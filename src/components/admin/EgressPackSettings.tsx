/**
 * Egress Pack Settings Component
 * Admin interface for managing egress credit pack definitions
 * Auto-saves all changes immediately
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Star, ThumbsUp, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { egressService, type CreditPack } from '@/services/egressService';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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

interface PackFormData {
  id: string;
  gb: number;
  price: number;
  isPopular: boolean;
  isRecommended: boolean;
}

const defaultFormData: PackFormData = {
  id: '',
  gb: 100,
  price: 0.50,
  isPopular: false,
  isRecommended: false,
};

const EgressPackSettings: React.FC = () => {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [warningThreshold, setWarningThreshold] = useState(200);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [formData, setFormData] = useState<PackFormData>(defaultFormData);
  const [thresholdInput, setThresholdInput] = useState('200');
  const [savingThreshold, setSavingThreshold] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await egressService.getAdminPackSettings();
      if (result.success && result.data) {
        setPacks(result.data.packs);
        setWarningThreshold(result.data.warningThresholdGb);
        setThresholdInput(result.data.warningThresholdGb.toString());
      } else {
        toast.error(result.error || 'Failed to load pack settings');
      }
    } catch (error) {
      console.error('Error fetching pack settings:', error);
      toast.error('Failed to load pack settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Auto-save function that saves current packs to server
  const autoSave = async (packsToSave: CreditPack[]) => {
    setSaving(true);
    try {
      const threshold = parseInt(thresholdInput, 10);
      if (isNaN(threshold) || threshold < 1) {
        toast.error('Warning threshold must be a positive number');
        setSaving(false);
        return false;
      }

      const result = await egressService.updateAdminPackSettings(packsToSave, threshold);
      if (result.success) {
        await fetchSettings();
        return true;
      } else {
        toast.error(result.error || 'Failed to save pack settings');
        return false;
      }
    } catch (error) {
      console.error('Error saving pack settings:', error);
      toast.error('Failed to save pack settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAddPack = () => {
    setFormData(defaultFormData);
    setShowAddDialog(true);
  };

  const handleEditPack = (pack: CreditPack) => {
    setSelectedPack(pack);
    setFormData({
      id: pack.id,
      gb: pack.gb,
      price: pack.price,
      isPopular: pack.isPopular || false,
      isRecommended: pack.isRecommended || false,
    });
    setShowEditDialog(true);
  };

  const handleDeletePack = (pack: CreditPack) => {
    setSelectedPack(pack);
    setShowDeleteDialog(true);
  };

  const confirmAddPack = async () => {
    if (!formData.id.trim()) {
      toast.error('Pack ID is required');
      return;
    }
    if (formData.gb < 1) {
      toast.error('Pack size must be at least 1 GB');
      return;
    }
    if (formData.price < 0.01) {
      toast.error('Pack price must be at least $0.01');
      return;
    }

    // Check for duplicate ID
    if (packs.some(p => p.id === formData.id)) {
      toast.error('A pack with this ID already exists');
      return;
    }

    const newPack: CreditPack = {
      id: formData.id,
      gb: formData.gb,
      price: formData.price,
      isPopular: formData.isPopular,
      isRecommended: formData.isRecommended,
    };

    const updatedPacks = [...packs, newPack];
    const success = await autoSave(updatedPacks);
    if (success) {
      setShowAddDialog(false);
      toast.success('Pack added successfully');
    }
  };

  const confirmEditPack = async () => {
    if (!selectedPack) return;
    if (!formData.id.trim()) {
      toast.error('Pack ID is required');
      return;
    }
    if (formData.gb < 1) {
      toast.error('Pack size must be at least 1 GB');
      return;
    }
    if (formData.price < 0.01) {
      toast.error('Pack price must be at least $0.01');
      return;
    }

    // Check for duplicate ID (excluding current pack)
    if (packs.some(p => p.id === formData.id && p.id !== selectedPack.id)) {
      toast.error('A pack with this ID already exists');
      return;
    }

    const updatedPacks = packs.map(p =>
      p.id === selectedPack.id
        ? {
            id: formData.id,
            gb: formData.gb,
            price: formData.price,
            isPopular: formData.isPopular,
            isRecommended: formData.isRecommended,
          }
        : p
    );

    const success = await autoSave(updatedPacks);
    if (success) {
      setShowEditDialog(false);
      setSelectedPack(null);
      toast.success('Pack updated successfully');
    }
  };

  const confirmDeletePack = async () => {
    if (!selectedPack) return;

    const updatedPacks = packs.filter(p => p.id !== selectedPack.id);
    const success = await autoSave(updatedPacks);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedPack(null);
      toast.success(`Pack "${selectedPack.id}" deleted successfully`);
    }
  };

  // Auto-save threshold when input loses focus or Enter key is pressed
  const handleThresholdBlur = async () => {
    const threshold = parseInt(thresholdInput, 10);
    if (isNaN(threshold) || threshold < 1) {
      toast.error('Warning threshold must be a positive number');
      setThresholdInput(warningThreshold.toString());
      return;
    }

    if (threshold === warningThreshold) {
      return; // No change
    }

    setSavingThreshold(true);
    try {
      const result = await egressService.updateAdminPackSettings(packs, threshold);
      if (result.success) {
        await fetchSettings();
        toast.success('Warning threshold updated successfully');
      } else {
        toast.error(result.error || 'Failed to update warning threshold');
        setThresholdInput(warningThreshold.toString());
      }
    } catch (error) {
      console.error('Error updating threshold:', error);
      toast.error('Failed to update warning threshold');
      setThresholdInput(warningThreshold.toString());
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleThresholdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleThresholdBlur();
    }
  };

  const formatGb = (gb: number): string => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(gb % 1000 === 0 ? 0 : 1)} TB`;
    }
    return `${gb} GB`;
  };

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(6)}`;
  };

  return (
    <div className="space-y-6">
      {/* Pack Management Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Credit Pack Definitions
              </CardTitle>
              <CardDescription>
                Define the credit packs available for purchase. Changes are saved automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                disabled={loading || saving}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading || saving ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleAddPack} disabled={saving}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pack
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading settings...</span>
            </div>
          ) : saving ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Saving changes...</span>
            </div>
          ) : packs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No credit packs defined. Click "Add Pack" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Badges</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packs.map((pack) => (
                  <TableRow key={pack.id}>
                    <TableCell className="font-medium">{pack.id}</TableCell>
                    <TableCell>{formatGb(pack.gb)}</TableCell>
                    <TableCell>{formatPrice(pack.price)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pack.isPopular && (
                          <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                            <Star className="h-3 w-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                        {pack.isRecommended && (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                        {!pack.isPopular && !pack.isRecommended && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPack(pack)}
                          disabled={saving}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePack(pack)}
                          className="text-destructive hover:text-destructive"
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Warning Threshold Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Warning Threshold
          </CardTitle>
          <CardDescription>
            Set the credit balance threshold (in GB) below which users will see a low balance warning. Changes auto-save on blur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="threshold">Warning Threshold (GB)</Label>
              <div className="relative mt-1">
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  onBlur={handleThresholdBlur}
                  onKeyDown={handleThresholdKeyDown}
                  disabled={savingThreshold}
                />
                {savingThreshold && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground pt-5">
              Current: {warningThreshold} GB
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Pack Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credit Pack</DialogTitle>
            <DialogDescription>
              Create a new credit pack for purchase. The pack will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-id">Pack ID</Label>
              <Input
                id="add-id"
                placeholder="e.g., 100GB, 1TB"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-gb">Size (GB)</Label>
              <Input
                id="add-gb"
                type="number"
                min="1"
                value={formData.gb}
                onChange={(e) => setFormData({ ...formData, gb: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-price">Price ($)</Label>
              <Input
                id="add-price"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="add-popular"
                  checked={formData.isPopular}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPopular: checked })}
                />
                <Label htmlFor="add-popular" className="cursor-pointer">
                  <Star className="h-4 w-4 inline mr-1 text-yellow-500" />
                  Popular
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="add-recommended"
                  checked={formData.isRecommended}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecommended: checked })}
                />
                <Label htmlFor="add-recommended" className="cursor-pointer">
                  <ThumbsUp className="h-4 w-4 inline mr-1 text-green-500" />
                  Recommended
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmAddPack} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Pack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pack Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credit Pack</DialogTitle>
            <DialogDescription>
              Update the credit pack details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-id">Pack ID</Label>
              <Input
                id="edit-id"
                placeholder="e.g., 100GB, 1TB"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gb">Size (GB)</Label>
              <Input
                id="edit-gb"
                type="number"
                min="1"
                value={formData.gb}
                onChange={(e) => setFormData({ ...formData, gb: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price ($)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-popular"
                  checked={formData.isPopular}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPopular: checked })}
                />
                <Label htmlFor="edit-popular" className="cursor-pointer">
                  <Star className="h-4 w-4 inline mr-1 text-yellow-500" />
                  Popular
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-recommended"
                  checked={formData.isRecommended}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRecommended: checked })}
                />
                <Label htmlFor="edit-recommended" className="cursor-pointer">
                  <ThumbsUp className="h-4 w-4 inline mr-1 text-green-500" />
                  Recommended
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={confirmEditPack} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Pack</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedPack?.id}" pack? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePack}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EgressPackSettings;
