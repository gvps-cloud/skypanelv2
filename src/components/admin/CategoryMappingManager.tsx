/**
 * Category Mapping Manager Component
 * Admin interface for managing white-label VPS category mappings
 */

import React, { useState } from 'react';
import { Plus, Edit, Trash2, GripVertical, Info } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCategoryMappings, useCreateCategoryMapping, useUpdateCategoryMapping, useDeleteCategoryMapping, useReorderCategoryMappings } from '@/hooks/useCategoryMappings';
import type { CategoryMapping, CreateCategoryMappingInput } from '@/types/categoryMappings';
import { VALID_ORIGINAL_CATEGORIES } from '@/types/categoryMappings';

// Mobile card component for category mapping
const MobileMappingCard: React.FC<{
  mapping: CategoryMapping;
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (mapping: CategoryMapping) => void;
  onToggleEnabled: (mapping: CategoryMapping) => void;
}> = ({ mapping, onEdit, onDelete, onToggleEnabled }) => {
  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-3">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm break-words">{mapping.custom_name}</h3>
              <Badge 
                variant={mapping.enabled ? 'default' : 'secondary'} 
                className="shrink-0 text-xs"
              >
                {mapping.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Original: <span className="font-medium text-foreground">{mapping.original_category}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(mapping)}
              className="h-9 w-9 p-0"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(mapping)}
              className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Description Section */}
        {mapping.custom_description && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {mapping.custom_description}
            </p>
          </div>
        )}

        {/* Footer Section */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium">
              Order {mapping.display_order}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Enable</span>
            <Switch
              checked={mapping.enabled}
              onCheckedChange={() => onToggleEnabled(mapping)}
              aria-label={`Toggle ${mapping.custom_name}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const categoryMappingSchema = z.object({
  original_category: z.string().min(1, 'Original category is required'),
  custom_name: z.string().min(1, 'Custom name is required').max(100, 'Custom name must be less than 100 characters'),
  custom_description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  display_order: z.number().int().min(0, 'Display order must be non-negative'),
  enabled: z.boolean(),
});

type CategoryMappingFormData = z.infer<typeof categoryMappingSchema>;

interface SortableRowProps {
  mapping: CategoryMapping;
  onEdit: (mapping: CategoryMapping) => void;
  onDelete: (mapping: CategoryMapping) => void;
  onToggleEnabled: (mapping: CategoryMapping) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  mapping,
  onEdit,
  onDelete,
  onToggleEnabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id });

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
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span>{mapping.original_category}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Original category from the Linode API. This value cannot be changed.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
      <TableCell>{mapping.custom_name}</TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
        {mapping.custom_description || '—'}
      </TableCell>
      <TableCell>
        <Badge variant={mapping.enabled ? 'default' : 'secondary'}>
          {mapping.display_order}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={mapping.enabled}
            onCheckedChange={() => onToggleEnabled(mapping)}
          />
          <span className="text-xs text-muted-foreground">
            {mapping.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(mapping)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(mapping)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface CategoryMappingManagerProps {
  /** Whether to render without card wrapper (for use inside other styled containers) */
  noCard?: boolean;
}

export const CategoryMappingManager: React.FC<CategoryMappingManagerProps> = ({ noCard = false }) => {
  const { data: mappings = [], isLoading, error } = useCategoryMappings();
  const createMutation = useCreateCategoryMapping();
  const updateMutation = useUpdateCategoryMapping();
  const deleteMutation = useDeleteCategoryMapping();
  const reorderMutation = useReorderCategoryMappings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CategoryMapping | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<CategoryMapping | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const form = useForm<CategoryMappingFormData>({
    resolver: zodResolver(categoryMappingSchema),
    defaultValues: {
      original_category: '',
      custom_name: '',
      custom_description: '',
      display_order: 0,
      enabled: true,
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = mappings.findIndex((m) => m.id === active.id);
      const newIndex = mappings.findIndex((m) => m.id === over.id);

      const reorderedMappings = arrayMove(mappings, oldIndex, newIndex);
      const orderings = reorderedMappings.map((mapping, index) => ({
        id: mapping.id,
        display_order: index,
      }));

      reorderMutation.mutate(orderings, {
        onSuccess: () => {
          toast.success('Category mappings reordered successfully');
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to reorder category mappings');
        },
      });
    }
  };

  const handleOpenDialog = (mapping?: CategoryMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      form.reset({
        original_category: mapping.original_category,
        custom_name: mapping.custom_name,
        custom_description: mapping.custom_description || '',
        display_order: mapping.display_order,
        enabled: mapping.enabled,
      });
    } else {
      setEditingMapping(null);
      form.reset({
        original_category: '',
        custom_name: '',
        custom_description: '',
        display_order: mappings.length,
        enabled: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMapping(null);
    form.reset();
  };

  const handleSubmit = (data: CategoryMappingFormData) => {
    if (editingMapping) {
      updateMutation.mutate(
        { id: editingMapping.id, input: data },
        {
          onSuccess: () => {
            toast.success('Category mapping updated successfully');
            handleCloseDialog();
          },
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update category mapping');
          },
        }
      );
    } else {
      createMutation.mutate(data as CreateCategoryMappingInput, {
        onSuccess: () => {
          toast.success('Category mapping created successfully');
          handleCloseDialog();
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to create category mapping');
        },
      });
    }
  };

  const handleToggleEnabled = (mapping: CategoryMapping) => {
    updateMutation.mutate(
      {
        id: mapping.id,
        input: { enabled: !mapping.enabled },
      },
      {
        onSuccess: () => {
          toast.success(
            `Category mapping ${mapping.enabled ? 'disabled' : 'enabled'}`
          );
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to toggle category mapping');
        },
      }
    );
  };

  const handleDeleteClick = (mapping: CategoryMapping) => {
    setMappingToDelete(mapping);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (mappingToDelete) {
      deleteMutation.mutate(mappingToDelete.id, {
        onSuccess: () => {
          toast.success('Category mapping deleted successfully');
          setDeleteDialogOpen(false);
          setMappingToDelete(null);
        },
        onError: (error: Error) => {
          toast.error(error.message || 'Failed to delete category mapping');
        },
      });
    }
  };

  const usedCategories = new Set(mappings.map((m) => m.original_category));
  const availableCategories = VALID_ORIGINAL_CATEGORIES.filter(
    (cat) => !usedCategories.has(cat) || editingMapping?.original_category === cat
  );

  if (isLoading) {
    const content = (
      <>
        {!noCard && (
          <CardHeader>
            <CardTitle>Category Mappings</CardTitle>
            <CardDescription>Loading category mappings...</CardDescription>
          </CardHeader>
        )}
        <CardContent className={noCard ? "p-0" : ""}>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </>
    );

    return noCard ? <>{content}</> : <Card>{content}</Card>;
  }

  if (error) {
    const content = (
      <>
        <CardHeader>
          <CardTitle>Category Mappings</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load category mappings
          </CardDescription>
        </CardHeader>
      </>
    );

    return noCard ? <>{content}</> : <Card>{content}</Card>;
  }

  // Header content
  const headerContent = (
    <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        {!noCard && (
          <>
            <CardTitle className="text-lg sm:text-xl">Category Mappings</CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Manage custom names and descriptions for VPS plan categories.
            </CardDescription>
          </>
        )}
      </div>
      <Button
        onClick={() => handleOpenDialog()}
        className="w-full sm:w-auto shrink-0"
        size="sm"
      >
        <Plus className="h-4 w-4 mr-2" />
        <span className="hidden xs:inline">Add Mapping</span>
        <span className="inline xs:hidden">Add</span>
      </Button>
    </div>
  );

  // Main content
  const mainContent = (
    <>
      {mappings.length === 0 ? (
        <div className="text-center py-8 sm:py-12 text-muted-foreground px-2">
          <div className="max-w-md mx-auto">
            <p className="text-base sm:text-lg font-medium mb-2">No category mappings yet</p>
            <p className="text-xs sm:text-sm mb-6">Click "Add Mapping" to create your first custom category name.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {mappings.map((mapping) => (
              <MobileMappingCard
                key={mapping.id}
                mapping={mapping}
                onEdit={handleOpenDialog}
                onDelete={handleDeleteClick}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]" />
                      <TableHead>Original Category</TableHead>
                      <TableHead>Custom Name</TableHead>
                      <TableHead className="max-w-xs">Description</TableHead>
                      <TableHead>Display Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={mappings.map((m) => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {mappings.map((mapping) => (
                        <SortableRow
                          key={mapping.id}
                          mapping={mapping}
                          onEdit={handleOpenDialog}
                          onDelete={handleDeleteClick}
                          onToggleEnabled={handleToggleEnabled}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          </div>
        </>
      )}
    </>
  );

  if (noCard) {
    return (
      <>
        <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold">Category Mappings</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage custom names and descriptions for VPS plan categories.
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full sm:w-auto shrink-0"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Add Mapping</span>
            <span className="inline xs:hidden">Add</span>
          </Button>
        </div>
        {mainContent}

      {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base sm:text-lg">
                {editingMapping ? 'Edit Category Mapping' : 'Add Category Mapping'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {editingMapping
                  ? 'Update the custom name and description for this category.'
                  : 'Create a new custom name and description for a VPS category.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="original_category" className="text-sm">Original Category</Label>
                  {editingMapping ? (
                    <Input
                      id="original_category"
                      value={form.watch('original_category')}
                      disabled
                      className="bg-muted"
                    />
                  ) : (
                    <Select
                      value={form.watch('original_category')}
                      onValueChange={(value) =>
                        form.setValue('original_category', value)
                      }
                    >
                      <SelectTrigger id="original_category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The original category name from the provider API
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="custom_name" className="text-sm">Custom Name *</Label>
                  <Input
                    id="custom_name"
                    {...form.register('custom_name')}
                    placeholder="e.g., Standard VPS"
                  />
                  {form.formState.errors.custom_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.custom_name.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="custom_description" className="text-sm">Custom Description</Label>
                  <Textarea
                    id="custom_description"
                    {...form.register('custom_description')}
                    placeholder="Describe this category for your customers..."
                    rows={3}
                  />
                  {form.formState.errors.custom_description && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.custom_description.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="display_order" className="text-sm">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    {...form.register('display_order', { valueAsNumber: true })}
                    min="0"
                  />
                  {form.formState.errors.display_order && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.display_order.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="enabled"
                    checked={form.watch('enabled')}
                    onCheckedChange={(checked) =>
                      form.setValue('enabled', checked)
                    }
                  />
                  <Label htmlFor="enabled" className="text-sm">Enabled</Label>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    form.formState.isSubmitting ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  className="w-full sm:w-auto"
                >
                  {editingMapping ? 'Update' : 'Create'} Mapping
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="w-[95vw] max-w-sm">
            <AlertDialogHeader className="pb-2">
              <AlertDialogTitle className="text-base sm:text-lg">Delete Category Mapping?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete the category mapping for "
                {mappingToDelete?.original_category}"? This action cannot be undone.
                The default category name will be used instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
              <AlertDialogCancel className="w-full sm:w-auto">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="w-full sm:w-auto">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          {headerContent}
        </CardHeader>
        <CardContent className="pt-0">
          {mainContent}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">
              {editingMapping ? 'Edit Category Mapping' : 'Add Category Mapping'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingMapping
                ? 'Update the custom name and description for this category.'
                : 'Create a new custom name and description for a VPS category.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="original_category" className="text-sm">Original Category</Label>
                {editingMapping ? (
                  <Input
                    id="original_category"
                    value={form.watch('original_category')}
                    disabled
                    className="bg-muted"
                  />
                ) : (
                  <Select
                    value={form.watch('original_category')}
                    onValueChange={(value) =>
                      form.setValue('original_category', value)
                    }
                  >
                    <SelectTrigger id="original_category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  The original category name from the provider API
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="custom_name" className="text-sm">Custom Name *</Label>
                <Input
                  id="custom_name"
                  {...form.register('custom_name')}
                  placeholder="e.g., Standard VPS"
                />
                {form.formState.errors.custom_name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.custom_name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="custom_description" className="text-sm">Custom Description</Label>
                <Textarea
                  id="custom_description"
                  {...form.register('custom_description')}
                  placeholder="Describe this category for your customers..."
                  rows={3}
                />
                {form.formState.errors.custom_description && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.custom_description.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="display_order" className="text-sm">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  {...form.register('display_order', { valueAsNumber: true })}
                  min="0"
                />
                {form.formState.errors.display_order && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.display_order.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="enabled"
                  checked={form.watch('enabled')}
                  onCheckedChange={(checked) =>
                    form.setValue('enabled', checked)
                  }
                />
                <Label htmlFor="enabled" className="text-sm">Enabled</Label>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="w-full sm:w-auto"
              >
                {editingMapping ? 'Update' : 'Create'} Mapping
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader className="pb-2">
            <AlertDialogTitle className="text-base sm:text-lg">Delete Category Mapping?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete the category mapping for "
              {mappingToDelete?.original_category}"? This action cannot be undone.
              The default category name will be used instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <AlertDialogCancel className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="w-full sm:w-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};