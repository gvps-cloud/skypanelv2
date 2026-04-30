/**
 * Category Mapping Service
 * Handles white-label category mappings for VPS plan types
 */

import { query } from '../lib/database.js';

export interface CategoryMapping {
  id: string;
  provider_id: string | null;
  original_category: string;
  custom_name: string;
  custom_description: string | null;
  display_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryMappingInput {
  provider_id?: string | null;
  original_category: string;
  custom_name: string;
  custom_description?: string | null;
  display_order?: number;
  enabled?: boolean;
}

export interface UpdateCategoryMappingInput {
  custom_name?: string;
  custom_description?: string | null;
  display_order?: number;
  enabled?: boolean;
}

// Default category labels for fallback
const DEFAULT_CATEGORY_LABELS: Record<string, { name: string; description: string }> = {
  standard: {
    name: 'Standard',
    description: 'Standard VPS plans offer a good mix of performance, resources, and price for most workloads.'
  },
  nanode: {
    name: 'Nanode',
    description: 'Affordable entry-level plans perfect for testing, development, and lightweight applications.'
  },
  dedicated: {
    name: 'Dedicated CPU',
    description: 'Dedicated CPU plans give you full access to CPU cores for consistent performance.'
  },
  premium: {
    name: 'Premium',
    description: 'Premium plans offer the latest high-performance CPUs with consistent performance for demanding workloads.'
  },
  highmem: {
    name: 'High Memory',
    description: 'High Memory plans favor RAM over other resources, great for caching and in-memory databases.'
  },
  gpu: {
    name: 'GPU',
    description: 'GPU plans include dedicated GPUs for machine learning, AI, and video transcoding workloads.'
  },
  accelerated: {
    name: 'Accelerated',
    description: 'Accelerated plans provide enhanced performance for I/O-intensive workloads.'
  },
  memory: {
    name: 'High Memory',
    description: 'High Memory plans favor RAM over other resources, great for caching and in-memory databases.'
  },
  cpu: {
    name: 'Dedicated CPU',
    description: 'Dedicated CPU plans give you full access to CPU cores for consistent performance.'
  }
};

/**
 * Map database row to CategoryMapping interface
 */
const mapRowToCategoryMapping = (row: Record<string, unknown>): CategoryMapping => ({
  id: String(row.id),
  provider_id: row.provider_id ? String(row.provider_id) : null,
  original_category: String(row.original_category),
  custom_name: String(row.custom_name),
  custom_description: row.custom_description ? String(row.custom_description) : null,
  display_order: Number(row.display_order),
  enabled: Boolean(row.enabled),
  created_at: new Date(row.created_at as Date).toISOString(),
  updated_at: new Date(row.updated_at as Date).toISOString(),
});

/**
 * Category Mapping Service
 */
export const categoryMappingService = {
  /**
   * Get all category mappings
   */
  async getAllCategoryMappings(): Promise<CategoryMapping[]> {
    try {
      const result = await query(
        `SELECT * FROM vps_category_mappings
         ORDER BY display_order ASC, original_category ASC`,
        []
      );
      return result.rows.map(mapRowToCategoryMapping);
    } catch (error) {
      console.error('Error fetching category mappings:', error);
      return [];
    }
  },

  /**
   * Get enabled category mappings only
   */
  async getEnabledCategoryMappings(): Promise<CategoryMapping[]> {
    try {
      const result = await query(
        `SELECT * FROM vps_category_mappings
         WHERE enabled = true
         ORDER BY display_order ASC, original_category ASC`,
        []
      );
      return result.rows.map(mapRowToCategoryMapping);
    } catch (error) {
      console.error('Error fetching enabled category mappings:', error);
      return [];
    }
  },

  /**
   * Get category mapping by original category
   */
  async getCategoryMapping(originalCategory: string, providerId?: string | null): Promise<CategoryMapping | null> {
    try {
      let queryText = 'SELECT * FROM vps_category_mappings WHERE original_category = $1';
      const params: (string | null)[] = [originalCategory.toLowerCase().trim()];

      if (providerId) {
        queryText += ' AND (provider_id = $2 OR provider_id IS NULL)';
        params.push(providerId);
      } else {
        queryText += ' AND provider_id IS NULL';
      }

      queryText += ' ORDER BY provider_id DESC NULLS LAST LIMIT 1';

      const result = await query(queryText, params);

      if (result.rows.length === 0) {
        return null;
      }

      return mapRowToCategoryMapping(result.rows[0]);
    } catch (error) {
      console.error('Error fetching category mapping:', error);
      return null;
    }
  },

  /**
   * Get custom category name for display
   * Falls back to default labels if no custom mapping exists
   */
  async getCategoryDisplayName(originalCategory: string, providerId?: string | null): Promise<string> {
    const mapping = await this.getCategoryMapping(originalCategory, providerId);

    if (mapping && mapping.enabled) {
      return mapping.custom_name;
    }

    // Fall back to default labels
    const normalizedCategory = originalCategory.toLowerCase().trim();
    return DEFAULT_CATEGORY_LABELS[normalizedCategory]?.name ||
           normalizedCategory.charAt(0).toUpperCase() + normalizedCategory.slice(1);
  },

  /**
   * Get custom category description for display
   * Falls back to default descriptions if no custom mapping exists
   */
  async getCategoryDescription(originalCategory: string, providerId?: string | null): Promise<string | null> {
    const mapping = await this.getCategoryMapping(originalCategory, providerId);

    if (mapping && mapping.enabled && mapping.custom_description) {
      return mapping.custom_description;
    }

    // Fall back to default descriptions
    const normalizedCategory = originalCategory.toLowerCase().trim();
    return DEFAULT_CATEGORY_LABELS[normalizedCategory]?.description || null;
  },

  /**
   * Create a new category mapping
   */
  async createCategoryMapping(input: CreateCategoryMappingInput): Promise<CategoryMapping> {
    const {
      provider_id = null,
      original_category,
      custom_name,
      custom_description = null,
      display_order = 0,
      enabled = true,
    } = input;

    const normalizedCategory = original_category.toLowerCase().trim();

    const result = await query(
      `INSERT INTO vps_category_mappings (provider_id, original_category, custom_name, custom_description, display_order, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [provider_id, normalizedCategory, custom_name.trim(), custom_description, display_order, enabled]
    );

    return mapRowToCategoryMapping(result.rows[0]);
  },

  /**
   * Update an existing category mapping
   */
  async updateCategoryMapping(id: string, input: UpdateCategoryMappingInput): Promise<CategoryMapping | null> {
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (input.custom_name !== undefined) {
      updates.push(`custom_name = $${paramIndex++}`);
      params.push(input.custom_name.trim());
    }

    if (input.custom_description !== undefined) {
      updates.push(`custom_description = $${paramIndex++}`);
      params.push(input.custom_description);
    }

    if (input.display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      params.push(input.display_order);
    }

    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      params.push(input.enabled);
    }

    if (updates.length === 0) {
      return this.getCategoryMappingById(id);
    }

    params.push(id);

    const result = await query(
      `UPDATE vps_category_mappings
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToCategoryMapping(result.rows[0]);
  },

  /**
   * Get category mapping by ID
   */
  async getCategoryMappingById(id: string): Promise<CategoryMapping | null> {
    const result = await query(
      'SELECT * FROM vps_category_mappings WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToCategoryMapping(result.rows[0]);
  },

  /**
   * Delete a category mapping
   */
  async deleteCategoryMapping(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM vps_category_mappings WHERE id = $1 RETURNING id',
      [id]
    );

    return result.rows.length > 0;
  },

  /**
   * Reorder category mappings
   */
  async reorderCategoryMappings(ordering: { id: string; display_order: number }[]): Promise<void> {
    await query('BEGIN', []);

    try {
      for (const item of ordering) {
        await query(
          'UPDATE vps_category_mappings SET display_order = $1 WHERE id = $2',
          [item.display_order, item.id]
        );
      }

      await query('COMMIT', []);
    } catch (error) {
      await query('ROLLBACK', []);
      throw error;
    }
  },

  /**
   * Bulk create/update category mappings
   */
  async syncCategoryMappings(mappings: CreateCategoryMappingInput[]): Promise<CategoryMapping[]> {
    const results: CategoryMapping[] = [];

    for (const mapping of mappings) {
      const existing = await this.getCategoryMapping(
        mapping.original_category,
        mapping.provider_id
      );

      if (existing) {
        const updated = await this.updateCategoryMapping(existing.id, {
          custom_name: mapping.custom_name,
          custom_description: mapping.custom_description,
          display_order: mapping.display_order,
          enabled: mapping.enabled,
        });
        if (updated) {
          results.push(updated);
        }
      } else {
        const created = await this.createCategoryMapping(mapping);
        results.push(created);
      }
    }

    return results;
  },
};