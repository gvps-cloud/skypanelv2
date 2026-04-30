import express from 'express';
import type { Request, Response } from 'express';
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError } from '../../lib/errorHandling.js';
import { logActivity } from '../../services/activityLogger.js';
import { RoleService } from '../../services/roles.js';

const router = express.Router();

router.post("/:id/firewalls/attach", async (req: Request, res: Response) => {
  try {
    const { firewallId } = (req.body || {}) as { firewallId?: number };
    const parsedFirewallId = Number(firewallId);
    if (!Number.isInteger(parsedFirewallId) || parsedFirewallId <= 0) {
      return res.status(400).json({ error: "Valid firewallId is required" });
    }

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

    await linodeService.attachFirewallToLinode(
      parsedFirewallId,
      providerInstanceId,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.firewall.attach",
          entityType: "vps",
          entityId: String(id),
          message: `Attached firewall ${parsedFirewallId} to VPS '${row.label}'`,
          status: "success",
          metadata: { firewallId: parsedFirewallId },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.firewall.attach activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "attach firewall");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.post("/:id/firewalls/detach", async (req: Request, res: Response) => {
  try {
    const { firewallId, deviceId } = (req.body || {}) as {
      firewallId?: number;
      deviceId?: number;
    };
    const parsedFirewallId = Number(firewallId);
    const parsedDeviceId = Number(deviceId);
    if (
      !Number.isInteger(parsedFirewallId) ||
      parsedFirewallId <= 0 ||
      !Number.isInteger(parsedDeviceId) ||
      parsedDeviceId <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Valid firewallId and deviceId are required" });
    }

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

    await linodeService.detachFirewallFromLinode(
      parsedFirewallId,
      parsedDeviceId,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.firewall.detach",
          entityType: "vps",
          entityId: String(id),
          message: `Detached firewall ${parsedFirewallId} from VPS '${row.label}'`,
          status: "success",
          metadata: { firewallId: parsedFirewallId, deviceId: parsedDeviceId },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.firewall.detach activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "detach firewall");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

export default router;
