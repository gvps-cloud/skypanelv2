import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Server,
  Zap,
  FileText,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PersistentApp {
  id: string;
  name?: string;
  command: string;
  startMode: "automatic" | "manual";
  workingDirectory?: string;
  nodeVersion?: string;
  proxyDetails?: { path: string; port: number };
  status?: string;
}

interface RuntimeTabProps {
  subscriptionId: string;
}

export default function RuntimeTab({ subscriptionId }: RuntimeTabProps) {
  const [apps, setApps] = useState<PersistentApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [startMode, setStartMode] = useState<"automatic" | "manual">("automatic");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [proxyPath, setProxyPath] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [creating, setCreating] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logAppName, setLogAppName] = useState("");
  const [logContent, setLogContent] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ items?: PersistentApp[] }>(`/hosting/node/${subscriptionId}/persistent-apps`);
      setApps(data.items ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load runtime apps";
      setError(message);
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
    if (!command.trim()) { toast.error("Command is required"); return; }
    setCreating(true);
    try {
      const body: Record<string, any> = {
        command: command.trim(),
        startMode,
      };
      if (workingDirectory.trim()) body.workingDirectory = workingDirectory.trim();
      if (proxyPath.trim() && proxyPort.trim()) {
        body.proxyDetails = { path: proxyPath.trim(), port: Number(proxyPort) };
      }
      await apiClient.post(`/hosting/node/${subscriptionId}/persistent-apps`, body);
      toast.success("Persistent app created");
      setDialogOpen(false);
      setCommand("");
      setStartMode("automatic");
      setWorkingDirectory("");
      setProxyPath("");
      setProxyPort("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create app");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (appId: string, appName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete persistent app "${appName || appId}"?`)) return;
    setActionLoading(appId);
    try {
      await apiClient.delete(`/hosting/node/${subscriptionId}/persistent-apps/${appId}`);
      toast.success("Persistent app deleted");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLog = async (appId: string, appName: string) => {
    if (!subscriptionId) return;
    setLogAppName(appName || appId);
    setLogOpen(true);
    setLogLoading(true);
    setLogContent("");
    try {
      const data = await apiClient.get<string>(`/hosting/node/${subscriptionId}/persistent-apps/${appId}/log`);
      setLogContent(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    } catch (err) {
      setLogContent(err instanceof Error ? err.message : "Failed to load log");
    } finally {
      setLogLoading(false);
    }
  };

  if (loading) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading runtime apps...</span>
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
    <div className="space-y-6">
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Zap className="h-5 w-5 text-primary" />
                <span>Persistent Apps</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Background processes and runtime services.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />New App
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-5">
          {apps.length === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No persistent apps configured.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>Start Mode</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate">{app.command}</TableCell>
                    <TableCell>
                      <Badge variant={app.startMode === "automatic" ? "default" : "secondary"}>{app.startMode}</Badge>
                    </TableCell>
                    <TableCell>
                      {app.proxyDetails ? `${app.proxyDetails.path}:${app.proxyDetails.port}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewLog(app.id, app.command)} title="View log">
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(app.id, app.command)}
                          disabled={actionLoading === app.id}
                          className="text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          {actionLoading === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Persistent App</DialogTitle>
            <DialogDescription>Add a background process that runs continuously.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Command</Label>
              <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="node server.js" />
            </div>
            <div className="space-y-2">
              <Label>Start Mode</Label>
              <Select value={startMode} onValueChange={(v) => setStartMode(v as "automatic" | "manual")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Working Directory (optional)</Label>
              <Input value={workingDirectory} onChange={(e) => setWorkingDirectory(e.target.value)} placeholder="/app" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Proxy Path</Label>
                <Input value={proxyPath} onChange={(e) => setProxyPath(e.target.value)} placeholder="/api" />
              </div>
              <div className="space-y-2">
                <Label>Proxy Port</Label>
                <Input value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} placeholder="3000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !command.trim()}>
              {creating && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log: {logAppName}</DialogTitle>
            <DialogDescription>Application output log.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto rounded-md bg-muted p-4">
            {logLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading log...</span>
              </div>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{logContent || "No log output available."}</pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
