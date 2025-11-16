import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  featured?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface UseMarketplacePaginationOptions<T> {
  initialPage?: number;
  initialLimit?: number;
  fetchFunction: (params: PaginationParams) => Promise<PaginatedResponse<T>>;
  queryKey: string[];
  staleTime?: number;
  enabled?: boolean;
}

export function useMarketplacePagination<T>({
  initialPage = 1,
  initialLimit = 12,
  fetchFunction,
  queryKey,
  staleTime = 30000,
  enabled = true,
}: UseMarketplacePaginationOptions<T>) {
  const [filters, setFilters] = useState<PaginationParams>({
    page: initialPage,
    limit: initialLimit,
  });

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, filters],
    queryFn: () => fetchFunction(filters),
    staleTime,
    enabled,
  });

  const updatePage = useCallback((newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: Math.max(1, newPage),
    }));
  }, []);

  const updateLimit = useCallback((newLimit: number) => {
    setFilters(prev => ({
      ...prev,
      limit: Math.max(1, newLimit),
      page: 1, // Reset to first page when changing limit
    }));
  }, []);

  const updateSearch = useCallback((search: string) => {
    setFilters(prev => ({
      ...prev,
      search: search.trim() || undefined,
      page: 1, // Reset to first page when searching
    }));
  }, []);

  const updateCategory = useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      category: category === "all" ? undefined : category,
      page: 1, // Reset to first page when changing category
    }));
  }, []);

  const updateFeatured = useCallback((featured: boolean) => {
    setFilters(prev => ({
      ...prev,
      featured: featured || undefined,
      page: 1, // Reset to first page when toggling featured
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      page: initialPage,
      limit: initialLimit,
    });
  }, [initialPage, initialLimit]);

  const nextPage = useCallback(() => {
    if (response?.pagination.hasNextPage) {
      updatePage(filters.page + 1);
    }
  }, [response?.pagination.hasNextPage, filters.page, updatePage]);

  const prevPage = useCallback(() => {
    if (response?.pagination.hasPrevPage) {
      updatePage(filters.page - 1);
    }
  }, [response?.pagination.hasPrevPage, filters.page, updatePage]);

  const loadMore = useCallback(() => {
    if (response?.pagination.hasNextPage) {
      setFilters(prev => ({
        ...prev,
        page: prev.page + 1,
      }));
    }
  }, [response?.pagination.hasNextPage]);

  return {
    data: response?.data || [],
    pagination: response?.pagination || {
      total: 0,
      page: 1,
      limit: initialLimit,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
    isLoading,
    isError,
    error,
    filters,

    // Actions
    updatePage,
    updateLimit,
    updateSearch,
    updateCategory,
    updateFeatured,
    clearFilters,
    nextPage,
    prevPage,
    loadMore,
    refetch,

    // Computed states
    canLoadMore: !!response?.pagination.hasNextPage,
    isEmpty: !response?.data || response.data.length === 0,
    isFirstPage: filters.page === 1,
    isLastPage: !response?.pagination.hasNextPage,
  };
}