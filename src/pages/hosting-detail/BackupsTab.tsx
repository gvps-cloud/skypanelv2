import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Archive,
  Download,
  Eye,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type OperationStatus = "started" | "successful" | "failed";
type BackupDisplayStatus = "running" | "successful" | "partial" | "failed" | "unknown";
type BackupStorageKind = "enhance" | "s3";
type BackupDownloadKind = "website" | "email";
type DatabaseRestoreMode = "all" | "none" | "specific";
type EmailRestoreMode = "none" | "all" | "specific";

interface BackupComponent {
  status?: OperationStatus;
  size?: number;
  count?: number;
}

interface BackupComponents {
  files?: BackupComponent;
  databases?: BackupComponent;
  emails?: BackupComponent;
}

interface Backup {
  id: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  displayDate?: string | null;
  displayStatus?: BackupDisplayStatus;
  canRestore?: boolean;
  size?: number | null;
  filesSize?: number | null;
  mysqlDbsSize?: number | null;
  emailsSize?: number | null;
  mysqlDbsCount?: number | null;
  emailsCount?: number | null;
  homeDirStatus?: OperationStatus | null;
  mysqlDbsStatus?: OperationStatus | null;
  emailsStatus?: OperationStatus | null;
  snapshotDirName?: string | null;
  kind?: "manual" | "automatic" | "archive" | string | null;
  storageKind?: BackupStorageKind | string | null;
  description?: string | null;
  components?: BackupComponents;
}

interface BackupStatus {
  id?: string;
  action?: "backup" | "restore" | string;
  displayDate?: string | null;
  displayStatus?: BackupDisplayStatus;
  components?: BackupComponents;
  homeDirStatus?: OperationStatus | null;
  mysqlDbsStatus?: OperationStatus | null;
  emailsStatus?: OperationStatus | null;
}

interface DirectoryTreeNode {
  name: string;
  rel_path: string;
  node_type: "file" | "directory" | "symlink" | string;
  size: number;
  permissions: string;
  last_modified: string;
}

interface BackupsTabProps {
  subscriptionId: string;
}

const statusLabels: Record<BackupDisplayStatus, string> = {
  running: "Running",
  successful: "Successful",
  partial: "Partial",
  failed: "Failed",
  unknown: "Unknown",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function statusVariant(status: BackupDisplayStatus | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "successful":
      return "default";
    case "running":
    case "partial":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function operationLabel(status: OperationStatus | null | undefined): string {
  switch (status) {
    case "started":
      return "Running";
    case "successful":
      return "Successful";
    case "failed":
      return "Failed";
    default:
      return "Not included";
  }
}

function storageQuery(backup: Backup | null): string {
  return backup?.storageKind === "enhance" || backup?.storageKind === "s3"
    ? `?storageKind=${encodeURIComponent(backup.storageKind)}`
    : "";
}

function backupSize(backup: Backup): number | null | undefined {
  const componentTotal =
    (backup.components?.files?.size ?? backup.filesSize ?? 0) +
    (backup.components?.databases?.size ?? backup.mysqlDbsSize ?? 0) +
    (backup.components?.emails?.size ?? backup.emailsSize ?? 0);

  return componentTotal > 0 ? componentTotal : backup.size;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ComponentSummary({ backup }: { backup: Backup }) {
  const components = backup.components ?? {
    files: { status: backup.homeDirStatus ?? undefined, size: backup.filesSize ?? undefined },
    databases: {
      status: backup.mysqlDbsStatus ?? undefined,
      size: backup.mysqlDbsSize ?? undefined,
      count: backup.mysqlDbsCount ?? undefined,
    },
    emails: {
      status: backup.emailsStatus ?? undefined,
      size: backup.emailsSize ?? undefined,
      count: backup.emailsCount ?? undefined,
    },
  };

  return (
    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      <span>Files: {operationLabel(components.files?.status)}</span>
      <span>DB: {operationLabel(components.databases?.status)}</span>
      <span>Email: {operationLabel(components.emails?.status)}</span>
    </div>
  );
}

export default function BackupsTab({ subscriptionId }: BackupsTabProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [createIncludeEmails, setCreateIncludeEmails] = useState(false);
  const [creating, setCreating] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState(true);
  const [restoreOnlyFiles, setRestoreOnlyFiles] = useState("");
  const [databaseMode, setDatabaseMode] = useState<DatabaseRestoreMode>("all");
  const [restoreDatabases, setRestoreDatabases] = useState("");
  const [emailMode, setEmailMode] = useState<EmailRestoreMode>("none");
  const [restoreEmails, setRestoreEmails] = useState("");

  const [backupsEnabled, setBackupsEnabled] = useState(true);
  const [togglingBackups, setTogglingBackups] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBackup, setDetailBackup] = useState<Backup | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<BackupStatus | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [treeOpen, setTreeOpen] = useState(false);
  const [treeBackup, setTreeBackup] = useState<Backup | null>(null);
  const [treeOffset, setTreeOffset] = useState("");
  const [treeNodes, setTreeNodes] = useState<DirectoryTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadKind, setDownloadKind] = useState<BackupDownloadKind>("website");
  const [downloading, setDownloading] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const hasRunningOperation = backupStatus?.displayStatus === "running";
  const disabledReason = backupsEnabled ? undefined : "Website backups are disabled";

  const loadData = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!subscriptionId) return;
      if (!options?.quiet) {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [backupsRes, disabledRes, statusRes] = await Promise.allSettled([
          apiClient.get<{ backups?: Backup[] }>(`/hosting/backups/${subscriptionId}/backups`),
          apiClient.get<{ disabled?: boolean }>(`/hosting/backups/${subscriptionId}/backups-disabled`),
          apiClient.get<{ status?: BackupStatus | null }>(`/hosting/backups/${subscriptionId}/backup-status`),
        ]);

        if (backupsRes.status === "fulfilled") {
          setBackups(backupsRes.value.backups ?? []);
        } else {
          setError(backupsRes.reason instanceof Error ? backupsRes.reason.message : "Failed to load backups");
        }

        if (disabledRes.status === "fulfilled") {
          setBackupsEnabled(!disabledRes.value?.disabled);
        }

        setBackupStatus(statusRes.status === "fulfilled" ? statusRes.value.status ?? null : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load backups");
      } finally {
        setLoading(false);
        if (!options?.quiet) {
          setRefreshing(false);
        }
      }
    },
    [subscriptionId],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!hasRunningOperation) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadData({ quiet: true });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [hasRunningOperation, loadData]);

  const sortedBackups = useMemo(
    () =>
      [...backups].sort((a, b) => {
        const aTime = new Date(a.displayDate ?? a.startedAt ?? a.finishedAt ?? 0).getTime();
        const bTime = new Date(b.displayDate ?? b.startedAt ?? b.finishedAt ?? 0).getTime();
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      }),
    [backups],
  );

  const handleCreate = async () => {
    if (!subscriptionId) return;
    setCreating(true);
    try {
      await apiClient.post(`/hosting/backups/${subscriptionId}/backups`, {
        description: backupDescription.trim() || undefined,
        includeEmails: createIncludeEmails,
      });
      toast.success("Backup initiated");
      setCreateOpen(false);
      setBackupDescription("");
      setCreateIncludeEmails(false);
      await loadData({ quiet: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (backup: Backup) => {
    if (!subscriptionId || !window.confirm("Delete this backup?")) return;
    setActionLoading(`delete-${backup.id}`);
    try {
      await apiClient.delete(`/hosting/backups/${subscriptionId}/backups/${backup.id}${storageQuery(backup)}`);
      toast.success("Backup deleted");
      await loadData({ quiet: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete backup");
    } finally {
      setActionLoading(null);
    }
  };

  const buildRestorePayload = () => {
    const payload: Record<string, unknown> = {
      restoreFiles,
      includeEmails: emailMode !== "none",
    };

    const files = splitList(restoreOnlyFiles);
    if (restoreFiles && files.length > 0) {
      payload.restoreOnlyFiles = files;
    }

    if (databaseMode === "none") {
      payload.restoreDatabases = [];
    } else if (databaseMode === "specific") {
      payload.restoreDatabases = splitList(restoreDatabases);
    }

    if (emailMode === "all") {
      payload.restoreAllEmails = true;
    } else if (emailMode === "specific") {
      payload.restoreEmails = splitList(restoreEmails);
    }

    return payload;
  };

  const handleRestore = async () => {
    if (!subscriptionId || !restoreBackup) return;
    setRestoring(true);
    try {
      await apiClient.put(
        `/hosting/backups/${subscriptionId}/backups/${restoreBackup.id}${storageQuery(restoreBackup)}`,
        buildRestorePayload(),
      );
      toast.success("Restore initiated");
      setRestoreOpen(false);
      await loadData({ quiet: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  };

  const handleToggleBackups = async () => {
    if (!subscriptionId) return;
    setTogglingBackups(true);
    try {
      await apiClient.put(`/hosting/backups/${subscriptionId}/backups-disabled`, {
        disabled: backupsEnabled,
      });
      setBackupsEnabled(!backupsEnabled);
      toast.success(backupsEnabled ? "Website backups disabled" : "Website backups enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update backups setting");
    } finally {
      setTogglingBackups(false);
    }
  };

  const openRestore = (backup: Backup) => {
    setRestoreBackup(backup);
    setRestoreFiles(true);
    setRestoreOnlyFiles("");
    setDatabaseMode("all");
    setRestoreDatabases("");
    setEmailMode("none");
    setRestoreEmails("");
    setRestoreOpen(true);
  };

  const openDetails = async (backup: Backup) => {
    setDetailBackup(backup);
    setRestoreStatus(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [detailRes, restoreRes] = await Promise.allSettled([
        apiClient.get<{ backup?: Backup }>(`/hosting/backups/${subscriptionId}/backups/${backup.id}${storageQuery(backup)}`),
        apiClient.get<{ status?: BackupStatus | null }>(
          `/hosting/backups/${subscriptionId}/backups/${backup.id}/restore-status`,
        ),
      ]);
      if (detailRes.status === "fulfilled" && detailRes.value.backup) {
        setDetailBackup(detailRes.value.backup);
      }
      if (restoreRes.status === "fulfilled") {
        setRestoreStatus(restoreRes.value.status ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load backup details");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadDirectoryTree = async (backup: Backup, offset = treeOffset) => {
    setTreeLoading(true);
    try {
      const params = new URLSearchParams();
      if (offset.trim()) {
        params.set("offset", offset.trim());
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await apiClient.get<{ nodes?: DirectoryTreeNode[] }>(
        `/hosting/backups/${subscriptionId}/backups/${backup.id}/directory-tree${suffix}`,
      );
      setTreeNodes(data.nodes ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load directory tree");
    } finally {
      setTreeLoading(false);
    }
  };

  const openTree = async (backup: Backup) => {
    setTreeBackup(backup);
    setTreeOffset("");
    setTreeNodes([]);
    setTreeOpen(true);
    await loadDirectoryTree(backup, "");
  };

  const handleDownload = async () => {
    if (!subscriptionId) return;
    setDownloading(true);
    try {
      const { blob, filename } = await apiClient.getBlob(
        `/hosting/backups/${subscriptionId}/backup/download?backupDownloadKind=${downloadKind}`,
      );
      downloadBlob(blob, filename || `${downloadKind}-backup.tar.gz`);
      toast.success("Backup download started");
      setDownloadOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download backup");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!subscriptionId || !uploadFile) return;
    setUploading(true);
    try {
      await apiClient.postBinary(
        `/hosting/backups/${subscriptionId}/backup/upload`,
        await uploadFile.arrayBuffer(),
        uploadFile.type || "application/gzip",
      );
      toast.success("Backup archive uploaded for restore");
      setUploadOpen(false);
      setUploadFile(null);
      await loadData({ quiet: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload backup");
    } finally {
      setUploading(false);
    }
  };

  if (loading && backups.length === 0) {
    return (
      <section className="rounded-2xl cyber-card cyber-card--hover">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading backups...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl cyber-card cyber-card--hover">
        <div className="px-6 py-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <Archive className="h-5 w-5 text-primary" />
              <span>Backups</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage website backups, restores, archives, and backup storage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch checked={backupsEnabled} onCheckedChange={handleToggleBackups} disabled={togglingBackups} />
              <span className="text-xs text-muted-foreground">Website backups</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadData()} disabled={refreshing}>
              <RefreshCw className={cn("mr-1.5 h-3 w-3", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDownloadOpen(true)}>
              <Download className="mr-1.5 h-3 w-3" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1.5 h-3 w-3" />
              Upload
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!backupsEnabled} title={disabledReason}>
              <Plus className="mr-1 h-4 w-4" />
              Backup Now
</Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-6 py-5 sm:px-8">
        {!backupsEnabled && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Website backups are disabled in Enhance. Automatic and manual backup creation are blocked until this is enabled.
          </div>
        )}

        {backupStatus && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium capitalize">
                  {backupStatus.action ?? "Backup"} {statusLabels[backupStatus.displayStatus ?? "unknown"]}
                </p>
                <p className="text-xs text-muted-foreground">Started {formatDate(backupStatus.displayDate)}</p>
              </div>
              <Badge variant={statusVariant(backupStatus.displayStatus)}>
                {statusLabels[backupStatus.displayStatus ?? "unknown"]}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Files: {operationLabel(backupStatus.components?.files?.status ?? backupStatus.homeDirStatus)}</span>
              <span>Databases: {operationLabel(backupStatus.components?.databases?.status ?? backupStatus.mysqlDbsStatus)}</span>
              <span>Email: {operationLabel(backupStatus.components?.emails?.status ?? backupStatus.emailsStatus)}</span>
            </div>
          </div>
        )}

        {sortedBackups.length === 0 ? (
          <div className="py-8 text-center">
            <Archive className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No backups found.</p>
          </div>
        ) : (
          <ScrollArea className="w-full whitespace-nowrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBackups.map((backup) => {
                  const status = backup.displayStatus ?? "unknown";
                  return (
                    <TableRow key={backup.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        <div>{formatDate(backup.displayDate ?? backup.startedAt ?? backup.finishedAt)}</div>
                        {backup.finishedAt && (
                          <div className="text-xs text-muted-foreground">Finished {formatDate(backup.finishedAt)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(status)}>{statusLabels[status]}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{backup.kind ?? "-"}</TableCell>
                      <TableCell className="uppercase">{backup.storageKind ?? "-"}</TableCell>
                      <TableCell>{formatBytes(backupSize(backup))}</TableCell>
                      <TableCell className="min-w-48">
                        <ComponentSummary backup={backup} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => openDetails(backup)} title="View backup details">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTree(backup)}
                            disabled={backup.storageKind === "s3"}
                            title={backup.storageKind === "s3" ? "S3 backups do not expose a directory tree" : "Browse directory tree"}
                          >
                            <FolderOpen className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRestore(backup)}
                            disabled={!backup.canRestore || status === "running"}
                            title={!backup.canRestore ? "Only successful or partial backups can be restored" : "Restore backup"}
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span className="ml-1">Restore</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(backup)}
                            disabled={actionLoading === `delete-${backup.id}`}
                            title="Delete backup"
                          >
                            {actionLoading === `delete-${backup.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>Create a full website backup. Email backup is optional in Enhance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="backup-note">Description (optional)</Label>
              <Input
                id="backup-note"
                placeholder="Before upgrading WordPress"
                value={backupDescription}
                onChange={(event) => setBackupDescription(event.target.value)}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="backup-include-emails"
                checked={createIncludeEmails}
                onCheckedChange={(checked) => setCreateIncludeEmails(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="backup-include-emails">Include email data</Label>
                <p className="text-xs text-muted-foreground">Enhance skips email backups by default because they can be slow.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !backupsEnabled}>
              {creating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Create Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              Choose what Enhance should restore from this backup. This can overwrite current website data.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-5 py-2 pr-1">
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{restoreBackup?.description || restoreBackup?.snapshotDirName || restoreBackup?.id}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(restoreBackup?.displayDate ?? restoreBackup?.startedAt)} · {restoreBackup?.storageKind ?? "storage unknown"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox id="restore-files" checked={restoreFiles} onCheckedChange={(checked) => setRestoreFiles(Boolean(checked))} />
                <div className="space-y-1">
                  <Label htmlFor="restore-files">Restore website files</Label>
                  <p className="text-xs text-muted-foreground">Leave specific paths empty to restore the full home directory.</p>
                </div>
              </div>
              <Textarea
                aria-label="Specific files or directories"
                placeholder="Optional paths, one per line, such as public_html/wp-content"
                value={restoreOnlyFiles}
                onChange={(event) => setRestoreOnlyFiles(event.target.value)}
                disabled={!restoreFiles}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="database-mode">Databases</Label>
                <select
                  id="database-mode"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={databaseMode}
                  onChange={(event) => setDatabaseMode(event.target.value as DatabaseRestoreMode)}
                >
                  <option value="all">Restore all databases</option>
                  <option value="none">Do not restore databases</option>
                  <option value="specific">Restore specific databases</option>
                </select>
                {databaseMode === "specific" && (
                  <Textarea
                    aria-label="Specific databases"
                    placeholder="Database names, one per line"
                    value={restoreDatabases}
                    onChange={(event) => setRestoreDatabases(event.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-mode">Email</Label>
                <select
                  id="email-mode"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={emailMode}
                  onChange={(event) => setEmailMode(event.target.value as EmailRestoreMode)}
                >
                  <option value="none">Do not restore email</option>
                  <option value="all">Restore all mailboxes</option>
                  <option value="specific">Restore specific mailboxes</option>
                </select>
                {emailMode === "specific" && (
                  <Textarea
                    aria-label="Specific email mailboxes"
                    placeholder="Mailbox addresses, one per line"
                    value={restoreEmails}
                    onChange={(event) => setRestoreEmails(event.target.value)}
                  />
                )}
              </div>
            </div>
</div>
            </ScrollArea>
           <DialogFooter>
             <Button variant="outline" size="sm" onClick={() => setRestoreOpen(false)}>
               Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleRestore} disabled={restoring}>
              {restoring && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Backup Details</DialogTitle>
            <DialogDescription>Enhance backup metadata and latest restore status.</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p>{formatDate(detailBackup?.startedAt ?? detailBackup?.displayDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Finished</p>
                  <p>{formatDate(detailBackup?.finishedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Snapshot</p>
                  <p className="break-all">{detailBackup?.snapshotDirName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p>{detailBackup?.description ?? "-"}</p>
                </div>
              </div>
              {detailBackup && <ComponentSummary backup={detailBackup} />}
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Last restore</p>
                {restoreStatus ? (
                  <div className="space-y-1">
                    <Badge variant={statusVariant(restoreStatus.displayStatus)}>
                      {statusLabels[restoreStatus.displayStatus ?? "unknown"]}
                    </Badge>
                    <p className="text-xs text-muted-foreground">Started {formatDate(restoreStatus.displayDate)}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Files: {operationLabel(restoreStatus.components?.files?.status)}</span>
                      <span>Databases: {operationLabel(restoreStatus.components?.databases?.status)}</span>
                      <span>Email: {operationLabel(restoreStatus.components?.emails?.status)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No restore status available.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={treeOpen} onOpenChange={setTreeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Backup Directory Tree</DialogTitle>
            <DialogDescription>Browse files captured in the Enhance backup snapshot.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="Optional offset, such as public_html"
                value={treeOffset}
                onChange={(event) => setTreeOffset(event.target.value)}
              />
              <Button variant="outline" onClick={() => treeBackup && loadDirectoryTree(treeBackup)} disabled={treeLoading}>
                {treeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Browse"}
              </Button>
            </div>
            <div className="max-h-[55vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Modified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treeNodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {treeLoading ? "Loading..." : "No files found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    treeNodes.map((node) => (
                      <TableRow key={node.rel_path || node.name}>
                        <TableCell>
                          <div className="font-medium">{node.name}</div>
                          <div className="text-xs text-muted-foreground">{node.rel_path}</div>
                        </TableCell>
                        <TableCell>{node.node_type}</TableCell>
                        <TableCell>{formatBytes(node.size)}</TableCell>
                        <TableCell>{node.permissions}</TableCell>
                        <TableCell>{formatDate(node.last_modified)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download Backup Archive</DialogTitle>
            <DialogDescription>Download the current website or email backup archive from Enhance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="download-kind">Archive type</Label>
            <select
              id="download-kind"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={downloadKind}
              onChange={(event) => setDownloadKind(event.target.value as BackupDownloadKind)}
            >
              <option value="website">Website</option>
              <option value="email">Email</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDownloadOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Backup Archive</DialogTitle>
            <DialogDescription>Upload and restore a `.tar.gz` archive through Enhance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="backup-upload">Archive file</Label>
            <Input
              id="backup-upload"
              type="file"
              accept=".tar.gz,.tgz,application/gzip,application/x-gzip"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
