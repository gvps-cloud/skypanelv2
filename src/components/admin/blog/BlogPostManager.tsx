import React, { useState, useEffect, useCallback } from "react";
import { apiClient, buildApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/ui/Pagination";
import RichTextEditor from "@/components/ui/rich-text-editor";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  ImagePlus,
  X,
  Loader2,
  Eye,
  FileText,
  Tag,
  ChevronDown,
} from "lucide-react";

interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  status: "draft" | "published";
  author_name: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  tags: BlogTag[];
}

interface PaginationInfo {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

const getCsrfToken = (): string | null => {
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("csrf_token="));
  if (!cookie) return null;
  const value = cookie.split("=")[1];
  return value ? decodeURIComponent(value) : null;
};

const getAuthHeaders = (): HeadersInit => {
  const userStr = localStorage.getItem("auth_user");
  let organizationId: string | undefined;
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      organizationId = user.organizationId;
    } catch {}
  }
  const csrfToken = getCsrfToken();
  return {
    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    ...(organizationId && { "X-Organization-ID": organizationId }),
  };
};

export function BlogPostManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [allTags, setAllTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalItems: 0,
    itemsPerPage: 10,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverFileInputKey, setCoverFileInputKey] = useState(0);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    category_id: "",
    status: "draft" as "draft" | "published",
    meta_title: "",
    meta_description: "",
    og_image_url: "",
    tag_ids: [] as string[],
  });
  const [newTagName, setNewTagName] = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.itemsPerPage.toString(),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await apiClient.get<{ success: boolean; posts: BlogPost[]; pagination: PaginationInfo }>(
        `/admin/blog/posts?${params.toString()}`,
      );
      setPosts(res.posts || []);
      setPagination(res.pagination || { currentPage: 1, totalItems: 0, itemsPerPage: 10 });
    } catch {
      toast.error("Failed to fetch blog posts");
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.itemsPerPage, statusFilter, categoryFilter, searchQuery]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; categories: BlogCategory[] }>(
        "/admin/blog/categories",
      );
      setCategories(res.categories || []);
    } catch (err) {
      console.error("Failed to fetch blog categories:", err);
      toast.error("Failed to load categories");
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; tags: BlogTag[] }>(
        "/admin/blog/tags",
      );
      setAllTags(res.tags || []);
    } catch (err) {
      console.error("Failed to fetch blog tags:", err);
      toast.error("Failed to load tags");
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, [fetchCategories, fetchTags]);

  const clearPendingCover = useCallback(() => {
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingCoverFile(null);
    setCoverFileInputKey((k) => k + 1);
  }, []);

  const openCreateDialog = () => {
    clearPendingCover();
    setSelectedPost(null);
    setFormData({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      category_id: "",
      status: "draft",
      meta_title: "",
      meta_description: "",
      og_image_url: "",
      tag_ids: [],
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (post: BlogPost) => {
    clearPendingCover();
    setSelectedPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content || "",
      excerpt: post.excerpt || "",
      category_id: post.category_id || "",
      status: post.status,
      meta_title: post.meta_title || "",
      meta_description: post.meta_description || "",
      og_image_url: post.og_image_url || "",
      tag_ids: post.tags?.map((t) => t.id) || [],
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (post: BlogPost) => {
    setSelectedPost(post);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug || undefined,
        content: formData.content,
        excerpt: formData.excerpt || null,
        category_id: formData.category_id || null,
        status: formData.status,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        og_image_url: formData.og_image_url.trim() || null,
        tag_ids: formData.tag_ids,
      };

      if (selectedPost) {
        await apiClient.put(`/admin/blog/posts/${selectedPost.id}`, payload);
        toast.success("Post updated successfully");
      } else {
        const res = await apiClient.post<{ success: boolean; post: BlogPost }>(
          "/admin/blog/posts",
          payload,
        );
        toast.success("Post created successfully");
        const newId = res?.post?.id;
        if (pendingCoverFile && newId) {
          setUploadingCover(true);
          try {
            const formDataUpload = new FormData();
            formDataUpload.append("cover", pendingCoverFile);
            const uploadRes = await fetch(
              buildApiUrl(`/api/admin/blog/posts/${newId}/cover-image`),
              {
                method: "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: formDataUpload,
              },
            );
            if (!uploadRes.ok) throw new Error("Upload failed");
            await uploadRes.json();
            toast.success("Cover image uploaded");
          } catch {
            toast.error("Post created but cover upload failed");
          } finally {
            setUploadingCover(false);
          }
        }
      }
      clearPendingCover();
      setEditDialogOpen(false);
      fetchPosts();
    } catch {
      toast.error(selectedPost ? "Failed to update post" : "Failed to create post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPost) return;
    try {
      await apiClient.delete(`/admin/blog/posts/${selectedPost.id}`);
      toast.success("Post deleted successfully");
      setDeleteDialogOpen(false);
      fetchPosts();
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleToggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    try {
      await apiClient.put(`/admin/blog/posts/${post.id}`, { status: newStatus });
      toast.success(`Post ${newStatus === "published" ? "published" : "unpublished"}`);
      fetchPosts();
    } catch {
      toast.error("Failed to update post status");
    }
  };

  const handleCoverUpload = async (postId: string, file: File) => {
    setUploadingCover(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("cover", file);
      const res = await fetch(buildApiUrl(`/api/admin/blog/posts/${postId}/cover-image`), {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: formDataUpload,
      });
      if (!res.ok) throw new Error("Upload failed");
      await res.json();
      toast.success("Cover image uploaded");
      fetchPosts();
    } catch {
      toast.error("Failed to upload cover image");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverDelete = async (postId: string) => {
    try {
      await apiClient.delete(`/admin/blog/posts/${postId}/cover-image`);
      toast.success("Cover image removed");
      fetchPosts();
    } catch {
      toast.error("Failed to remove cover image");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await apiClient.post<{ success: boolean; tag: BlogTag }>("/admin/blog/tags", {
        name: newTagName.trim(),
      });
      setAllTags((prev) => [...prev, res.tag]);
      setFormData((prev) => ({ ...prev, tag_ids: [...prev.tag_ids, res.tag.id] }));
      setNewTagName("");
    } catch {
      toast.error("Failed to create tag");
    }
  };

  const toggleTag = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  const generateSlugFromTitle = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Blog Posts
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage blog posts for your public-facing blog.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((prev) => ({ ...prev, currentPage: 1 }));
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-12 text-center text-muted-foreground">
            <FileText className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p className="font-medium">No blog posts yet</p>
            <p className="text-sm mt-1">Create your first blog post to get started.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {post.cover_image_url ? (
                          <img
                            src={post.cover_image_url}
                            alt=""
                            className="h-10 w-14 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded bg-muted border flex items-center justify-center">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm leading-tight">{post.title}</p>
                          <p className="text-xs text-muted-foreground">/{post.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.status === "published" ? "default" : "secondary"}>
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.category_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.author_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString()
                        : new Date(post.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(post)}
                          title={post.status === "published" ? "Unpublish" : "Publish"}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(post)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(post)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4">
              <Pagination
                currentPage={pagination.currentPage}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.itemsPerPage}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, currentPage: page }))}
                onItemsPerPageChange={(items) =>
                  setPagination((prev) => ({ ...prev, itemsPerPage: items, currentPage: 1 }))
                }
              />
            </div>
          </>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) clearPendingCover();
          setEditDialogOpen(open);
        }}
      >
        <DialogContent
          className={cn(
            "flex h-[min(90vh,880px)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0",
            "sm:rounded-sm",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle className="text-base sm:text-lg">
              {selectedPost ? "Edit Post" : "Create New Post"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedPost
                ? "Update title, content, category, tags, cover image, and SEO fields for this post."
                : "Create a new blog post with title, content, optional cover image, and optional SEO metadata."}
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5",
              "[scrollbar-width:thin]",
              "[scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]",
              "[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-transparent",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/25",
              "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/45",
            )}
          >
            <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="post-title">Title *</Label>
                <Input
                  id="post-title"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      title,
                      slug: prev.slug === generateSlugFromTitle(prev.title) || !prev.slug
                        ? generateSlugFromTitle(title)
                        : prev.slug,
                    }));
                  }}
                  placeholder="Post title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-slug">Slug</Label>
                <Input
                  id="post-slug"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(html) => setFormData((prev) => ({ ...prev, content: html }))}
                placeholder="Write your blog post content..."
                height={350}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-excerpt">Excerpt</Label>
              <Textarea
                id="post-excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
                placeholder="A brief summary of the post (optional)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, category_id: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, status: v as "draft" | "published" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={formData.tag_ids.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag name"
                  className="max-w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Tag
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-sm border border-primary/20 bg-muted/10 p-4">
              <div className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <Label className="text-sm font-medium leading-none">Cover Image</Label>
              </div>
              <div className="flex flex-col gap-3">
                {coverPreviewUrl ? (
                <div className="relative w-fit max-w-full">
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="h-36 w-full max-w-[min(100%,288px)] rounded-sm border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -right-2 -top-2 h-7 w-7 rounded-sm shadow-sm"
                    onClick={clearPendingCover}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : selectedPost?.cover_image_url ? (
                <div className="relative w-fit max-w-full">
                  <img
                    src={selectedPost.cover_image_url}
                    alt="Cover"
                    className="h-36 w-full max-w-[min(100%,288px)] rounded-sm border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -right-2 -top-2 h-7 w-7 rounded-sm shadow-sm"
                    onClick={() => handleCoverDelete(selectedPost.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-2 rounded-sm border-primary/25" asChild>
                      <span>
                        <ImagePlus className="h-4 w-4" />
                        {uploadingCover ? "Uploading..." : "Upload Cover"}
                      </span>
                    </Button>
                    <input
                      key={`cover-${selectedPost?.id ?? "new"}-${coverFileInputKey}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (!selectedPost) {
                          setCoverPreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(file);
                          });
                          setPendingCoverFile(file);
                          return;
                        }
                        handleCoverUpload(selectedPost.id, file);
                      }}
                      disabled={uploadingCover}
                    />
                  </label>
                  {!selectedPost && (
                    <span className="text-xs text-muted-foreground">
                      Attached when you create the post (immediate upload when editing).
                    </span>
                  )}
                </div>
                )}
              </div>
            </div>

            <Collapsible className="group rounded-sm border border-primary/20 bg-muted/5">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 border-b border-transparent px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/25 group-data-[state=open]:border-border">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>SEO Settings</span>
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border bg-background/40 px-4 pb-4 pt-3 data-[state=closed]:animate-none">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="meta-title">Meta Title</Label>
                    <Input
                      id="meta-title"
                      value={formData.meta_title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, meta_title: e.target.value }))}
                      placeholder="Override title for search engines"
                      className="rounded-sm border-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meta-description">Meta Description</Label>
                    <Textarea
                      id="meta-description"
                      value={formData.meta_description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                      }
                      placeholder="Description for search engines"
                      rows={2}
                      className="rounded-sm border-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="og-image-url">Open Graph image URL</Label>
                    <Input
                      id="og-image-url"
                      value={formData.og_image_url}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, og_image_url: e.target.value }))
                      }
                      placeholder="https://… (optional; falls back to cover image)"
                      className="rounded-sm border-primary/20"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                clearPendingCover();
                setEditDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingCover}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {selectedPost ? "Update Post" : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedPost?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
