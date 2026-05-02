import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { booleanQuery } from "../../lib/hostingRouteHelpers.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

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

router.get("/:id/ssh-keys", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteSshKeys(enhanceWebsiteOrgId, sub.enhance_website_id, {
      sanitize: booleanQuery(req.query.sanitize),
    });
    res.json({ keys: unwrapItems(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get SSH keys" });
  }
});

router.post("/:id/ssh-keys", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteSshKey(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create SSH key" });
  }
});

router.patch("/:id/ssh-keys/:keyId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWebsiteSshKey(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.keyId, req.body);
    res.json(result ?? { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update SSH key" });
  }
});

router.delete("/:id/ssh-keys/:keyId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteSshKey(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.keyId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete SSH key" });
  }
});

router.post("/:id/ssh-password", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const newPassword = String(req.body?.newPassword ?? req.body?.password ?? "").trim();
    if (!newPassword) return res.status(400).json({ error: "New SSH password is required" });
    const result = await EnhanceService.authorizeWebsiteSshPassword(enhanceWebsiteOrgId, sub.enhance_website_id, newPassword);
    res.status(201).json(result ?? { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set SSH password" });
  }
});

export default router;
