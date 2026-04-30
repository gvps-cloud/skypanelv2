import express from 'express';
import type { Request, Response } from 'express';
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError } from '../../lib/errorHandling.js';
import { logActivity } from '../../services/activityLogger.js';
import { RoleService } from '../../services/roles.js';
import {
  BACKUP_DAY_OPTIONS,
  BACKUP_WINDOW_OPTIONS,
} from './shared/utils.js';

const router = express.Router();

router.post("/:id/backups/enable", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.enableLinodeBackups(providerInstanceId);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.enable",
          entityType: "vps",
          entityId: String(id),
          message: `Enabled backups for VPS '${row.label}'`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.enable activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "enable backups");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/backups/disable", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.cancelLinodeBackups(providerInstanceId);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.disable",
          entityType: "vps",
          entityId: String(id),
          message: `Disabled backups for VPS '${row.label}'`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.disable activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "disable backups");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/backups/schedule", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    const { day: rawDay, window: rawWindow } = req.body ?? {};

    let dayValue: string | null | undefined = undefined;
    if (rawDay !== undefined) {
      if (rawDay === null) {
        dayValue = null;
      } else if (typeof rawDay === "string") {
        const trimmed = rawDay.trim();
        if (trimmed === "") {
          dayValue = null;
        } else if (BACKUP_DAY_OPTIONS.has(trimmed)) {
          dayValue = trimmed;
        } else {
          return res.status(400).json({ error: "Invalid backup day selected" });
        }
      } else {
        return res.status(400).json({ error: "Invalid backup day payload" });
      }
    }

    let windowValue: string | null | undefined = undefined;
    if (rawWindow !== undefined) {
      if (rawWindow === null) {
        windowValue = null;
      } else if (typeof rawWindow === "string") {
        const trimmed = rawWindow.trim().toUpperCase();
        if (trimmed === "") {
          windowValue = null;
        } else if (BACKUP_WINDOW_OPTIONS.has(trimmed)) {
          windowValue = trimmed;
        } else {
          return res
            .status(400)
            .json({ error: "Invalid backup window selected" });
        }
      } else {
        return res.status(400).json({ error: "Invalid backup window payload" });
      }
    }

    const scheduleUpdate: { day?: string | null; window?: string | null } = {};
    if (dayValue !== undefined) {
      scheduleUpdate.day = dayValue;
    }
    if (windowValue !== undefined) {
      scheduleUpdate.window = windowValue;
    }

    if (Object.keys(scheduleUpdate).length === 0) {
      return res.status(400).json({ error: "No schedule changes supplied" });
    }

    await linodeService.updateLinodeBackupSchedule(
      providerInstanceId,
      scheduleUpdate,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.schedule",
          entityType: "vps",
          entityId: String(id),
          message: `Updated backup schedule for VPS '${row.label}'`,
          metadata: {
            day: dayValue ?? "auto",
            window: windowValue ?? "auto",
          },
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.schedule activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "update backup schedule");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/backups/snapshot", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label } = (req.body || {}) as { label?: string };
    const snapshotLabel =
      typeof label === "string" && label.trim().length > 0
        ? label.trim()
        : undefined;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.createLinodeBackup(providerInstanceId, snapshotLabel);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.snapshot",
          entityType: "vps",
          entityId: String(id),
          message: `Triggered manual snapshot for VPS '${row.label}'${
            snapshotLabel ? ` (${snapshotLabel})` : ""
          }`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.snapshot activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "trigger snapshot");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post(
  "/:id/backups/:backupId/restore",
  async (req: Request, res: Response) => {
    try {
      const { id, backupId } = req.params;
      const user = (req as any).user;
      const userId = user.id;
      const userRole = user.role;
      const organizationId = user.organizationId;
      const parsedBackupId = Number(backupId);
      if (!Number.isInteger(parsedBackupId) || parsedBackupId <= 0) {
        return res.status(400).json({ error: "A valid backupId is required" });
      }

      const { overwrite } = (req.body || {}) as { overwrite?: boolean };

      if (userRole !== "admin") {
        const hasVpsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          "vps_manage",
        );

        if (!hasVpsManagePermission) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: "vps_manage",
          });
        }
      }

      let rowRes;
      if (user.role === "admin") {
        rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
      } else {
        rowRes = await query(
          "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
          [id, organizationId],
        );
      }

      if (rowRes.rows.length === 0) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const row = rowRes.rows[0];
      const providerInstanceId = Number(row.provider_instance_id);
      if (!Number.isFinite(providerInstanceId)) {
        return res
          .status(400)
          .json({ error: "Instance is missing provider reference" });
      }

      await linodeService.restoreLinodeBackup(
        providerInstanceId,
        parsedBackupId,
        {
          overwrite: overwrite !== undefined ? Boolean(overwrite) : true,
          targetInstanceId: providerInstanceId,
        },
      );

      try {
        await logActivity(
          {
            userId: user.id,
            organizationId: user.organizationId,
            eventType: "vps.backups.restore",
            entityType: "vps",
            entityId: String(id),
            message: `Initiated restore from backup ${parsedBackupId} for VPS '${row.label}'`,
            status: "success",
            metadata: {
              backupId: parsedBackupId,
              overwrite: overwrite !== undefined ? Boolean(overwrite) : true,
            },
          },
          req as any,
        );
      } catch (logErr) {
        console.warn("Failed to log vps.backups.restore activity:", logErr);
      }

      res.json({ success: true });
    } catch (err: any) {
      const structuredError = handleProviderError(err, "linode", "restore backup");
      res.status(structuredError.statusCode).json({ error: structuredError.message });
    }
  },
);

export default router;
