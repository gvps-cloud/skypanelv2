import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface PaaSApplicationSummary {
  id: string;
  name: string;
  status: string;
  repositoryUrl?: string;
  deploymentStrategy: "buildpack" | "dockerfile" | "image";
  appPort?: number;
  createdAt?: string;
}

const PaaSApplicationsPage: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<PaaSApplicationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryBranch, setRepositoryBranch] = useState("main");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [imageUrl, setImageUrl] = useState("");
  const [deploymentStrategy, setDeploymentStrategy] = useState<
    "buildpack" | "dockerfile" | "image"
  >("buildpack");
  const [appPort, setAppPort] = useState<string>("8080");
  const [initialPortEnabled, setInitialPortEnabled] = useState(true);
  const [initialPortProtocol, setInitialPortProtocol] = useState("https");
  const [initialDomain, setInitialDomain] = useState("");

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadApplications = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/client/paas/applications"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load applications");
      }
      const items: PaaSApplicationSummary[] = (payload.applications || []).map(
        (app: any) => ({
          id: String(app.id),
          name: app.name,
          status: app.status || "pending",
          repositoryUrl: app.repositoryUrl || app.repository_url,
          deploymentStrategy: app.deploymentStrategy || app.deployment_strategy,
          appPort: app.appPort ?? app.app_port ?? undefined,
          createdAt: app.createdAt || app.created_at,
        })
      );
      setApplications(items);
    } catch (error: any) {
      console.error("Failed to load PaaS applications", error);
      toast.error(error?.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const resetCreateForm = () => {
    setName("");
    setRepositoryUrl("");
    setRepositoryBranch("main");
    setDockerfilePath("Dockerfile");
    setImageUrl("");
    setDeploymentStrategy("buildpack");
    setAppPort("8080");
  };

  const handleCreate = async () => {
    if (!hasToken) return;
    if (!name.trim()) {
      toast.error("Application name is required");
      return;
    }
    
    // Validation based on strategy
    if (deploymentStrategy === "image" && !imageUrl.trim()) {
      toast.error("Docker image URL is required");
      return;
    }
    if (deploymentStrategy !== "image" && !repositoryUrl.trim()) {
       // Allow optional repo for buildpack? The original code had it optional. 
       // But usually you need a repo. Let's keep it consistent with original for now, 
       // or make it required if strategy is dockerfile.
    }

    setCreating(true);
    try {
      const body: any = {
        name: name.trim(),
        deploymentStrategy,
        appPort: Number(appPort) || 8080,
      };

      if (deploymentStrategy === "image") {
        body.imageUrl = imageUrl.trim();
      } else {
        body.repositoryUrl = repositoryUrl.trim();
        body.repositoryBranch = repositoryBranch.trim() || "main";
        if (deploymentStrategy === "dockerfile") {
          body.dockerfilePath = dockerfilePath.trim() || "Dockerfile";
        }
      }

      const res = await fetch(buildApiUrl("/api/client/paas/applications"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create application");
      }
      toast.success("Application created");
      if (initialPortEnabled) {
        try {
          const portRes = await fetch(buildApiUrl(`/api/client/paas/applications/${payload.application.id}/ports/initial`), {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ containerPort: Number(appPort) || 8080, protocol: initialPortProtocol, customDomain: initialDomain || undefined }),
          });
          const portPayload = await portRes.json().catch(() => ({}));
          if (!portRes.ok) {
            throw new Error(portPayload.error || "Failed to create initial port");
          }
        } catch (e: any) {
          toast.error(e?.message || "Failed to setup initial port");
        }
      }
      setCreateOpen(false);
      resetCreateForm();
      void loadApplications();
    } catch (error: any) {
      console.error("Failed to create PaaS application", error);
      toast.error(error?.message || "Failed to create application");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetails = (id: string) => {
    navigate(`/paas/apps/${id}`);
  };

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Applications"
        description="Manage your buildpack, Dockerfile, and image-based applications."
        badge={{ text: "PaaS", variant: "secondary" }}
        actions={
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New application
          </Button>
        }
      />

      <ContentCard
        title="Applications"
        description="Your deployed and deployable PaaS applications."
        headerAction={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void loadApplications()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        {applications.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p className="mb-2 font-medium">No applications yet</p>
            <p className="mb-4 max-w-md">
              Create your first PaaS application to deploy via buildpacks, Dockerfile, or
              a pre-built image.
            </p>
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create application
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {applications.map((app) => (
              <Card
                key={app.id}
                className="cursor-pointer transition hover:border-primary/60 hover:shadow-sm"
                onClick={() => handleOpenDetails(app.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">
                        {app.name}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          {app.deploymentStrategy}
                        </span>
                        {app.appPort && <span>Port {app.appPort}</span>}
                      </div>
                    </div>
                    {renderStatusBadge(app.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {app.repositoryUrl && (
                    <p className="truncate text-xs" title={app.repositoryUrl}>
                      {app.repositoryUrl}
                    </p>
                  )}
                  {app.createdAt && (
                    <p className="text-xs">
                      Created {new Date(app.createdAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ContentCard>

      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) resetCreateForm();
      }}>
      <DialogContent>
          <DialogHeader>
            <DialogTitle>New PaaS application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="paas-name">Name</Label>
              <Input
                id="paas-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-app"
              />
            </div>

            <div className="space-y-2">
              <Label>Deployment strategy</Label>
              <div className="flex gap-2">
                {(["buildpack", "dockerfile", "image"] as const).map((strategy) => (
                  <Button
                    key={strategy}
                    type="button"
                    variant={deploymentStrategy === strategy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDeploymentStrategy(strategy)}
                  >
                    {strategy}
                  </Button>
                ))}
              </div>
            </div>

            {deploymentStrategy !== "image" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paas-repo">Repository URL</Label>
                  <Input
                    id="paas-repo"
                    value={repositoryUrl}
                    onChange={(e) => setRepositoryUrl(e.target.value)}
                    placeholder="https://github.com/you/your-app.git"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paas-branch">Repository branch</Label>
                  <Input
                    id="paas-branch"
                    value={repositoryBranch}
                    onChange={(e) => setRepositoryBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
              </>
            )}

            {deploymentStrategy === "dockerfile" && (
              <div className="space-y-2">
                <Label htmlFor="paas-dockerfile">Dockerfile path</Label>
                <Input
                  id="paas-dockerfile"
                  value={dockerfilePath}
                  onChange={(e) => setDockerfilePath(e.target.value)}
                  placeholder="Dockerfile"
                />
              </div>
            )}

            {deploymentStrategy === "image" && (
              <div className="space-y-2">
                <Label htmlFor="paas-image">Docker Image URL</Label>
                <Input
                  id="paas-image"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="nginx:latest or registry.example.com/my-image:tag"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="paas-port">Application port</Label>
              <Input
                id="paas-port"
                type="number"
                min={1}
                max={65535}
                value={appPort}
                onChange={(e) => setAppPort(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Create initial port mapping</Label>
              <div className="flex items-center gap-2 text-xs">
                <Button type="button" size="sm" variant={initialPortEnabled ? "default" : "outline"} onClick={() => setInitialPortEnabled(true)}>Enable</Button>
                <Button type="button" size="sm" variant={!initialPortEnabled ? "default" : "outline"} onClick={() => setInitialPortEnabled(false)}>Disable</Button>
              </div>
              {initialPortEnabled && (
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <Label>Protocol</Label>
                    <Input value={initialPortProtocol} onChange={(e) => setInitialPortProtocol(e.target.value)} placeholder="https | http | tcp | udp" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Custom domain (optional)</Label>
                    <Input value={initialDomain} onChange={(e) => setInitialDomain(e.target.value)} placeholder="app.example.com" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
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

export default PaaSApplicationsPage;
