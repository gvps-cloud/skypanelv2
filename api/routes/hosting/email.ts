import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { config } from "../../config/index.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { unwrapItems } from "../../lib/unwrapItems.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

function normalizeEmail(email: any) {
  const quota = email?.quota;
  return {
    address: String(email?.address ?? ""),
    mailboxName: email?.mailboxName ?? null,
    aliases: Array.isArray(email?.aliases) ? email.aliases : [],
    forwarders: Array.isArray(email?.forwarders) ? email.forwarders : undefined,
    status: email?.status ?? null,
    hasMailbox: Boolean(email?.hasMailbox),
    quota: typeof quota === "object" && quota !== null ? quota.total : quota ?? null,
    quotaUsage: typeof quota === "object" && quota !== null ? quota.usage : null,
    forwardersCount: Number(email?.forwardersCount ?? 0),
    autorespondersCount: email?.autorespondersCount ?? null,
    isCatchAll: Boolean(email?.isCatchAll),
    createdAt: email?.createdAt ?? null,
    ssoAvailable: Boolean(email?.ssoAvailable),
  };
}

function normalizeQuota(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  return Math.max(0, Math.trunc(numericValue));
}

function normalizeStringArray(value: any): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function getEnhanceErrorMessage(error: EnhanceApiError, fallbackMessage: string): string {
  const body = error.responseBody;
  if (typeof body === "string" && body.trim()) return body;

  if (body && typeof body === "object") {
    const responseBody = body as Record<string, any>;
    if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
      const firstError = responseBody.errors[0];
      if (typeof firstError === "string") return firstError;
      if (firstError && typeof firstError === "object") {
        const nestedMessage = firstError.reason ?? firstError.message ?? firstError.error;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
      }
    }

    const message = responseBody.detail ?? responseBody.message ?? responseBody.reason ?? responseBody.error;
    if (typeof message === "string" && message.trim()) return message;
    if (message && typeof message === "object" && typeof message.message === "string") return message.message;
  }

  return error.message || fallbackMessage;
}

function sendEmailError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof EnhanceApiError) {
    res.status(error.statusCode ?? 500).json({ error: getEnhanceErrorMessage(error, fallbackMessage) });
    return;
  }

  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}

function toEnhanceNewEmail(body: any, username: string) {
  const payload: Record<string, any> = { username };
  const mailboxPassword = body?.mailboxPassword ?? body?.password;
  const quota = normalizeQuota(body?.quota);
  const forwarders = normalizeStringArray(body?.forwarders);
  const aliases = normalizeStringArray(body?.aliases);

  if (typeof body?.mailboxName === "string" && body.mailboxName.trim()) payload.mailboxName = body.mailboxName.trim();
  if (typeof mailboxPassword === "string" && mailboxPassword.length > 0) payload.mailboxPassword = mailboxPassword;
  if (quota !== undefined) payload.quota = quota;
  if (forwarders) payload.forwarders = forwarders;
  if (aliases) payload.aliases = aliases;
  if (typeof body?.isCatchAll === "boolean") payload.isCatchAll = body.isCatchAll;

  return payload;
}

function toEnhanceUpdateEmail(body: any) {
  const payload: Record<string, any> = {};
  const mailboxPassword = body?.mailboxPassword ?? body?.password;
  const quota = normalizeQuota(body?.quota);
  const forwarders = normalizeStringArray(body?.forwarders);
  const aliases = normalizeStringArray(body?.aliases);
  const blacklist = normalizeStringArray(body?.blacklist);
  const whitelist = normalizeStringArray(body?.whitelist);

  if (typeof body?.mailboxName === "string" && body.mailboxName.trim()) payload.mailboxName = body.mailboxName.trim();
  if (typeof mailboxPassword === "string" && mailboxPassword.length > 0) payload.mailboxPassword = mailboxPassword;
  if (quota !== undefined) payload.quota = quota;
  if (forwarders) payload.forwarders = forwarders;
  if (aliases) payload.aliases = aliases;
  if (blacklist) payload.blacklist = blacklist;
  if (whitelist) payload.whitelist = whitelist;
  if (typeof body?.hasMailbox === "boolean") payload.hasMailbox = body.hasMailbox;
  if (typeof body?.isCatchAll === "boolean") payload.isCatchAll = body.isCatchAll;
  if (typeof body?.status === "string" && body.status.trim()) payload.status = body.status.trim();

  return payload;
}

