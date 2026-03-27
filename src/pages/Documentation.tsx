import { useEffect, useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  Search,
  AlertCircle,
  ChevronRight,
  FileText,
  Download,
  Menu,
  X,
  ArrowLeft,
  Rocket,
  User,
  CreditCard,
  Server,
  Code,
  LayoutGrid,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import ApiReference from "@/components/docs/ApiReference";

const categoryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  User,
  CreditCard,
  Server,
  Code,
};

function getCategoryIcon(iconName: string | null) {
  return categoryIconMap[iconName || ""] || BookOpen;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  categories,
  categorySlug,
  articleSlug,
  searchQuery,
  onSearchChange,
  onNavigate,
}: {
  categories: DocumentationCategoryWithArticles[];
  categorySlug?: string;
  articleSlug?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigate: (path: string) => void;
}) {
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        (cat.description || "").toLowerCase().includes(q) ||
        (cat.articles || []).some(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            (a.summary || "").toLowerCase().includes(q)
        )
    );
  }, [categories, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Logo / title */}
      <div className="px-5 pt-5 pb-4">
        <Link to="/docs" className="flex items-center gap-2.5 group" onClick={() => onNavigate("/docs")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight">Docs</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search docs..."
            className="h-8 pl-8 text-sm bg-muted/60 border-0 focus-visible:ring-1"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Nav list */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-0.5 pb-6">
          {filteredCategories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            const isActive = categorySlug === cat.slug;
            const hasArticles = searchQuery.trim() || isActive;

            return (
              <div key={cat.id}>
                <button
                  onClick={() => onNavigate(`/docs/${cat.slug}`)}
                  className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                    isActive && !articleSlug
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate flex-1">{cat.name}</span>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal tabular-nums">
                    {cat.article_count || (cat.articles?.length || 0)}
                  </Badge>
                </button>

                {/* Show articles when category is active or searching */}
                {hasArticles && cat.articles && cat.articles.length > 0 && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
                    {cat.articles.map((article) => {
                      const isArticleActive =
                        categorySlug === cat.slug && articleSlug === article.slug;
                      return (
                        <button
                          key={article.id}
                          onClick={() => onNavigate(`/docs/${cat.slug}/${article.slug}`)}
                          className={`w-full text-left rounded-md px-2 py-1 text-[13px] transition-colors ${
                            isArticleActive
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {article.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredCategories.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground text-center">
              No results for &quot;{searchQuery}&quot;
            </p>
          )}
        </nav>
      </ScrollArea>
    </div>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({
  category,
  article,
}: {
  category?: { name: string; slug: string };
  article?: string;
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
      <Link to="/docs" className="hover:text-foreground transition-colors">
        Docs
      </Link>
      {category && (
        <>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to={`/docs/${category.slug}`}
            className="hover:text-foreground transition-colors"
          >
            {category.name}
          </Link>
        </>
      )}
      {article && (
        <>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{article}</span>
        </>
      )}
    </nav>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Documentation() {
  const { categorySlug, articleSlug } = useParams<{
    categorySlug?: string;
    articleSlug?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<DocumentationCategoryWithArticles[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<DocumentationArticleWithFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleNotFound, setArticleNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      setMobileOpen(false);
    },
    [navigate]
  );

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

  // Fetch category with articles when navigating to a category
  useEffect(() => {
    if (!categorySlug) return;
    // Don't fetch if we already have articles for this category
    const existing = categories.find((c) => c.slug === categorySlug);
    if (existing?.articles && existing.articles.length > 0) return;

    const fetchCategory = async () => {
      try {
        const response = await apiClient.get<{ category: DocumentationCategoryWithArticles }>(
          `/documentation/categories/${categorySlug}`
        );
        const cat = response.category;
        setCategories((prev) =>
          prev.map((c) => (c.slug === categorySlug ? { ...c, articles: cat.articles || [] } : c))
        );
      } catch (err) {
        console.error("Failed to fetch category:", err);
      }
    };
    fetchCategory();
  }, [categorySlug, categories]);

  // Fetch article content
  useEffect(() => {
    if (!articleSlug) {
      setSelectedArticle(null);
      setArticleNotFound(false);
      return;
    }

    const fetchArticle = async () => {
      try {
        setIsLoadingArticle(true);
        setArticleNotFound(false);
        const response = await apiClient.get<{ article: DocumentationArticleWithFiles }>(
          `/documentation/articles/${articleSlug}?category_slug=${categorySlug}`
        );
        setSelectedArticle(response.article);
      } catch {
        setSelectedArticle(null);
        setArticleNotFound(true);
      } finally {
        setIsLoadingArticle(false);
      }
    };
    fetchArticle();
  }, [articleSlug, categorySlug]);

  // Clear search on navigation
  useEffect(() => {
    setSearchQuery("");
  }, [location.pathname]);

  // Derived state
  const currentCategory = useMemo(
    () => (categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined),
    [categorySlug, categories]
  );

  // ── Render: Index (no category selected) ─────────────────────────────────

  const renderIndex = () => (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Documentation</h1>
        <p className="text-muted-foreground text-lg">
          Guides, tutorials, and API reference to help you get the most out of {BRAND_NAME}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          return (
            <Link
              key={cat.id}
              to={`/docs/${cat.slug}`}
              className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/40"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{cat.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {cat.article_count || 0} article{cat.article_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  // ── Render: Category view ────────────────────────────────────────────────

  const renderCategory = (cat: DocumentationCategoryWithArticles) => (
    <div className="max-w-3xl">
      <Breadcrumb category={{ name: cat.name, slug: cat.slug }} />

      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          {(() => {
            const Icon = getCategoryIcon(cat.icon);
            return <Icon className="h-6 w-6 text-primary" />;
          })()}
          <h1 className="text-2xl font-bold tracking-tight">{cat.name}</h1>
        </div>
        {cat.description && <p className="text-muted-foreground">{cat.description}</p>}
      </div>

      {!cat.articles || cat.articles.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 py-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No articles in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cat.articles.map((article) => (
            <Link
              key={article.id}
              to={`/docs/${cat.slug}/${article.slug}`}
              className="group flex items-center gap-3 rounded-lg border p-4 transition-all hover:bg-accent hover:border-primary/30"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                {article.summary && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{article.summary}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render: Article view ─────────────────────────────────────────────────

  const renderArticle = (article: DocumentationArticleWithFiles) => (
    <article className="max-w-3xl">
      <Breadcrumb
        category={article.category ? { name: article.category.name, slug: article.category.slug } : undefined}
        article={article.title}
      />

      <h1 className="text-2xl font-bold tracking-tight mb-3">{article.title}</h1>
      {article.summary && (
        <p className="text-muted-foreground text-lg mb-8">{article.summary}</p>
      )}

      {/* HTML content */}
      <div
        className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted prose-pre:border prose-table:text-sm"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(article.content, { USE_PROFILES: { html: true } }),
        }}
      />

      {/* File attachments */}
      {article.files && article.files.length > 0 && (
        <div className="mt-10 border-t pt-6">
          <h3 className="text-sm font-semibold mb-3">Attachments</h3>
          <div className="space-y-2">
            {article.files.map((file) => (
              <a
                key={file.id}
                href={`/api/documentation/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">{file.filename}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );

  // ── Render: Loading / Error ──────────────────────────────────────────────

  const renderLoading = () => (
    <div className="max-w-3xl space-y-4 animate-pulse">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full" />
    </div>
  );

  // ── Main layout ──────────────────────────────────────────────────────────

  const sidebarProps = {
    categories,
    categorySlug,
    articleSlug,
    searchQuery,
    onSearchChange: setSearchQuery,
    onNavigate: handleNavigate,
  };

  // Check if this is the API Reference category
  const isApiReferenceCategory = categorySlug === "api-reference" && !articleSlug;

  const content = isLoading ? (
    renderLoading()
  ) : error ? (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Failed to load documentation</p>
          <p className="text-sm mt-0.5">{error}</p>
        </div>
      </div>
    </div>
  ) : isLoadingArticle ? (
    renderLoading()
  ) : articleNotFound ? (
    <div className="max-w-3xl text-center py-16">
      <AlertCircle className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
      <h2 className="text-lg font-semibold mb-1">Article not found</h2>
      <p className="text-sm text-muted-foreground mb-4">
        The article you&apos;re looking for doesn&apos;t exist or has been removed.
      </p>
      <Button variant="outline" onClick={() => handleNavigate("/docs")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to docs
      </Button>
    </div>
  ) : selectedArticle ? (
    renderArticle(selectedArticle)
  ) : isApiReferenceCategory ? (
    // Render ApiReference component for api-reference category
    <ApiReference onBack={() => handleNavigate("/docs")} />
  ) : currentCategory ? (
    renderCategory(currentCategory)
  ) : (
    renderIndex()
  );

  return (
    <PublicLayout>
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 border-r bg-muted/20">
          <div className="sticky top-16 w-full max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
            <Sidebar {...sidebarProps} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile top bar */}
          <div className="lg:hidden sticky top-16 z-20 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-4 h-12">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <Sidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              {currentCategory && (
                <>
                  <Link to="/docs" className="text-muted-foreground hover:text-foreground">
                    Docs
                  </Link>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </>
              )}
              <span className="truncate font-medium">
                {selectedArticle?.title || currentCategory?.name || "Documentation"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-8 lg:px-10 lg:py-10">{content}</div>
        </main>
      </div>
    </PublicLayout>
  );
}
