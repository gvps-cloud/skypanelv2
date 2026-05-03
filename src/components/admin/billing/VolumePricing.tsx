/**
 * Volume Pricing Component
 * Admin interface for managing Block Storage volume types and billing
 */
import React, { useState, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw, Plus, Pencil, Trash2, HardDrive, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

interface VolumeType {
  id: string;
  label: string;
  storage_type: string;
  size_min_gb: number;
  size_max_gb: number;
  price_per_gb_month: number;
  price_per_gb_hour: number;
  region_pricing: Record<string, { price_per_gb_month: number; price_per_gb_hour: number }>;
  is_active: boolean;
  display_order: number;
  description: string | null;
}

interface Volume {
  id: string;
  organization_id: string;
  organization_name: string;
  vps_id: string | null;
  vps_label: string | null;
  provider: string;
  provider_volume_id: string;
  label: string;
  region: string;
  size_gb: number;
  storage_type: string;
  status: string;
  hourly_price: number;
  created_at: string;
}

interface VolumeOverview {
  stats: {
    total_volumes: number;
    active_volumes: number;
    total_capacity_gb: number;
  };
  by_status: Array<{ status: string; count: string; total_gb: string }>;
  by_organization: Array<{ id: string; name: string; volume_count: string; total_gb: string }>;
  recent_billing: Array<{
    id: string;
    volume_label: string;
    provider: string;
    total_amount: number;
    size_gb: number;
    billing_period_start: string;
    organization_name: string;
  }>;
}

export function VolumePricing() {
  const [volumeTypes, setVolumeTypes] = useState<VolumeType[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [overview, setOverview] = useState<VolumeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"types" | "volumes">("types");
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [editingType, setEditingType] = useState<VolumeType | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    storage_type: "ssd",
    size_min_gb: 10,
    size_max_gb: 10000,
    price_per_gb_month: 0,
    price_per_gb_hour: 0.000015,
    is_active: true,
    description: "",
  });

  const fetchVolumeTypes = useCallback(async () => {
    try {
      const data = await apiClient.get<{ volume_types: VolumeType[] }>(
        "/admin/volume-billing/volume-types"
      );
      setVolumeTypes(data.volume_types || []);
    } catch {
      toast.error("Failed to load volume types");
    }
  }, []);

  const fetchVolumes = useCallback(async () => {
    try {
      const data = await apiClient.get<{ volumes: Volume[] }>(
        "/admin/volume-billing/volumes"
      );
      setVolumes(data.volumes || []);
    } catch {
      toast.error("Failed to load volumes");
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await apiClient.get<VolumeOverview>(
        "/admin/volume-billing/volumes/overview"
      );
      setOverview(data);
    } catch {
      toast.error("Failed to load volume overview");
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchVolumeTypes(), fetchVolumes(), fetchOverview()]);
    setLoading(false);
  }, [fetchVolumeTypes, fetchVolumes, fetchOverview]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateType = async () => {
    try {
      await apiClient.post("/admin/volume-billing/volume-types", formData);
      toast.success("Volume type created");
      setShowTypeDialog(false);
      resetForm();
      fetchVolumeTypes();
    } catch (err: any) {
      toast.error(err.message || "Failed to create volume type");
    }
  };

  const handleUpdateType = async () => {
    if (!editingType) return;
    try {
      await apiClient.put(
        `/admin/volume-billing/volume-types/${editingType.id}`,
        formData
      );
      toast.success("Volume type updated");
      setShowTypeDialog(false);
      setEditingType(null);
      resetForm();
      fetchVolumeTypes();
    } catch (err: any) {
      toast.error(err.message || "Failed to update volume type");
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Delete this volume type?")) return;
    try {
      await apiClient.delete(`/admin/volume-billing/volume-types/${id}`);
      toast.success("Volume type deleted");
      fetchVolumeTypes();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete volume type");
    }
  };

  const resetForm = () => {
    setFormData({
      label: "",
      storage_type: "ssd",
      size_min_gb: 10,
      size_max_gb: 10000,
      price_per_gb_month: 0,
      price_per_gb_hour: 0.000015,
      is_active: true,
      description: "",
    });
  };

  const openEditDialog = (type: VolumeType) => {
    setEditingType(type);
    setFormData({
      label: type.label,
      storage_type: type.storage_type,
      size_min_gb: type.size_min_gb,
      size_max_gb: type.size_max_gb,
      price_per_gb_month: Number(type.price_per_gb_month),
      price_per_gb_hour: Number(type.price_per_gb_hour),
      is_active: type.is_active,
      description: type.description || "",
    });
    setShowTypeDialog(true);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-600";
      case "creating": return "bg-yellow-500/10 text-yellow-600";
      case "resizing": return "bg-blue-500/10 text-blue-600";
      case "deleting": return "bg-red-500/10 text-red-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-primary/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Volumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.stats.total_volumes}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Volumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.stats.active_volumes}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/25">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.stats.total_capacity_gb} GB</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "types"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("types")}
        >
          Volume Types
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "volumes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("volumes")}
        >
          All Volumes
        </button>
      </div>

      {/* Volume Types Tab */}
      {activeTab === "types" && (
        <Card className="border-primary/25">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Volume Types
              </CardTitle>
              <CardDescription>
                Configure Block Storage pricing tiers
              </CardDescription>
            </div>
            <Button
              onClick={() => { resetForm(); setEditingType(null); setShowTypeDialog(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Size Range</TableHead>
                  <TableHead>$/GB/mo</TableHead>
                  <TableHead>$/GB/hr</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumeTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No volume types configured
                    </TableCell>
                  </TableRow>
                )}
                {volumeTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{type.storage_type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{type.size_min_gb}–{type.size_max_gb} GB</TableCell>
                    <TableCell>${Number(type.price_per_gb_month).toFixed(4)}</TableCell>
                    <TableCell>${Number(type.price_per_gb_hour).toFixed(6)}</TableCell>
                    <TableCell>
                      <Badge className={cn(type.is_active ? "bg-green-500/10 text-green-600" : "bg-muted")}>
                        {type.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Volumes Tab */}
      {activeTab === "volumes" && (
        <Card className="border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              All Volumes
            </CardTitle>
            <CardDescription>
              View all Block Storage volumes across organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>VPS</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No volumes found
                    </TableCell>
                  </TableRow>
                )}
                {volumes.map((vol) => (
                  <TableRow key={vol.id}>
                    <TableCell className="font-medium">{vol.label}</TableCell>
                    <TableCell>{vol.organization_name}</TableCell>
                    <TableCell>{vol.vps_label || "—"}</TableCell>
                    <TableCell>{vol.region}</TableCell>
                    <TableCell>{vol.size_gb} GB</TableCell>
                    <TableCell>
                      <Badge variant="outline">{vol.storage_type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(vol.status)}>{vol.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{vol.provider_volume_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Volume Type" : "Create Volume Type"}
            </DialogTitle>
            <DialogDescription>
              Configure pricing for Block Storage volumes
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Label</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="NVMe Block Storage"
              />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="High-performance NVMe Block Storage"
              />
            </div>
            <div>
              <Label>Storage Type</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.storage_type === "ssd"}
                    onChange={() => setFormData({ ...formData, storage_type: "ssd" })}
                  />
                  SSD
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.storage_type === "nvme"}
                    onChange={() => setFormData({ ...formData, storage_type: "nvme" })}
                  />
                  NVMe
                </label>
              </div>
            </div>
            <div>
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Min Size (GB)</Label>
              <Input
                type="number"
                value={formData.size_min_gb}
                onChange={(e) => setFormData({ ...formData, size_min_gb: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Max Size (GB)</Label>
              <Input
                type="number"
                value={formData.size_max_gb}
                onChange={(e) => setFormData({ ...formData, size_max_gb: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Price per GB / Month ($)</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.price_per_gb_month}
                onChange={(e) => setFormData({ ...formData, price_per_gb_month: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Price per GB / Hour ($)</Label>
              <Input
                type="number"
                step="0.000001"
                value={formData.price_per_gb_hour}
                onChange={(e) => setFormData({ ...formData, price_per_gb_hour: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={editingType ? handleUpdateType : handleCreateType}>
              {editingType ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
