import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Globe2,
  Plus,
  Trash2,
  Terminal as TerminalIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PaaSApplicationDetail {
  id: string;
  name: string;
  status: string;
  deploymentStrategy: "buildpack" | "dockerfile" | "image";
  repositoryUrl?: string;
  repositoryBranch?: string;
  appPort?: number;
  targetWorkerNodeId?: string;
  createdAt?: string;
}

interface EnvVarSummary {
  id: string;
  key: string;
  is_encrypted?: boolean;
  created_at?: string;
}

interface PortRecord {
  id: number;
  container_port: number;
  protocol: string;
  custom_domain?: string | null;
  is_primary?: boolean;
  is_internal_only?: boolean;
  host_port?: number | null;
  host_ip?: string | null;
  target_machine?: string | null;
  enable_ssl?: boolean;
}

interface DeploymentRecord {
  id: string;
  version: string;
  status: string;
  git_branch?: string;
  git_commit_sha?: string;
  created_at?: string;
  completed_at?: string | null;
}

interface AppStats {
  cpu?: string;
  memory?: string;
  uptime?: string;
  instances?: number;
}

const PaaSApplicationDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [app, setApp] = useState<PaaSApplicationDetail | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [envVars, setEnvVars] = useState<EnvVarSummary[]>([]);
  const [ports, setPorts] = useState<PortRecord[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [logs, setLogs] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deployBranch, setDeployBranch] = useState("");
  const [deploying, setDeploying] = useState(false);

  const [addEnvOpen, setAddEnvOpen] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [newEnvSecret, setNewEnvSecret] = useState(true);
  const [savingEnv, setSavingEnv] = useState(false);

  const [addPortOpen, setAddPortOpen] = useState(false);
  const [newPortContainer, setNewPortContainer] = useState("8080");
  const [newPortProtocol, setNewPortProtocol] = useState("https");
  const [savingPort, setSavingPort] = useState(false);

  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newDomainPort, setNewDomainPort] = useState<string>("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasToken = useMemo(() => Boolean(token), [token]);
  const appId = id ?? "";

  const renderStatusBadge = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    let variant: "default" | "secondary" | "outline" | "destructive" =
      "secondary";
    const label = status || "unknown";

    if (normalized === "running") {
      variant = "default";
    } else if (normalized === "deploying" || normalized === "building") {
      variant = "outline";
    } else if (normalized === "failed") {
      variant = "destructive";
    }

    return <Badge variant={variant}>{label}</Badge>;
  };

  const primaryDomains = useMemo(
    () => ports.filter((p) => p.custom_domain).map((p) => p.custom_domain as string),
    [ports]
  );

  const loadApp = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(buildApiUrl(`/api/client/paas/applications/${appId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load application");
      }
      const a = payload.application || payload.app || payload;
      const detail: PaaSApplicationDetail = {
        id: String(a.id),
        name: a.name,
        status: a.status || "pending",
        deploymentStrategy: a.deploymentStrategy || a.deployment_strategy,
        repositoryUrl: a.repositoryUrl || a.repository_url,
        repositoryBranch: a.repositoryBranch || a.repository_branch,
        appPort: a.appPort ?? a.app_port ?? undefined,
        targetWorkerNodeId: a.targetWorkerNodeId || a.target_worker_node_id,
        createdAt: a.createdAt || a.created_at,
      };
      setApp(detail);
    } catch (error: any) {
      console.error("Failed to load PaaS application", error);
      toast.error(error?.message || "Failed to load application");
    }
  }, [hasToken, appId, token]);

  const loadStats = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/stats`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setStats(payload.stats || payload);
    } catch (error) {
      console.warn("Failed to load PaaS app stats", error);
    }
  }, [hasToken, appId, token]);

  const loadEnv = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/env`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load env vars");
      }
      const items: EnvVarSummary[] = (payload.envVars || []).map((row: any) => ({
        id: String(row.id),
        key: row.key,
        is_encrypted: row.is_encrypted,
        created_at: row.created_at,
      }));
      setEnvVars(items);
    } catch (error: any) {
      console.error("Failed to load env vars", error);
      toast.error(error?.message || "Failed to load environment variables");
    }
  }, [hasToken, appId, token]);

  const loadPorts = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/ports`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load ports");
      }
      setPorts(payload.ports || []);
    } catch (error: any) {
      console.error("Failed to load ports", error);
      toast.error(error?.message || "Failed to load ports");
    }
  }, [hasToken, appId, token]);

  const loadDeployments = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/deployments`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load deployments");
      }
      const items: DeploymentRecord[] = (payload.deployments || []).map(
        (d: any) => ({
          id: String(d.id),
          version: d.version,
          status: d.status,
          git_branch: d.git_branch,
          git_commit_sha: d.git_commit_sha,
          created_at: d.created_at,
          completed_at: d.completed_at,
        })
      );
      setDeployments(items);
    } catch (error: any) {
      console.error("Failed to load deployments", error);
      toast.error(error?.message || "Failed to load deployments");
    }
  }, [hasToken, appId, token]);

  const loadLogs = useCallback(async () => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/logs?lines=300`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load logs");
      }
      setLogs(payload.logs || "");
    } catch (error: any) {
      console.error("Failed to load logs", error);
      toast.error(error?.message || "Failed to load logs");
    }
  }, [hasToken, appId, token]);

  const loadAll = useCallback(async () => {
    if (!hasToken || !appId) return;
    setLoading(true);
    try {
      await Promise.all([
        loadApp(),
        loadStats(),
        loadEnv(),
        loadPorts(),
        loadDeployments(),
        loadLogs(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [hasToken, appId, loadApp, loadStats, loadEnv, loadPorts, loadDeployments, loadLogs]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    if (!hasToken || !appId) return;
    setRefreshing(true);
    try {
      await loadAll();
      toast.success("Application refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!hasToken || !appId) return;
    if (!window.confirm("Delete this application and its deployments? This cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete application");
      }
      toast.success("Application deleted");
      navigate("/paas/apps");
    } catch (error: any) {
      console.error("Failed to delete application", error);
      toast.error(error?.message || "Failed to delete application");
    } finally {
      setDeleting(false);
    }
  };

  const callLifecycleEndpoint = async (action: "start" | "stop" | "restart") => {
    if (!hasToken || !appId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/${action}`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Failed to ${action} application`);
      }
      toast.success(`Application ${action}ed`);
      await Promise.all([loadApp(), loadStats()]);
    } catch (error: any) {
      console.error(`Failed to ${action} application`, error);
      toast.error(error?.message || `Failed to ${action} application`);
    }
  };

  const handleDeploy = async () => {
    if (!hasToken || !appId) return;
    setDeploying(true);
    try {
      const body: any = {};
      if (deployBranch.trim()) {
        body.gitBranch = deployBranch.trim();
      }
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/deploy`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to trigger deployment");
      }
      toast.success("Deployment started");
      setDeployDialogOpen(false);
      setDeployBranch("");
      await loadDeployments();
    } catch (error: any) {
      console.error("Failed to trigger deployment", error);
      toast.error(error?.message || "Failed to trigger deployment");
    } finally {
      setDeploying(false);
    }
  };

  const handleAddEnv = async () => {
    if (!hasToken || !appId) return;
    if (!newEnvKey.trim()) {
      toast.error("Environment key is required");
      return;
    }
    setSavingEnv(true);
    try {
      const body = {
        key: newEnvKey.trim(),
        value: newEnvValue,
        isEncrypted: newEnvSecret,
      };
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/env`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to add env var");
      }
      toast.success("Environment variable added");
      setAddEnvOpen(false);
      setNewEnvKey("");
      setNewEnvValue("");
      setNewEnvSecret(true);
      await loadEnv();
    } catch (error: any) {
      console.error("Failed to add env var", error);
      toast.error(error?.message || "Failed to add environment variable");
    } finally {
      setSavingEnv(false);
    }
  };

  const handleDeleteEnv = async (envId: string) => {
    if (!hasToken || !appId) return;
    if (!window.confirm("Delete this environment variable?")) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/env/${envId}`),
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete env var");
      }
      toast.success("Environment variable deleted");
      await loadEnv();
    } catch (error: any) {
      console.error("Failed to delete env var", error);
      toast.error(error?.message || "Failed to delete environment variable");
    }
  };

  const handleAddPort = async () => {
    if (!hasToken || !appId) return;
    const port = Number(newPortContainer);
    if (!Number.isFinite(port) || port <= 0) {
      toast.error("Valid container port is required");
      return;
    }
    setSavingPort(true);
    try {
      const body = {
        containerPort: port,
        protocol: newPortProtocol || "https",
      };
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/ports`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to add port");
      }
      toast.success("Port added");
      setAddPortOpen(false);
      setNewPortContainer("8080");
      setNewPortProtocol("https");
      await loadPorts();
    } catch (error: any) {
      console.error("Failed to add port", error);
      toast.error(error?.message || "Failed to add port");
    } finally {
      setSavingPort(false);
    }
  };

  const handleDeletePort = async (portId: number) => {
    if (!hasToken || !appId) return;
    if (!window.confirm("Delete this port mapping?")) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/ports/${portId}`),
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete port");
      }
      toast.success("Port deleted");
      await loadPorts();
    } catch (error: any) {
      console.error("Failed to delete port", error);
      toast.error(error?.message || "Failed to delete port");
    }
  };

  const handleAddDomain = async () => {
    if (!hasToken || !appId) return;
    if (!newDomain.trim()) {
      toast.error("Domain is required");
      return;
    }
    const port = newDomainPort ? Number(newDomainPort) : app?.appPort ?? undefined;
    if (!port || !Number.isFinite(port)) {
      toast.error("Valid port is required for the domain");
      return;
    }
    setSavingDomain(true);
    try {
      const body: any = {
        domain: newDomain.trim(),
        containerPort: port,
      };
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/domains`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to add domain");
      }
      toast.success("Domain added and configuration redeployed");
      setAddDomainOpen(false);
      setNewDomain("");
      setNewDomainPort("");
      await loadPorts();
    } catch (error: any) {
      console.error("Failed to add domain", error);
      toast.error(error?.message || "Failed to add domain");
    } finally {
      setSavingDomain(false);
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!hasToken || !appId) return;
    if (!window.confirm("Remove this custom domain and redeploy configuration?")) return;
    try {
      const encoded = encodeURIComponent(domain);
      const res = await fetch(
        buildApiUrl(`/api/client/paas/applications/${appId}/domains/${encoded}`),
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete domain");
      }
      toast.success("Domain removed and configuration redeployed");
      await loadPorts();
    } catch (error: any) {
      console.error("Failed to delete domain", error);
      toast.error(error?.message || "Failed to delete domain");
    }
  };

  if (!appId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Application not found" />
      </div>
    );
  }

  const isLoadingInitial = loading && !app;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/paas/apps" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </Link>
      </div>

      <PageHeader
        title={app?.name || "PaaS Application"}
        description={
          primaryDomains.length > 0
            ? `Primary domains: ${primaryDomains.join(", ")}`
            : app?.appPort
            ? `Listening on port ${app.appPort}`
            : undefined
        }
        badge={{ text: "PaaS", variant: "secondary" }}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={handleRefresh}
              disabled={refreshing || isLoadingInitial}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing || isLoadingInitial ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setDeployDialogOpen(true)}
              disabled={isLoadingInitial}
            >
              <RotateCcw className="h-4 w-4" />
              Deploy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => callLifecycleEndpoint("start")}
              disabled={isLoadingInitial}
            >
              <Play className="h-4 w-4" />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => callLifecycleEndpoint("stop")}
              disabled={isLoadingInitial}
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => callLifecycleEndpoint("restart")}
              disabled={isLoadingInitial}
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-destructive/60 text-destructive hover:text-destructive"
              onClick={handleDeleteApplication}
              disabled={isLoadingInitial || deleting}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="ports">Ports</TabsTrigger>
          <TabsTrigger value="domains">Custom domains</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContentCard title="Application overview" description="Status and basic configuration.">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Status</div>
                <div>{app && renderStatusBadge(app.status)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Deployment strategy</div>
                <div className="text-sm capitalize">{app?.deploymentStrategy}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Port</div>
                <div className="text-sm">{app?.appPort ?? "—"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Worker node</div>
                <div className="text-sm">{app?.targetWorkerNodeId ?? "—"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Repository</div>
                <div className="text-sm break-all">
                  {app?.repositoryUrl ? (
                    <a
                      href={app.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {app.repositoryUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Created</div>
                <div className="text-sm">
                  {app?.createdAt
                    ? new Date(app.createdAt).toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>

            {stats && (
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">CPU</div>
                  <div className="text-sm">{stats.cpu ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Memory</div>
                  <div className="text-sm">{stats.memory ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Uptime</div>
                  <div className="text-sm">{stats.uptime ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Instances</div>
                  <div className="text-sm">{stats.instances ?? 0}</div>
                </div>
              </div>
            )}
          </ContentCard>
        </TabsContent>

        <TabsContent value="env">
          <ContentCard
            title="Environment variables"
            description="Securely manage build and runtime environment variables."
            headerAction={
              <Button size="sm" className="gap-2" onClick={() => setAddEnvOpen(true)}>
                <Plus className="h-4 w-4" />
                Add variable
              </Button>
            }
          >
            {envVars.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No environment variables configured.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envVars.map((env) => (
                    <TableRow key={env.id}>
                      <TableCell className="font-mono text-xs">{env.key}</TableCell>
                      <TableCell>{env.is_encrypted ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-xs">
                        {env.created_at
                          ? new Date(env.created_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteEnv(env.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ContentCard>
        </TabsContent>

        <TabsContent value="ports">
          <ContentCard
            title="Ports"
            description="Manage container ports and host bindings for this application."
            headerAction={
              <Button size="sm" className="gap-2" onClick={() => setAddPortOpen(true)}>
                <Plus className="h-4 w-4" />
                Add port
              </Button>
            }
          >
            {ports.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No ports configured. The application may still use its default app port.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container port</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Host binding</TableHead>
                    <TableHead>Internal only</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ports.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.container_port}</TableCell>
                      <TableCell>{p.protocol}</TableCell>
                      <TableCell>
                        {p.host_port
                          ? `${p.host_ip || "0.0.0.0"}:${p.host_port}`
                          : "Ingress"}
                      </TableCell>
                      <TableCell>{p.is_internal_only ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeletePort(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ContentCard>
        </TabsContent>

        <TabsContent value="domains">
          <ContentCard
            title="Custom domains"
            description="Attach custom domains using x-ports and automatic Caddy ingress."
            headerAction={
              <Button size="sm" className="gap-2" onClick={() => setAddDomainOpen(true)}>
                <Globe2 className="h-4 w-4" />
                Add domain
              </Button>
            }
          >
            {primaryDomains.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No custom domains configured.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {primaryDomains.map((domain) => (
                  <li key={domain} className="flex items-center justify-between gap-2">
                    <span>{domain}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>CNAME to your cluster entrypoint</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteDomain(domain)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ContentCard>
        </TabsContent>

        <TabsContent value="logs">
          <ContentCard
            title="Application logs"
            description="Recent logs from the underlying uncloud service."
            headerAction={
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => void loadLogs()}
              >
                <TerminalIcon className="h-4 w-4" />
                Refresh logs
              </Button>
            }
          >
            <Textarea
              readOnly
              value={logs}
              className="min-h-[260px] font-mono text-xs"
            />
          </ContentCard>
        </TabsContent>

        <TabsContent value="deployments">
          <ContentCard
            title="Deployments"
            description="Deployment history for this application."
          >
            {deployments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No deployments recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.version}</TableCell>
                      <TableCell>{d.status}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.git_branch || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.created_at
                          ? new Date(d.created_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.completed_at
                          ? new Date(d.completed_at).toLocaleString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ContentCard>
        </TabsContent>
      </Tabs>

      <Dialog
        open={deployDialogOpen}
        onOpenChange={(open) => {
          setDeployDialogOpen(open);
          if (!open) setDeployBranch("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trigger deployment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="deploy-branch">Git branch (optional)</Label>
            <Input
              id="deploy-branch"
              value={deployBranch}
              onChange={(e) => setDeployBranch(e.target.value)}
              placeholder={app?.repositoryBranch || "main"}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeployDialogOpen(false);
                setDeployBranch("");
              }}
              disabled={deploying}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDeploy} disabled={deploying}>
              {deploying ? "Starting…" : "Start deployment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addEnvOpen}
        onOpenChange={(open) => {
          setAddEnvOpen(open);
          if (!open) {
            setNewEnvKey("");
            setNewEnvValue("");
            setNewEnvSecret(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add environment variable</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="env-key">Key</Label>
              <Input
                id="env-key"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="DATABASE_URL"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="env-value">Value</Label>
              <Textarea
                id="env-value"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              Values are stored encrypted at rest. Marking as "secret" only affects how the
              value is displayed in the UI.
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddEnvOpen(false)}
              disabled={savingEnv}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddEnv} disabled={savingEnv}>
              {savingEnv ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addPortOpen}
        onOpenChange={(open) => {
          setAddPortOpen(open);
          if (!open) {
            setNewPortContainer("8080");
            setNewPortProtocol("https");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add port</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="port-container">Container port</Label>
              <Input
                id="port-container"
                type="number"
                min={1}
                max={65535}
                value={newPortContainer}
                onChange={(e) => setNewPortContainer(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="port-protocol">Protocol</Label>
              <Input
                id="port-protocol"
                value={newPortProtocol}
                onChange={(e) => setNewPortProtocol(e.target.value)}
                placeholder="https | http | tcp | udp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddPortOpen(false)}
              disabled={savingPort}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddPort} disabled={savingPort}>
              {savingPort ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addDomainOpen}
        onOpenChange={(open) => {
          setAddDomainOpen(open);
          if (!open) {
            setNewDomain("");
            setNewDomainPort("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom domain</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="domain-name">Domain</Label>
              <Input
                id="domain-name"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="app.example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="domain-port">Port (optional)</Label>
              <Input
                id="domain-port"
                type="number"
                min={1}
                max={65535}
                value={newDomainPort}
                onChange={(e) => setNewDomainPort(e.target.value)}
                placeholder={app?.appPort ? String(app.appPort) : "8080"}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              After adding a domain, create a CNAME record pointing to your cluster&apos;s
              public entrypoint. SSL is handled automatically by Caddy when using x-ports.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDomainOpen(false)}
              disabled={savingDomain}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddDomain} disabled={savingDomain}>
              {savingDomain ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaaSApplicationDetailsPage;
