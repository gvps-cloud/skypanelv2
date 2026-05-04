import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { config } from "../../config/index.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  const sub = await getHostingSubscriptionForOrganization(id, organizationId);
  if (!sub) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  if (!sub.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }
  return sub;
}

function getEnhancePanelOrigin(): string {
  const panelUrl = config.ENHANCE_API_URL.replace(/\/api\/?$/i, "");
  return new URL(panelUrl).origin;
}

function readAccessToken(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const token = (value as Record<string, unknown>).accessToken ?? (value as Record<string, unknown>).token;
    if (typeof token === "string") return token.trim();
  }
  return "";
}

function buildFileManagerUrl(filerdAddress: string, rawAccessToken: unknown): string {
  const accessToken = readAccessToken(rawAccessToken);
  if (!accessToken) {
    throw new EnhanceApiError("Enhance did not return a site access token", 502);
  }

  const address = filerdAddress.trim();
  if (!address) {
    throw new EnhanceApiError("File manager is not available for this website", 404);
  }

  const url = /^https?:\/\//i.test(address)
    ? new URL(address)
    : new URL(address.startsWith("/") ? address : `/${address}`, getEnhancePanelOrigin());
  url.searchParams.set("accessToken", accessToken);
  return url.toString();
}

function normalizeWebsiteStatus(website: any) {
  if (!website || typeof website !== "object" || Array.isArray(website)) {
    return website;
  }

  const status = typeof website.status === "string" ? website.status.toLowerCase() : "";
  const suspendedBy = typeof website.suspendedBy === "string" ? website.suspendedBy.trim() : "";
  const isSuspended = website.isSuspended === true || status === "disabled" || suspendedBy.length > 0;
  const normalizedStatus = status === "deleted"
    ? "deleted"
    : isSuspended
      ? "suspended"
      : status === "active"
        ? "active"
        : "unknown";

  return {
    ...website,
    isSuspended,
    normalizedStatus,
  };
}

const WEBSERVER_KINDS = new Set(["liteSpeed", "openLiteSpeed", "dummyWebServer", "apache", "nginx"]);

function normalizeWebserverKind(kind: unknown) {
  return typeof kind === "string" && WEBSERVER_KINDS.has(kind) ? kind : "unknown";
}

function readVhostWebserverKind(kind: unknown): "apache" | "nginx" | null {
  return kind === "apache" || kind === "nginx" ? kind : null;
}

const REDIS_OPERATIONS = [
  {
    method: "GET",
    operationId: "getWebsiteRedisState",
    enhancePath: "/v2/websites/{website_id}/redis",
  },
  {
    method: "PUT",
    operationId: "setWebsiteRedisState",
    enhancePath: "/v2/websites/{website_id}/redis",
  },
] as const;

function readRedisAllowed(website: any): boolean | null {
  const redisAllowed = website?.canUse?.redis;
  return typeof redisAllowed === "boolean" ? redisAllowed : null;
}

async function getRedisAllowedForWebsite(sub: any) {
  const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
  const website = await EnhanceService.getWebsite(enhanceWebsiteOrgId, sub.enhance_website_id);
  return readRedisAllowed(website);
}

function normalizeWebsiteUpdatePayload(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const payload = { ...body };
  if (typeof payload.isSuspended === "boolean") {
    payload.status = payload.isSuspended ? "disabled" : "active";
  } else if (payload.status === "suspended") {
    payload.status = "disabled";
    payload.isSuspended = true;
  } else if (payload.status === "disabled") {
    payload.isSuspended = true;
  } else if (payload.status === "active") {
    payload.isSuspended = false;
  }
  return payload;
}

async function updateWebsiteAndReadFresh(sub: any, body: any) {
  const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
  await EnhanceService.updateWebsite(
    enhanceWebsiteOrgId,
    sub.enhance_website_id,
    normalizeWebsiteUpdatePayload(body),
  );
  const website = await EnhanceService.getWebsite(enhanceWebsiteOrgId, sub.enhance_website_id);
  return normalizeWebsiteStatus(website);
}