function splitEmailAddress(address: string) {
  const trimmed = address.trim();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;
  return {
    username: trimmed.slice(0, atIndex),
    domain: trimmed.slice(atIndex + 1).toLowerCase(),
  };
}

const EMAIL_DOMAIN_NOTE = "Email creation can only use customer-owned domains mapped to this website in Enhance. Preview, staging, and internal Enhance domains are not valid mailbox domains.";

function normalizeDomainName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\.$/, "");
}

function collectDomainLikeValues(value: unknown, names: Set<string>) {
  if (!value) return;
  if (typeof value === "string") {
    const normalized = normalizeDomainName(value);
    if (normalized) names.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectDomainLikeValues(item, names));
    return;
  }
  if (isRecord(value)) {
    for (const nestedValue of Object.values(value)) {
      collectDomainLikeValues(nestedValue, names);
    }
  }
}

function getKnownPreviewDomains(serverDomains: unknown, stagingDomain: string | null): Set<string> {
  const names = new Set<string>();
  if (stagingDomain) names.add(normalizeDomainName(stagingDomain));

  if (isRecord(serverDomains)) {
    for (const [key, value] of Object.entries(serverDomains)) {
      const keyName = key.toLowerCase();
      if (keyName.includes("staging") || keyName.includes("preview") || keyName.includes("internal")) {
        collectDomainLikeValues(value, names);
      }
    }
  }

  return names;
}

function isPreviewDomain(domainName: string, previewDomains: Set<string>): boolean {
  const normalized = normalizeDomainName(domainName);
  if (!normalized) return true;

  for (const previewDomain of previewDomains) {
    if (normalized === previewDomain || normalized.endsWith(`.${previewDomain}`)) {
      return true;
    }
  }

  return false;
}

function normalizeMappedEmailDomain(domain: any, previewDomains: Set<string>) {
  const id = String(domain?.id ?? domain?.domainId ?? domain?.domain_id ?? "");
  const domainName = normalizeDomainName(domain?.domain ?? domain?.name);
  const mappingKind = String(domain?.mappingKind ?? domain?.mapping_kind ?? domain?.kind ?? "").toLowerCase();
  const isInternalMapping = ["preview", "staging", "internal", "serverhostname", "server-hostname"].includes(mappingKind);
  const emailEligible = Boolean(id && domainName && !isInternalMapping && !isPreviewDomain(domainName, previewDomains));

  return {
    id,
    domain: domainName,
    is_primary: Boolean(domain?.is_primary ?? domain?.isPrimary ?? domain?.mappingKind === "primary"),
    mappingKind: domain?.mappingKind ?? domain?.mapping_kind ?? null,
    emailEligible,
  };
}

async function getEligibleEmailDomains(orgId: string, websiteId: string) {
  const [domains, serverDomains, stagingDomain] = await Promise.all([
    EnhanceService.getWebsiteDomainMappings(orgId, websiteId),
    EnhanceService.getWebsiteServerDomains(orgId, websiteId).catch(() => null),
    config.ENHANCE_MASTER_ORG_ID
      ? EnhanceService.getStagingDomain(config.ENHANCE_MASTER_ORG_ID).catch(() => null)
      : Promise.resolve(null),
  ]);

  const previewDomains = getKnownPreviewDomains(serverDomains, stagingDomain);
  const allDomains = unwrapItems(domains)
    .map((domain: any) => normalizeMappedEmailDomain(domain, previewDomains))
    .filter((domain: any) => domain.id && domain.domain);

  return {
    domains: allDomains.filter((domain: any) => domain.emailEligible),
    excludedCount: allDomains.filter((domain: any) => !domain.emailEligible).length,
    stagingDomains: Array.from(previewDomains),
  };
}

function hasConfigValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNestedConfigValue(data: Record<string, any>, keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (hasConfigValue(current)) return current;
  }
  return undefined;
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstConfigValue(values: unknown[]): unknown {
  return values.find(hasConfigValue);
}

function firstArrayString(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  return firstString(value);
}

function setMissing(record: Record<string, any>, key: string, value: unknown) {
  if (!hasConfigValue(record[key]) && hasConfigValue(value)) {
    record[key] = value;
  }
}

