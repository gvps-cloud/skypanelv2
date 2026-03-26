import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Search,
  AlertCircle,
  ChevronRight,
  FileText,
  Download,
  Menu,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BRAND_NAME } from "../lib/brand";
import PublicLayout from "@/components/PublicLayout";
import { apiClient } from "@/lib/api";
import type {
  DocumentationCategoriesResponse,
  DocumentationCategoryWithArticles,
  DocumentationArticleWithFiles,
} from "@/types/documentation";

// Icon mapping for categories
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket: BookOpen,
  User: BookOpen,
  CreditCard: BookOpen,
  Server: BookOpen,
  Code: BookOpen,
  default: BookOpen,
};

function getCategoryIcon(iconName: string | null) {
  return iconMap[iconName || "default"] || iconMap.default;
}

export default function Documentation() {
  const { categorySlug, articleSlug } = useParams<{
    categorySlug?: string;
    articleSlug?: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<DocumentationCategoryWithArticles[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<DocumentationArticleWithFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.get<DocumentationCategoriesResponse>(
          "/documentation/categories"
        );
        setCategories(response.categories || []);
      } catch (err) {
        console.error("Failed to fetch documentation categories:", err);
        setError(err instanceof Error ? err.message : "Failed to load documentation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Fetch article when URL changes
  useEffect(() => {
    const fetchArticle = async () => {
      if (!articleSlug) {
        setSelectedArticle(null);
        return;
      }

      try {
        setIsLoadingArticle(true);
        const response = await apiClient.get<{ article: DocumentationArticleWithFiles }>(
          `/documentation/articles/${articleSlug}?category_slug=${categorySlug}`
        );
        setSelectedArticle(response.article);
      } catch (err) {
        console.error("Failed to fetch article:", err);
        setSelectedArticle(null);
      } finally {
        setIsLoadingArticle(false);
      }
    };

    fetchArticle();
  }, [categorySlug, articleSlug]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;

    return categories
      .map((cat) => ({
        ...cat,
        articles: (cat.articles || []).filter(
          (article) =>
            article.title.toLowerCase().includes(query) ||
            (article.summary && article.summary.toLowerCase().includes(query))
        ),
      }))
      .filter((cat) => cat.articles.length > 0);
  }, [searchQuery, categories]);

  // Get current category
  const currentCategory = useMemo(() => {
    if (!categorySlug) return null;
    return categories.find((cat) => cat.slug === categorySlug);
  }, [categorySlug, categories]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle article click
  const handleArticleClick = (catSlug: string, artSlug: string) => {
    navigate(`/docs/${catSlug}/${artSlug}`);
    setMobileMenuOpen(false);
  };

  // Sidebar content
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Documentation</h2>
        <p className="text-sm text-muted-foreground">
          Browse guides and references
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Category/Article List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                </div>
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? "No results found" : "No categories available"}
            </div>
          ) : (
            filteredCategories.map((category) => {
              const IconComponent = getCategoryIcon(category.icon);
              const isActive = categorySlug === category.slug;

              return (
                <div key={category.id} className="mb-2">
                  <button
                    onClick={() => {
                      navigate(`/docs/${category.slug}`);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium truncate">{category.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {category.article_count || (category.articles?.length || 0)}
                    </Badge>
                  </button>

                  {/* Articles in category */}
                  {(isActive || searchQuery) && category.articles && category.articles.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1">
                      {category.articles.map((article) => {
                        const isArticleActive =
                          categorySlug === category.slug && articleSlug === article.slug;

                        return (
                          <button
                            key={article.id}
                            onClick={() => handleArticleClick(category.slug, article.slug)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-sm transition-colors ${
                              isArticleActive
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{article.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Article content renderer
  const ArticleContent = ({ article }: { article: DocumentationArticleWithFiles }) => (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 not-prose">
        <Link to="/docs" className="hover:text-foreground">Documentation</Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          to={`/docs/${article.category?.slug}`}
          className="hover:text-foreground"
        >
          {article.category?.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{article.title}</span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>

      {/* Summary */}
      {article.summary && (
        <p className="text-lg text-muted-foreground mb-6">{article.summary}</p>
      )}

      {/* Content */}
      <div
        className="prose-content"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Files */}
      {article.files && article.files.length > 0 && (
        <div className="mt-8 not-prose">
          <h3 className="text-lg font-semibold mb-4">Attachments</h3>
          <div className="space-y-2">
            {article.files.map((file) => (
              <a
                key={file.id}
                href={`/api/documentation/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.file_size)}
                  </p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Category overview
  const CategoryOverview = ({ category }: { category: DocumentationCategoryWithArticles }) => (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/docs" className="hover:text-foreground">Documentation</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{category.name}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
        {category.description && (
          <p className="text-muted-foreground">{category.description}</p>
        )}
      </div>

      {/* Articles grid */}
      {category.articles && category.articles.length > 0 ? (
        <div className="grid gap-4">
          {category.articles.map((article) => (
            <Card
              key={article.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleArticleClick(category.slug, article.slug)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {article.title}
                </CardTitle>
              </CardHeader>
              {article.summary && (
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {article.summary}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No articles in this category yet.
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Welcome / Index page
  const WelcomePage = () => (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground">
          Welcome to {BRAND_NAME} documentation. Browse the categories below to find guides,
          tutorials, and reference materials.
        </p>
      </div>

      {/* Category cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredCategories.map((category) => {
          const IconComponent = getCategoryIcon(category.icon);
          return (
            <Card
              key={category.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/docs/${category.slug}`)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconComponent className="h-5 w-5" />
                  {category.name}
                </CardTitle>
                {category.description && (
                  <CardDescription>{category.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {category.article_count || (category.articles?.length || 0)} articles
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <PublicLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-72 border-r bg-muted/30">
          <SidebarContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile header with menu button */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
            <h2 className="font-semibold">
              {selectedArticle
                ? selectedArticle.title
                : currentCategory
                ? currentCategory.name
                : "Documentation"}
            </h2>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>

          {/* Content area */}
          <div className="p-6 lg:p-8 max-w-4xl">
            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {/* Error State */}
            {!isLoading && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading documentation</AlertTitle>
                <AlertDescription>
                  {error}. Please try refreshing the page.
                </AlertDescription>
              </Alert>
            )}

            {/* Content */}
            {!isLoading && !error && (
              <>
                {isLoadingArticle ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : selectedArticle ? (
                  <ArticleContent article={selectedArticle} />
                ) : currentCategory ? (
                  <CategoryOverview category={currentCategory} />
                ) : (
                  <WelcomePage />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </PublicLayout>
  );
}
