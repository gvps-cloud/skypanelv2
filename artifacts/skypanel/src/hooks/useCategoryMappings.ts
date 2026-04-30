/**
 * Category Mappings Hook
 * React hook for managing white-label category mappings
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryMappingService } from '../services/categoryMappingService.js';
import type {
  CreateCategoryMappingInput,
  UpdateCategoryMappingInput,
  CategoryMappingOrdering,
} from '../types/categoryMappings.js';

// Query keys
export const categoryMappingKeys = {
  all: ['category-mappings'] as const,
  enabled: ['category-mappings', 'enabled'] as const,
  detail: (id: string) => ['category-mappings', id] as const,
};

/**
 * Hook for fetching all category mappings (admin)
 */
export function useCategoryMappings() {
  return useQuery({
    queryKey: categoryMappingKeys.all,
    queryFn: async () => {
      const result = await categoryMappingService.getAllCategoryMappings();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch category mappings');
      }
      return result.mappings || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching enabled category mappings (public)
 */
export function useEnabledCategoryMappings() {
  return useQuery({
    queryKey: categoryMappingKeys.enabled,
    queryFn: async () => {
      const result = await categoryMappingService.getEnabledCategoryMappings();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch enabled category mappings');
      }
      return result.mappings || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - cache longer for public data
  });
}

/**
 * Hook for fetching a single category mapping (admin)
 */
export function useCategoryMapping(id: string) {
  return useQuery({
    queryKey: categoryMappingKeys.detail(id),
    queryFn: async () => {
      const result = await categoryMappingService.getCategoryMapping(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch category mapping');
      }
      return result.mapping;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for creating a category mapping (admin)
 */
export function useCreateCategoryMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryMappingInput) => {
      const result = await categoryMappingService.createCategoryMapping(input);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create category mapping');
      }
      return result.mapping;
    },
    onSuccess: () => {
      // Invalidate and refetch category mappings queries
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.enabled });
    },
  });
}

/**
 * Hook for updating a category mapping (admin)
 */
export function useUpdateCategoryMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCategoryMappingInput }) => {
      const result = await categoryMappingService.updateCategoryMapping(id, input);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update category mapping');
      }
      return result.mapping;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch category mappings queries
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.enabled });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook for deleting a category mapping (admin)
 */
export function useDeleteCategoryMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await categoryMappingService.deleteCategoryMapping(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete category mapping');
      }
      return id;
    },
    onSuccess: () => {
      // Invalidate and refetch category mappings queries
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.enabled });
    },
  });
}

/**
 * Hook for reordering category mappings (admin)
 */
export function useReorderCategoryMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderings: CategoryMappingOrdering[]) => {
      const result = await categoryMappingService.reorderCategoryMappings(orderings);
      if (!result.success) {
        throw new Error(result.error || 'Failed to reorder category mappings');
      }
      return result.mappings || [];
    },
    onSuccess: () => {
      // Invalidate and refetch category mappings queries
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.enabled });
    },
  });
}

/**
 * Hook for syncing category mappings (admin)
 */
export function useSyncCategoryMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mappings: CreateCategoryMappingInput[]) => {
      const result = await categoryMappingService.syncCategoryMappings(mappings);
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync category mappings');
      }
      return result.mappings || [];
    },
    onSuccess: () => {
      // Invalidate and refetch category mappings queries
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryMappingKeys.enabled });
    },
  });
}

/**
 * Hook for getting custom category display name
 */
export function useCategoryDisplayName(originalCategory: string) {
  const { data: mappings } = useEnabledCategoryMappings();

  const customName = mappings?.find(
    (m) => m.original_category === originalCategory.toLowerCase()
  )?.custom_name;

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

  const displayName =
    customName ||
    defaultLabels[originalCategory.toLowerCase()] ||
    originalCategory.charAt(0).toUpperCase() + originalCategory.slice(1);

  return displayName;
}

/**
 * Hook for getting custom category description
 */
export function useCategoryDescription(originalCategory: string) {
  const { data: mappings } = useEnabledCategoryMappings();

  const customDescription = mappings?.find(
    (m) => m.original_category === originalCategory.toLowerCase()
  )?.custom_description;

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

  const description =
    customDescription ||
    defaultDescriptions[originalCategory.toLowerCase()] ||
    null;

  return description;
}