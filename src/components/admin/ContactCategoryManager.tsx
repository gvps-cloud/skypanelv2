import React, { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import type { ContactCategory } from '@/types/contact';

const categorySchema = z.object({
  label: z.string().min(1, 'Category label is required').max(255, 'Label must be less than 255 characters'),
  value: z.string()
    .min(1, 'Category value is required')
    .max(255, 'Value must be less than 255 characters')
    .regex(/^[a-z0-9-_]+$/, 'Value must contain only lowercase letters, numbers, hyphens, and underscores'),
  is_active: z.boolean(),
});

interface ContactCategoryManagerProps {
  token: string;
}

interface SortableRowProps {
  category: ContactCategory;
  onEdit: (category: ContactCategory) => void;
  onDelete: (category: ContactCategory) => void;
  onToggleActive: (category: ContactCategory) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({ category, onEdit, onDelete, onToggleActive }) => {
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
      <TableCell className="font-medium">{category.label}</TableCell>
      <TableCell className="text-sm text-muted-foreground font-mono">
        {category.value}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{category.display_order}</Badge>
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

export const ContactCategoryManager: React.FC<ContactCategoryManagerProps> = ({ token }) => {
  const [categories, setCategories] = useState<ContactCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ContactCategory | null>(null);

  const createForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      label: '',
      value: '',
      is_active: true,
    },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      label: '',
      value: '',
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
      const data = await apiClient.get<{ categories: ContactCategory[] }>('/admin/contact/categories');
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (data: CategoryFormData) => {
    setSubmitting(true);
    try {
      const responseData = await apiClient.post<{ category: ContactCategory }>('/admin/contact/categories', data);
      
      setCategories(prev => [...prev, responseData.category]);
      setShowCreateDialog(false);
      createForm.reset();
      toast.success('Contact category created successfully');
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
      const responseData = await apiClient.put<{ category: ContactCategory }>(`/admin/contact/categories/${selectedCategory.id}`, data);
      
      setCategories(prev => prev.map(cat => cat.id === selectedCategory.id ? responseData.category : cat));
      setShowEditDialog(false);
      setSelectedCategory(null);
      editForm.reset();
      toast.success('Contact category updated successfully');
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
      await apiClient.delete(`/admin/contact/categories/${selectedCategory.id}`);
      
      setCategories(prev => prev.filter(cat => cat.id !== selectedCategory.id));
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      toast.success('Contact category deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (category: ContactCategory) => {
    try {
      const data = await apiClient.put<{ category: ContactCategory }>(`/admin/contact/categories/${category.id}`, { is_active: !category.is_active });
      
      setCategories(prev => prev.map(cat => cat.id === category.id ? data.category : cat));
      toast.success(`Category ${!category.is_active ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    }
  };

  const openEditDialog = (category: ContactCategory) => {
    setSelectedCategory(category);
    editForm.reset({
      label: category.label,
      value: category.value,
      is_active: category.is_active,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (category: ContactCategory) => {
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
      await apiClient.post('/admin/contact/categories/reorder', { categories: reorderData });

      toast.success('Categories reordered successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder categories');
      // Revert on error
      fetchCategories();
    }
  };

  // Auto-generate value from label
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>, form: typeof createForm | typeof editForm) => {
    const label = e.target.value;
    form.setValue('label', label);
    
    // Only auto-generate value if it's empty or matches the previous auto-generated value
    const currentValue = form.getValues('value');
    if (!currentValue || currentValue === label.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')) {
      const generatedValue = label
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('value', generatedValue);
    }
  };

  return (
    <>
      <Card className="border-primary/25">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">Contact Categories</CardTitle>
            <CardDescription>Manage categories for the contact form dropdown</CardDescription>
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
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="min-w-[200px]">Label</TableHead>
                      <TableHead className="min-w-[200px]">Value</TableHead>
                      <TableHead className="w-24">Order</TableHead>
                      <TableHead className="w-32">Status</TableHead>
                      <TableHead className="w-40 text-right">Actions</TableHead>
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
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
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
            <DialogTitle>Create Contact Category</DialogTitle>
            <DialogDescription>
              Add a new category for the contact form dropdown.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  {...createForm.register('label')}
                  onChange={(e) => handleLabelChange(e, createForm)}
                  placeholder="e.g., General inquiry"
                  disabled={submitting}
                />
                {createForm.formState.errors.label && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.label.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Display text shown to users in the dropdown
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="value">Value *</Label>
                <Input
                  id="value"
                  {...createForm.register('value')}
                  placeholder="e.g., general-inquiry"
                  disabled={submitting}
                  className="font-mono text-sm"
                />
                {createForm.formState.errors.value && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.value.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Internal identifier (lowercase, hyphens, underscores only)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={createForm.watch('is_active')}
                  onCheckedChange={(checked) => createForm.setValue('is_active', checked)}
                  disabled={submitting}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (visible on public contact page)
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
            <DialogTitle>Edit Contact Category</DialogTitle>
            <DialogDescription>
              Update the category details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-label">Label *</Label>
                <Input
                  id="edit-label"
                  {...editForm.register('label')}
                  onChange={(e) => handleLabelChange(e, editForm)}
                  placeholder="e.g., General inquiry"
                  disabled={submitting}
                />
                {editForm.formState.errors.label && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.label.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Display text shown to users in the dropdown
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-value">Value *</Label>
                <Input
                  id="edit-value"
                  {...editForm.register('value')}
                  placeholder="e.g., general-inquiry"
                  disabled={submitting}
                  className="font-mono text-sm"
                />
                {editForm.formState.errors.value && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.value.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Internal identifier (lowercase, hyphens, underscores only)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-is_active"
                  checked={editForm.watch('is_active')}
                  onCheckedChange={(checked) => editForm.setValue('is_active', checked)}
                  disabled={submitting}
                />
                <Label htmlFor="edit-is_active" className="cursor-pointer">
                  Active (visible on public contact page)
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
            <AlertDialogTitle>Delete Contact Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.label}"? This action cannot be undone.
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
