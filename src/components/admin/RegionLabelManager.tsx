/**
 * Region Label Manager Component
 * Admin interface for managing whitelabel region display names
 */

import React, { useState, useEffect } from 'react';
import { Globe, Save, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';

interface RegionLabel {
  id: string;
  region_id: string;
  provider: string;
  display_label: string;
  display_country: string;
  created_at: string;
  updated_at: string;
}

export default function RegionLabelManager() {
  const [labels, setLabels] = useState<RegionLabel[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ display_label: string; display_country: string }>({
    display_label: '',
    display_country: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch labels on mount
  useEffect(() => {
    fetchLabels();
  }, []);

  const fetchLabels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/admin/platform/region-labels');
      if (response.data.success) {
        setLabels(response.data.labels || []);
      } else {
        setError('Failed to fetch region labels');
      }
    } catch (err: any) {
      console.error('Error fetching region labels:', err);
      setError(err.message || 'Failed to fetch region labels');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (label: RegionLabel) => {
    setEditingId(label.region_id);
    setEditForm({
      display_label: label.display_label,
      display_country: label.display_country,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ display_label: '', display_country: '' });
  };

  const handleSave = async (regionId: string) => {
    try {
      setSaving(true);
      const response = await apiClient.put(`/api/admin/platform/region-labels/${regionId}`, {
        display_label: editForm.display_label,
        display_country: editForm.display_country,
      });

      if (response.data.success) {
        toast.success('Region label updated successfully');
        setEditingId(null);
        await fetchLabels();
      } else {
        toast.error('Failed to update region label');
      }
    } catch (err: any) {
      console.error('Error updating region label:', err);
      toast.error(err.message || 'Failed to update region label');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (regionId: string) => {
    try {
      setSaving(true);
      const response = await apiClient.delete(`/api/admin/platform/region-labels/${regionId}`);

      if (response.data.success) {
        toast.success('Region label reset to default');
        await fetchLabels();
      } else {
        toast.error('Failed to reset region label');
      }
    } catch (err: any) {
      console.error('Error resetting region label:', err);
      toast.error(err.message || 'Failed to reset region label');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={fetchLabels} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Region Display Labels</CardTitle>
          </div>
          <CardDescription>
            Customize how region names appear to users on the homepage globe and throughout the platform.
            These labels are shown instead of the provider&apos;s native region names for whitelabeling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Region ID</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labels.map((label) => (
                  <TableRow key={label.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {label.region_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {editingId === label.region_id ? (
                        <Input
                          value={editForm.display_label}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, display_label: e.target.value }))
                          }
                          className="max-w-[200px]"
                          placeholder="Display name"
                        />
                      ) : (
                        <span className="font-medium">{label.display_label}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === label.region_id ? (
                        <Input
                          value={editForm.display_country}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, display_country: e.target.value }))
                          }
                          className="max-w-[160px]"
                          placeholder="Country"
                        />
                      ) : (
                        <span>{label.display_country}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingId === label.region_id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSave(label.region_id)}
                              disabled={saving}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(label)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReset(label.region_id)}
                              disabled={saving}
                              title="Reset to default (delete custom label)"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {labels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No region labels found. Labels will be created when you first edit them.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Display Name:</strong> The friendly name shown on the homepage globe and
              throughout the platform (e.g., &quot;US East (Newark)&quot; instead of &quot;Newark&quot;)
            </li>
            <li>
              <strong>Country:</strong> The country name displayed alongside the region
            </li>
            <li>
              <strong>Reset:</strong> Clicking the reset button removes the custom label and the
              platform will use the provider&apos;s native region name
            </li>
            <li>
              <strong>Globe Visualization:</strong> Changes take effect immediately on the homepage
              3D globe
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
