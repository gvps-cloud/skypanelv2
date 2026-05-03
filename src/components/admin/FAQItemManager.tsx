import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import type { FAQCategory, FAQItem } from '@/types/faq';

const itemSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  question: z.string().min(1, 'Question is required').max(500, 'Question must be less than 500 characters'),
  answer: z.string().min(1, 'Answer is required').max(5000, 'Answer must be less than 5000 characters'),
  is_active: z.boolean(),
});

interface FAQItemManagerProps {
  token: string;
}

interface SortableItemProps {
  item: FAQItem;
  onEdit: (item: FAQItem) => void;
  onDelete: (item: FAQItem) => void;
  onToggleActive: (item: FAQItem) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ item, onEdit, onDelete, onToggleActive }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border border-border p-4"
    >
      <div {...attributes} {...listeners} className="cursor-move mt-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="font-medium text-sm">{item.question}</p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {item.answer}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={item.is_active}
              onCheckedChange={() => onToggleActive(item)}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(item)}
              className="gap-1"
            >
              <Edit className="h-3 w-3" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(item)}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

type ItemFormData = z.infer<typeof itemSchema>;

export const FAQItemManager: React.FC<FAQItemManagerProps> = ({ token }) => {
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FAQItem | null>(null);

  const createForm = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category_id: '',
      question: '',
      answer: '',
      is_active: true,
    },
  });

  const editForm = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      category_id: '',
      question: '',
      answer: '',
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
    try {
      const data = await apiClient.get<{ categories: FAQCategory[] }>('/admin/faq/categories');
      setCategories(data.categories || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load categories');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ items: FAQItem[] }>('/admin/faq/items');
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load FAQ items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, []);

  const handleCreate = async (data: ItemFormData) => {
    setSubmitting(true);
    try {
      const responseData = await apiClient.post<{ item: FAQItem }>('/admin/faq/items', data);
      
      setItems(prev => [...prev, responseData.item]);
      setShowCreateDialog(false);
      createForm.reset();
      toast.success('FAQ item created successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create FAQ item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: ItemFormData) => {
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const responseData = await apiClient.put<{ item: FAQItem }>(`/admin/faq/items/${selectedItem.id}`, data);
      
      setItems(prev => prev.map(item => item.id === selectedItem.id ? responseData.item : item));
      setShowEditDialog(false);
      setSelectedItem(null);
      editForm.reset();
      toast.success('FAQ item updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update FAQ item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      await apiClient.delete(`/admin/faq/items/${selectedItem.id}`);
      
      setItems(prev => prev.filter(item => item.id !== selectedItem.id));
      setShowDeleteDialog(false);
      setSelectedItem(null);
      toast.success('FAQ item deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete FAQ item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: FAQItem) => {
    try {
      const data = await apiClient.put<{ item: FAQItem }>(`/admin/faq/items/${item.id}`, { is_active: !item.is_active });
      
      setItems(prev => prev.map(i => i.id === item.id ? data.item : i));
      toast.success(`FAQ item ${!item.is_active ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update FAQ item');
    }
  };

  const openEditDialog = (item: FAQItem) => {
    setSelectedItem(item);
    editForm.reset({
      category_id: item.category_id,
      question: item.question,
      answer: item.answer,
      is_active: item.is_active,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (item: FAQItem) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  const getItemsByCategory = (categoryId: string) => {
    return items.filter(item => item.category_id === categoryId);
  };

  const handleDragEnd = (categoryId: string) => async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const categoryItems = getItemsByCategory(categoryId);
    const oldIndex = categoryItems.findIndex((item) => item.id === active.id);
    const newIndex = categoryItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update the UI
    const newCategoryItems = arrayMove(categoryItems, oldIndex, newIndex);
    const otherItems = items.filter(item => item.category_id !== categoryId);
    setItems([...otherItems, ...newCategoryItems]);

    // Prepare reorder data
    const reorderData = newCategoryItems.map((item, index) => ({
      id: item.id,
      display_order: index,
    }));

    try {
      await apiClient.post('/admin/faq/items/reorder', { items: reorderData });

      toast.success('FAQ items reordered successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reorder FAQ items');
      // Revert on error
      fetchItems();
    }
  };

  return (
    <>
      <Card className="border-primary/25">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="text-lg font-semibold">FAQ Items</CardTitle>
            <CardDescription>Manage questions and answers within categories</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add FAQ Item
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading FAQ items...</div>
          ) : categories.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No categories available. Create a category first to add FAQ items.
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No FAQ items yet. Create your first FAQ item to get started.
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {categories.map((category) => {
                const categoryItems = getItemsByCategory(category.id);
                if (categoryItems.length === 0) return null;

                return (
                  <AccordionItem key={category.id} value={category.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline">{categoryItems.length} items</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd(category.id)}
                      >
                        <div className="space-y-3 pt-2">
                          <SortableContext
                            items={categoryItems.map((item) => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {categoryItems.map((item) => (
                              <SortableItem
                                key={item.id}
                                item={item}
                                onEdit={openEditDialog}
                                onDelete={openDeleteDialog}
                                onToggleActive={handleToggleActive}
                              />
                            ))}
                          </SortableContext>
                        </div>
                      </DndContext>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) createForm.reset();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create FAQ Item</DialogTitle>
            <DialogDescription>
              Add a new question and answer to your FAQ.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Controller
                  name="category_id"
                  control={createForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {createForm.formState.errors.category_id && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.category_id.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="question">Question *</Label>
                <Input
                  id="question"
                  {...createForm.register('question')}
                  placeholder="e.g., How do I reset my password?"
                  disabled={submitting}
                />
                {createForm.formState.errors.question && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.question.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="answer">Answer *</Label>
                <Textarea
                  id="answer"
                  {...createForm.register('answer')}
                  placeholder="Provide a detailed answer to the question"
                  rows={6}
                  disabled={submitting}
                />
                {createForm.formState.errors.answer && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.answer.message}</p>
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
                {submitting ? 'Creating...' : 'Create FAQ Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setSelectedItem(null);
          editForm.reset();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit FAQ Item</DialogTitle>
            <DialogDescription>
              Update the question and answer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Controller
                  name="category_id"
                  control={editForm.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                      <SelectTrigger id="edit-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {editForm.formState.errors.category_id && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.category_id.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-question">Question *</Label>
                <Input
                  id="edit-question"
                  {...editForm.register('question')}
                  placeholder="e.g., How do I reset my password?"
                  disabled={submitting}
                />
                {editForm.formState.errors.question && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.question.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-answer">Answer *</Label>
                <Textarea
                  id="edit-answer"
                  {...editForm.register('answer')}
                  placeholder="Provide a detailed answer to the question"
                  rows={6}
                  disabled={submitting}
                />
                {editForm.formState.errors.answer && (
                  <p className="text-sm text-destructive">{editForm.formState.errors.answer.message}</p>
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
            <AlertDialogTitle>Delete FAQ Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ item? This action cannot be undone.
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
