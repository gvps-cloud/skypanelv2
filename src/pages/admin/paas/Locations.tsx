import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, MapPin, Edit, Trash2, Building, Globe } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface PaaSLocation {
  id: string;
  name: string;
  datacenterCode: string;
  region: string;
  country: string;
  description?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  workerCount?: number;
}

interface LocationStats {
  total: number;
  active: number;
  inactive: number;
  workersCount: number;
}

const DATACENTER_PAGE_SIZE = 5;

const AdminPaaSLocationsPage: React.FC = () => {
  const { token } = useAuth();

  const [locations, setLocations] = useState<PaaSLocation[]>([]);
  const [stats, setStats] = useState<LocationStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datacenterFilter, setDatacenterFilter] = useState<string>("all");
  const [datacenterSearch, setDatacenterSearch] = useState("");
  const [datacenterPage, setDatacenterPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [selectedLocation, setSelectedLocation] = useState<PaaSLocation | null>(null);
  const [newName, setNewName] = useState("");
  const [newDatacenterCode, setNewDatacenterCode] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadLocations = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const query =
        statusFilter && statusFilter !== "all"
          ? `?activeOnly=${statusFilter === "active"}`
          : "";
      const res = await fetch(buildApiUrl(`/api/admin/paas/locations${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load locations");
      }
      const items: PaaSLocation[] = (payload.locations || []).map((loc: any) => ({
        id: String(loc.id),
        name: loc.name,
        datacenterCode: loc.datacenterCode || loc.datacenter_code,
        region: loc.region,
        country: loc.country,
        description: loc.description,
        metadata: loc.metadata || {},
        isActive: loc.isActive || loc.is_active,
        createdAt: loc.createdAt || loc.created_at,
        updatedAt: loc.updatedAt || loc.updated_at,
        createdBy: loc.createdBy || loc.created_by,
        // workerCount comes from backend aggregation in PaaSLocationService.getAllLocations
        // It may be provided as either camelCase or snake_case depending on the caller
        workerCount:
          typeof loc.workerCount === "number"
            ? loc.workerCount
            : loc.worker_count !== undefined
            ? Number(loc.worker_count)
            : undefined,
      }));
      setLocations(items);
    } catch (error: any) {
      console.error("Failed to load PaaS locations", error);
      toast.error(error?.message || "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [hasToken, statusFilter, token]);

  const loadStats = useCallback(async () => {
    if (!hasToken) return;
    setStatsLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/paas/locations/stats"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load location stats");
      }
      setStats(payload.stats || payload);
    } catch (error: any) {
      console.error("Failed to load location stats", error);
      toast.error(error?.message || "Failed to load location statistics");
    } finally {
      setStatsLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const datacenterOptions = useMemo(
    () =>
      Array.from(new Set(locations.map((loc) => loc.datacenterCode))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [locations],
  );

  const {
    pagedDatacenterOptions,
    datacenterTotalPages,
    datacenterCurrentPage,
    datacenterTotalCount,
  } = useMemo(() => {
    const search = datacenterSearch.trim().toLowerCase();
    const filtered = search
      ? datacenterOptions.filter((code) => code.toLowerCase().includes(search))
      : datacenterOptions;

    const totalPages = Math.max(1, Math.ceil(filtered.length / DATACENTER_PAGE_SIZE));
    const currentPage = Math.min(datacenterPage, totalPages - 1);
    const start = currentPage * DATACENTER_PAGE_SIZE;
    const end = start + DATACENTER_PAGE_SIZE;

    return {
      pagedDatacenterOptions: filtered.slice(start, end),
      datacenterTotalPages: totalPages,
      datacenterCurrentPage: currentPage,
      datacenterTotalCount: filtered.length,
    };
  }, [datacenterOptions, datacenterSearch, datacenterPage]);

  const filteredLocations = useMemo(
    () =>
      datacenterFilter === "all"
        ? locations
        : locations.filter((loc) => loc.datacenterCode === datacenterFilter),
    [locations, datacenterFilter],
  );

  const resetCreateForm = () => {
    setNewName("");
    setNewDatacenterCode("");
    setNewRegion("");
    setNewCountry("");
    setNewDescription("");
    setNewIsActive(true);
  };

  const resetEditForm = () => {
    setSelectedLocation(null);
    setNewName("");
    setNewDatacenterCode("");
    setNewRegion("");
    setNewCountry("");
    setNewDescription("");
    setNewIsActive(true);
  };

  const openEditDialog = (location: PaaSLocation) => {
    setSelectedLocation(location);
    setNewName(location.name);
    setNewDatacenterCode(location.datacenterCode);
    setNewRegion(location.region);
    setNewCountry(location.country);
    setNewDescription(location.description || "");
    setNewIsActive(location.isActive);
    setEditOpen(true);
  };

  const openDeleteDialog = (location: PaaSLocation) => {
    setSelectedLocation(location);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!hasToken) return;
    if (!newName.trim() || !newDatacenterCode.trim() || !newRegion.trim() || !newCountry.trim()) {
      toast.error("Name, datacenter code, region, and country are required");
      return;
    }

    // Validate datacenter code format
    if (!/^[a-z0-9-]+$/i.test(newDatacenterCode.trim())) {
      toast.error("Datacenter code must contain only letters, numbers, and hyphens");
      return;
    }

    setCreating(true);
    try {
      const body = {
        name: newName.trim(),
        datacenterCode: newDatacenterCode.trim().toLowerCase(),
        region: newRegion.trim(),
        country: newCountry.trim(),
        description: newDescription.trim() || undefined,
        isActive: newIsActive,
      };

      const res = await fetch(buildApiUrl("/api/admin/paas/locations"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create location");
      }

      toast.success("Location created successfully");
      setAddOpen(false);
      resetCreateForm();
      void loadLocations();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to create location", error);
      toast.error(error?.message || "Failed to create location");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!hasToken || !selectedLocation) return;
    if (!newName.trim() || !newDatacenterCode.trim() || !newRegion.trim() || !newCountry.trim()) {
      toast.error("Name, datacenter code, region, and country are required");
      return;
    }

    // Validate datacenter code format if changed
    if (!/^[a-z0-9-]+$/i.test(newDatacenterCode.trim())) {
      toast.error("Datacenter code must contain only letters, numbers, and hyphens");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: newName.trim(),
        datacenterCode: newDatacenterCode.trim().toLowerCase(),
        region: newRegion.trim(),
        country: newCountry.trim(),
        description: newDescription.trim() || undefined,
        isActive: newIsActive,
      };

      const res = await fetch(buildApiUrl(`/api/admin/paas/locations/${selectedLocation.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update location");
      }

      toast.success("Location updated successfully");
      setEditOpen(false);
      resetEditForm();
      void loadLocations();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to update location", error);
      toast.error(error?.message || "Failed to update location");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasToken || !selectedLocation) return;

    setDeleting(true);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/locations/${selectedLocation.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete location");
      }

      toast.success(payload.message || "Location deleted successfully");
      setDeleteOpen(false);
      resetEditForm();
      void loadLocations();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to delete location", error);
      toast.error(error?.message || "Failed to delete location");
    } finally {
      setDeleting(false);
    }
  };

  const renderStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-emerald-600 text-white">Active</Badge>
    ) : (
      <Badge variant="outline">Inactive</Badge>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Locations"
        description="Manage datacenter locations for organizing worker nodes geographically."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
        actions={
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add location
          </Button>
        }
      />

      <ContentCard
        title="Location statistics"
        description="Overview of datacenter locations and worker distribution."
        headerAction={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              void loadLocations();
              void loadStats();
            }}
            disabled={loading || statsLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || statsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        {stats ? (
          <div className="grid gap-4 md:grid-cols-4 text-sm">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total:</span> {stats.total}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Active:</span> {stats.active}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="font-medium">Inactive:</span> {stats.inactive}
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Workers:</span> {stats.workersCount}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No location statistics available yet. Add a location to initialize.
          </p>
        )}
      </ContentCard>

      <ContentCard
        title="Datacenter locations"
        description="Physical and logical datacenter locations where worker nodes can be deployed."
        headerAction={
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={datacenterFilter}
              onValueChange={(value) => setDatacenterFilter(value)}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="All datacenters" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search datacenter code..."
                    value={datacenterSearch}
                    onChange={(e) => {
                      setDatacenterSearch(e.target.value);
                      setDatacenterPage(0);
                    }}
                    // Prevent Radix Select typeahead from hijacking key presses
                    // so users can type full search strings without auto-selecting items.
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    className="h-8"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">All datacenters</SelectItem>
                  {pagedDatacenterOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </div>
                {datacenterTotalCount > DATACENTER_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t px-2 py-1 text-xs text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={datacenterCurrentPage === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDatacenterPage((prev) => Math.max(prev - 1, 0));
                      }}
                    >
                      {"<"}
                    </Button>
                    <span>
                      Page {datacenterCurrentPage + 1} of {datacenterTotalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={datacenterCurrentPage >= datacenterTotalPages - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDatacenterPage((prev) => prev + 1);
                      }}
                    >
                      {">"}
                    </Button>
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {filteredLocations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No locations configured yet. Add at least one location to organize worker nodes.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Datacenter Code</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    <div>
                      {location.name}
                      {location.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {location.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {location.datacenterCode}
                  </TableCell>
                  <TableCell>{location.region}</TableCell>
                  <TableCell>{location.country}</TableCell>
                  <TableCell>{renderStatusBadge(location.isActive)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {location.workerCount || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(location)}
                        title="Edit location"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => openDeleteDialog(location)}
                        title="Delete location"
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
      </ContentCard>

      {/* Create Location Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => {
        setAddOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add datacenter location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="location-name">Location Name</Label>
              <Input
                id="location-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New York Datacenter 1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="datacenter-code">Datacenter Code</Label>
              <Input
                id="datacenter-code"
                value={newDatacenterCode}
                onChange={(e) => setNewDatacenterCode(e.target.value)}
                placeholder="us-nyc-01"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier using letters, numbers, and hyphens only
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="us-east"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  placeholder="United States"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Primary datacenter in New York"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is-active">Location is active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                resetCreateForm();
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) resetEditForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit datacenter location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-location-name">Location Name</Label>
              <Input
                id="edit-location-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New York Datacenter 1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-datacenter-code">Datacenter Code</Label>
              <Input
                id="edit-datacenter-code"
                value={newDatacenterCode}
                onChange={(e) => setNewDatacenterCode(e.target.value)}
                placeholder="us-nyc-01"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier using letters, numbers, and hyphens only
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-region">Region</Label>
                <Input
                  id="edit-region"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="us-east"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-country">Country</Label>
                <Input
                  id="edit-country"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  placeholder="United States"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Primary datacenter in New York"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-active"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-is-active">Location is active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                resetEditForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) resetEditForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete location</DialogTitle>
          </DialogHeader>
          {selectedLocation && (
            <div className="space-y-3 py-2">
              <p className="text-sm">
                Are you sure you want to delete the location "{selectedLocation.name}"?
              </p>
              {selectedLocation.workerCount && selectedLocation.workerCount > 0 && (
                <p className="text-sm text-amber-600">
                  Warning: {selectedLocation.workerCount} worker(s) are currently assigned to this location and will be unassigned.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                resetEditForm();
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaaSLocationsPage;