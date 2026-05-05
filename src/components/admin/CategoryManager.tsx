import React, { useState, useEffect } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import type { FAQCategory, FAQItem } from '@/types/faq';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(255, 'Category name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  is_active: z.boolean(),
});

interface CategoryManagerProps {
  token: string;
}

interface SortableRowProps {
  category: FAQCategory;
  onEdit: (category: FAQCategory) => void;
  onDelete: (category: FAQCategory) => void;
  onToggleActive: (category: FAQCategory) => void;
  itemCount: number;
}

const SortableRow: React.FC<SortableRowProps> = ({ category, onEdit, onDelete, onToggleActive, itemCount }) => {
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
        <div {...attributes} {...listeners} className="cursor-move">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {category.description || '—'}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{itemCount}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={category.is_active}
            onCheckedChange={() => onToggleActive(category)}
          />
          <span className="text-xs text-muted-foreground">
            {category.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(category)}
            className="gap-1"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(category)}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

type CategoryFormData = z.infer<typeof categorySchema>;

export const CategoryManager: React.FC<CategoryManagerProps> = ({ token }) => {
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory | null>(null);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  const createForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ categories: FAQCategory[] }>('/admin/faq/categories');
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemCounts = async () => {
    try {
      const data = await apiClient.get<{ items: FAQItem[] }>('/admin/faq/items');
      const counts: Record<string, number> = {};
      (data.items || []).forEach((item: FAQItem) => {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      });
      setItemCounts(counts);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load FAQ item counts');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItemCounts();
  }, []);

  const handleCreate = async (data: CategoryFormData) => {
    setSubmitting(true);
    try {
      const responseData = await apiClient.post<{ category: FAQCategory }>('/admin/faq/categories', data);
      
      setCategories(prev => [...prev, responseData.category]);
      setShowCreateDialog(false);
      createForm.reset();
      toast.success('Category created successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: CategoryFormData) => {
    if (!selectedCategory) return;

    setSubmitting(true);
    try {
      const responseData = await apiClient.put<{ category: FAQCategory }>(`/admin/faq/categories/${selectedCategory.id}`, data);
      
      setCategories(prev => prev.map(cat => cat.id === selectedCategory.id ? responseData.category : cat));
      setShowEditDialog(false);
      setSelectedCategory(null);
      editForm.reset();
      toast.success('Category updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setSubmitting(true);
    try {
      await apiClient.delete(`/admin/faq/categories/${selectedCategory.id}`);
      
      setCategories(prev => prev.filter(cat => cat.id !== selectedCategory.id));
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      toast.success('Category deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (category: FAQCategory) => {
    try {
      const data = await apiClient.put<{ category: FAQCategory }>(`/admin/faq/categories/${category.id}`, { is_active: !category.is_active });
      
      setCategories(prev => prev.map(cat => cat.id === category.id ? data.category : cat));
      toast.success(`Category ${!category.is_active ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const openEditDialog = (category: FAQCategory) => {
    setSelectedCategory(category);
    editForm.reset({
      name: category.name,
      description: category.description || '',
      is_active: category.is_active,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (category: FAQCategory) => {
    setSelectedCategory(category);
    setShowDeleteDialog(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update the UI
    const newCategories = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCategories);

    // Prepare reorder data
    const reorderData = newCategories.map((cat, index) => ({
      id: cat.id,
      display_order: index,
    }));

    try {
      await apiClient.post('/admin/faq/categories/reorder', { categories: reorderData });

      toast.success('Categories reordered successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder categories');
      // Revert on error
      fetchCategories();
    }
  };

  return (
    <>
      <Card className="border-primary/25">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">FAQ Categories</CardTitle>
            <CardDescription>Organize FAQ items into logical groupings</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No categories yet. Create your first category to get started.
            </div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="min-w-[200px]">Name</TableHead>
                      <TableHead className="min-w-[300px]">Description</TableHead>
                      <TableHead className="w-24">Items</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-32 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={categories.map((cat) => cat.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {categories.map((category) => (
                        <SortableRow
                          key={category.id}
                          category={category}
                          onEdit={openEditDialog}
                          onDelete={openDeleteDialog}
                          onToggleActive={handleToggleActive}
                          itemCount={itemCounts[category.id] ?? 0}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) createForm.reset();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create FAQ Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your FAQ items.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...createForm.register('name')}
                  placeholder="e.g., Getting Started"
                  disabled={submitting}
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...createForm.register('description')}
                  placeholder="Brief description of this category"
                  rows={3}
                  disabled={submitting}
                />
                {createForm.formState.errors.description && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.description.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={createForm.watch('is_active')}
                  onCheckedChange={(checked) => createForm.setValue('is_active', checked)}
                  disabled={submitting}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (visible on public FAQ page)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreateDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Category'}
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
            <DialogTitle>Edit FAQ Category</DialogTitle>
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
                  {...editForm.register('name')}
                  placeholder="e.g., Getting Started"
                  disabled={submitting}
                />
                {editForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  {...editForm.register('description')}
                  placeholder="Brief description of this category"
                  rows={3}
                  disabled={submitting}
                />
                {editForm.formState.errors.description && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.description.message}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-is_active"
                  checked={editForm.watch('is_active')}
                  onCheckedChange={(checked) => editForm.setValue('is_active', checked)}
                  disabled={submitting}
                />
                <Label htmlFor="edit-is_active" className="cursor-pointer">
                  Active (visible on public FAQ page)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowEditDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This will also delete all FAQ items in this category. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
