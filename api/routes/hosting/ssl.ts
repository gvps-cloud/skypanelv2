import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

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

// SSL
router.post("/:id/domains/:domainId/ssl", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.createWebsiteDomainLetsencryptCerts(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.status(202).json({ success: true, message: "Let's Encrypt certificate generation started" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to generate SSL" });
  }
});

router.post("/:id/domains/:domainId/mail_ssl", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.createWebsiteMailDomainLetsencryptCerts(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.status(202).json({ success: true, message: "Mail Let's Encrypt certificate generation started" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to generate mail SSL" });
  }
});

router.get("/:id/domains/:domainId/ssl", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteDomainSsl(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.json({
      ssl: result ?? null,
      sslActive: Boolean(result),
      forceSsl: Boolean(result?.forceHttps ?? result?.force_https),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get SSL status" });
  }
});

router.post("/:id/domains/:domainId/ssl/upload", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.uploadWebsiteDomainSsl(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to upload SSL certificate" });
  }
});

router.get("/:id/domains/:domainId/mail_ssl", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteDomainMailSsl(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get mail SSL status" });
  }
});

router.post("/:id/domains/:domainId/mail_ssl/upload", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.uploadWebsiteDomainMailSsl(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to upload mail SSL certificate" });
  }
});

router.put("/:id/domains/:domainId/force_ssl", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    if (!(await ensureDomainBelongsToWebsite(sub, req.params.domainId, res))) return;
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled ?? req.body?.forceSsl);
    await EnhanceService.setWebsiteDomainForceSsl(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.domainId, enabled);
    res.json({ success: true, forceSsl: enabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set force SSL" });
  }
});

export default router;
