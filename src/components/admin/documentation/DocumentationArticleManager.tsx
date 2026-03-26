import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildApiUrl } from "@/lib/api";

// Types
interface DocumentationCategory {
  id: string;
  name: string;
  slug: string;
}

interface DocumentationFile {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface DocumentationArticle {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  display_order: number;
  is_active: boolean;
  category_name?: string;
  category_slug?: string;
  files?: DocumentationFile[];
  created_at: string;
  updated_at: string;
}

// Schema
const articleSchema = z.object({
  category_id: z.string().uuid("Please select a category"),
  title: z.string().min(1, "Title is required").max(500, "Title must be less than 500 characters"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(500, "Slug must be less than 500 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  content: z.string().min(1, "Content is required"),
  summary: z.string().max(500, "Summary must be less than 500 characters").optional(),
  is_active: z.boolean(),
});

type ArticleFormData = z.infer<typeof articleSchema>;

// Sortable Row Component
function SortableRow({
  article,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  article: DocumentationArticle;
  onEdit: (article: DocumentationArticle) => void;
  onDelete: (article: DocumentationArticle) => void;
  onToggleActive: (article: DocumentationArticle) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          className="cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{article.title}</TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded">{article.slug}</code>
      </TableCell>
      <TableCell>{article.category_name || "-"}</TableCell>
      <TableCell>
        <Badge variant="secondary">{article.files?.length || 0}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={article.is_active}
            onCheckedChange={() => onToggleActive(article)}
          />
          <span className="text-xs text-muted-foreground">
            {article.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(article)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(article)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function DocumentationArticleManager() {
  const [articles, setArticles] = useState<DocumentationArticle[]>([]);
  const [categories, setCategories] = useState<DocumentationCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<DocumentationArticle | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<DocumentationFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const token = localStorage.getItem("token");

  const form = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      category_id: "",
      title: "",
      slug: "",
      content: "",
      summary: "",
      is_active: true,
    },
  });

  const editForm = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      category_id: "",
      title: "",
      slug: "",
      content: "",
      summary: "",
      is_active: true,
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/admin/documentation/categories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, [token]);

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    try {
      setIsLoading(true);
      const url =
        selectedCategoryId === "all"
          ? buildApiUrl("/api/admin/documentation/articles")
          : buildApiUrl(`/api/admin/documentation/articles?category_id=${selectedCategoryId}`);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error("Failed to fetch articles:", error);
      toast.error("Failed to fetch articles");
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedCategoryId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = articles.findIndex((art) => art.id === active.id);
    const newIndex = articles.findIndex((art) => art.id === over.id);
    const newArticles = arrayMove(articles, oldIndex, newIndex);
    setArticles(newArticles);

    const reorderData = newArticles.map((art, index) => ({
      id: art.id,
      display_order: index,
    }));

    try {
      const res = await fetch(buildApiUrl("/api/admin/documentation/articles/reorder"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ articles: reorderData }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reorder articles");
      }

      toast.success("Articles reordered successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to reorder articles");
      fetchArticles();
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Upload file
  const uploadFile = async (articleId: string, file: File): Promise<DocumentationFile | null> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/articles/${articleId}/files`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload file");
      return data.file;
    } catch (error) {
      console.error("Failed to upload file:", error);
      return null;
    }
  };

  // Delete file
  const deleteFile = async (fileId: string): Promise<boolean> => {
    try {
      const res = await fetch(buildApiUrl(`/api/admin/documentation/files/${fileId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete file");
      }
      return true;
    } catch (error) {
      console.error("Failed to delete file:", error);
      return false;
    }
  };

  // Create article
  const handleCreate = async (data: ArticleFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/documentation/articles"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to create article");

      const newArticle = responseData.article;

      // Upload pending files
      for (const file of pendingFiles) {
        await uploadFile(newArticle.id, file);
      }

      setArticles((prev) => [...prev, newArticle]);
      setShowCreateDialog(false);
      form.reset();
      setPendingFiles([]);
      toast.success("Article created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create article");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit article
  const handleEdit = async (data: ArticleFormData) => {
    if (!selectedArticle) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/articles/${selectedArticle.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to update article");

      // Delete marked files
      for (const fileId of filesToDelete) {
        await deleteFile(fileId);
      }

      // Upload new files
      for (const file of pendingFiles) {
        await uploadFile(selectedArticle.id, file);
      }

      setArticles((prev) =>
        prev.map((art) =>
          art.id === selectedArticle.id ? responseData.article : art
        )
      );
      setShowEditDialog(false);
      setSelectedArticle(null);
      editForm.reset();
      setUploadedFiles([]);
      setFilesToDelete([]);
      setPendingFiles([]);
      toast.success("Article updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update article");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete article
  const handleDelete = async () => {
    if (!selectedArticle) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/articles/${selectedArticle.id}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete article");
      }

      setArticles((prev) => prev.filter((art) => art.id !== selectedArticle.id));
      setShowDeleteDialog(false);
      setSelectedArticle(null);
      toast.success("Article deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete article");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (article: DocumentationArticle) => {
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/articles/${article.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: !article.is_active }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update article");

      setArticles((prev) =>
        prev.map((art) =>
          art.id === article.id ? data.article : art
        )
      );
      toast.success(`Article ${!article.is_active ? "activated" : "deactivated"}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update article");
    }
  };

  // Open edit dialog
  const openEditDialog = async (article: DocumentationArticle) => {
    try {
      // Fetch full article with files
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/articles/${article.id}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();

      setSelectedArticle(data.article);
      setUploadedFiles(data.article.files || []);
      setFilesToDelete([]);
      setPendingFiles([]);
      editForm.reset({
        category_id: data.article.category_id,
        title: data.article.title,
        slug: data.article.slug,
        content: data.article.content,
        summary: data.article.summary || "",
        is_active: data.article.is_active,
      });
      setShowEditDialog(true);
    } catch (error) {
      toast.error("Failed to load article");
    }
  };

  // Open delete dialog
  const openDeleteDialog = (article: DocumentationArticle) => {
    setSelectedArticle(article);
    setShowDeleteDialog(true);
  };

  // Handle file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPendingFiles((prev) => [...prev, ...Array.from(files)]);
    }
    e.target.value = "";
  };

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Mark existing file for deletion
  const markFileForDeletion = (fileId: string) => {
    setFilesToDelete((prev) => [...prev, fileId]);
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Articles
          </CardTitle>
          <Select
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
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
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Article
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No articles yet. Create your first article to get started.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={articles.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((article) => (
                    <SortableRow
                      key={article.id}
                      article={article}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                      onToggleActive={handleToggleActive}
                    />
                  ))}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setPendingFiles([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Article</DialogTitle>
            <DialogDescription>
              Create a new documentation article.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category_id">Category</Label>
                <Select
                  value={form.watch("category_id")}
                  onValueChange={(value) => form.setValue("category_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category_id && (
                  <p className="text-sm text-destructive">{form.formState.errors.category_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="Article title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                {...form.register("slug")}
                placeholder="url-friendly-slug"
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Input
                id="summary"
                {...form.register("summary")}
                placeholder="Brief description of the article"
              />
              {form.formState.errors.summary && (
                <p className="text-sm text-destructive">{form.formState.errors.summary.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content (HTML)</Label>
              <Textarea
                id="content"
                {...form.register("content")}
                className="min-h-[300px] font-mono"
                placeholder="<h1>Title</h1><p>Content here...</p>"
              />
              {form.formState.errors.content && (
                <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, images, text files. Max 10MB each.
                </p>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePendingFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Switch
                id="is_active"
                checked={form.watch("is_active")}
                onCheckedChange={(checked) => form.setValue("is_active", checked)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowCreateDialog(false);
                  setPendingFiles([]);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setUploadedFiles([]);
          setFilesToDelete([]);
          setPendingFiles([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
            <DialogDescription>
              Update the article details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category_id">Category</Label>
                <Select
                  value={editForm.watch("category_id")}
                  onValueChange={(value) => editForm.setValue("category_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.formState.errors.category_id && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.category_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  {...editForm.register("title")}
                  placeholder="Article title"
                />
                {editForm.formState.errors.title && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.title.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                {...editForm.register("slug")}
                placeholder="url-friendly-slug"
              />
              {editForm.formState.errors.slug && (
                <p className="text-sm text-destructive">{editForm.formState.errors.slug.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-summary">Summary</Label>
              <Input
                id="edit-summary"
                {...editForm.register("summary")}
                placeholder="Brief description of the article"
              />
              {editForm.formState.errors.summary && (
                <p className="text-sm text-destructive">{editForm.formState.errors.summary.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content (HTML)</Label>
              <Textarea
                id="edit-content"
                {...editForm.register("content")}
                className="min-h-[300px] font-mono"
              />
              {editForm.formState.errors.content && (
                <p className="text-sm text-destructive">{editForm.formState.errors.content.message}</p>
              )}
            </div>

            {/* Existing Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Current Attachments</Label>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.filename}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.file_size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => markFileForDeletion(file.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New File Upload */}
            <div className="space-y-2">
              <Label>Add Attachments</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileInput}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, images, text files. Max 10MB each.
                </p>
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePendingFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-is_active">Active</Label>
              </div>
              <Switch
                id="edit-is_active"
                checked={editForm.watch("is_active")}
                onCheckedChange={(checked) => editForm.setValue("is_active", checked)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowEditDialog(false);
                  setUploadedFiles([]);
                  setFilesToDelete([]);
                  setPendingFiles([]);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedArticle?.title}"? This will
              also delete all attached files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