function ensureProtocolRecord(config: Record<string, any>, key: "imap" | "smtp" | "pop3") {
  const current = config[key];
  const protocolConfig = isRecord(current) ? { ...current } : {};
  config[key] = protocolConfig;
  return protocolConfig;
}

async function resolveEmailClientHostname(orgId: string, websiteId: string, config: Record<string, any>) {
  const serverDomains = await EnhanceService.getWebsiteServerDomains(orgId, websiteId).catch((error) => {
    console.warn("Failed to fetch website server domains for email client config:", error);
    return null;
  });

  const emailServerDomain = firstArrayString(serverDomains?.emailServerDomains);
  if (emailServerDomain) {
    config.emailServerDomains = serverDomains?.emailServerDomains;
    return emailServerDomain;
  }

  const existingHostname = firstString([
    getNestedConfigValue(config, ["imap.host", "imap.hostname", "imap.server", "imapServer", "imapHost"]),
    getNestedConfigValue(config, ["smtp.host", "smtp.hostname", "smtp.server", "smtpServer", "smtpHost"]),
    getNestedConfigValue(config, ["pop3.host", "pop3.hostname", "pop3.server", "pop3Server", "pop3Host"]),
  ]);
  if (existingHostname) return existingHostname;

  const website = await EnhanceService.getWebsite(orgId, websiteId).catch((error) => {
    console.warn("Failed to fetch website for email client config:", error);
    return null;
  });
  if (!website?.emailServerId) return undefined;

  const override = await EnhanceService.getEmailServerHostnameOverride(website.emailServerId).catch((error) => {
    console.warn("Failed to fetch server hostname override for email client config:", error);
    return null;
  });
  const overrideHostname = firstString([override?.domain, override?.hostname]);
  if (overrideHostname) return overrideHostname;

  const server = await EnhanceService.getServer(website.emailServerId).catch((error) => {
    console.warn("Failed to fetch email server for client config:", error);
    return null;
  });
  return firstString([server?.hostname]);
}

function buildEmailClientConfig(rawConfig: unknown, emailAddress: string, hostname?: string) {
  const config = isRecord(rawConfig) ? { ...rawConfig } : {};
  const username = firstString([config.username, config.user, emailAddress]) ?? emailAddress;

  const protocolDefaults = [
    {
      key: "imap" as const,
      serverKey: "imapServer",
      portKey: "imapPort",
      sslKey: "imapSSL",
      defaultPort: 993,
    },
    {
      key: "smtp" as const,
      serverKey: "smtpServer",
      portKey: "smtpPort",
      sslKey: "smtpSSL",
      defaultPort: 465,
    },
    {
      key: "pop3" as const,
      serverKey: "pop3Server",
      portKey: "pop3Port",
      sslKey: "pop3SSL",
      defaultPort: 995,
    },
  ];

  setMissing(config, "username", username);

  for (const protocol of protocolDefaults) {
    const protocolConfig = ensureProtocolRecord(config, protocol.key);
    const protocolHostname = firstString([
      protocolConfig.host,
      protocolConfig.hostname,
      protocolConfig.server,
      config[protocol.serverKey],
      hostname,
    ]);
    const protocolPort = firstConfigValue([protocolConfig.port, config[protocol.portKey], protocol.defaultPort]);
    const protocolSsl = firstConfigValue([protocolConfig.ssl, protocolConfig.tls, config[protocol.sslKey], true]);

    setMissing(config, protocol.serverKey, protocolHostname);
    setMissing(config, protocol.portKey, protocolPort);
    setMissing(config, protocol.sslKey, protocolSsl);
    setMissing(protocolConfig, "host", protocolHostname);
    setMissing(protocolConfig, "port", config[protocol.portKey]);
    setMissing(protocolConfig, "ssl", config[protocol.sslKey]);
    setMissing(protocolConfig, "tls", config[protocol.sslKey]);
    setMissing(protocolConfig, "username", username);
  }

  return config;
}

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  const subscription = await getHostingSubscriptionForOrganization(id, organizationId);
  if (!subscription) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }
  return subscription;
}

// Email Boxes
router.get("/:id/domains", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const eligibleDomains = await getEligibleEmailDomains(enhanceWebsiteOrgId, sub.enhance_website_id);

    res.json({
      domains: eligibleDomains.domains,
      excludedCount: eligibleDomains.excludedCount,
      stagingDomains: eligibleDomains.stagingDomains,
      note: EMAIL_DOMAIN_NOTE,
    });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to get email domains");
  }
});

