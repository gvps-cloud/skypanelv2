import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Puzzle,
  Globe,
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

interface InstallableApp {
  app: string;
  version: string;
  isLatest: boolean;
  description?: string;
  size?: number;
  createdAt?: string;
}

interface InstalledApp {
  id: string;
  app: string;
  version: string;
  path?: string;
}

interface Domain {
  id: string;
  domain: string;
}

interface AppsTabProps {
  subscriptionId: string;
}

export default function AppsTab({ subscriptionId }: AppsTabProps) {
  const [installable, setInstallable] = useState<InstallableApp[]>([]);
  const [installed, setInstalled] = useState<InstalledApp[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [selectedAppKey, setSelectedAppKey] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [installPath, setInstallPath] = useState("");
  const [domainId, setDomainId] = useState("");
  const [installing, setInstalling] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const [instRes, installedRes, domainRes] = await Promise.all([
        apiClient.get<{ apps?: InstallableApp[] }>(`/hosting/apps/${subscriptionId}/installable`),
        apiClient.get<{ apps?: InstalledApp[] }>(`/hosting/apps/${subscriptionId}/apps`),
        apiClient.get<{ domains?: Domain[] }>(`/hosting/dns/${subscriptionId}/domains`),
      ]);
      setInstallable(instRes.apps ?? []);
      setInstalled(installedRes.apps ?? []);
      const mappedDomains = domainRes.domains ?? [];
      setDomains(mappedDomains);
      setDomainId((prev) => prev || mappedDomains[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInstall = async () => {
    const selectedApp = installable.find((app) => `${app.app}:${app.version}` === selectedAppKey);
    if (!subscriptionId || !selectedApp || !adminUsername || !adminPassword || !adminEmail) {
      toast.error("All fields are required");
      return;
    }
    setInstalling(true);
    try {
      await apiClient.post(`/hosting/apps/${subscriptionId}/apps`, {
        app: selectedApp.app,
        version: selectedApp.version,
        adminUsername: adminUsername.trim(),
        adminPassword: adminPassword.trim(),
        adminEmail: adminEmail.trim(),
        path: installPath.trim() || undefined,
        domainId: domainId || undefined,
      });
      toast.success(`${selectedApp.app} ${selectedApp.version} installed successfully`);
      setInstallOpen(false);
      setSelectedAppKey("");
      setAdminUsername("");
      setAdminPassword("");
      setAdminEmail("");
      setInstallPath("");
      setDomainId(domains[0]?.id ?? "");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to install app");
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = async (appId: string, appName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete ${appName} installation? This will remove all data.`)) return;
    const backupBeforeOperation = confirm("Create an Enhance backup before deleting this app?");
    setActionLoading(appId);
    try {
      await apiClient.delete(`/hosting/apps/${subscriptionId}/apps/${appId}?backupBeforeOperation=${backupBeforeOperation ? "true" : "false"}`);
      toast.success(`${appName} deleted`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading apps...</span>
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
      {/* Installed Apps */}
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Globe className="h-5 w-5 text-primary" />
                <span>Installed Applications</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage your installed CMS apps.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
              </Button>
              <Button size="sm" onClick={() => setInstallOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Install App
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-5">
          {installed.length === 0 ? (
            <div className="text-center py-8">
              <Puzzle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No applications installed.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installed.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium capitalize">{app.app}</TableCell>
                    <TableCell>{app.version}</TableCell>
                    <TableCell>{app.path || "root"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(app.id, app.app)}
                        disabled={actionLoading === app.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {actionLoading === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
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

      {/* Available Apps */}
      {installable.length > 0 && (
        <section className={cn("rounded-2xl border bg-card shadow-sm")}>
          <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Puzzle className="h-5 w-5 text-primary" />
              <span>Available Apps</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Apps available for installation on this subscription.</p>
          </div>
          <div className="px-6 sm:px-8 py-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {installable.map((app) => (
                <div key={`${app.app}-${app.version}`} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium capitalize">{app.app}</h3>
                    {app.isLatest && <Badge variant="outline">Latest</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Version {app.version}</p>
                  {app.description && <p className="text-xs text-muted-foreground">{app.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Install Dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Application</DialogTitle>
            <DialogDescription>Install WordPress or Joomla on this website.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Application</Label>
              <Select value={selectedAppKey} onValueChange={setSelectedAppKey}>
                <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
                <SelectContent>
                  {installable.map((app) => (
                    <SelectItem key={`${app.app}-${app.version}`} value={`${app.app}:${app.version}`}>
                      {app.app} {app.version}{app.isLatest ? " (latest)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select value={domainId} onValueChange={setDomainId}>
                <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                <SelectContent>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>{domain.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Admin Username</Label>
              <Input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-2">
              <Label>Admin Password</Label>
              <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Admin Email</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Install Path (optional)</Label>
              <Input value={installPath} onChange={(e) => setInstallPath(e.target.value)} placeholder="Leave empty for root" />
              <p className="text-xs text-muted-foreground">e.g. &quot;blog&quot; for /blog/</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInstallOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleInstall} disabled={installing || !selectedAppKey || !adminUsername || !adminPassword || !adminEmail}>
              {installing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
