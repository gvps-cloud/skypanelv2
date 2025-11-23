/**
 * PaaS Billing Service
 * Extends BillingService to handle PaaS-specific billing logic
 */

import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface PaaSBillingUsage {
  id: string;
  userId: string;
  applicationId?: string;
  addonId?: string;
  usageType: 'compute' | 'storage' | 'bandwidth' | 'addon';
  amount: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface BillingPeriodSummary {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCompute: number;
  totalStorage: number;
  totalBandwidth: number;
  totalAddons: number;
  totalCost: number;
  applications: {
    id: string;
    name: string;
    cost: number;
  }[];
  addons: {
    id: string;
    name: string;
    type: string;
    cost: number;
  }[];
}

export class PaaSBillingService {
  /**
   * Record PaaS usage
   */
  static async recordUsage(params: {
    userId: string;
    applicationId?: string;
    addonId?: string;
    usageType: 'compute' | 'storage' | 'bandwidth' | 'addon';
    amount: number;
    unit: string;
    costPerUnit: number;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PaaSBillingUsage | null> {
    try {
      const usageId = uuidv4();
      const totalCost = params.amount * params.costPerUnit;
      const now = new Date();
      
      const result = await query(
        `INSERT INTO paas_billing_usage (
          id, user_id, application_id, addon_id, usage_type,
          amount, unit, cost_per_unit, total_cost,
          period_start, period_end, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          usageId,
          params.userId,
          params.applicationId,
          params.addonId,
          params.usageType,
          params.amount,
          params.unit,
          params.costPerUnit,
          totalCost,
          params.periodStart,
          params.periodEnd,
          now
        ]
      );
      
      return this.mapRowToUsage(result.rows[0]);
    } catch (error) {
      console.error('Error recording usage:', error);
      return null;
    }
  }

  /**
   * Calculate compute usage for an application
   */
  static async calculateComputeUsage(
    applicationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    try {
      const appResult = await query(
        `SELECT a.cpu_limit, a.memory_limit_mb, a.min_instances, a.pricing_plan_id,
                p.plan_type, p.price_per_cpu_hour, p.price_per_ram_gb_hour
         FROM paas_applications a
         LEFT JOIN paas_pricing_plans p ON p.id = a.pricing_plan_id
         WHERE a.id = $1`,
        [applicationId]
      );
      
      if (appResult.rows.length === 0) {
        return 0;
      }
      
      const app = appResult.rows[0];
      const cpuCores = app.cpu_limit || 1;
      const memoryGb = (app.memory_limit_mb || 512) / 1024;
      const instances = app.min_instances || 1;
      
      // Calculate hours in period
      const periodMs = periodEnd.getTime() - periodStart.getTime();
      const hours = periodMs / (1000 * 60 * 60);
      
      const cpuRate = parseFloat(app.price_per_cpu_hour || '0') || 0.04;
      const ramRate = parseFloat(app.price_per_ram_gb_hour || '0') || 0.005;
      const cpuCost = cpuCores * instances * hours * cpuRate;
      const memoryCost = memoryGb * instances * hours * ramRate;
      
      return cpuCost + memoryCost;
    } catch (error) {
      console.error('Error calculating compute usage:', error);
      return 0;
    }
  }

  /**
   * Calculate addon usage
   */
  static async calculateAddonUsage(
    addonId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    try {
      // Get addon pricing plan
      const addonResult = await query(
        `SELECT 
          a.addon_type, 
          ap.price_per_hour, 
          ap.storage_limit_gb, 
          ap.price_per_gb_hour
        FROM paas_addons a
        LEFT JOIN paas_addon_pricing ap ON a.pricing_plan_id = ap.id
        WHERE a.id = $1`,
        [addonId]
      );
      
      if (addonResult.rows.length === 0) {
        return 0;
      }
      
      const addon = addonResult.rows[0];
      
      // Calculate hours in period
      const periodMs = periodEnd.getTime() - periodStart.getTime();
      const hours = periodMs / (1000 * 60 * 60);
      
      // Base addon cost
      let cost = (addon.price_per_hour || 0) * hours;
      
      // Add storage cost if applicable
      if (addon.storage_limit_gb && addon.price_per_gb_hour) {
        cost += addon.storage_limit_gb * addon.price_per_gb_hour * hours;
      }
      
      return cost;
    } catch (error) {
      console.error('Error calculating addon usage:', error);
      return 0;
    }
  }

  /**
   * Process hourly billing for all active PaaS applications
   */
  static async processHourlyBilling(): Promise<void> {
    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      
      console.log(`⏱️ Processing PaaS hourly billing for period ${periodStart.toISOString()} - ${now.toISOString()}`);
      
      // Get all active applications
      const appsResult = await query(
        "SELECT id, user_id, name FROM paas_applications WHERE status IN ('running', 'deploying')"
      );
      
      for (const app of appsResult.rows) {
        const computeCost = await this.calculateComputeUsage(app.id, periodStart, now);
        
        if (computeCost > 0) {
          await this.recordUsage({
            userId: app.user_id,
            applicationId: app.id,
            usageType: 'compute',
            amount: 1, // 1 hour
            unit: 'hours',
            costPerUnit: computeCost,
            periodStart,
            periodEnd: now
          });
          
          console.log(`  💰 Recorded compute usage for ${app.name}: $${computeCost.toFixed(4)}`);
        }
      }
      
      // Get all active addons
      const addonsResult = await query(
        "SELECT id, application_id, name, addon_type FROM paas_addons WHERE status = 'available'"
      );
      
      for (const addon of addonsResult.rows) {
        // Get user from application
        const appResult = await query(
          'SELECT user_id FROM paas_applications WHERE id = $1',
          [addon.application_id]
        );
        
        if (appResult.rows.length === 0) continue;
        
        const addonCost = await this.calculateAddonUsage(addon.id, periodStart, now);
        
        if (addonCost > 0) {
          await this.recordUsage({
            userId: appResult.rows[0].user_id,
            addonId: addon.id,
            usageType: 'addon',
            amount: 1, // 1 hour
            unit: 'hours',
            costPerUnit: addonCost,
            periodStart,
            periodEnd: now
          });
          
          console.log(`  💰 Recorded addon usage for ${addon.name} (${addon.addon_type}): $${addonCost.toFixed(4)}`);
        }
      }
      
      console.log(`✅ Completed PaaS hourly billing`);
    } catch (error) {
      console.error('Error processing hourly billing:', error);
    }
  }

  /**
   * Get billing summary for a period
   */
  static async getBillingSummary(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BillingPeriodSummary> {
    try {
      // Get all usage records for the period
      const usageResult = await query(
        `SELECT * FROM paas_billing_usage 
         WHERE user_id = $1 
         AND period_start >= $2 
         AND period_end <= $3
         ORDER BY created_at DESC`,
        [userId, periodStart, periodEnd]
      );
      
      // Aggregate by type
      let totalCompute = 0;
      let totalStorage = 0;
      let totalBandwidth = 0;
      let totalAddons = 0;
      
      const appCosts: Map<string, number> = new Map();
      const addonCosts: Map<string, number> = new Map();
      
      for (const row of usageResult.rows) {
        const cost = parseFloat(row.total_cost);
        
        switch (row.usage_type) {
          case 'compute':
            totalCompute += cost;
            if (row.application_id) {
              appCosts.set(row.application_id, (appCosts.get(row.application_id) || 0) + cost);
            }
            break;
          case 'storage':
            totalStorage += cost;
            break;
          case 'bandwidth':
            totalBandwidth += cost;
            break;
          case 'addon':
            totalAddons += cost;
            if (row.addon_id) {
              addonCosts.set(row.addon_id, (addonCosts.get(row.addon_id) || 0) + cost);
            }
            break;
        }
      }
      
      // Get application details
      const applications = [];
      for (const [appId, cost] of appCosts.entries()) {
        const appResult = await query('SELECT name FROM paas_applications WHERE id = $1', [appId]);
        if (appResult.rows.length > 0) {
          applications.push({
            id: appId,
            name: appResult.rows[0].name,
            cost
          });
        }
      }
      
      // Get addon details
      const addons = [];
      for (const [addonId, cost] of addonCosts.entries()) {
        const addonResult = await query(
          'SELECT name, addon_type FROM paas_addons WHERE id = $1',
          [addonId]
        );
        if (addonResult.rows.length > 0) {
          addons.push({
            id: addonId,
            name: addonResult.rows[0].name,
            type: addonResult.rows[0].addon_type,
            cost
          });
        }
      }
      
      return {
        userId,
        periodStart,
        periodEnd,
        totalCompute,
        totalStorage,
        totalBandwidth,
        totalAddons,
        totalCost: totalCompute + totalStorage + totalBandwidth + totalAddons,
        applications,
        addons
      };
    } catch (error) {
      console.error('Error getting billing summary:', error);
      return {
        userId,
        periodStart,
        periodEnd,
        totalCompute: 0,
        totalStorage: 0,
        totalBandwidth: 0,
        totalAddons: 0,
        totalCost: 0,
        applications: [],
        addons: []
      };
    }
  }

  /**
   * Get usage records for a user
   */
  static async getUserUsage(
    userId: string,
    limit: number = 100
  ): Promise<PaaSBillingUsage[]> {
    try {
      const result = await query(
        'SELECT * FROM paas_billing_usage WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      
      return result.rows.map(row => this.mapRowToUsage(row));
    } catch (error) {
      console.error('Error getting user usage:', error);
      return [];
    }
  }

  /**
   * Get cost projection for next billing period
   */
  static async getProjectedCosts(userId: string): Promise<{
    daily: number;
    monthly: number;
  }> {
    try {
      // Get average daily cost from last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      const result = await query(
        `SELECT SUM(total_cost) as total 
         FROM paas_billing_usage 
         WHERE user_id = $1 
         AND created_at >= $2`,
        [userId, sevenDaysAgo]
      );
      
      const totalLast7Days = parseFloat(result.rows[0]?.total || '0');
      const dailyAverage = totalLast7Days / 7;
      
      return {
        daily: dailyAverage,
        monthly: dailyAverage * 30
      };
    } catch (error) {
      console.error('Error getting projected costs:', error);
      return { daily: 0, monthly: 0 };
    }
  }

  /**
   * Map database row to PaaSBillingUsage interface
   */
  private static mapRowToUsage(row: any): PaaSBillingUsage {
    return {
      id: row.id,
      userId: row.user_id,
      applicationId: row.application_id,
      addonId: row.addon_id,
      usageType: row.usage_type,
      amount: parseFloat(row.amount),
      unit: row.unit,
      costPerUnit: parseFloat(row.cost_per_unit),
      totalCost: parseFloat(row.total_cost),
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      createdAt: new Date(row.created_at)
    };
  }
}
