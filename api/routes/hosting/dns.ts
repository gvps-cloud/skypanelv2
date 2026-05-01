import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

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

// Domain Mappings
router.get("/:id/domains", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const domains = await EnhanceService.getWebsiteDomainMappings(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
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
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteMappedDomain(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to add domain" });
  }
});

// DNS Zone
router.get("/:id/domains/:domainId/dns", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const zone = await EnhanceService.getWebsiteDomainDnsZone(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.json(zone);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get DNS zone" });
  }
});

router.post("/:id/domains/:domainId/dns/records", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteDomainDnsZoneRecord(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create DNS record" });
  }
});

router.put("/:id/domains/:domainId/dns/records/:recordId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWebsiteDomainDnsZoneRecord(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, req.params.recordId, req.body,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update DNS record" });
  }
});

router.delete("/:id/domains/:domainId/dns/records/:recordId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteDomainDnsZoneRecord(
      enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, req.params.recordId,
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete DNS record" });
  }
});

router.delete("/:id/domains/:domainId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteDomainMapping(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete domain" });
  }
});

router.put("/:id/domains/primary", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWebsitePrimaryDomain(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set primary domain" });
  }
});

export default router;
