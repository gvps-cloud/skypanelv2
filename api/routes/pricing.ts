import express, { Request, Response } from "express";
import { query } from "../lib/database.js";
import { linodeService } from "../services/linodeService.js";
import { getSpeedTestUrl, parseStoredAllowedRegions, normalizeRegionList } from "../lib/providerRegions.js";

const router = express.Router();

// ============================================================================
// Regions Cache for public endpoints
// ============================================================================
interface PublicRegion {
  id: string;
  label: string;
  country: string;
  status: string;
  site_type: string;
  speedTestUrl?: string;
}

interface CachedRegions {
  regions: PublicRegion[];
  count: number;
  timestamp: number;
}

let regionsCache: CachedRegions | null = null;
const REGIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isRegionsCacheValid(): boolean {
  if (!regionsCache) return false;
  return Date.now() - regionsCache.timestamp < REGIONS_CACHE_TTL_MS;
}

export function invalidateRegionsCache(): void {
  regionsCache = null;
}

/**
 * GET /api/pricing/public-regions
 * 
 * Public endpoint to retrieve allowed regions from all active providers.
 * Returns only regions that are enabled by admin in the provider configuration.
 * Cached for 5 minutes.
 */
router.get("/public-regions", async (_req: Request, res: Response) => {
  try {
    // Check cache first
    if (isRegionsCacheValid() && regionsCache) {
      return res.json({
        success: true,
        regions: regionsCache.regions,
        count: regionsCache.count,
        cached: true,
        cacheExpiry: new Date(regionsCache.timestamp + REGIONS_CACHE_TTL_MS).toISOString(),
      });
    }

    // Fetch all active providers
    const providersResult = await query(
      `SELECT id, type, allowed_regions FROM service_providers WHERE active = true`
    );

    // Collect all allowed regions across providers
    const allowedRegionSet = new Set<string>();

    for (const provider of providersResult.rows) {
      if (provider.type !== "linode") continue;

      // Try to get regions from provider_region_overrides first
      let providerAllowedRegions: string[] = [];
      try {
        const overridesResult = await query(
          "SELECT region FROM provider_region_overrides WHERE provider_id = $1",
          [provider.id]
        );

        if (overridesResult.rows.length > 0) {
          providerAllowedRegions = normalizeRegionList(
            overridesResult.rows
              .map((row) => row.region)
              .filter((value): value is string => typeof value === "string")
          );
        }
      } catch (err: any) {
        const message = String(err?.message || "").toLowerCase();
        const missingTable =
          message.includes("relation") &&
          message.includes("provider_region_overrides");
        if (!missingTable) {
          console.warn("Error fetching provider_region_overrides:", err);
        }
      }

      // Fall back to allowed_regions JSONB column
      if (providerAllowedRegions.length === 0) {
        providerAllowedRegions = parseStoredAllowedRegions(provider.allowed_regions);
      }

      // Add to the set
      providerAllowedRegions.forEach((region) => allowedRegionSet.add(region));
    }

    // Fetch all Linode regions for details
    const linodeRegions = await linodeService.getLinodeRegions();

    // Filter to only allowed regions and map with speed test URLs
    const allowedRegions: PublicRegion[] = linodeRegions
      .filter((region) => {
        const slug = region.id?.toLowerCase() || "";
        // If no specific regions configured, all are allowed
        if (allowedRegionSet.size === 0) return true;
        return allowedRegionSet.has(slug);
      })
      .map((region) => ({
        id: region.id,
        label: region.label || region.id,
        country: region.country || "",
        status: region.status || "unknown",
        site_type: region.site_type || "core",
        speedTestUrl: getSpeedTestUrl(region.id),
      }));

    // Update cache
    regionsCache = {
      regions: allowedRegions,
      count: allowedRegions.length,
      timestamp: Date.now(),
    };

    res.json({
      success: true,
      regions: allowedRegions,
      count: allowedRegions.length,
      cached: false,
      cacheExpiry: new Date(Date.now() + REGIONS_CACHE_TTL_MS).toISOString(),
    });
  } catch (error) {
    console.error("Public regions fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch regions";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/pricing/vps
 * 
 * Public endpoint to retrieve available VPS plans for pricing display.
 * No authentication required - this is for public pricing pages.
 */
router.get("/vps", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
         provider_id,
         provider_plan_id,
         base_price,
         markup_price,
         backup_price_monthly,
         backup_price_hourly,
         backup_upcharge_monthly,
         backup_upcharge_hourly,
         daily_backups_enabled,
         weekly_backups_enabled,
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications,
         type_class
       FROM vps_plans
       WHERE active = true
       ORDER BY base_price + markup_price ASC`
    );

    // Build a network_out lookup from Linode types keyed by provider_plan_id
    let networkOutMap: Record<string, number> = {};
    try {
      const linodeTypes = await linodeService.getLinodeTypes();
      for (const lt of linodeTypes) {
        networkOutMap[lt.id] = lt.network_out || 0;
      }
    } catch (err) {
      console.warn("Could not fetch Linode types for network_out enrichment:", err);
    }

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
      region_id: row.region_id,
      specifications: row.specifications,
      type_class: row.type_class || 'standard',
      network_out: networkOutMap[row.provider_plan_id] || 0,
    }));

    res.json({ plans });
  } catch (error) {
    console.error("Public VPS plans fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch VPS plans";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/pricing
 * 
 * Public endpoint to retrieve all pricing information (VPS).
 * No authentication required - this is for public pricing pages.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Fetch VPS plans
    const vpsResult = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
         provider_id,
         provider_plan_id,
         base_price,
         markup_price,
         backup_price_monthly,
         backup_price_hourly,
         backup_upcharge_monthly,
         backup_upcharge_hourly,
         daily_backups_enabled,
         weekly_backups_enabled,
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications
       FROM vps_plans
       WHERE active = true
       ORDER BY base_price + markup_price ASC`
    );

    const vpsPlans = (vpsResult.rows || []).map((row: any) => ({
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
      region_id: row.region_id,
      specifications: row.specifications,
    }));
    
    res.json({
      vps: vpsPlans
    });
  } catch (error) {
    console.error("Public pricing fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch pricing information";
    res.status(500).json({ error: message });
  }
});

export default router;