import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceService } from "../../services/enhanceService.js";
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
  return subscription;
}

// Node Apps
router.get("/:id/apps", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const apps = await EnhanceService.getWebsiteApps(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json(apps);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get apps" });
  }
});

router.post("/:id/apps", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteApp(enhanceWebsiteOrgId, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create app" });
  }
});

router.delete("/:id/apps/:appId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteApp(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete app" });
  }
});

// Persistent Apps
router.get("/:id/persistent-apps", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const apps = await EnhanceService.getWebsitePersistentApps(sub.enhance_website_id);
    res.json(apps);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get persistent apps" });
  }
});

export default router;
