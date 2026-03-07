/**
 * Platform Statistics Service for SkyPanelV2
 * Provides aggregated statistics for VPS infrastructure and platform-wide metrics
 */

import { query } from "../lib/database.js";
import { linodeService } from "./linodeService.js";

interface VPSStatusBreakdown {
  running: number;
  stopped: number;
  provisioning: number;
  rebooting: number;
  error: number;
  [key: string]: number;
}

interface VPSResources {
  totalVCPUs: number;
  totalMemoryGB: number;
  totalDiskGB: number;
}

interface VPSStats {
  total: number;
  byStatus: VPSStatusBreakdown;
  resources: VPSResources;
}

interface PlatformStats {
  users: {
    total: number;
    admins: number;
    regular: number;
  };
  organizations: {
    total: number;
  };
  vps: {
    total: number;
    active: number;
  };
  support: {
    totalTickets: number;
    openTickets: number;
  };
  plans: {
    vpsPlans: number;
  };
  regions: {
    total: number;
  };
  cacheExpiry: string;
}

interface CachedStats<T> {
  data: T;
  timestamp: number;
}

export class PlatformStatsService {
  private static vpsStatsCache: CachedStats<VPSStats> | null = null;
  private static platformStatsCache: CachedStats<PlatformStats> | null = null;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if cached data is still valid
   */
  private static isCacheValid<T>(cache: CachedStats<T> | null): boolean {
    if (!cache) return false;
    const now = Date.now();
    return now - cache.timestamp < this.CACHE_TTL_MS;
  }

  /**
   * Get VPS infrastructure statistics with status breakdown and resource totals
   */
  static async getVPSStats(): Promise<{ vps: VPSStats; lastUpdated: string }> {
    // Check cache first
    if (this.isCacheValid(this.vpsStatsCache)) {
      return {
        vps: this.vpsStatsCache!.data,
        lastUpdated: new Date(this.vpsStatsCache!.timestamp).toISOString(),
      };
    }

    try {
      // Get total count and status breakdown
      const statusResult = await query(`
        SELECT 
          COUNT(*) as total,
          status,
          COUNT(*) FILTER (WHERE status = 'running') as running,
          COUNT(*) FILTER (WHERE status = 'stopped') as stopped,
          COUNT(*) FILTER (WHERE status = 'provisioning') as provisioning,
          COUNT(*) FILTER (WHERE status = 'rebooting') as rebooting,
          COUNT(*) FILTER (WHERE status = 'error') as error
        FROM vps_instances
        GROUP BY ROLLUP(status)
        HAVING status IS NULL
      `);

      const statusRow = statusResult.rows[0] || {
        total: 0,
        running: 0,
        stopped: 0,
        provisioning: 0,
        rebooting: 0,
        error: 0,
      };

      // Get resource totals by joining with vps_plans
      // Note: memory and disk are stored in MB in specifications, so we convert to GB
      const resourceResult = await query(`
        SELECT 
          COALESCE(SUM(COALESCE((vps_plans.specifications->>'vcpus')::INTEGER, 0)), 0) as total_vcpus,
          COALESCE(SUM(COALESCE((vps_plans.specifications->>'memory')::INTEGER, 0)), 0) as total_memory_mb,
          COALESCE(SUM(COALESCE((vps_plans.specifications->>'disk')::INTEGER, 0)), 0) as total_disk_mb
        FROM vps_instances
        LEFT JOIN vps_plans ON (vps_plans.id::text = vps_instances.plan_id OR vps_plans.provider_plan_id = vps_instances.plan_id)
      `);

      const resourceRow = resourceResult.rows[0] || {
        total_vcpus: 0,
        total_memory_mb: 0,
        total_disk_mb: 0,
      };

      const vpsStats: VPSStats = {
        total: parseInt(statusRow.total) || 0,
        byStatus: {
          running: parseInt(statusRow.running) || 0,
          stopped: parseInt(statusRow.stopped) || 0,
          provisioning: parseInt(statusRow.provisioning) || 0,
          rebooting: parseInt(statusRow.rebooting) || 0,
          error: parseInt(statusRow.error) || 0,
        },
        resources: {
          totalVCPUs: parseInt(resourceRow.total_vcpus) || 0,
          totalMemoryGB: Math.round(
            (parseInt(resourceRow.total_memory_mb) || 0) / 1024
          ),
          totalDiskGB: Math.round(
            (parseInt(resourceRow.total_disk_mb) || 0) / 1024
          ),
        },
      };

      // Cache the result
      const now = Date.now();
      this.vpsStatsCache = {
        data: vpsStats,
        timestamp: now,
      };

      return {
        vps: vpsStats,
        lastUpdated: new Date(now).toISOString(),
      };
    } catch (error) {
      console.error("Error fetching VPS stats:", error);
      throw error;
    }
  }