async function ensureDomainBelongsToWebsite(sub: any, domainId: string, res: Response) {
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.getWebsiteDomainMapping(enhanceWebsiteOrgId, sub.enhance_website_id, domainId);
    return true;
  } catch (error) {
    if (error instanceof EnhanceApiError && error.statusCode === 404) {
      res.status(404).json({ error: "Domain not found" });
      return false;
    }

    throw error;
  }
}

// ============================================================
// Website status / suspend + PHP version
// ============================================================

router.get("/:id/website", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsite(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json(normalizeWebsiteStatus(result));
  } catch (error: any) {
    if (error instanceof EnhanceApiError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Failed to get website" });
  }
});

router.get("/:id/webserver-kind", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const kind = await EnhanceService.getWebsiteWebserverKind(sub.enhance_website_id);
    res.json({ kind: normalizeWebserverKind(kind) });
  } catch (error: any) {
    if (error instanceof EnhanceApiError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Failed to get webserver kind" });
  }
});

router.post("/:id/file-manager", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const [website, accessToken] = await Promise.all([
      EnhanceService.getWebsite(enhanceWebsiteOrgId, sub.enhance_website_id),
      EnhanceService.getSiteAccessToken(enhanceWebsiteOrgId, sub.enhance_website_id),
    ]);

    const filerdAddress = String(website?.filerdAddress ?? website?.filerd_address ?? "").trim();
    const fileManagerUrl = buildFileManagerUrl(filerdAddress, accessToken);
    res.json({ url: fileManagerUrl, filerdAddress });
  } catch (error: any) {
    if (error instanceof EnhanceApiError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Failed to open file manager" });
  }
});

router.patch("/:id/website", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const website = await updateWebsiteAndReadFresh(sub, req.body);
    res.json(website);
  } catch (error: any) {
    if (error instanceof EnhanceApiError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Failed to update website" });
  }
});

// Legacy PUT for backward compat
router.put("/:id/website", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const website = await updateWebsiteAndReadFresh(sub, req.body);
    res.json(website);
  } catch (error: any) {
    if (error instanceof EnhanceApiError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 404)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error?.message || "Failed to update website" });
  }
});

// ============================================================
// PHP Settings (LSPHP)
// ============================================================

router.get("/:id/php", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const settings = await EnhanceService.getWebsiteLsphpSettings(sub.enhance_website_id);
    res.json(settings);
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({});
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get PHP settings" });
  }
});

router.put("/:id/php", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.setWebsiteLsphpSettings(sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update PHP settings" });
  }
});

router.post("/:id/php/restart", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.restartWebsitePhp(sub.enhance_website_id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to restart PHP" });
  }
});

// ============================================================
// PHP Error Log
// ============================================================

router.get("/:id/php/error-log", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const log = await EnhanceService.getWebsitePhpErrorLog(sub.enhance_website_id);
    res.json({ log });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ log: "" });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get PHP error log" });
  }
});

// ============================================================
// PHP Extensions
// ============================================================

router.get("/:id/php/extensions", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enabled = await EnhanceService.getWebsiteEnabledPhpExtensions(sub.enhance_website_id);
    res.json({ extensions: enabled });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ extensions: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get PHP extensions" });
  }
});

router.get("/:id/php/extensions/available", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const available = await EnhanceService.getWebsiteAvailablePhpExtensions(sub.enhance_website_id);
    res.json({ extensions: available });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ extensions: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get available PHP extensions" });
  }
});

router.get("/:id/php/extensions/built-in", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const builtIn = await EnhanceService.getBuiltInPhpExtensions(sub.enhance_website_id);
    res.json({ extensions: builtIn });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ extensions: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get built-in PHP extensions" });
  }
});

router.post("/:id/php/extensions/:name", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.enableWebsitePhpExtension(sub.enhance_website_id, req.params.name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to enable PHP extension" });
  }
});

router.delete("/:id/php/extensions/:name", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.disableWebsitePhpExtension(sub.enhance_website_id, req.params.name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to disable PHP extension" });
  }
});

// ============================================================
// PHP.ini Settings
// ============================================================

