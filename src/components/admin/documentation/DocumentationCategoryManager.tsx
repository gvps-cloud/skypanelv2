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
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  description: string | null;
  slug: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  article_count?: number;
  created_at: string;
  updated_at: string;
}

// Schema
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be less than 255 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug must be less than 255 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  icon: z.string().max(100).optional(),
  is_active: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// Sortable Row Component
function SortableRow({
  category,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: DocumentationCategory;
  onEdit: (category: DocumentationCategory) => void;
  onDelete: (category: DocumentationCategory) => void;
  onToggleActive: (category: DocumentationCategory) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

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
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded">{category.slug}</code>
      </TableCell>
      <TableCell className="max-w-xs truncate">
        {category.description || "-"}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{category.article_count || 0}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={category.is_active}
            onCheckedChange={() => onToggleActive(category)}
          />
          <span className="text-xs text-muted-foreground">
            {category.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(category)}
            disabled={(category.article_count || 0) > 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function DocumentationCategoryManager() {
  const [categories, setCategories] = useState<DocumentationCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DocumentationCategory | null>(null);

  const token = localStorage.getItem("token");

  const createForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      slug: "",
      icon: "",
      is_active: true,
    },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      slug: "",
      icon: "",
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
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/documentation/categories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load categories");
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);
    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    const reorderData = newCategories.map((cat, index) => ({
      id: cat.id,
      display_order: index,
    }));

    try {
      const res = await fetch(
        buildApiUrl("/api/admin/documentation/categories/reorder"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ categories: reorderData }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reorder categories");
      }

      toast.success("Categories reordered successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to reorder categories");
      fetchCategories();
    }
  };

  // Create category
  const handleCreate = async (data: CategoryFormData) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/documentation/categories"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to create category");

      setCategories((prev) => [...prev, responseData.category]);
      setShowCreateDialog(false);
      createForm.reset();
      toast.success("Category created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit category
  const handleEdit = async (data: CategoryFormData) => {
    if (!token || !selectedCategory) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/categories/${selectedCategory.id}`),
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
      if (!res.ok) throw new Error(responseData.error || "Failed to update category");

      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === selectedCategory.id ? responseData.category : cat
        )
      );
      setShowEditDialog(false);
      setSelectedCategory(null);
      editForm.reset();
      toast.success("Category updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update category");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete category
  const handleDelete = async () => {
    if (!token || !selectedCategory) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/categories/${selectedCategory.id}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete category");
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== selectedCategory.id));
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      toast.success("Category deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (category: DocumentationCategory) => {
    if (!token) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/documentation/categories/${category.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: !category.is_active }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category");

      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === category.id ? data.category : cat
        )
      );
      toast.success(`Category ${!category.is_active ? "activated" : "deactivated"}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update category");
    }
  };

  // Open edit dialog
  const openEditDialog = (category: DocumentationCategory) => {
    setSelectedCategory(category);
    editForm.reset({
      name: category.name,
      description: category.description || "",
      slug: category.slug,
      icon: category.icon || "",
      is_active: category.is_active,
    });
    setShowEditDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (category: DocumentationCategory) => {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Categories
        </CardTitle>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No categories yet. Create your first category to get started.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <SortableRow
                      key={category.id}
                      category={category}
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
        if (!open) createForm.reset();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Create a new documentation category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...createForm.register("name")}
                  placeholder="Category name"
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  {...createForm.register("slug")}
                  placeholder="url-friendly-slug"
                />
                {createForm.formState.errors.slug && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.slug.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...createForm.register("description")}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon">Icon Name (Lucide)</Label>
                <Input
                  id="icon"
                  {...createForm.register("icon")}
                  placeholder="e.g., Rocket, Server, Code"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <Switch
                  id="is_active"
                  checked={createForm.watch("is_active")}
                  onCheckedChange={(checked) => createForm.setValue("is_active", checked)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
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
          setSelectedCategory(null);
          editForm.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  {...editForm.register("name")}
                  placeholder="Category name"
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-slug">Slug *</Label>
                <Input
                  id="edit-slug"
                  {...editForm.register("slug")}
                  placeholder="url-friendly-slug"
                />
                {editForm.formState.errors.slug && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.slug.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  {...editForm.register("description")}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-icon">Icon Name (Lucide)</Label>
                <Input
                  id="edit-icon"
                  {...editForm.register("icon")}
                  placeholder="e.g., Rocket, Server, Code"
                />
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowEditDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
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
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This will
              also delete all articles and files in this category. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
