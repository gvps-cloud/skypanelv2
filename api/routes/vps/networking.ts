import express from 'express';
import type { Request, Response } from 'express';
import { authenticateToken, requireOrganization } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError } from '../../lib/errorHandling.js';
import {
  getPanelIpv6PrefixRangesForRdns,
  ipv6AddressOwnedByLinodeInstance,
  ipv6AddressInRange,
} from '../../lib/ipv6.js';
import { normalizeProviderToken } from '../../lib/providerTokens.js';
import { DEFAULT_RDNS_BASE_DOMAIN } from './shared/utils.js';
import {
  mapIPv4Address,
  mapIPv6Assignment,
  mapIPv6Range,
  mapIPv6RangeCollection,
  pickIPv4Array,
  pickIPv6Pool,
  toStringOrNull,
  toNumberOrNull,
} from './shared/types.js';
import { logActivity } from '../../services/activityLogger.js';
import { RoleService } from '../../services/roles.js';

const router = express.Router();

router.post("/:id/networking/rdns", async (req: Request, res: Response) => {
  try {
    const { address, rdns } = (req.body || {}) as {
      address?: string;
      rdns?: string | null;
    };
    if (typeof address !== "string" || address.trim().length === 0) {
      return res.status(400).json({ error: "A valid IP address is required" });
    }
    const normalizedAddress = address.trim();
    const rdnsValue =
      typeof rdns === "string" && rdns.trim().length > 0 ? rdns.trim() : null;

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
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

    const isIPv6 = normalizedAddress.includes(":");

    try {
      const ipPayload =
        await linodeService.getLinodeInstanceIPs(providerInstanceId);

      if (isIPv6) {
        if (!ipv6AddressOwnedByLinodeInstance(normalizedAddress, ipPayload)) {
          return res
            .status(400)
            .json({ error: "IPv6 address not assigned to this instance" });
        }
      } else {
        // IPv4 ownership check (existing logic)
        const ipv4Sets =
          ipPayload?.ipv4 && typeof ipPayload.ipv4 === "object"
            ? Object.values(ipPayload.ipv4)
            : [];
        const flattened = Array.isArray(ipv4Sets)
          ? (ipv4Sets as unknown[]).reduce<string[]>((acc, value) => {
              if (Array.isArray(value)) {
                value.forEach((entry) => {
                  const addr = (entry as any)?.address;
                  if (typeof addr === "string") {
                    acc.push(addr);
                  }
                });
              }
              return acc;
            }, [])
          : [];

        if (!flattened.includes(normalizedAddress)) {
          return res
            .status(400)
            .json({ error: "Address not assigned to this instance" });
        }
      }
    } catch (addressErr) {
      console.warn(
        "Failed to verify IP ownership before rDNS update:",
        addressErr,
      );
    }

    await linodeService.updateIPAddressReverseDNS(normalizedAddress, rdnsValue);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.network.rdns",
          entityType: "vps",
          entityId: String(id),
          message: `Updated rDNS for ${normalizedAddress} on VPS '${row.label}'`,
          status: "success",
          metadata: { ip: normalizedAddress, rdns: rdnsValue },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.network.rdns activity:", logErr);
    }

    res.json({ success: true, rdns: rdnsValue });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "update rDNS");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.get("/:id/networking/ipv6-rdns-records", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasPermission = await RoleService.checkPermission(userId, organizationId, "vps_manage");
      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions", required: "vps_manage" });
      }
    }

    let rowRes;
    if (userRole === "admin") {
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
      return res.status(400).json({ error: "Instance is missing provider reference" });
    }

    const ipPayload = await linodeService.getLinodeInstanceIPs(providerInstanceId);
    const ranges = getPanelIpv6PrefixRangesForRdns(ipPayload);

    if (ranges.length === 0) {
      return res.json({ records: [] });
    }

    // Fetch all account IPs and filter to those in instance ranges with RDNS set
    const records: Array<{ address: string; rdns: string }> = [];
    try {
      const accountIPs = await linodeService.getAccountNetworkingIPs();
      const ipList = accountIPs?.data ?? [];
      for (const ip of ipList) {
        if (!ip.address || !ip.rdns) continue;
        if (!ip.address.includes(":")) continue; // IPv6 only
        if (ip.rdns.includes(".ip.linodeusercontent.com")) continue; // skip default
        for (const r of ranges) {
          if (ipv6AddressInRange(ip.address, r.range, r.prefix)) {
            records.push({ address: ip.address, rdns: ip.rdns });
            break;
          }
        }
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch account IPs for IPv6 RDNS records:", fetchErr);
    }

    res.json({ records });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "fetch IPv6 RDNS records");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

router.put("/:id/hostname", async (req: Request, res: Response) => {
  try {
    const { hostname } = (req.body || {}) as { hostname?: string };

    // Validate hostname format
    if (typeof hostname !== "string" || hostname.trim().length === 0) {
      return res.status(400).json({ error: "Hostname is required" });
    }

    const normalizedHostname = hostname.trim();

    // Validate hostname format (3-64 characters, alphanumeric with hyphens, underscores, periods)
    if (normalizedHostname.length < 3 || normalizedHostname.length > 64) {
      return res
        .status(400)
        .json({ error: "Hostname must be between 3 and 64 characters" });
    }

    const hostnamePattern = /^[a-zA-Z0-9._-]+$/;
    if (!hostnamePattern.test(normalizedHostname)) {
      return res.status(400).json({
        error:
          "Hostname can only contain letters, numbers, hyphens, underscores, and periods",
      });
    }

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
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

    // Update hostname via Linode API
    await linodeService.updateLinodeInstance(providerInstanceId, {
      label: normalizedHostname,
    });

    // Update local database
    await query(
      "UPDATE vps_instances SET label = $1, updated_at = NOW() WHERE id = $2",
      [normalizedHostname, id],
    );

    // Log hostname update activity
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.hostname.update",
          entityType: "vps",
          entityId: String(id),
          message: `Updated hostname for VPS '${row.label}' to '${normalizedHostname}'`,
          status: "success",
          metadata: { oldHostname: row.label, newHostname: normalizedHostname },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.hostname.update activity:", logErr);
    }

    res.json({
      success: true,
      hostname: normalizedHostname,
      message: "Hostname updated successfully",
    });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "update hostname");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

export default router;
