import { useEffect, useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import type { ReactNode } from "react";
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
  Globe,
  Cpu,
  Wifi,
  Loader2,
  ChevronDown,
} from "lucide-react";

import "@/styles/home.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BRAND_NAME } from "../lib/brand";
import { apiClient } from "@/lib/api";
import type {
  DocumentationCategoriesResponse,
  DocumentationCategoryWithArticles,
  DocumentationArticleWithFiles,
} from "@/types/documentation";
import ApiReference from "@/components/docs/ApiReference";
import { useEnabledCategoryMappings } from "@/hooks/useCategoryMappings";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

/* ─── Trust Items ────────────────────────────────────────────────── */

/* ── Plans & Regions constants ─────────────────────────────────────────────────*/

const DEFAULT_CATEGORY_META = {
  nanode: { label: "Nanode", order: 0 },
  standard: { label: "Standard", order: 1 },
  dedicated: { label: "Dedicated CPU", order: 2 },
  premium: { label: "Premium", order: 3 },
  highmem: { label: "High Memory", order: 4 },
  gpu: { label: "GPU", order: 5 },
  accelerated: { label: "Accelerated", order: 6 },
} as const;

/* ── Plans & Regions types ───────────────────────────────────────────────────*/

interface VpsPlan {
  id: number | string;
  name: string;
  base_price: number;
  markup_price: number;
  specifications: {
    vcpus?: number;
    memory?: number;
    disk?: number;
    transfer?: number;
    transfer_gb?: number;
    [key: string]: unknown;
  };
  type_class?: string;
}

interface PublicRegion {
  id: string;
  label: string;
  country: string;
  status: string;
  site_type: string;
  speedTestUrl?: string;
  displayLabel?: string;
  displayCountry?: string;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}

// disk from Linode API is in MB; convert to GB for display
function formatStorage(mb: number): string {
  const gb = mb / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  if (gb === Math.floor(gb)) return `${gb} GB`;
  return `${gb.toFixed(1)} GB`;
}

// transfer from Linode API is in GB
function formatTransfer(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(0)} TB`;
  return `${gb} GB`;
}

function formatMonthlyPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const categoryIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Rocket,
  User,
  CreditCard,
  Server,
  Code,
  Globe,
};

function getCategoryIcon(iconName: string | null) {
  return categoryIconMap[iconName || ""] || BookOpen;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Replace documentation template placeholders before rendering.
// {{PLATFORM_URL}} → current origin (e.g. https://gvps.cloud)
function renderDocHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  const platformUrl = window.location.origin;
  const replaced = raw.replace(/\{\{PLATFORM_URL\}\}/g, platformUrl);
  return DOMPurify.sanitize(replaced);
}

function SanitizedHtml({ html, className }: { html: string; className: string }) {
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Monospace, wide-tracked text style used throughout the docs UI */
const DOCS_FONT = "font-mono tracking-wider";

/* ── Sidebar ────────────────────────────────────────────────────────────────*/

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand the active category; collapse all others on first load
  useEffect(() => {
    if (categorySlug) {
      setExpanded((prev) => {
        const next = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
        next[categorySlug] = true;
        return next;
      });
    }
  }, [categorySlug]);

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
            (a.summary || "").toLowerCase().includes(q),
        ),
    );
  }, [categories, searchQuery]);

  const toggle = (slug: string) =>
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div className="flex flex-col h-full">
      {/* Logo / title */}
      <div className="px-5 pt-5 pb-4">
        <Link
          to="/docs"
          className="flex items-center gap-2.5 group"
          onClick={() => onNavigate("/docs")}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/20 bg-muted shrink-0">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-tight font-mono tracking-wider">Docs</span>
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
            className="h-8 pl-8 text-sm bg-muted/60 border-0 focus-visible:ring-1 font-mono tracking-wider"
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

      {/* Nav tree — always show nested articles */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-0.5 pb-6">
          {filteredCategories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            const isActive = categorySlug === cat.slug;
            const isExpanded = !!expanded[cat.slug];
            const hasArticles = cat.articles && cat.articles.length > 0;

            return (
              <div key={cat.id}>
                <div className="flex items-center">
                  {hasArticles && (
                    <button
                      onClick={() => toggle(cat.slug)}
                      className="mr-1 p-0.5 rounded hover:bg-accent/50 shrink-0"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                      />
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate(`/docs/${cat.slug}`)}
                    className={`flex-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                      isActive && !articleSlug
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{cat.name}</span>
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 text-[10px] font-normal tabular-nums shrink-0"
                    >
                      {cat.article_count || cat.articles?.length || 0}
                    </Badge>
                  </button>
                </div>

                {/* Always render article list; show only when expanded or active */}
                {hasArticles && (
                  <div
                    className={`ml-5 mt-0.5 space-y-0.5 border-l border-border/50 pl-3 overflow-hidden transition-all duration-200 ${
                      isExpanded || isActive ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    {cat.articles!.map((article) => {
                      const isArticleActive =
                        categorySlug === cat.slug &&
                        articleSlug === article.slug;
                      return (
                        <button
                          key={article.id}
                          onClick={() =>
                            onNavigate(`/docs/${cat.slug}/${article.slug}`)
                          }
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

/* ── Breadcrumb ───────────────────────────────────────────────────────────────*/

function Breadcrumb({
  category,
  article,
  className = "mb-6",
}: {
  category?: { name: string; slug: string };
  article?: string;
  className?: string;
}) {
  return (
    <nav
      className={`flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}
    >
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

/* ── Page header (docs-first, no marketing chrome) ───────────────────────*/

function DocsPageHeader({
  title,
  description,
  breadcrumb,
}: {
  title: ReactNode;
  description?: string;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="border-b border-border/50 pb-6 mb-8">
      {breadcrumb}
      <h1 className="text-3xl font-semibold tracking-tight mt-3">
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground mt-1.5">{description}</p>
      )}
    </div>
  );
}