router.get("/:id/emails", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const emails = await EnhanceService.getWebsiteEmails(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({ emails: unwrapItems(emails).map(normalizeEmail) });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to get emails");
  }
});

router.post("/:id/emails", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const directUsername = String(req.body?.username ?? "").trim();
    let username = directUsername;
    let domainId = req.body?.domainId ? String(req.body.domainId) : "";

    if (!username || !domainId) {
      const parsed = splitEmailAddress(String(req.body?.address ?? req.body?.username ?? ""));
      if (!parsed) {
        return res.status(400).json({ error: "A valid email address is required" });
      }

      username = parsed.username;
      const eligibleDomains = await getEligibleEmailDomains(enhanceWebsiteOrgId, sub.enhance_website_id);
      const domain = eligibleDomains.domains.find((item: any) => item.domain === parsed.domain);
      domainId = String(domain?.id ?? "");
    }

    if (!domainId) {
      return res.status(400).json({ error: "Email domain is not eligible for mailbox creation on this hosting service" });
    }

    const eligibleDomains = await getEligibleEmailDomains(enhanceWebsiteOrgId, sub.enhance_website_id);
    const selectedDomain = eligibleDomains.domains.find((domain: any) => domain.id === domainId);
    if (!selectedDomain) {
      return res.status(400).json({ error: "Email domain is not eligible for mailbox creation on this hosting service" });
    }

    const payload = toEnhanceNewEmail(req.body, username);
    if (!payload.mailboxPassword && !payload.forwarders) {
      return res.status(400).json({ error: "Email account requires a mailbox password or at least one forwarder" });
    }

    const result = await EnhanceService.createWebsiteEmail(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      String(domainId),
      payload,
    );
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to create email");
  }
});

router.get("/:id/emails/:emailAddress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteEmail(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress);
    res.json(result);
  } catch (error: any) {
    sendEmailError(res, error, "Failed to get email");
  }
});

router.delete("/:id/emails/:emailAddress", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteEmail(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress);
    res.json({ success: true });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to delete email");
  }
});

router.patch("/:id/emails/:emailAddress", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const payload = toEnhanceUpdateEmail(req.body);
    const result = await EnhanceService.updateWebsiteEmail(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress, payload,
    );
    res.json(result);
  } catch (error: any) {
    sendEmailError(res, error, "Failed to update email");
  }
});

router.get("/:id/emails/:emailAddress/client-conf", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteEmailClientConf(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    const hostname = await resolveEmailClientHostname(enhanceWebsiteOrgId, sub.enhance_website_id, isRecord(result) ? result : {});
    res.json(buildEmailClientConfig(result, req.params.emailAddress, hostname));
  } catch (error: any) {
    sendEmailError(res, error, "Failed to get email client config");
  }
});

router.get("/:id/emails/:emailAddress/sso", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const url = await EnhanceService.getWebsiteEmailSsoUrl(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    res.json({ url });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to open webmail");
  }
});

router.get("/:id/emails/:emailAddress/autoresponder", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteEmailAutoresponder(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    res.json(result ?? {});
  } catch (error: any) {
    if (error instanceof EnhanceApiError && error.statusCode === 404) {
      return res.json(null);
    }
    sendEmailError(res, error, "Failed to get autoresponder");
  }
});

router.post("/:id/emails/:emailAddress/autoresponder", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteEmailAutoresponder(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress, req.body,
    );
    res.json(result);
  } catch (error: any) {
    sendEmailError(res, error, "Failed to create autoresponder");
  }
});

router.get("/:id/emails/:emailAddress/spam-thresholds", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getEmailSpamThresholds(sub.enhance_website_id, req.params.emailAddress);
    res.json(result ?? {});
  } catch (error: any) {
    sendEmailError(res, error, "Failed to get spam thresholds");
  }
});

router.put("/:id/emails/:emailAddress/spam-thresholds", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.setEmailSpamThresholds(sub.enhance_website_id, req.params.emailAddress, req.body);
    res.json(result ?? { success: true });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to set spam thresholds");
  }
});

router.delete("/:id/emails/:emailAddress/autoresponder", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteEmailAutoresponder(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.emailAddress,
    );
    res.json({ success: true });
  } catch (error: any) {
    sendEmailError(res, error, "Failed to delete autoresponder");
  }
});

export default router;
