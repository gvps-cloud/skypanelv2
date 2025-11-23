import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Plus, RefreshCw, Server, Trash2, Wifi, AlertTriangle, Edit } from "lucide-react";

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

interface WorkerNode {
  id: string;
  name: string;
  hostIp: string;
  sshPort: number;
  sshUser: string;
  uncloudContext: string;
  status: "active" | "inactive" | "maintenance" | "error";
  cpuTotal?: number | null;
  memoryTotalGb?: number | null;
  diskTotalGb?: number | null;
  lastHealthCheck?: string | null;
  healthStatus?: "healthy" | "degraded" | "unhealthy" | null;
  createdAt: string;
  updatedAt: string;
}

interface SshKey {
  id: string;
  name: string;
  keyPath: string;
}

interface WorkerStats {
  total: number;
  active: number;
  inactive: number;
  maintenance: number;
  error: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
}

const AdminPaaSWorkersPage: React.FC = () => {
  const { token } = useAuth();

  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [stats, setStats] = useState<WorkerStats | null>(null);
  const [sshKeys, setSshKeys] = useState<SshKey[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationLogs, setCreationLogs] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newHostIp, setNewHostIp] = useState("");
  const [newSshPort, setNewSshPort] = useState("22");
  const [newSshUser, setNewSshUser] = useState("root");
  const [selectedKeyId, setSelectedKeyId] = useState<string>("custom");
  const [newSshKeyPath, setNewSshKeyPath] = useState("/root/.ssh/id_rsa");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsWorker, setDetailsWorker] = useState<WorkerNode | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<WorkerNode["status"]>("active");
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadSshKeys = useCallback(async () => {
    if (!hasToken) return;
    try {
      const res = await fetch(buildApiUrl("/api/admin/paas/ssh-keys"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.keys)) {
        setSshKeys(data.keys);
      }
    } catch (error) {
      console.error("Failed to load SSH keys", error);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadSshKeys();
  }, [loadSshKeys]);

  const loadWorkers = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const query =
        statusFilter && statusFilter !== "all"
          ? `?status=${encodeURIComponent(statusFilter)}`
          : "";
      const res = await fetch(buildApiUrl(`/api/admin/paas/workers${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load workers");
      }
      const items: WorkerNode[] = (payload.workers || []).map((w: any) => ({
        id: String(w.id),
        name: w.name,
        hostIp: w.hostIp || w.host_ip,
        sshPort: w.sshPort ?? w.ssh_port ?? 22,
        sshUser: w.sshUser || w.ssh_user,
        uncloudContext: w.uncloudContext || w.uncloud_context,
        status: w.status,
        cpuTotal: w.cpuTotal ?? w.cpu_total ?? null,
        memoryTotalGb: w.memoryTotalGb ?? w.memory_total_gb ?? null,
        diskTotalGb: w.diskTotalGb ?? w.disk_total_gb ?? null,
        lastHealthCheck: (w.lastHealthCheck || w.last_health_check) ?? null,
        healthStatus: (w.healthStatus || w.health_status) ?? null,
        createdAt: w.createdAt || w.created_at,
        updatedAt: w.updatedAt || w.updated_at,
      }));
      setWorkers(items);
    } catch (error: any) {
      console.error("Failed to load PaaS workers", error);
      toast.error(error?.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }, [hasToken, statusFilter, token]);

  const loadStats = useCallback(async () => {
    if (!hasToken) return;
    setStatsLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/paas/workers/stats"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load worker stats");
      }
      setStats(payload.stats || payload);
    } catch (error: any) {
      console.error("Failed to load worker stats", error);
      toast.error(error?.message || "Failed to load worker statistics");
    } finally {
      setStatsLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const resetCreateForm = () => {
    setNewName("");
    setNewHostIp("");
    setNewSshPort("22");
    setNewSshUser("root");
    setSelectedKeyId(sshKeys.length > 0 ? sshKeys[0].id : "custom");
    setNewSshKeyPath("/root/.ssh/id_rsa");
    setCreationLogs("");
  };

  // Update default selected key when keys are loaded
  useEffect(() => {
    if (sshKeys.length > 0 && selectedKeyId === "custom" && !newSshKeyPath) {
      setSelectedKeyId(sshKeys[0].id);
    }
  }, [sshKeys, selectedKeyId, newSshKeyPath]);

  const handleCreate = async () => {
    if (!hasToken) return;
    if (!newName.trim() || !newHostIp.trim() || !newSshUser.trim()) {
      toast.error("Name, host IP, and SSH user are required");
      return;
    }
    
    let finalKeyPath = newSshKeyPath;
    
    if (selectedKeyId !== "custom") {
      const key = sshKeys.find(k => k.id === selectedKeyId);
      if (key) {
        finalKeyPath = key.keyPath;
      } else {
        toast.error("Selected SSH key not found");
        return;
      }
    } else if (!newSshKeyPath.trim()) {
      toast.error("SSH key path is required");
      return;
    }

    const port = Number(newSshPort);
    if (!Number.isFinite(port) || port <= 0) {
      toast.error("Valid SSH port is required");
      return;
    }
    setCreating(true);
    setCreationLogs("🔄 Starting worker creation process...\n");
    
    // Show progress toast
    const progressToast = toast.loading("Adding worker to cluster...", {
      description: "Connecting to uncloud cluster and registering machine",
    });
    
    setCreationLogs(prev => prev + `📡 Sending request to add machine ${newName.trim()}...\n`);
    
    try {
      const body = {
        name: newName.trim(),
        hostIp: newHostIp.trim(),
        sshPort: port,
        sshUser: newSshUser.trim(),
        sshKeyPath: finalKeyPath.trim(),
      };
      const res = await fetch(buildApiUrl("/api/admin/paas/workers"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreationLogs(prev => prev + `❌ Error: ${payload.error || "Failed to create worker"}\n`);
        throw new Error(payload.error || "Failed to create worker");
      }
      
      // Show backend logs
      if (payload.logs) {
        setCreationLogs(prev => prev + payload.logs + "\n");
      }
      
      setCreationLogs(prev => prev + `\n🎉 Setup complete! ${newName.trim()} is now part of your cluster.\n`);
      
      toast.success("Worker created successfully", {
        id: progressToast,
        description: `${newName.trim()} is now part of your cluster`,
      });
      
      // Keep dialog open for 2 seconds to show final logs
      setTimeout(() => {
        setAddOpen(false);
        resetCreateForm();
      }, 2000);
      
      void loadWorkers();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to create PaaS worker", error);
      setCreationLogs(prev => prev + `\n❌ FAILED: ${error?.message || "Unknown error"}\n`);
      setCreationLogs(prev => prev + `Check backend console for detailed error logs.\n`);
      
      toast.error("Failed to create worker", {
        id: progressToast,
        description: error?.message || "Check server logs for details",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!hasToken) return;
    if (!window.confirm("Delete this worker node? This will remove its uncloud context.")) {
      return;
    }
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/workers/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete worker");
      }
      toast.success("Worker deleted");
      void loadWorkers();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to delete PaaS worker", error);
      toast.error(error?.message || "Failed to delete worker");
    }
  };

  const handleTest = async (id: string) => {
    if (!hasToken) return;
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/workers/${id}/test`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Connection test failed");
      }
      toast.success(payload.message || "Connection test successful");
      void loadWorkers();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to test worker connection", error);
      toast.error(error?.message || "Failed to test connection");
    }
  };

  const openDetails = (worker: WorkerNode) => {
    setDetailsWorker(worker);
    setEditName(worker.name);
    setEditStatus(worker.status);
    setDetailsOpen(true);
  };

  const handleSaveDetails = async () => {
    if (!hasToken || !detailsWorker) return;
    if (!editName.trim()) {
      toast.error("Worker name cannot be empty");
      return;
    }
    setSavingDetails(true);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/workers/${detailsWorker.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: editName.trim(),
          status: editStatus 
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update worker");
      }
      toast.success("Worker updated");
      setDetailsOpen(false);
      setDetailsWorker(null);
      void loadWorkers();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to update worker", error);
      toast.error(error?.message || "Failed to update worker");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (!hasToken || !detailsWorker) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to remove worker "${detailsWorker.name}"? This will remove the machine from the cluster and reset it.`
    );
    
    if (!confirmed) return;
    
    setDeleting(true);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/workers/${detailsWorker.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete worker");
      }
      toast.success(`Worker "${detailsWorker.name}" removed from cluster`);
      setDetailsOpen(false);
      setDetailsWorker(null);
      void loadWorkers();
      void loadStats();
    } catch (error: any) {
      console.error("Failed to delete worker", error);
      toast.error(error?.message || "Failed to delete worker");
    } finally {
      setDeleting(false);
    }
  };

  const renderStatusBadge = (status: WorkerNode["status"]) => {
    const label = status;
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-600 text-white">{label}</Badge>;
      case "inactive":
        return <Badge variant="outline">{label}</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-500 text-white">{label}</Badge>;
      case "error":
      default:
        return <Badge className="bg-destructive text-destructive-foreground">{label}</Badge>;
    }
  };

  const renderHealthBadge = (health?: WorkerNode["healthStatus"]) => {
    if (!health) return <Badge variant="outline">unknown</Badge>;
    switch (health) {
      case "healthy":
        return (
          <Badge className="bg-emerald-600 text-white flex items-center gap-1">
            <Wifi className="h-3 w-3" /> healthy
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-amber-500 text-white flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> degraded
          </Badge>
        );
      case "unhealthy":
      default:
        return (
          <Badge className="bg-destructive text-destructive-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> unhealthy
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Workers"
        description="Manage uncloud worker nodes that run PaaS applications."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
        actions={
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add worker
          </Button>
        }
      />

      <ContentCard
        title="Cluster health"
        description="Overview of worker states and health as reported by uncloud."
        headerAction={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={async () => {
              try {
                // First discover any missing workers from uncloud
                const discoverRes = await fetch(buildApiUrl('/api/admin/paas/workers/discover'), {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });
                const discoverData = await discoverRes.json().catch(() => ({}));
                
                if (discoverRes.ok && discoverData.registered > 0) {
                  toast.success(`Discovered ${discoverData.registered} new worker(s)`);
                }
                
                // Then reload the worker list
                void loadWorkers();
                void loadStats();
              } catch (error) {
                console.error('Error during refresh:', error);
                // Still reload even if discovery fails
                void loadWorkers();
                void loadStats();
              }
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
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8 text-sm">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total:</span> {stats.total}
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Active:</span> {stats.active}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted" />
              <span className="font-medium">Inactive:</span> {stats.inactive}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-medium">Maintenance:</span> {stats.maintenance}
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="font-medium">Error:</span> {stats.error}
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="font-medium">Healthy:</span> {stats.healthy}
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Degraded:</span> {stats.degraded}
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium">Unhealthy:</span> {stats.unhealthy}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No worker statistics available yet. Add a worker to initialize the cluster.
          </p>
        )}
      </ContentCard>

      <ContentCard
        title="Worker nodes"
        description="Each worker corresponds to a uncloud context that can run PaaS apps."
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
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {workers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No workers configured yet. Add at least one worker to enable PaaS deployments.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Last check</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-xs">
                    {w.hostIp}:{w.sshPort}
                    <div className="text-[11px] text-muted-foreground">
                      ctx: {w.uncloudContext}
                    </div>
                  </TableCell>
                  <TableCell>{renderStatusBadge(w.status)}</TableCell>
                  <TableCell>{renderHealthBadge(w.healthStatus)}</TableCell>
                  <TableCell className="text-xs">
                    {w.cpuTotal != null && (
                      <div>{w.cpuTotal} vCPU</div>
                    )}
                    {w.memoryTotalGb != null && (
                      <div>{w.memoryTotalGb.toFixed(1)} GB RAM</div>
                    )}
                    {w.diskTotalGb != null && (
                      <div>{w.diskTotalGb.toFixed(1)} GB disk</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {w.lastHealthCheck
                      ? new Date(w.lastHealthCheck).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDetails(w)}
                        title="View details"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTest(w.id)}
                        title="Test connection"
                      >
                        <Wifi className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(w.id)}
                        title="Delete worker"
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

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsWorker(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Worker details</DialogTitle>
          </DialogHeader>
          {detailsWorker && (
            <div className="space-y-3 py-2 text-sm">
              <div className="space-y-1">
                <Label htmlFor="worker-name-edit">Worker Name</Label>
                <Input
                  id="worker-name-edit"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="worker-1"
                  className="h-9"
                />
                <div className="text-xs text-muted-foreground">
                  {detailsWorker.hostIp}:{detailsWorker.sshPort} · ctx: {detailsWorker.uncloudContext}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="worker-status">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(val) =>
                    setEditStatus(val as WorkerNode["status"])
                  }
                >
                  <SelectTrigger id="worker-status" className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>
                  CPU: {detailsWorker.cpuTotal != null ? `${detailsWorker.cpuTotal} vCPU` : "—"}
                </div>
                <div>
                  Memory: {detailsWorker.memoryTotalGb != null
                    ? `${detailsWorker.memoryTotalGb.toFixed(1)} GB`
                    : "—"}
                </div>
                <div>
                  Disk: {detailsWorker.diskTotalGb != null
                    ? `${detailsWorker.diskTotalGb.toFixed(1)} GB`
                    : "—"}
                </div>
                <div>
                  Last health check: {detailsWorker.lastHealthCheck
                    ? new Date(detailsWorker.lastHealthCheck).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteWorker}
              disabled={deleting || savingDetails || !detailsWorker}
            >
              {deleting ? "Removing…" : "Remove from Cluster"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDetailsOpen(false);
                  setDetailsWorker(null);
                }}
                disabled={savingDetails || deleting}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handleSaveDetails}
                disabled={savingDetails || deleting || !detailsWorker}
              >
                {savingDetails ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add PaaS worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="worker-name">Name</Label>
              <Input
                id="worker-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="worker-1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="worker-host">Host IP or hostname</Label>
              <Input
                id="worker-host"
                value={newHostIp}
                onChange={(e) => setNewHostIp(e.target.value)}
                placeholder="203.0.113.10"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="worker-ssh-port">SSH port</Label>
                <Input
                  id="worker-ssh-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={newSshPort}
                  onChange={(e) => setNewSshPort(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="worker-ssh-user">SSH user</Label>
                <Input
                  id="worker-ssh-user"
                  value={newSshUser}
                  onChange={(e) => setNewSshUser(e.target.value)}
                  placeholder="root"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="worker-ssh-key-select">SSH Key</Label>
                {sshKeys.length > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      if (selectedKeyId === "custom") {
                        setSelectedKeyId(sshKeys[0].id);
                      } else {
                        setSelectedKeyId("custom");
                      }
                    }}
                  >
                    {selectedKeyId === "custom" ? "Select managed key" : "Use custom path"}
                  </Button>
                )}
              </div>

              {sshKeys.length > 0 && selectedKeyId !== "custom" ? (
                <div className="space-y-1">
                  <Select
                    value={selectedKeyId}
                    onValueChange={setSelectedKeyId}
                  >
                    <SelectTrigger id="worker-ssh-key-select">
                      <SelectValue placeholder="Select SSH key" />
                    </SelectTrigger>
                    <SelectContent>
                      {sshKeys.map((key) => (
                        <SelectItem key={key.id} value={key.id}>
                          {key.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Using key at: <code className="bg-muted px-1 rounded">{sshKeys.find(k => k.id === selectedKeyId)?.keyPath}</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    id="worker-ssh-key"
                    value={newSshKeyPath}
                    onChange={(e) => setNewSshKeyPath(e.target.value)}
                    placeholder="/root/.ssh/id_rsa"
                  />
                  <div className="flex justify-between items-start">
                    <p className="text-xs text-muted-foreground">
                      Absolute path to the private SSH key on the panel host.
                    </p>
                    {sshKeys.length === 0 && (
                      <a 
                        href="/admin/paas/ssh-keys" 
                        className="text-xs text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Generate managed key ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {(creating || creationLogs) && (
              <div className="space-y-2 mt-4">
                <Label>Installation Logs</Label>
                <textarea
                  readOnly
                  value={creationLogs}
                  className="w-full h-48 p-3 bg-black text-green-400 font-mono text-xs rounded border border-border overflow-y-auto resize-none"
                  style={{ fontFamily: 'monospace' }}
                />
                <p className="text-xs text-muted-foreground">
                  Real-time output from the worker setup process
                </p>
              </div>
            )}
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
    </div>
  );
};

export default AdminPaaSWorkersPage;
