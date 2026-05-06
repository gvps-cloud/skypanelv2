import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/ui/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PublicLayout from "@/components/PublicLayout";
import { cn } from "@/lib/utils";
import { Search, Calendar, User, ArrowRight, FileText, Tag } from "lucide-react";

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  published_year: number | null;
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  tags: BlogTag[];
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  post_count: number;
}

interface PaginationInfo {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalItems: 0,
    itemsPerPage: 9,
  });

  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const categorySlug = searchParams.get("category") || "";
  const searchQuery = searchParams.get("search") || "";

  const updateParams = (updates: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "9",
      });
      if (categorySlug) params.set("category", categorySlug);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/blog/posts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPosts(data.posts || []);
      setPagination(
        data.pagination || { currentPage: 1, totalItems: 0, itemsPerPage: 9 },
      );
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, categorySlug, searchQuery]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/blog/categories");
      if (!res.ok) return;
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    document.title = "Blog";
  }, []);

  const getPostUrl = (post: BlogPostSummary) => {
    const year = post.published_year || new Date().getFullYear();
    return `/blog/${year}/${post.slug}`;
  };

  return (
    <PublicLayout>
      <div className="min-h-screen font-mono">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-background">
          <div className="pointer-events-none absolute inset-0 home-hero-grid-lines" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground">
                Blog
              </h1>
              <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto uppercase tracking-wider">
                Insights, tutorials, and updates from our team.
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => {
                    updateParams({ search: e.target.value, page: "1" });
                  }}
                  className="pl-9 rounded-sm border-primary/25 shadow-none"
                />
              </div>
              {categories.length > 0 && (
                <Select
                  value={categorySlug || "all"}
                  onValueChange={(v) => updateParams({ category: v === "all" ? "" : v, page: "1" })}
                >
                  <SelectTrigger className="w-full sm:w-[180px] rounded-sm border-primary/25 shadow-none">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.name} ({cat.post_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-sm border border-primary/25 bg-card shadow-none animate-pulse"
                >
                  <div className="h-48 bg-muted rounded-t-sm border-b border-border" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded-sm w-3/4" />
                    <div className="h-3 bg-muted rounded-sm w-full" />
                    <div className="h-3 bg-muted rounded-sm w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 rounded-sm border border-dashed border-primary/25 bg-card/30 px-6">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold tracking-tight">No posts found</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {searchQuery || categorySlug
                  ? "Try adjusting your search or filters."
                  : "Check back soon for new content."}
              </p>
              {(searchQuery || categorySlug) && (
                <Button
                  variant="outline"
                  className="mt-4 rounded-sm border-primary/25 shadow-none"
                  onClick={() => {
                    setSearchParams({});
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={getPostUrl(post)}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-sm border border-primary/25 bg-card text-card-foreground shadow-none transition-colors",
                      "cyber-card cyber-card--hover",
                    )}
                  >
                    {post.cover_image_url ? (
                      <div className="aspect-video overflow-hidden border-b border-border">
                        <img
                          src={post.cover_image_url}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center border-b border-border bg-muted/40">
                        <FileText className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2 mb-3">
                        {post.category_name && (
                          <Badge variant="secondary" className="text-xs">
                            {post.category_name}
                          </Badge>
                        )}
                        {post.published_at && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.published_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors line-clamp-2 group-hover:text-primary">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        {post.author_name && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {post.author_name}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors ml-auto" />
                      </div>
                      {post.tags && post.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center text-xs text-muted-foreground"
                            >
                              <Tag className="h-2.5 w-2.5 mr-1" />
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {pagination.totalItems > pagination.itemsPerPage && (
                <div className="mt-10 flex justify-center">
                  <Pagination
                    currentPage={pagination.currentPage}
                    totalItems={pagination.totalItems}
                    itemsPerPage={pagination.itemsPerPage}
                    onPageChange={(page) => updateParams({ page: page.toString() })}
                    showItemsPerPage={false}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}
