import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeDnsRecord(record: any) {
  return {
    id: record?.id ?? undefined,
    type: record?.kind ?? record?.type ?? "",
    name: record?.name ?? "",
    value: record?.value ?? "",
    ttl: typeof record?.ttl === "number" ? record.ttl : (typeof record?.ttl === "string" ? parseInt(record.ttl, 10) : 3600),
    proxy: record?.proxy ?? false,
  };
}

function toEnhanceDnsRecord(body: any) {
  const { type, ...rest } = body;
  return {
    ...rest,
    kind: type ?? body.kind,
  };
}

function normalizeDomainMapping(domain: any) {
  const cert = domain?.cert ?? null;
  return {
    id: String(domain?.id ?? domain?.domainId ?? domain?.domain_id ?? ""),
    domain: String(domain?.domain ?? domain?.name ?? ""),
    is_primary: Boolean(domain?.is_primary ?? domain?.mappingKind === "primary"),
    mappingKind: domain?.mappingKind ?? null,
    documentRoot: domain?.documentRoot ?? domain?.document_root ?? null,
    cert,
    sslActive: Boolean(cert),
    forceSsl: Boolean(cert?.forceHttps ?? cert?.force_https),
  };
}

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  const subscription = await getHostingSubscriptionForOrganization(id, organizationId);
  if (!subscription) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  return subscription;
}

function requireWebsiteId(subscription: any, res: Response): string | null {
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }

  return String(subscription.enhance_website_id);
}

// Domain Mappings
router.get("/:id/domains", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const domains = await EnhanceService.getWebsiteDomainMappings(
      enhanceWebsiteOrgId,
      websiteId,
      { withSsl: req.query.withSsl === "true" },
    );
    res.json({ domains: unwrapItems(domains).map(normalizeDomainMapping) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get domains" });
  }
});

router.post("/:id/domains", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteMappedDomain(enhanceWebsiteOrgId, websiteId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to add domain" });
  }
});

// DNS Zone
router.get("/:id/domains/:domainId/dns", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const zone = await EnhanceService.getWebsiteDomainDnsZone(enhanceWebsiteOrgId, websiteId, req.params.domainId);
    res.json({
      domain: zone?.domain ?? "",
      records: Array.isArray(zone?.records) ? zone.records.map(normalizeDnsRecord) : [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get DNS zone" });
  }
});

router.post("/:id/domains/:domainId/dns/records", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteDomainDnsZoneRecord(enhanceWebsiteOrgId, websiteId, req.params.domainId, toEnhanceDnsRecord(req.body));
    res.json(normalizeDnsRecord(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create DNS record" });
  }
});

router.patch("/:id/domains/:domainId/dns/records/:recordId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWebsiteDomainDnsZoneRecord(
      enhanceWebsiteOrgId, websiteId, req.params.domainId, req.params.recordId, toEnhanceDnsRecord(req.body),
    );
    res.json(normalizeDnsRecord(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update DNS record" });
  }
});

router.delete("/:id/domains/:domainId/dns/records/:recordId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteDomainDnsZoneRecord(
      enhanceWebsiteOrgId, websiteId, req.params.domainId, req.params.recordId,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete DNS record" });
  }
});

router.delete("/:id/domains/:domainId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteDomainMapping(enhanceWebsiteOrgId, websiteId, req.params.domainId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete domain" });
  }
});

router.put("/:id/domains/primary", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const domainId = String(req.body?.domainId ?? "").trim();
    if (!domainId) {
      return res.status(400).json({ error: "Domain ID is required" });
    }

    const domainMapping = await EnhanceService.getWebsiteDomainMapping(enhanceWebsiteOrgId, websiteId, domainId);
    await EnhanceService.updateWebsitePrimaryDomain(enhanceWebsiteOrgId, websiteId, req.body);

    const primaryDomain = String(domainMapping?.domain ?? "").trim();
    if (primaryDomain) {
      await query(
        `UPDATE hosting_subscriptions SET domain = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
        [primaryDomain, sub.id, sub.organization_id],
      );
    }

    res.json({ success: true, domain: primaryDomain || null });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set primary domain" });
  }
});

export default router;
