import express, { Request, Response } from "express";
import { authenticateToken, requireOrganization } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError } from '../../lib/errorHandling.js';
import { logActivity } from '../../services/activityLogger.js';
import { RoleService } from '../../services/roles.js';
import {
  DEFAULT_RDNS_BASE_DOMAIN,
  isBrandedTemplateId,
  toBrandedTemplateId,
  normalizeImageTemplate,
  BRANDED_TEMPLATE_PREFIX,
  LEGACY_TEMPLATE_PREFIX,
  resolveImageForProvider,
  loadProviderTokenById,
} from "./shared/utils.js";
import { normalizeProviderStatus, mapConfigProfile } from "./shared/types.js";

const router = express.Router();

async function resolveVpsInstance(req: Request, res: Response) {
  const { id } = req.params;
  const user = (req as any).user;
  const userId = user.id;
  const userRole = user.role;
  const organizationId = user.organizationId;

  if (userRole !== "admin") {
    const hasPermission = await RoleService.checkPermission(userId, organizationId, "vps_manage");
    if (!hasPermission) {
      res.status(403).json({ error: "Insufficient permissions", required: "vps_manage" });
      return null;
    }
  }

  let rowRes;
  if (userRole === "admin") {
    rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
  } else {
    rowRes = await query("SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2", [id, organizationId]);
  }

  if (rowRes.rows.length === 0) {
    res.status(404).json({ error: "Instance not found" });
    return null;
  }

  const row = rowRes.rows[0];
  const providerInstanceId = Number(row.provider_instance_id);
  if (!Number.isFinite(providerInstanceId)) {
    res.status(400).json({ error: "Instance is missing provider reference" });
    return null;
  }

  return { row, providerInstanceId, user };
}

router.get("/:id/disks", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const disks = await linodeService.listDisks(ctx.providerInstanceId);
    res.json({ disks });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "list disks");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.get("/:id/disks/:diskId", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    const disk = await linodeService.getDisk(ctx.providerInstanceId, diskId);
    res.json({ disk });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "get disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/disks", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const { label, size, filesystem, image, root_pass, authorized_keys, stackscript_id, stackscript_data } = req.body;
    if (!label || !size) {
      return res.status(400).json({ error: "label and size are required" });
    }
    if (typeof size !== "number" || size < 1) {
      return res.status(400).json({ error: "size must be a positive number (MB)" });
    }

    const disk = await linodeService.createDisk(ctx.providerInstanceId, {
      label,
      size,
      filesystem,
      image,
      root_pass,
      authorized_keys,
      stackscript_id,
      stackscript_data,
    });

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.create",
      entityType: "disk",
      entityId: String(disk.id),
      message: `Created disk '${label}' on VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, diskId: disk.id, size },
    }, req as any);

    res.status(201).json({ disk });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "create disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.put("/:id/disks/:diskId", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    const { label, filesystem } = req.body;
    const params: { label?: string; filesystem?: string } = {};
    if (label) params.label = label;
    if (filesystem) params.filesystem = filesystem;

    const disk = await linodeService.updateDisk(ctx.providerInstanceId, diskId, params);

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.update",
      entityType: "disk",
      entityId: String(diskId),
      message: `Updated disk ${diskId} on VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, diskId, updates: params },
    }, req as any);

    res.json({ disk });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "update disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/disks/:diskId/resize", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    const { size } = req.body;
    if (!size || typeof size !== "number" || size < 1) {
      return res.status(400).json({ error: "size must be a positive number (MB)" });
    }

    await linodeService.resizeDisk(ctx.providerInstanceId, diskId, size);

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.resize",
      entityType: "disk",
      entityId: String(diskId),
      message: `Resized disk ${diskId} to ${size}MB on VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, diskId, newSize: size },
    }, req as any);

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "resize disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/disks/:diskId/clone", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    const disk = await linodeService.cloneDisk(ctx.providerInstanceId, diskId);

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.clone",
      entityType: "disk",
      entityId: String(disk.id),
      message: `Cloned disk ${diskId} on VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, sourceDiskId: diskId, newDiskId: disk.id },
    }, req as any);

    res.status(201).json({ disk });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "clone disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/disks/:diskId/password", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    const { password } = req.body;
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "password is required and must be at least 8 characters" });
    }

    await linodeService.resetDiskPassword(ctx.providerInstanceId, diskId, password);

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.password_reset",
      entityType: "disk",
      entityId: String(diskId),
      message: `Reset password for disk ${diskId} on VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, diskId },
      suppressNotification: true,
    }, req as any);

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "reset disk password");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.delete("/:id/disks/:diskId", async (req: Request, res: Response) => {
  try {
    const ctx = await resolveVpsInstance(req, res);
    if (!ctx) return;

    const diskId = Number(req.params.diskId);
    if (!Number.isFinite(diskId)) {
      return res.status(400).json({ error: "Invalid disk ID" });
    }

    await linodeService.deleteDisk(ctx.providerInstanceId, diskId);

    await logActivity({
      userId: ctx.user.id,
      organizationId: ctx.user.organizationId,
      eventType: "vps.disk.delete",
      entityType: "disk",
      entityId: String(diskId),
      message: `Deleted disk ${diskId} from VPS '${ctx.row.label}'`,
      status: "success",
      metadata: { instanceId: ctx.row.id, diskId },
    }, req as any);

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "delete disk");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

export default router;