router.get("/:id/php/ini", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const settings = await EnhanceService.getWebsiteSetting(enhanceWebsiteOrgId, sub.enhance_website_id, "phpIni");
    
    const items = [];
    if (settings && typeof settings === 'object') {
      for (const [key, obj] of Object.entries(settings)) {
        if (obj && typeof obj === 'object' && 'value' in obj) {
          items.push({ key, value: String((obj as any).value) });
        } else {
          items.push({ key, value: String(obj) });
        }
      }
    }
    
    res.json({ items });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ items: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get PHP.ini settings" });
  }
});

router.put("/:id/php/ini/:key", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const value = typeof req.body === 'object' && req.body !== null && 'value' in req.body ? req.body.value : req.body;
    await EnhanceService.setWebsiteSetting(enhanceWebsiteOrgId, sub.enhance_website_id, "phpIni", req.params.key, value);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set PHP.ini setting" });
  }
});

router.delete("/:id/php/ini/:key", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteSetting(enhanceWebsiteOrgId, sub.enhance_website_id, "phpIni", req.params.key);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete PHP.ini setting" });
  }
});

// ============================================================
// Ioncube
// ============================================================

router.get("/:id/ioncube", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enabled = await EnhanceService.getWebsiteIoncubeStatus(sub.enhance_website_id);
    res.json({ enabled });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ enabled: false });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get ioncube status" });
  }
});

router.put("/:id/ioncube", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled);
    await EnhanceService.setWebsiteIoncubeStatus(sub.enhance_website_id, enabled);
    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set ioncube status" });
  }
});

// ============================================================
// Redis
// ============================================================

router.get("/:id/redis", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const allowed = await getRedisAllowedForWebsite(sub);
    let enabled = false;
    let status: "available" | "not_in_plan" | "unavailable" = allowed === false ? "not_in_plan" : "available";

    if (allowed !== false) {
      try {
        enabled = Boolean(await EnhanceService.getWebsiteRedisState(sub.enhance_website_id));
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 400 || error?.statusCode === 403) {
          enabled = false;
          status = "unavailable";
        } else {
          throw error;
        }
      }
    }

    res.json({ enabled, allowed, status, operations: REDIS_OPERATIONS });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ enabled: false, allowed: null, status: "unavailable", operations: REDIS_OPERATIONS });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get redis status" });
  }
});

router.put("/:id/redis", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const allowed = await getRedisAllowedForWebsite(sub);
    if (allowed === false) {
      res.status(403).json({ error: "Redis is not available for this hosting plan" });
      return;
    }

    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled);
    await EnhanceService.setWebsiteRedisState(sub.enhance_website_id, enabled);
    res.json({ success: true, enabled, allowed, status: "available", operations: REDIS_OPERATIONS });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set redis status" });
  }
});

// ============================================================
// Metrics
// ============================================================

router.get("/:id/metrics", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const { start, end, granularity } = req.query;
    const params: Record<string, string> = {};
    if (start) params.start = String(start);
    if (end) params.end = String(end);
    if (granularity) params.granularity = String(granularity);
    const result = await EnhanceService.getWebsiteMetrics(enhanceWebsiteOrgId, sub.enhance_website_id, params);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get metrics" });
  }
});

// ============================================================
// .htaccess Rewrites
// ============================================================

router.get("/:id/htaccess", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteHtaccessRewrites(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json(result);
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ items: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get .htaccess rewrites" });
  }
});

router.patch("/:id/htaccess", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWebsiteHtaccessRewrites(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update .htaccess rewrites" });
  }
});

// ============================================================
// .htaccess IP Rules
// ============================================================

router.get("/:id/htaccess/ips", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteHtaccessIpsRule(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json(result);
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ kind: null, ips: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get IP rules" });
  }
});

router.put("/:id/htaccess/ips", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWebsiteHtaccessIpsRule(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update IP rules" });
  }
});

// ============================================================
// Nginx FastCGI Cache (domain-scoped)
// ============================================================

router.get("/:id/domains/:domainId/nginx-fastcgi", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enabled = await EnhanceService.getDomainNginxFastCgi(req.params.domainId);
    res.json({ enabled });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ enabled: false });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get FastCGI status" });
  }
});

router.put("/:id/domains/:domainId/nginx-fastcgi", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled);
    await EnhanceService.setDomainNginxFastCgi(req.params.domainId, enabled);
    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set FastCGI status" });
  }
});

