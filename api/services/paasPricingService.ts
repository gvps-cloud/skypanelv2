import { query, transaction } from '../lib/database.js';

export interface PricingPlan {
  id: number;
  name: string;
  slug: string;
  description?: string;
  plan_type: 'monthly' | 'per_resource' | 'custom';
  monthly_price?: number;
  cpu_cores?: number;
  ram_mb?: number;
  disk_gb?: number;
  bandwidth_gb?: number;
  price_per_cpu_hour?: number;
  price_per_ram_gb_hour?: number;
  price_per_disk_gb_month?: number;
  price_per_bandwidth_gb?: number;
  max_applications?: number;
  buildpack_support: boolean;
  custom_domain_support: boolean;
  ssl_support: boolean;
  max_custom_domains: number;
  is_active: boolean;
  is_visible: boolean;
  is_default: boolean;
  sort_order: number;
  features: string[];
  metadata: any;
  created_at: Date;
  updated_at: Date;
  created_by?: number;
}

export interface AddonPricing {
  id: number;
  addon_type: string;
  name: string;
  slug: string;
  description?: string;
  monthly_price: number;
  storage_gb?: number;
  max_connections?: number;
  ram_mb?: number;
  cpu_cores?: number;
  backup_enabled: boolean;
  backup_retention_days: number;
  high_availability: boolean;
  is_active: boolean;
  is_visible: boolean;
  sort_order: number;
  features: string[];
  created_at: Date;
  updated_at: Date;
}

export class PaaSPricingService {
  /**
   * Get all pricing plans
   */
  static async getAllPlans(includeHidden = false): Promise<PricingPlan[]> {
    let sql = 'SELECT * FROM paas_pricing_plans';
    const params: any[] = [];
    
    if (!includeHidden) {
      sql += ' WHERE is_visible = true AND is_active = true';
    }
    
    sql += ' ORDER BY sort_order ASC, id ASC';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get a pricing plan by ID
   */
  static async getPlanById(id: number | string): Promise<PricingPlan | null> {
    const result = await query('SELECT * FROM paas_pricing_plans WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new pricing plan
   */
  static async createPlan(data: Partial<PricingPlan>): Promise<PricingPlan> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const values = keys.map(k => (data as any)[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO paas_pricing_plans (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Update a pricing plan
   */
  static async updatePlan(id: number | string, data: Partial<PricingPlan>): Promise<PricingPlan | null> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    
    if (keys.length === 0) return this.getPlanById(id);
    
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...keys.map(k => (data as any)[k])];
    
    const sql = `
      UPDATE paas_pricing_plans
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Delete a pricing plan
   */
  static async deletePlan(id: number | string): Promise<boolean> {
    const result = await query('DELETE FROM paas_pricing_plans WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all addon pricing
   */
  static async getAllAddonPricing(includeHidden = false): Promise<AddonPricing[]> {
    let sql = 'SELECT * FROM paas_addon_pricing';
    const params: any[] = [];
    
    if (!includeHidden) {
      sql += ' WHERE is_visible = true AND is_active = true';
    }
    
    sql += ' ORDER BY addon_type ASC, sort_order ASC, monthly_price ASC';
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get addon pricing by ID
   */
  static async getAddonPricingById(id: number | string): Promise<AddonPricing | null> {
    const result = await query('SELECT * FROM paas_addon_pricing WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Create a new addon pricing
   */
  static async createAddonPricing(data: Partial<AddonPricing>): Promise<AddonPricing> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    const values = keys.map(k => (data as any)[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO paas_addon_pricing (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  }

  /**
   * Update addon pricing
   */
  static async updateAddonPricing(id: number | string, data: Partial<AddonPricing>): Promise<AddonPricing | null> {
    const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    
    if (keys.length === 0) return this.getAddonPricingById(id);
    
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...keys.map(k => (data as any)[k])];
    
    const sql = `
      UPDATE paas_addon_pricing
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0] || null;
  }

  /**
   * Delete addon pricing
   */
  static async deleteAddonPricing(id: number | string): Promise<boolean> {
    const result = await query('DELETE FROM paas_addon_pricing WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }
}