  /**
   * Get platform-wide statistics for the about page
   */
  static async getPlatformStats(): Promise<PlatformStats> {
    // Check cache first
    if (this.isCacheValid(this.platformStatsCache)) {
      return this.platformStatsCache!.data;
    }

    try {
      // Get user statistics
      const userResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE role = 'admin') as admins,
          COUNT(*) FILTER (WHERE role = 'user') as regular
        FROM users
      `);

      const userRow = userResult.rows[0] || { total: 0, admins: 0, regular: 0 };

      // Get organization count
      const orgResult = await query(`
        SELECT COUNT(*) as total
        FROM organizations
      `);

      const orgRow = orgResult.rows[0] || { total: 0 };

      // Get VPS statistics (all-time total and currently active)
      const vpsResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) as active
        FROM vps_instances
      `);

      const vpsRow = vpsResult.rows[0] || { total: 0, active: 0 };

      // Get support ticket statistics
      const ticketResult = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as open
        FROM support_tickets
      `);

      const ticketRow = ticketResult.rows[0] || { total: 0, open: 0 };

      // Get available VPS plans count
      const plansResult = await query(`
        SELECT COUNT(*) as vps_plans
        FROM vps_plans
        WHERE active = true
      `);

      const plansRow = plansResult.rows[0] || { vps_plans: 0 };

      // Get regions count from admin-allowed regions across all providers
      let regionCount = 0;
      try {
        // First, get all allowed regions from provider_region_overrides
        const allowedRegionSet = new Set<string>();
        
        const providersResult = await query(
          `SELECT id, allowed_regions FROM service_providers WHERE active = true AND type = 'linode'`
        );
        
        for (const provider of providersResult.rows) {
          try {
            const overridesResult = await query(
              "SELECT region FROM provider_region_overrides WHERE provider_id = $1",
              [provider.id]
            );
            
            if (overridesResult.rows.length > 0) {
              overridesResult.rows.forEach((row) => {
                if (typeof row.region === "string") {
                  allowedRegionSet.add(row.region.toLowerCase().trim());
                }
              });
            } else if (provider.allowed_regions) {
              // Fall back to allowed_regions JSONB column
              const parsed = Array.isArray(provider.allowed_regions) 
                ? provider.allowed_regions 
                : [];
              parsed.forEach((r: string) => {
                if (typeof r === "string") {
                  allowedRegionSet.add(r.toLowerCase().trim());
                }
              });
            }
          } catch {
            // If table doesn't exist, skip
          }
        }
        
        if (allowedRegionSet.size > 0) {
          regionCount = allowedRegionSet.size;
        } else {
          // Fallback to all Linode regions if no specific regions configured
          const regions = await linodeService.getLinodeRegions();
          regionCount = regions.length;
        }
      } catch (error) {
        console.warn(
          "Failed to fetch allowed regions for platform stats:",
          error
        );
        // Fallback to 0 if query fails
      }
      const platformStats: PlatformStats = {
        users: {
          total: parseInt(userRow.total) || 0,
          admins: parseInt(userRow.admins) || 0,
          regular: parseInt(userRow.regular) || 0,
        },
        organizations: {
          total: parseInt(orgRow.total) || 0,
        },
        vps: {
          total: parseInt(vpsRow.total) || 0,
          active: parseInt(vpsRow.active) || 0,
        },
        support: {
          totalTickets: parseInt(ticketRow.total) || 0,
          openTickets: parseInt(ticketRow.open) || 0,
        },
        plans: {
          vpsPlans: parseInt(plansRow.vps_plans) || 0,
        },
        regions: {
          total: regionCount,
        },
        cacheExpiry: new Date(Date.now() + this.CACHE_TTL_MS).toISOString(),
      };

      // Cache the result
      this.platformStatsCache = {
        data: platformStats,
        timestamp: Date.now(),
      };

      return platformStats;
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      throw error;
    }
  }

  /**
   * Clear all caches (useful for testing or when significant events occur)
   */
  static clearCache(): void {
    this.vpsStatsCache = null;
    this.platformStatsCache = null;
  }
}
