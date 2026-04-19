import express, { Request, Response } from "express";
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import { handleProviderError, sendSafeErrorResponse } from '../../lib/errorHandling.js';
import {
  normalizeRegionList,
  parseStoredAllowedRegions,
  shouldFilterByAllowedRegions,
} from '../../lib/providerRegions.js';
import { normalizeProviderToken } from '../../lib/providerTokens.js';
import { config } from '../../config/index.js';
import { RoleService } from '../../services/roles.js';
import {
  DEFAULT_RDNS_BASE_DOMAIN,
  loadProviderTokenById,
} from "./shared/utils.js";

const router = express.Router();

router.get("/networking/config", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      "SELECT rdns_base_domain FROM networking_config ORDER BY updated_at DESC LIMIT 1",
    );
    const row = result.rows?.[0] ?? null;
    const baseDomain =
      typeof row?.rdns_base_domain === "string" &&
      row.rdns_base_domain.trim().length > 0
        ? row.rdns_base_domain.trim()
        : DEFAULT_RDNS_BASE_DOMAIN;
    res.json({ config: { rdns_base_domain: baseDomain } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load networking configuration";
    if (message.toLowerCase().includes("does not exist")) {
      res.json({
        config: { rdns_base_domain: DEFAULT_RDNS_BASE_DOMAIN },
        warning: message,
      });
      return;
    }
    sendSafeErrorResponse(res, error, 500, { fallbackMessage: "Failed to load networking configuration" });
  }
});

router.get("/providers", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      "SELECT id, name, type, active, display_order FROM service_providers WHERE active = true ORDER BY display_order ASC NULLS LAST, created_at DESC",
    );
    res.json({ providers: result.rows || [] });
  } catch (err) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch providers" });
  }
});

router.get(
  "/providers/:providerId/regions",
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { type_class } = req.query as any;

      const providerResult = await query(
        "SELECT id, type, api_key_encrypted, allowed_regions FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
        [providerId],
      );

      if (providerResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Provider not found or inactive" });
      }

      const provider = providerResult.rows[0];
      const providerType = provider.type as "linode";

      let allowedRegions: string[] = [];

      try {
        const overridesResult = await query(
          "SELECT region FROM provider_region_overrides WHERE provider_id = $1",
          [providerId],
        );

        if (overridesResult.rows.length > 0) {
          allowedRegions = normalizeRegionList(
            overridesResult.rows
              .map((row) => row.region)
              .filter((value): value is string => typeof value === "string"),
          );
        }
      } catch (overrideErr: any) {
        const message = String(overrideErr?.message || "").toLowerCase();
        const relationMissing =
          message.includes("relation") &&
          message.includes("provider_region_overrides");
        if (!relationMissing) {
          throw overrideErr;
        }
      }

      if (allowedRegions.length === 0) {
        allowedRegions = parseStoredAllowedRegions(
          provider.allowed_regions ?? null,
        );
      }

      const normalizedAllowedRegions =
        allowedRegions.length > 0 ? allowedRegions : [];
      const shouldApplyAllowedRegionFilter = shouldFilterByAllowedRegions(
        normalizedAllowedRegions,
      );

      if (providerType !== "linode") {
        return res.status(400).json({ error: "Unsupported provider type" });
      }

      const allRegions = await linodeService.getLinodeRegions();

      let regions = allRegions;
      if (shouldApplyAllowedRegionFilter) {
        const allowedSet = new Set(normalizedAllowedRegions);
        regions = allRegions.filter(
          (region) =>
            region &&
            typeof region.id === "string" &&
            allowedSet.has(region.id.toLowerCase()),
        );
      }

      if (type_class && typeof type_class === "string") {
        try {
          const plansResult = await query(
            `SELECT DISTINCT vpr.region_id
             FROM vps_plan_regions vpr
             INNER JOIN vps_plans p ON vpr.vps_plan_id = p.id
             WHERE p.provider_id = $1
               AND p.active = true
               AND p.type_class = $2`,
            [providerId, type_class],
          );

          const regionsWithPlans = new Set(
            (plansResult.rows || []).map((row: any) => row.region_id),
          );

          regions = regions.filter(
            (region) =>
              region &&
              typeof region.id === "string" &&
              regionsWithPlans.has(region.id),
          );
        } catch (plansErr: any) {
          const message = String(plansErr?.message || "").toLowerCase();
          if (
            !message.includes("does not exist") &&
            !message.includes("relation")
          ) {
            throw plansErr;
          }
        }
      }

      res.json({ regions });
    } catch (err) {
      sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch regions" });
    }
  },
);

router.get(
  "/providers/:providerId/plans/:regionId",
  async (req: Request, res: Response) => {
    try {
      const { providerId, regionId } = req.params;
      const { type_class } = req.query as any;

      const providerCheck = await query(
        "SELECT id FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
        [providerId],
      );

      if (providerCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Provider not found or inactive" });
      }

      let queryText = `
        SELECT
          p.id,
          p.name,
          COALESCE(p.specifications->>'description', '') AS description,
          p.provider_id,
          p.provider_plan_id,
          p.base_price,
          p.markup_price,
          p.backup_price_monthly,
          p.backup_price_hourly,
          p.backup_upcharge_monthly,
          p.backup_upcharge_hourly,
          p.daily_backups_enabled,
          p.weekly_backups_enabled,
          p.type_class,
          p.specifications
        FROM vps_plans p
        INNER JOIN vps_plan_regions vpr ON p.id = vpr.vps_plan_id
        WHERE p.active = true
          AND p.provider_id = $1
          AND vpr.region_id = $2
      `;

      const queryParams: any[] = [providerId, regionId];

      if (type_class && typeof type_class === "string") {
        queryText += ` AND p.type_class = $3`;
        queryParams.push(type_class);
      }

      queryText += ` ORDER BY p.base_price ASC`;

      const result = await query(queryText, queryParams);

      const plans = (result.rows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        provider_id: row.provider_id,
        provider_plan_id: row.provider_plan_id,
        base_price: row.base_price,
        markup_price: row.markup_price,
        backup_price_monthly: row.backup_price_monthly || 0,
        backup_price_hourly: row.backup_price_hourly || 0,
        backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
        backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
        daily_backups_enabled: row.daily_backups_enabled || false,
        weekly_backups_enabled: row.weekly_backups_enabled !== false,
        type_class: row.type_class || "standard",
        specifications: row.specifications,
      }));

      res.json({ plans });
    } catch (err) {
      sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch plans" });
    }
  },
);

router.get("/providers/:providerId/ssh-keys", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    if (!userId || !organizationId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const canViewKeys = await RoleService.checkPermission(
      userId,
      organizationId,
      "ssh_keys_view",
    );
    if (!canViewKeys) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view SSH keys" });
    }

    const result = await query(
      `SELECT id, name, public_key, fingerprint, linode_key_id, created_at
       FROM user_ssh_keys
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    const keys = result.rows.map(row => ({
      id: row.linode_key_id || row.id,
      label: row.name,
      ssh_key: row.public_key,
      fingerprint: row.fingerprint,
      created: row.created_at,
    }));

    return res.json({ ssh_keys: keys });
  } catch (err: any) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch SSH keys" });
  }
});

export default router;
