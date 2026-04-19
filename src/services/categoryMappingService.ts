/**
 * Category Mapping Service for SkyPanelV2 Frontend
 * Handles white-label category mappings for VPS plan types
 */

import type {
  CategoryMapping,
  CreateCategoryMappingInput,
  UpdateCategoryMappingInput,
  CategoryMappingOrdering,
} from '../types/categoryMappings.js';
import { apiClient } from '@/lib/api';

class CategoryMappingService {
  /**
   * Get all category mappings (admin only)
   */
  async getAllCategoryMappings(): Promise<{
    success: boolean;
    mappings?: CategoryMapping[];
    error?: string;
  }> {
    try {
      const data = await apiClient.get<{ mappings?: CategoryMapping[] }>('/admin/category-mappings');

      return {
        success: true,
        mappings: data.mappings || [],
      };
    } catch (error) {
      console.error('Get all category mappings error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Get enabled category mappings (for public display)
   * Uses public endpoint - no authentication required
   */
  async getEnabledCategoryMappings(): Promise<{
    success: boolean;
    mappings?: CategoryMapping[];
    error?: string;
  }> {
    try {
      const data = await apiClient.get<{ mappings?: CategoryMapping[] }>('/pricing/category-mappings');

      return {
        success: true,
        mappings: data.mappings || [],
      };
    } catch (error) {
      console.error('Get enabled category mappings error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Get a single category mapping by ID (admin only)
   */
  async getCategoryMapping(id: string): Promise<{
    success: boolean;
    mapping?: CategoryMapping;
    error?: string;
  }> {
    try {
      const data = await apiClient.get<{ mapping: CategoryMapping }>(`/admin/category-mappings/${id}`);

      return {
        success: true,
        mapping: data.mapping,
      };
    } catch (error) {
      console.error('Get category mapping error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Create a new category mapping (admin only)
   */
  async createCategoryMapping(
    input: CreateCategoryMappingInput
  ): Promise<{
    success: boolean;
    mapping?: CategoryMapping;
    error?: string;
  }> {
    try {
      const data = await apiClient.post<{ mapping: CategoryMapping }>('/admin/category-mappings', input);

      return {
        success: true,
        mapping: data.mapping,
      };
    } catch (error) {
      console.error('Create category mapping error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Update an existing category mapping (admin only)
   */
  async updateCategoryMapping(
    id: string,
    input: UpdateCategoryMappingInput
  ): Promise<{
    success: boolean;
    mapping?: CategoryMapping;
    error?: string;
  }> {
    try {
      const data = await apiClient.put<{ mapping: CategoryMapping }>(`/admin/category-mappings/${id}`, input);

      return {
        success: true,
        mapping: data.mapping,
      };
    } catch (error) {
      console.error('Update category mapping error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Delete a category mapping (admin only)
   */
  async deleteCategoryMapping(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.delete(`/admin/category-mappings/${id}`);

      return { success: true };
    } catch (error) {
      console.error('Delete category mapping error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Reorder category mappings (admin only)
   */
  async reorderCategoryMappings(
    orderings: CategoryMappingOrdering[]
  ): Promise<{
    success: boolean;
    mappings?: CategoryMapping[];
    error?: string;
  }> {
    try {
      const data = await apiClient.post<{ mappings?: CategoryMapping[] }>('/admin/category-mappings/reorder', { orderings });

      return {
        success: true,
        mappings: data.mappings || [],
      };
    } catch (error) {
      console.error('Reorder category mappings error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Bulk sync category mappings (admin only)
   */
  async syncCategoryMappings(
    mappings: CreateCategoryMappingInput[]
  ): Promise<{
    success: boolean;
    mappings?: CategoryMapping[];
    error?: string;
  }> {
    try {
      const data = await apiClient.post<{ mappings?: CategoryMapping[] }>('/admin/category-mappings/sync', { mappings });

      return {
        success: true,
        mappings: data.mappings || [],
      };
    } catch (error) {
      console.error('Sync category mappings error:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  /**
   * Get custom category name for display (with fallback)
   * This is a convenience method that combines the enabled mappings with defaults
   */
  async getCategoryDisplayName(originalCategory: string): Promise<string> {
    const result = await this.getEnabledCategoryMappings();

    if (result.success && result.mappings) {
      const mapping = result.mappings.find(
        (m) => m.original_category === originalCategory.toLowerCase()
      );

      if (mapping) {
        return mapping.custom_name;
      }
    }

    // Fallback to default labels
    const defaultLabels: Record<string, string> = {
      standard: 'Standard',
      nanode: 'Nanode',
      dedicated: 'Dedicated CPU',
      premium: 'Premium',
      highmem: 'High Memory',
      gpu: 'GPU',
      accelerated: 'Accelerated',
      memory: 'High Memory',
      cpu: 'Dedicated CPU',
    };

    return (
      defaultLabels[originalCategory.toLowerCase()] ||
      originalCategory.charAt(0).toUpperCase() + originalCategory.slice(1)
    );
  }

  /**
   * Get custom category description for display (with fallback)
   * This is a convenience method that combines the enabled mappings with defaults
   */
  async getCategoryDescription(
    originalCategory: string
  ): Promise<string | null> {
    const result = await this.getEnabledCategoryMappings();

    if (result.success && result.mappings) {
      const mapping = result.mappings.find(
        (m) => m.original_category === originalCategory.toLowerCase()
      );

      if (mapping && mapping.custom_description) {
        return mapping.custom_description;
      }
    }

    // Fallback to default descriptions
    const defaultDescriptions: Record<string, string> = {
      standard:
        'Standard VPS plans offer a good mix of performance, resources, and price for most workloads.',
      nanode:
        'Affordable entry-level plans perfect for testing, development, and lightweight applications.',
      dedicated:
        'Dedicated CPU plans give you full access to CPU cores for consistent performance.',
      premium:
        'Premium plans offer the latest high-performance CPUs with consistent performance for demanding workloads.',
      highmem:
        'High Memory plans favor RAM over other resources, great for caching and in-memory databases.',
      gpu:
        'GPU plans include dedicated GPUs for machine learning, AI, and video transcoding workloads.',
      accelerated:
        'Accelerated plans provide enhanced performance for I/O-intensive workloads.',
      memory:
        'High Memory plans favor RAM over other resources, great for caching and in-memory databases.',
      cpu:
        'Dedicated CPU plans give you full access to CPU cores for consistent performance.',
    };

    return (
      defaultDescriptions[originalCategory.toLowerCase()] || null
    );
  }
}

export const categoryMappingService = new CategoryMappingService();
