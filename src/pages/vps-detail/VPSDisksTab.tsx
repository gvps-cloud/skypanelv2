import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, RefreshCw, AlertTriangle, Trash2, Copy, Edit2, Key } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Disk {
  id: number;
  label: string;
  status: string;
  size: number;
  filesystem: string;
  created: string;
  updated: string;
}

interface VPSDisksTabProps {
  instanceId?: string;
  instanceLabel?: string;
}

export default function VPSDisksTab({ instanceId, instanceLabel }: VPSDisksTabProps) {
  const [disks, setDisks] = useState<Disk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadDisks = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ disks: Disk[] }>(`/vps/${instanceId}/disks`);
      setDisks(data.disks ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load disks";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadDisks();
  }, [loadDisks]);

  const handleDelete = async (diskId: number, diskLabel: string) => {
    if (!instanceId) return;
    if (!confirm(`Are you sure you want to delete disk "${diskLabel}"? This action cannot be undone.`)) return;

    setActionLoading(diskId);
    try {
      await apiClient.delete(`/vps/${instanceId}/disks/${diskId}`);
      toast.success(`Disk "${diskLabel}" deleted`);
      await loadDisks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete disk");
    } finally {
      setActionLoading(null);
    }
  };

  const handleClone = async (diskId: number, diskLabel: string) => {
    if (!instanceId) return;
    if (!confirm(`Clone disk "${diskLabel}"? This will create an identical copy.`)) return;

    setActionLoading(diskId);
    try {
      await apiClient.post(`/vps/${instanceId}/disks/${diskId}/clone`);
      toast.success(`Disk "${diskLabel}" cloned`);
      await loadDisks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone disk");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResize = async (diskId: number, currentSize: number, diskLabel: string) => {
    if (!instanceId) return;
    const input = prompt(`Enter new disk size in MB (current: ${currentSize} MB):`, String(currentSize));
    if (!input) return;
    const newSize = parseInt(input, 10);
    if (isNaN(newSize) || newSize < 1) {
      toast.error("Size must be a positive number");
      return;
    }
    if (newSize < currentSize) {
      toast.error("New size must be larger than current size");
      return;
    }

    setActionLoading(diskId);
    try {
      await apiClient.post(`/vps/${instanceId}/disks/${diskId}/resize`, { size: newSize });
      toast.success(`Disk "${diskLabel}" resize initiated to ${newSize} MB`);
      await loadDisks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resize disk");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePasswordReset = async (diskId: number, diskLabel: string) => {
    if (!instanceId) return;
    const password = prompt(`Enter new root password for disk "${diskLabel}":`);
    if (!password) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setActionLoading(diskId);
    try {
      await apiClient.post(`/vps/${instanceId}/disks/${diskId}/password`, { password });
      toast.success(`Password reset for disk "${diskLabel}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && disks.length === 0) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading disks...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="px-6 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadDisks}>
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <HardDrive className="h-5 w-5 text-primary" />
              <span>Disks</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage storage disks for {instanceLabel ?? "this instance"}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDisks} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {disks.length === 0 ? (
          <div className="text-center py-8">
            <HardDrive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No disks found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disks.map((disk) => (
              <div
                key={disk.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground truncate">
                      {disk.label}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      disk.status === "ready"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}>
                      {disk.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{(disk.size / 1024).toFixed(1)} GB</span>
                    <span>{disk.filesystem || "raw"}</span>
                    <span>ID: {disk.id}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResize(disk.id, disk.size, disk.label)}
                    disabled={actionLoading === disk.id}
                    title="Resize disk"
                  >
                    {actionLoading === disk.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Edit2 className="h-3 w-3" />
                    )}
                    <span className="ml-1">Resize</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClone(disk.id, disk.label)}
                    disabled={actionLoading === disk.id}
                    title="Clone disk"
                  >
                    <Copy className="h-3 w-3" />
                    <span className="ml-1">Clone</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePasswordReset(disk.id, disk.label)}
                    disabled={actionLoading === disk.id}
                    title="Reset root password"
                  >
                    <Key className="h-3 w-3" />
                    <span className="ml-1">Password</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(disk.id, disk.label)}
                    disabled={actionLoading === disk.id}
                    className="text-destructive hover:text-destructive"
                    title="Delete disk"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="ml-1">Delete</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
