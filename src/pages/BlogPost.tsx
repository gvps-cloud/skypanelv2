import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import { TerminalPageHeader } from "@/components/terminal";
import { cn } from "@/lib/utils";
import {
  Calendar,
  User,
  ArrowLeft,
  Tag,
  FileText,
  Loader2,
  FolderOpen,
  Clock,
  Link2,
} from "lucide-react";

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  published_year: number | null;
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: BlogTag[];
}

interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  published_year: number | null;
  category_slug: string | null;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  post_count: number;
}

function estimateReadingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 1;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function SanitizedHtml({ html, className }: { html: string; className: string }) {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["img", "iframe"],
    ADD_ATTR: ["loading", "src", "alt", "width", "height", "allow", "allowfullscreen", "frameborder"],
  });
  return (
    <div
      className={cn(
        className,
        "min-w-0 max-w-full [overflow-wrap:anywhere] break-words",
        "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:break-normal [&_pre]:[overflow-wrap:normal]",
        "[&_code]:break-normal [&_img]:max-w-full [&_img]:h-auto [&_table]:max-w-full",
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export default function BlogPost() {
  const { year, slug } = useParams<{ year: string; slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [recentPosts, setRecentPosts] = useState<BlogPostSummary[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!year || !slug) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/blog/posts/${year}/${slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        if (data?.post) {
          setPost(data.post);
          const metaTitle = data.post.meta_title || `${data.post.title} — Blog`;
          document.title = metaTitle;
          const metaDesc = data.post.meta_description || data.post.excerpt || "";
          let metaTag = document.querySelector('meta[name="description"]');
          if (!metaTag) {
            metaTag = document.createElement("meta");
            metaTag.setAttribute("name", "description");
            document.head.appendChild(metaTag);
          }
          metaTag.setAttribute("content", metaDesc);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [year, slug]);

  useEffect(() => {
    if (!post?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [postsRes, catRes] = await Promise.all([
          fetch("/api/blog/posts?limit=8&page=1"),
          fetch("/api/blog/categories"),
        ]);
        if (!postsRes.ok || !catRes.ok) return;
        const postsData = await postsRes.json();
        const catData = await catRes.json();
        if (cancelled) return;
        const list: BlogPostSummary[] = (postsData.posts || []).filter(
          (p: BlogPostSummary) => p.id !== post.id,
        );
        setRecentPosts(list.slice(0, 5));
        setCategories(catData.categories || []);
      } catch {
        /* sidebar is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post?.id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center font-mono">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PublicLayout>
    );
  }

  if (notFound || !post) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center px-4 font-mono">
          <div className="max-w-md rounded-sm border border-dashed border-primary/25 bg-card/30 px-8 py-10 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-xl font-bold tracking-tight">Post not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The blog post you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button variant="outline" className="mt-6 rounded-sm border-primary/25 shadow-none" asChild>
              <Link to="/blog">Back to Blog</Link>
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const postYear = post.published_year ?? (year ? parseInt(year, 10) : new Date().getFullYear());
  const canonicalPath = `/blog/${postYear}/${post.slug}`;
  const readingMinutes = estimateReadingMinutes(post.content || "");

  const copyPostLink = () => {
    const url = `${window.location.origin}${canonicalPath}`;
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const getPostUrl = (p: BlogPostSummary) => {
    const y = p.published_year || new Date().getFullYear();
    return `/blog/${y}/${p.slug}`;
  };

  return (
    <PublicLayout>
      <article className="min-h-screen font-mono">
        {/* Hero */}
        {post.cover_image_url ? (
          <div className="relative h-[300px] w-full overflow-hidden border-b border-border md:h-[400px]">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-transparent" />
          </div>
        ) : (
          <div className="relative overflow-hidden border-b border-border bg-background">
            <div className="pointer-events-none absolute inset-0 home-hero-grid-lines opacity-40" aria-hidden />
            <div className="relative h-24 w-full bg-muted/20 md:h-28" />
          </div>
        )}

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <div className="mb-6 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-sm text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/blog">
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Link>
            </Button>
          </div>

          <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
            {/* Main column */}
            <div className="min-w-0">
              <TerminalPageHeader
                pathPrefix="~/www/blog"
                command={`pager --file ${post.slug}.md`}
                className="mb-6"
              />
              <header
                className={cn(
                  "mb-8 border-b border-border pb-8",
                  "border-l-2 border-l-primary/50 pl-4 sm:pl-5",
                )}
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {post.category_name && (
                    <Badge variant="secondary" className="rounded-sm text-xs">
                      {post.category_name}
                    </Badge>
                  )}
                  {post.tags &&
                    post.tags.length > 0 &&
                    post.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline" className="rounded-sm text-xs font-normal">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag.name}
                      </Badge>
                    ))}
                </div>

                <h1 className="break-words text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                  {post.title}
                </h1>

                {post.excerpt ? (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {post.excerpt}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase tracking-wider text-muted-foreground sm:text-sm">
                  {post.author_name && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-4 w-4 shrink-0" />
                      {post.author_name}
                    </span>
                  )}
                  {formattedDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 shrink-0" />
                      {formattedDate}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    ~{readingMinutes} min read
                  </span>
                </div>
              </header>

              <div
                className={cn(
                  "cyber-card cyber-card--hover rounded-sm border border-primary/25 bg-card/40 p-4 shadow-none sm:p-6 md:p-8",
                  "min-w-0 w-full overflow-x-hidden",
                )}
              >
                <SanitizedHtml
                  html={post.content || ""}
                  className="prose prose-slate max-w-none pb-2 prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-sm prose-p:leading-relaxed md:prose-p:text-base dark:prose-invert prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-pre:rounded-sm prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-img:rounded-sm prose-img:border prose-img:border-border prose-table:text-sm"
                />
              </div>
            </div>

            {/* Sidebar */}
            <aside className="min-w-0 space-y-6 lg:sticky lg:top-[calc(var(--announcement-banner-height,0px)+5rem)] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:self-start">
              <div className="hidden lg:block">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 h-auto gap-2 rounded-sm px-0 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link to="/blog">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Blog
                  </Link>
                </Button>
              </div>

              <div className="cyber-card rounded-sm border border-primary/25 bg-card/30 p-4 shadow-none">
                <h2 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <span className="text-muted-foreground">#</span> session
                </h2>
                <dl className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2">
                    <dt className="uppercase tracking-wider text-[10px] text-muted-foreground/80">path</dt>
                    <dd className="break-all font-mono text-[11px] text-foreground/90">{canonicalPath}</dd>
                  </div>
                  {formattedDate && (
                    <div className="flex justify-between gap-2 border-b border-border/60 pb-2">
                      <dt className="uppercase tracking-wider text-[10px]">published</dt>
                      <dd className="text-right text-foreground/90">{formattedDate}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="uppercase tracking-wider text-[10px]">read</dt>
                    <dd className="text-foreground/90">~{readingMinutes} min</dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full rounded-sm border-primary/25 font-mono text-xs shadow-none"
                  onClick={copyPostLink}
                >
                  <Link2 className="mr-2 h-3.5 w-3.5" />
                  {linkCopied ? "Copied" : "Copy link"}
                </Button>
              </div>

              {post.author_name && (
                <div className="cyber-card rounded-sm border border-primary/25 bg-card/30 p-4 shadow-none">
                  <h2 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <User className="h-3 w-3" /> author
                  </h2>
                  <p className="text-sm font-medium text-foreground">{post.author_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Posted under {post.category_name || "Blog"}.
                  </p>
                </div>
              )}

              {categories.length > 0 && (
                <div className="cyber-card rounded-sm border border-primary/25 bg-card/30 p-4 shadow-none">
                  <h2 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <FolderOpen className="h-3 w-3" /> categories
                  </h2>
                  <nav className="flex flex-col gap-1.5">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/blog?category=${encodeURIComponent(cat.slug)}`}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground"
                      >
                        <span className="truncate">{cat.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-primary/70">{cat.post_count}</span>
                      </Link>
                    ))}
                  </nav>
                </div>
              )}

              {recentPosts.length > 0 && (
                <div className="cyber-card rounded-sm border border-primary/25 bg-card/30 p-4 shadow-none">
                  <h2 className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <FileText className="h-3 w-3" /> recent
                  </h2>
                  <ul className="space-y-3">
                    {recentPosts.map((p) => (
                      <li key={p.id}>
                        <Link
                          to={getPostUrl(p)}
                          className="group block rounded-sm border border-transparent px-0 py-0.5 transition-colors hover:border-primary/20"
                        >
                          <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground group-hover:text-primary">
                            {p.title}
                          </span>
                          {p.published_at && (
                            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {new Date(p.published_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </article>
    </PublicLayout>
  );
}
