import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import {
  normalizeBackupStatus,
  normalizeHostingBackup,
  parseBackupDownloadKind,
  parseBackupStorageKind,
  type BackupDownloadKind,
  type BackupStorageKind,
} from "../../lib/hostingBackups.js";
import { unwrapItems } from "../../lib/unwrapItems.js";
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
  return subscription;
}

function requireWebsiteId(subscription: any, res: Response): string | null {
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }

  return String(subscription.enhance_website_id);
}

function queryStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function readStorageKind(req: Request, res: Response): BackupStorageKind | undefined | null {
  try {
    return parseBackupStorageKind(queryStringValue(req.query.storageKind));
  } catch {
    res.status(400).json({ error: "Invalid storageKind" });
    return null;
  }
}

function readDownloadKind(req: Request, res: Response): BackupDownloadKind | null {
  try {
    return parseBackupDownloadKind(queryStringValue(req.query.backupDownloadKind));
  } catch {
    res.status(400).json({ error: "Invalid backupDownloadKind" });
    return null;
  }
}

function isEnhanceNotFound(error: unknown): boolean {
  return error instanceof EnhanceApiError && error.statusCode === 404;
}

router.get("/:id/backups", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteBackups(enhanceWebsiteOrgId, websiteId);
    res.json({ backups: unwrapItems(result).map(normalizeHostingBackup) });
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
  const storageKind = readStorageKind(req, res);
  if (storageKind === null) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId, { storageKind });
    res.json({ backup: normalizeHostingBackup(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backup" });
  }
});

router.put("/:id/backups/:backupId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  const storageKind = readStorageKind(req, res);
  if (storageKind === null) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.restoreWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId, {
      ...req.body,
      storageKind,
    });
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
  const storageKind = readStorageKind(req, res);
  if (storageKind === null) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteBackup(enhanceWebsiteOrgId, websiteId, req.params.backupId, { storageKind });
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
    res.json({ status: normalizeBackupStatus(result) });
  } catch (error: any) {
    if (isEnhanceNotFound(error)) {
      res.json({ status: null });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get backup status" });
  }
});

router.get("/:id/backups/:backupId/restore-status", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteRestoreStatus(enhanceWebsiteOrgId, websiteId, req.params.backupId);
    res.json({ status: normalizeBackupStatus(result) });
  } catch (error: any) {
    if (isEnhanceNotFound(error)) {
      res.json({ status: null });
      return;
    }
    res.status(500).json({ error: error?.message || "Failed to get restore status" });
  }
});

router.get("/:id/backups/:backupId/directory-tree", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const offset = queryStringValue(req.query.offset);
    const result = await EnhanceService.getWebsiteBackupDirectoryTree(
      enhanceWebsiteOrgId,
      websiteId,
      req.params.backupId,
      offset,
    );
    res.json({ nodes: Array.isArray(result) ? result : unwrapItems(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get backup directory tree" });
  }
});

router.get("/:id/backup/download", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  const backupDownloadKind = readDownloadKind(req, res);
  if (!backupDownloadKind) return;
  try {
    const result = await EnhanceService.downloadWebsiteBackup(websiteId, backupDownloadKind);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      result.contentDisposition || `attachment; filename="${backupDownloadKind}-backup.tar.gz"`,
    );
    res.send(result.data);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to download backup" });
  }
});

router.post(
  "/:id/backup/upload",
  requireOrgPermission("hosting_manage"),
  express.raw({ type: ["application/gzip", "application/x-gzip", "application/octet-stream"], limit: "512mb" }),
  async (req: Request, res: Response) => {
    const sub = await resolveSubscription(req, res);
    if (!sub) return;
    const websiteId = requireWebsiteId(sub, res);
    if (!websiteId) return;
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (body.length === 0) {
      res.status(400).json({ error: "Backup archive is required" });
      return;
    }
    try {
      await EnhanceService.uploadWebsiteBackup(websiteId, body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to upload backup" });
    }
  },
);

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