export default function Documentation() {
  const { categorySlug, articleSlug } = useParams<{
    categorySlug?: string;
    articleSlug?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<
    DocumentationCategoryWithArticles[]
  >([]);
  const [selectedArticle, setSelectedArticle] =
    useState<DocumentationArticleWithFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleNotFound, setArticleNotFound] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [vpsPlans, setVpsPlans] = useState<VpsPlan[]>([]);
  const [publicRegions, setPublicRegions] = useState<PublicRegion[]>([]);
  const [loadingPlansRegions, setLoadingPlansRegions] = useState(false);
  const { data: enabledCategoryMappings = [] } = useEnabledCategoryMappings();

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      setMobileOpen(false);
    },
    [navigate],
  );

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get<DocumentationCategoriesResponse>(
          "/documentation/categories",
        );
        setCategories(response.categories || []);
      } catch (err) {
        console.error("Failed to fetch documentation categories:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load documentation",
        );
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
        const response = await apiClient.get<{
          category: DocumentationCategoryWithArticles;
        }>(`/documentation/categories/${categorySlug}`);
        const cat = response.category;
        setCategories((prev) =>
          prev.map((c) =>
            c.slug === categorySlug
              ? { ...c, articles: cat.articles || [] }
              : c,
          ),
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
        const response = await apiClient.get<{
          article: DocumentationArticleWithFiles;
        }>(
          `/documentation/articles/${articleSlug}?category_slug=${categorySlug}`,
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

  // Fetch plans & regions for the plans-regions and creating-your-first-vps articles
  useEffect(() => {
    if (
      articleSlug !== "plans-regions" &&
      articleSlug !== "creating-your-first-vps"
    )
      return;

    const fetchPlansAndRegions = async () => {
      try {
        setLoadingPlansRegions(true);
        const [plansData, regionsData] = await Promise.all([
          apiClient.get<{ plans?: VpsPlan[] }>("/pricing/vps"),
          apiClient.get<{ regions?: PublicRegion[] }>("/pricing/public-regions"),
        ]);
        setVpsPlans(plansData.plans || []);
        setPublicRegions(regionsData.regions || []);
      } catch (err) {
        console.error("Failed to fetch plans/regions for docs:", err);
      } finally {
        setLoadingPlansRegions(false);
      }
    };
    fetchPlansAndRegions();
  }, [articleSlug]);

  // Clear search on navigation
  useEffect(() => {
    setSearchQuery("");
  }, [location.pathname]);

  // Derived state
  const currentCategory = useMemo(
    () =>
      categorySlug
        ? categories.find((c) => c.slug === categorySlug)
        : undefined,
    [categorySlug, categories],
  );

  /* ── Render: Index (no category selected) ─────────────────────────────────*/

  const renderIndex = () => (
    <div className="max-w-3xl">
      <DocsPageHeader
        title="Documentation"
        description={`Guides, tutorials, and API reference to help you get the most out of ${BRAND_NAME}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          return (
            <Link
              key={cat.id}
              to={`/docs/${cat.slug}`}
              className="group home-feature-card"
            >
              <div className="flex items-start gap-3.5 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-muted transition-colors group-hover:border-primary/35">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {cat.article_count || 0} article
                    {cat.article_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  /* ── Render: Category view ────────────────────────────────────────────────*/

  const renderCategory = (cat: DocumentationCategoryWithArticles) => (
    <div className="max-w-3xl space-y-6">
      <DocsPageHeader
        title={cat.name}
        description={cat.description}
        breadcrumb={<Breadcrumb category={{ name: cat.name, slug: cat.slug }} />}
      />

      {!cat.articles || cat.articles.length === 0 ? (
        <div className="rounded-sm border bg-muted/30 py-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">
            No articles in this category yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cat.articles.map((article) => (
            <Link
              key={article.id}
              to={`/docs/${cat.slug}/${article.slug}`}
              className="group home-feature-card flex items-center gap-3 p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm group-hover:text-primary transition-colors">
                  {article.title}
                </p>
                {article.summary && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {article.summary}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Render: Plans & Regions article (dynamic data) ───────────────────────*/

  /* ── Helpers for Plans & Regions ──────────────────────────────────────────*/

  const getCategoryLabel = useCallback(
    (category: string): string => {
      const mapping = enabledCategoryMappings.find(
        (item) => item.original_category === category,
      );
      if (mapping?.custom_name) return mapping.custom_name;
      return (
        DEFAULT_CATEGORY_META[category]?.label ??
        category.charAt(0).toUpperCase() + category.slice(1)
      );
    },
    [enabledCategoryMappings],
  );

  const groupedPlans = useMemo(() => {
    const groups: Record<string, typeof vpsPlans> = {};
    for (const plan of vpsPlans) {
      const cat = plan.type_class || "standard";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(plan);
    }
    // Sort categories by display_order
    return Object.entries(groups).sort((a, b) => {
      const mappingA = enabledCategoryMappings.find(
        (m) => m.original_category === a[0],
      );
      const mappingB = enabledCategoryMappings.find(
        (m) => m.original_category === b[0],
      );
      const orderA =
        mappingA?.display_order ?? DEFAULT_CATEGORY_META[a[0]]?.order ?? 99;
      const orderB =
        mappingB?.display_order ?? DEFAULT_CATEGORY_META[b[0]]?.order ?? 99;
      return orderA - orderB;
    });
  }, [vpsPlans, enabledCategoryMappings]);

  // Latency state for inline speed testing (same approach as /status page)
  const [docsLatencyState, setDocsLatencyState] = useState<
    Record<string, { loading: boolean; latency?: number; error?: boolean }>
  >({});
  const [docsTestingAll, setDocsTestingAll] = useState(false);

  const measureDocsLatency = useCallback(
    async (regionId: string, speedTestUrl: string) => {
      setDocsLatencyState((prev) => ({
        ...prev,
        [regionId]: { loading: true },
      }));
      try {
        const startTime = performance.now();
        await fetch(`${speedTestUrl}?t=${Date.now()}`, {
          mode: "no-cors",
          cache: "no-store",
        });
        const latency = Math.round(performance.now() - startTime);
        setDocsLatencyState((prev) => ({
          ...prev,
          [regionId]: { loading: false, latency },
        }));
      } catch {
        setDocsLatencyState((prev) => ({
          ...prev,
          [regionId]: { loading: false, error: true },
        }));
      }
    },
    [],
  );

  const testAllDocsRegions = useCallback(async () => {
    setDocsTestingAll(true);
    const withUrls = publicRegions.filter((r) => r.speedTestUrl);
    await Promise.all(
      withUrls.map((r) => measureDocsLatency(r.id, r.speedTestUrl!)),
    );
    setDocsTestingAll(false);
  }, [publicRegions, measureDocsLatency]);

  const getDocsLatencyBadgeClass = (ms: number): string => {
    if (ms < 100) return "bg-green-500 text-white dark:text-white";
    if (ms < 200) return "bg-yellow-500 text-black dark:text-black";
    if (ms < 300) return "bg-orange-500 text-white dark:text-white";
    return "bg-red-500 text-white dark:text-white";
  };

  /* ── Shared plan table renderer ────────────────────────────────────────────*/

  const renderPlanTable = (plans: typeof vpsPlans) => (
    <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Plan</th>
            <th className="px-4 py-3 text-left font-medium">vCPUs</th>
            <th className="px-4 py-3 text-left font-medium">RAM</th>
            <th className="px-4 py-3 text-left font-medium">Storage</th>
            <th className="px-4 py-3 text-left font-medium">Transfer</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => {
            const specs = plan.specifications || {};
            const vcpus = Number(specs.vcpus ?? specs.cpu_cores ?? 0);
            const memory = Number(specs.memory ?? specs.memory_gb ?? 0);
            const disk = Number(specs.disk ?? specs.storage_gb ?? 0);
            const transfer = Number(
              specs.transfer ?? specs.transfer_gb ?? specs.bandwidth_gb ?? 0,
            );
            const price =
              Number(plan.base_price || 0) + Number(plan.markup_price || 0);
            return (
              <tr
                key={plan.id}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3">{vcpus}</td>
                <td className="px-4 py-3">{formatMemory(memory)}</td>
                <td className="px-4 py-3">{formatStorage(disk)}</td>
                <td className="px-4 py-3">{formatTransfer(transfer)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMonthlyPrice(price)}/mo
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  /* ── Render: Creating Your First VPS article (dynamic plans) ──────────────*/

  const renderCreatingVpsArticle = (article: DocumentationArticleWithFiles) => {
    const MARKER = "<!-- VPS_PLANS_TABLE -->";
    const parts = article.content ? article.content.split(MARKER) : ["", ""];

    return (
      <article className="max-w-3xl space-y-6">
        <DocsPageHeader
          title={article.title}
          description={article.summary}
          breadcrumb={
            <Breadcrumb
              category={
                article.category
                  ? {
                      name: article.category.name,
                      slug: article.category.slug,
                    }
                  : undefined
              }
              article={article.title}
            />
          }
        />

        {/* Content before the plans table marker */}
        {parts[0] && (
          <SanitizedHtml
            className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted prose-pre:border prose-table:text-sm mb-6"
            html={renderDocHtml(parts[0])}
          />
        )}

        {/* Dynamic plans table (same as plans-regions) */}
        <div className="mb-6">
          {loadingPlansRegions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : vpsPlans.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No VPS plans are currently configured.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedPlans.map(([typeClass, plans]) => (
                <div key={typeClass}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {getCategoryLabel(typeClass)}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {plans.length} plan{plans.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {renderPlanTable(plans)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content after the plans table marker */}
        {parts[1] && (
          <SanitizedHtml
            className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted prose-pre:border prose-table:text-sm"
            html={renderDocHtml(parts[1])}
          />
        )}

        {/* File attachments */}
        {article.files && article.files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Attachments
            </h3>
            {article.files.map((file) => (
              <a
                key={file.id}
                href={`/api/documentation/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="home-feature-card flex items-center gap-3 p-4"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">
                  {file.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)}
                </span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </article>
    );
  };

  /* ── Render: Plans & Regions article ──────────────────────────────────────*/

  const renderPlansRegionsArticle = (
    article: DocumentationArticleWithFiles,
  ) => {
    return (
      <article className="max-w-3xl space-y-6">
        <DocsPageHeader
          title={article.title}
          description={article.summary}
          breadcrumb={
            <Breadcrumb
              category={
                article.category
                  ? {
                      name: article.category.name,
                      slug: article.category.slug,
                    }
                  : undefined
              }
              article={article.title}
            />
          }
        />

        {article.content && (
          <SanitizedHtml
            className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted prose-pre:border prose-table:text-sm"
            html={renderDocHtml(article.content)}
          />
        )}

        {/* ── Plan Tiers grouped by type_class ──────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-sm border border-primary/20 bg-primary/5 p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Plan Tiers</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Available VPS plans configured by your administrator.
            </p>
          </div>

          {loadingPlansRegions ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : vpsPlans.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No VPS plans are currently configured.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedPlans.map(([typeClass, plans]) => (
                <div key={typeClass}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {getCategoryLabel(typeClass)}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {plans.length} plan{plans.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {renderPlanTable(plans)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Regions with inline speed test ────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-sm border border-primary/20 bg-primary/5 p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Regions</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Available data center locations. Test latency from your browser.
            </p>
          </div>

          {publicRegions.some((r) => r.speedTestUrl) && (
            <Button
              size="sm"
              variant="default"
              onClick={testAllDocsRegions}
              disabled={docsTestingAll}
              className="h-8 text-xs"
            >
              {docsTestingAll ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Testing All...
                </>
              ) : (
                <>
                  <Wifi className="mr-1.5 h-3 w-3" />
                  Test All Regions
                </>
              )}
            </Button>
          )}

          {loadingPlansRegions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : publicRegions.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No regions are currently configured.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {publicRegions.map((region) => {
                const label = region.displayLabel || region.label;
                const country =
                  region.displayCountry || region.country?.toUpperCase() || "";
                const lat = docsLatencyState[region.id];

                return (
                  <div
                    key={region.id}
                    className="home-feature-card flex flex-col gap-2 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {country}
                        </p>
                      </div>
                      {lat?.latency !== undefined && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDocsLatencyBadgeClass(lat.latency)}`}
                        >
                          {lat.latency}ms
                        </span>
                      )}
                      {lat?.error && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5"
                        >
                          Failed
                        </Badge>
                      )}
                    </div>
                    {region.speedTestUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs"
                        onClick={() =>
                          measureDocsLatency(region.id, region.speedTestUrl!)
                        }
                        disabled={lat?.loading || docsTestingAll}
                      >
                        {lat?.loading ? (
                          <>
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            Testing...
                          </>
                        ) : lat?.latency !== undefined ? (
                          <>
                            <Wifi className="mr-1.5 h-3 w-3" />
                            Retest
                          </>
                        ) : (
                          <>
                            <Wifi className="mr-1.5 h-3 w-3" />
                            Test Latency
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* File attachments */}
        {article.files && article.files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Attachments
            </h3>
            {article.files.map((file) => (
              <a
                key={file.id}
                href={`/api/documentation/files/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="home-feature-card flex items-center gap-3 p-4"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">
                  {file.filename}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)}
                </span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </article>
    );
  };

  /* ── Render: Article view ─────────────────────────────────────────────────*/

  const renderArticle = (article: DocumentationArticleWithFiles) => (
    <article className="max-w-3xl space-y-6">
      <DocsPageHeader
        title={article.title}
        description={article.summary}
        breadcrumb={
          <Breadcrumb
            category={
              article.category
                ? { name: article.category.name, slug: article.category.slug }
                : undefined
            }
            article={article.title}
          />
        }
      />

      {/* HTML content */}
      <SanitizedHtml
        className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:bg-muted prose-pre:border prose-table:text-sm"
        html={renderDocHtml(article.content)}
      />

      {/* File attachments */}
      {article.files && article.files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Attachments
          </h3>
          {article.files.map((file) => (
            <a
              key={file.id}
              href={`/api/documentation/files/${file.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="home-feature-card flex items-center gap-3 p-4"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate flex-1">
                {file.filename}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.file_size)}
              </span>
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </article>
  );

  /* ── Render: Loading / Error ──────────────────────────────────────────────*/

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

  /* ── Main layout ──────────────────────────────────────────────────────────*/

  const sidebarProps = {
    categories,
    categorySlug,
    articleSlug,
    searchQuery,
    onSearchChange: setSearchQuery,
    onNavigate: handleNavigate,
  };

  // Check if this is the API Reference category
  const isApiReferenceCategory =
    categorySlug === "api-reference" && !articleSlug;

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
        The article you&apos;re looking for doesn&apos;t exist or has been
        removed.
      </p>
      <Button variant="outline" onClick={() => handleNavigate("/docs")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to docs
      </Button>
    </div>
  ) : selectedArticle && articleSlug === "plans-regions" ? (
    renderPlansRegionsArticle(selectedArticle)
  ) : selectedArticle && articleSlug === "creating-your-first-vps" ? (
    renderCreatingVpsArticle(selectedArticle)
  ) : selectedArticle ? (
    renderArticle(selectedArticle)
  ) : isApiReferenceCategory ? (
    // Render ApiReference component for api-reference category
    <div>
      <DocsPageHeader
        title="API Reference"
        description={`Complete REST API documentation for ${BRAND_NAME}`}
        breadcrumb={<Breadcrumb category={{ name: "API Reference", slug: "api-reference" }} />}
      />
      <ApiReference onBack={() => handleNavigate("/docs")} />
    </div>
  ) : currentCategory ? (
    renderCategory(currentCategory)
  ) : (
    renderIndex()
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      {/* Single landmark; no nested <main> */}
      <div className="pt-20 lg:pt-24">
        {/* Content area */}
        <div className="flex min-h-[calc(100vh-4rem)]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 border-r bg-muted/20">
            <div className="sticky top-[calc(var(--announcement-banner-height,0px)+5rem)] w-full max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
              <Sidebar {...sidebarProps} />
            </div>
          </aside>

          {/* Content column */}
          <div className="flex-1 min-w-0">
            {/* Mobile top bar */}
            <div className="lg:hidden sticky top-[calc(var(--announcement-banner-height,0px)+5rem)] z-20 flex items-center gap-2 border-b bg-background px-4 h-12">
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
                    <Link
                      to="/docs"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Docs
                    </Link>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <span className="truncate font-medium">
                  {selectedArticle?.title ||
                    currentCategory?.name ||
                    "Documentation"}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-8 lg:px-10 lg:py-10">{content}</div>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
