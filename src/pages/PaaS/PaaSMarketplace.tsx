/**
 * PaaS Marketplace Page
 * Browse and deploy templates from the marketplace
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Star, Download, ArrowRight, ArrowLeft, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketplaceCardSkeleton, MarketplaceGridSkeleton } from '@/components/ui/skeleton-card';
import { apiClient } from '@/lib/api';
import { useMarketplacePagination, type PaginatedResponse } from '@/hooks/useMarketplacePagination';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon_url?: string;
  git_url: string;
  git_branch?: string;
  buildpack?: string;
  recommended_plan_slug?: string;
  min_cpu_cores?: number;
  min_ram_mb?: number;
  deploy_count: number;
  rating: number;
  is_featured: boolean;
  created_at?: string;
}

const categoryIcons: Record<string, string> = {
  nodejs: '🟢',
  python: '🐍',
  php: '🐘',
  cms: '📝',
  frontend: '⚛️',
  'full-stack': '🔥',
  golang: '🔷',
  database: '🗄️',
};

const categoryLabels: Record<string, string> = {
  nodejs: 'Node.js',
  python: 'Python',
  php: 'PHP',
  cms: 'CMS',
  frontend: 'Frontend',
  'full-stack': 'Full-Stack',
  golang: 'Go',
  database: 'Database',
};

// API function to fetch templates with pagination
const fetchMarketplaceTemplates = async (params: any) => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
    ...(params.search && { search: params.search }),
    ...(params.category && { category: params.category }),
    ...(params.featured && { featured: 'true' }),
  });

  try {
    const response = await apiClient.get(`/paas/marketplace/templates?${queryParams}`);
    return response;
  } catch (error) {
    throw error;
  }
};

const PaaSMarketplace: React.FC = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<Template[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const navigate = useNavigate();

  // Initialize pagination hook
  const {
    data: templates,
    pagination,
    isLoading,
    isError,
    error,
    filters,
    updateSearch,
    updateCategory,
    updateFeatured,
    clearFilters,
    nextPage,
    prevPage,
    isEmpty,
    isFirstPage,
    isLastPage,
  } = useMarketplacePagination<Template>({
    initialLimit: 12,
    fetchFunction: fetchMarketplaceTemplates,
    queryKey: ['marketplace-templates'],
  });

  
  // Load categories and featured templates on mount
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      setLoadingCategories(true);

      // Load categories (we can get this from the first page or a separate endpoint)
      const initialResponse = await apiClient.get('/paas/marketplace/templates?limit=100');

      const templatesArray: Template[] = Array.isArray(initialResponse.data)
        ? (initialResponse.data as Template[])
        : [];
      const allCategories = Array.from(
        new Set(
          templatesArray
            .map((t) => (typeof t.category === 'string' ? t.category : ''))
            .filter((cat) => cat.length > 0)
        )
      );
      setCategories(allCategories);

      // Load featured templates
      const featured = initialResponse.data?.filter((t: Template) => t.is_featured) || [];
      setFeaturedTemplates(featured);
    } catch (error) {
      toast.error('Failed to load marketplace data');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleDeploy = (slug: string) => {
    navigate(`/paas/marketplace/deploy/${slug}`);
  };

  const handleSearch = (value: string) => {
    updateSearch(value);
  };

  const handleCategoryChange = (category: string) => {
    updateCategory(category === 'all' ? undefined : category);
  };

  const handleToggleFeatured = () => {
    updateFeatured(!filters.featured);
  };

  const handleClearFilters = () => {
    clearFilters();
  };

  const startIndex =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endIndex =
    pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/paas')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to PaaS
        </Button>
      </div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8" />
          <h1 className="text-3xl font-bold">PaaS Marketplace</h1>
        </div>
        <p className="text-muted-foreground">
          Deploy popular frameworks and applications with one click
        </p>
      </div>

      {/* Featured Templates */}
      {featuredTemplates.length > 0 && !filters.search && !filters.category && !filters.featured && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Featured Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredTemplates.slice(0, 6).map((template) => (
              <Card key={template.id} className="border-2 border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{categoryIcons[template.category] || '📦'}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      </div>
                    </div>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {template.deploy_count}
                      </span>
                    </div>
                    <Button size="sm" onClick={() => handleDeploy(template.slug)}>
                      Deploy
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.category || 'all'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {categoryIcons[cat] || ''} {categoryLabels[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filters.featured ? 'default' : 'outline'}
          onClick={handleToggleFeatured}
        >
          <Star className="w-4 h-4 mr-2" />
          Featured Only
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all" onClick={() => handleCategoryChange('all')}>
            All Templates
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} onClick={() => handleCategoryChange(cat)}>
              {categoryIcons[cat] || ''} {categoryLabels[cat] || cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {isLoading && templates.length === 0 ? (
        <div>
          <div className="mb-6 text-sm text-muted-foreground">
            Loading marketplace templates...
          </div>
          <MarketplaceGridSkeleton count={12} />
        </div>
      ) : isError ? (
        <Card className="py-12">
          <CardContent>
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-lg font-medium mb-2">Failed to load templates</p>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card className="py-12">
          <CardContent>
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No templates found</p>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{categoryIcons[template.category] || '📦'}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      </div>
                    </div>
                    {template.is_featured && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {template.deploy_count}
                      </span>
                      {template.buildpack && (
                        <Badge variant="secondary" className="text-xs">
                          {template.buildpack.split('/')[1]}
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" onClick={() => handleDeploy(template.slug)}>
                      Deploy
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.total > pagination.limit && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex}-{endIndex} of {pagination.total} templates (Page{' '}
                {pagination.page} of {Math.max(1, pagination.totalPages)})
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={prevPage}
                  disabled={!pagination.hasPrevPage || isLoading || isFirstPage}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={nextPage}
                  disabled={!pagination.hasNextPage || isLoading || isLastPage}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Results Count */}
      {!isLoading && !isEmpty && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <div>
            Showing {startIndex}-{endIndex} of {pagination.total} templates
            {pagination.page > 1 && ` (Page ${pagination.page} of ${Math.max(1, pagination.totalPages)})`}
          </div>
          {filters.search && (
            <div className="text-xs mt-1">
              Results for "{filters.search}"
              {filters.category && ` in ${filters.category}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaaSMarketplace;