router.delete("/:id/domains/:domainId/nginx-fastcgi", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    await EnhanceService.clearDomainNginxFastCgi(req.params.domainId);
    res.json({ success: true, message: "FastCGI cache purged" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to purge FastCGI cache" });
  }
});

router.get("/:id/domains/:domainId/nginx-fastcgi/excluded-paths", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const paths = await EnhanceService.getDomainNginxFastCgiExcludedPaths(req.params.domainId);
    res.json({ paths });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ paths: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get excluded paths" });
  }
});

router.post("/:id/domains/:domainId/nginx-fastcgi/excluded-paths", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const path = typeof req.body === "string" ? req.body : req.body?.path;
    if (!path) {
      res.status(400).json({ error: "Path is required" });
      return;
    }
    await EnhanceService.addDomainNginxFastCgiExcludedPath(req.params.domainId, path);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to add excluded path" });
  }
});

router.delete("/:id/domains/:domainId/nginx-fastcgi/excluded-paths", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ error: "Path query parameter is required" });
      return;
    }
    await EnhanceService.deleteDomainNginxFastCgiExcludedPath(req.params.domainId, path);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete excluded path" });
  }
});

// ============================================================
// ModSecurity (domain-scoped)
// ============================================================

router.get("/:id/domains/:domainId/modsec-status", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const result = await EnhanceService.getWebsiteDomainModSecStatus(req.params.domainId);
    res.json({ enabled: Boolean(result?.enabled) });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ enabled: false });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get ModSecurity status" });
  }
});

router.put("/:id/domains/:domainId/modsec-status", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled);
    await EnhanceService.setWebsiteDomainModSecStatus(req.params.domainId, enabled);
    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set ModSecurity status" });
  }
});

// ============================================================
// Custom vhost (Apache/Nginx domain-scoped)
// ============================================================

router.get("/:id/domains/:domainId/vhost", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const result = await EnhanceService.getWebsiteDomainVhost(req.params.domainId);
    res.json({
      contents: typeof result?.contents === "string" ? result.contents : "",
      webserver: readVhostWebserverKind(result?.webserver),
    });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ contents: "", webserver: null });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get vhost" });
  }
});

router.put("/:id/domains/:domainId/vhost", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const webserver = readVhostWebserverKind(req.body?.webserver);
    if (!webserver) {
      res.status(400).json({ error: "Vhost webserver must be apache or nginx" });
      return;
    }
    await EnhanceService.setWebsiteDomainVhost(req.params.domainId, {
      contents: typeof req.body?.contents === "string" ? req.body.contents : "",
      webserver,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to save vhost" });
  }
});

router.delete("/:id/domains/:domainId/vhost", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const webserver = readVhostWebserverKind(req.body?.webserver);
    if (!webserver) {
      res.status(400).json({ error: "Vhost webserver must be apache or nginx" });
      return;
    }
    await EnhanceService.deleteWebsiteDomainVhost(req.params.domainId, webserver);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete vhost" });
  }
});

// ============================================================
// Webserver Rewrites (domain-scoped)
// ============================================================

router.get("/:id/domains/:domainId/webserver-rewrites", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const rewrites = await EnhanceService.getDomainWebserverRewrites(req.params.domainId);
    res.json({ rewrites });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 400) {
      res.json({ rewrites: [] });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get webserver rewrites" });
  }
});

router.put("/:id/domains/:domainId/webserver-rewrites", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    await EnhanceService.setDomainWebserverRewrite(req.params.domainId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set webserver rewrite" });
  }
});

router.delete("/:id/domains/:domainId/webserver-rewrites", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const path = req.query.path as string;
    if (!path) {
      res.status(400).json({ error: "Path query parameter is required" });
      return;
    }
    await EnhanceService.deleteDomainWebserverRewrite(req.params.domainId, path);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete webserver rewrite" });
  }
});

// ============================================================
// Mail Domain SSL (domain-scoped)
// ============================================================

router.post("/:id/domains/:domainId/mail-ssl", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.createWebsiteMailDomainLetsencryptCerts(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.status(202).json({ success: true, message: "Mail SSL certificate generation started" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to generate mail SSL" });
  }
});

export default router;
