/**
 * Category Mapping Types
 * White-label category mappings for VPS plan types
 */

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

export interface CategoryMappingOrdering {
  id: string;
  display_order: number;
}

// Valid original categories from Linode API
export const VALID_ORIGINAL_CATEGORIES = [
  'standard',
  'nanode',
  'dedicated',
  'premium',
  'highmem',
  'gpu',
  'accelerated',
] as const;

export type OriginalCategory = typeof VALID_ORIGINAL_CATEGORIES[number];