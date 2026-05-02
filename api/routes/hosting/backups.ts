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

router.get("/:id/backups", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteBackups(enhanceWebsiteOrgId, websiteId);
    res.json({ backups: unwrapItems(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backups" });
  }
});

router.post("/:id/backups", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.backupWebsite(enhanceWebsiteOrgId, websiteId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create backup" });
  }
});

router.get("/:id/backups/:backupId", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backup" });
  }
});

router.put("/:id/backups/:backupId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.restoreWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to restore backup" });
  }
});

router.delete("/:id/backups/:backupId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete backup" });
  }
});

router.get("/:id/backup-status", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteBackupStatus(enhanceWebsiteOrgId, websiteId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backup status" });
  }
});

router.get("/:id/backups-disabled", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const result = await EnhanceService.getBackupsDisabled(websiteId);
    res.json({ disabled: Boolean(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backups disabled status" });
  }
});

router.put("/:id/backups-disabled", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const disabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.disabled);
    await EnhanceService.setBackupsDisabled(websiteId, disabled);
    res.json({ disabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set backups disabled" });
  }
});

export default router;
