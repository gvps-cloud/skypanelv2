import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Archive,
  RotateCcw,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Backup {
  id: string;
  createdAt?: string;
  status?: string;
  size?: number;
  type?: string;
  components?: any;
}

interface BackupsTabProps {
  subscriptionId: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

export default function BackupsTab({ subscriptionId }: BackupsTabProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBackupId, setRestoreBackupId] = useState("");
  const [restoring, setRestoring] = useState(false);

  const [autoBackupsEnabled, setAutoBackupsEnabled] = useState(true);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const [backupsRes, disabledRes] = await Promise.allSettled([
        apiClient.get<{ backups?: Backup[] }>(`/hosting/backups/${subscriptionId}/backups`),
        apiClient.get<{ disabled?: boolean }>(`/hosting/backups/${subscriptionId}/backups-disabled`),
      ]);
      if (backupsRes.status === "fulfilled") {
        setBackups(backupsRes.value.backups ?? []);
      } else {
        setError(backupsRes.reason instanceof Error ? backupsRes.reason.message : "Failed to load backups");
      }
      if (disabledRes.status === "fulfilled") {
        setAutoBackupsEnabled(!disabledRes.value?.disabled);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!subscriptionId) return;
    setCreating(true);
    try {
      await apiClient.post(`/hosting/backups/${subscriptionId}/backups`, { 
        description: backupDescription.trim() || undefined 
      });
      toast.success("Backup initiated");
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!subscriptionId) return;
    if (!confirm("Delete this backup?")) return;
    setActionLoading(backupId);
    try {
      await apiClient.delete(`/hosting/backups/${subscriptionId}/backups/${backupId}`);
      toast.success("Backup deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete backup");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async () => {
    if (!subscriptionId || !restoreBackupId) return;
    setRestoring(true);
    try {
      await apiClient.put(`/hosting/backups/${subscriptionId}/backups/${restoreBackupId}`, {});
      toast.success("Restore initiated");
      setRestoreOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  };

  const handleToggleAutoBackup = async () => {
    if (!subscriptionId) return;
    setTogglingAuto(true);
    try {
      await apiClient.put(`/hosting/backups/${subscriptionId}/backups-disabled`, {
        disabled: autoBackupsEnabled,
      });
      setAutoBackupsEnabled(!autoBackupsEnabled);
      toast.success(autoBackupsEnabled ? "Automatic backups disabled" : "Automatic backups enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle auto backups");
    } finally {
      setTogglingAuto(false);
    }
  };

  if (loading && backups.length === 0) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading backups...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1.5" />Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border bg-card shadow-sm")}>
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Archive className="h-5 w-5 text-primary" />
              <span>Backups</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage website backups.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={autoBackupsEnabled} onCheckedChange={handleToggleAutoBackup} disabled={togglingAuto} />
              <span className="text-xs text-muted-foreground">Auto</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Backup Now
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {backups.length === 0 ? (
          <div className="text-center py-8">
            <Archive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No backups found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className="font-medium">{formatDate(backup.createdAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        backup.status === "completed" || backup.status === "success"
                          ? "default"
                          : backup.status === "in_progress" || backup.status === "running"
                            ? "secondary"
                            : backup.status === "failed"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {backup.status ?? "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatBytes(backup.size)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRestoreBackupId(backup.id);
                          setRestoreOpen(true);
                        }}
                        disabled={backup.status === "in_progress"}
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span className="ml-1">Restore</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Backup Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>Create a full website backup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="backup-note">Note (Optional)</Label>
              <Input
                id="backup-note"
                placeholder="Before upgrading WordPress"
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Create Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirm Dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              Are you sure? This will overwrite the current website data with the backup snapshot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleRestore} disabled={restoring}>
              {restoring && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
