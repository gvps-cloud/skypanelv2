import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Server,
  Zap,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
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

interface NodeApp {
  id: string;
  name: string;
  runtime: string;
  status: string;
  createdAt?: string;
}

interface PersistentApp {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface NodeTabProps {
  subscriptionId: string;
}

export default function NodeTab({ subscriptionId }: NodeTabProps) {
  const [apps, setApps] = useState<NodeApp[]>([]);
  const [persistentApps, setPersistentApps] = useState<PersistentApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppRuntime, setNewAppRuntime] = useState("");
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const [appsRes, persistentRes] = await Promise.all([
        apiClient.get<{ apps?: NodeApp[] }>(`/hosting/node/${subscriptionId}/apps`),
        apiClient.get<{ apps?: PersistentApp[] }>(`/hosting/node/${subscriptionId}/persistent-apps`),
      ]);
      setApps(appsRes.apps ?? []);
      setPersistentApps(persistentRes.apps ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Node apps";
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
    if (!newAppName.trim() || !newAppRuntime.trim()) {
      toast.error("Name and runtime are required");
      return;
    }
    setCreating(true);
    try {
      await apiClient.post(`/hosting/node/${subscriptionId}/apps`, {
        name: newAppName.trim(),
        runtime: newAppRuntime.trim(),
      });
      toast.success("App created");
      setNewAppName("");
      setNewAppRuntime("");
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create app");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (appId: string, appName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Are you sure you want to delete app "${appName}"?`)) return;
    setActionLoading(appId);
    try {
      await apiClient.delete(`/hosting/node/${subscriptionId}/apps/${appId}`);
      toast.success(`App "${appName}" deleted`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && apps.length === 0 && persistentApps.length === 0) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading Node apps...</span>
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
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
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
                <Server className="h-5 w-5 text-primary" />
                <span>Node Apps</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Manage Node.js applications for this subscription.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New App
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Node App</DialogTitle>
                    <DialogDescription>
                      Add a new Node.js application.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="app-name">App Name</Label>
                      <Input
                        id="app-name"
                        value={newAppName}
                        onChange={(e) => setNewAppName(e.target.value)}
                        placeholder="my-app"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="app-runtime">Runtime</Label>
                      <Select value={newAppRuntime} onValueChange={setNewAppRuntime}>
                        <SelectTrigger id="app-runtime">
                          <SelectValue placeholder="Select runtime" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="node18">Node.js 18</SelectItem>
                          <SelectItem value="node20">Node.js 20</SelectItem>
                          <SelectItem value="node22">Node.js 22</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5">
          {apps.length === 0 ? (
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No Node apps found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Runtime</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>{app.runtime}</TableCell>
                    <TableCell>
                      <Badge variant={app.status === "running" ? "default" : "secondary"}>
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(app.id, app.name)}
                        disabled={actionLoading === app.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {actionLoading === app.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        <span className="ml-1">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Persistent Apps */}
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Zap className="h-5 w-5 text-primary" />
                <span>Persistent Apps</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Always-on services for this subscription.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5">
          {persistentApps.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No persistent apps found.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {persistentApps.map((app) => (
                <Card key={app.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{app.name}</CardTitle>
                      <Badge variant={app.status === "active" ? "default" : "secondary"}>
                        {app.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{app.type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
