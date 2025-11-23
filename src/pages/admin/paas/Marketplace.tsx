import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language?: string;
  framework?: string;
  logoUrl?: string;
  repositoryUrl: string;
  repositoryBranch: string;
  deploymentStrategy: "buildpack" | "dockerfile" | "image";
  appPort: number;
  minCpuCores?: number;
  minMemoryMb?: number;
  isActive: boolean;
  deployCount: number;
}

const AdminPaaSMarketplacePage: React.FC = () => {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MarketplaceTemplate | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MarketplaceTemplate | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [language, setLanguage] = useState("");
  const [framework, setFramework] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryBranch, setRepositoryBranch] = useState("main");
  const [deploymentStrategy, setDeploymentStrategy] = useState<
    MarketplaceTemplate["deploymentStrategy"]
  >("buildpack");
  const [appPort, setAppPort] = useState("8080");

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadTemplates = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/paas/marketplace"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load marketplace templates");
      }
      const items: MarketplaceTemplate[] = (payload.templates || []).map((t: any) => ({
        id: String(t.id),
        name: t.name,
        description: t.description,
        category: t.category || "General",
        language: t.language,
        framework: t.framework,
        logoUrl: t.logoUrl || t.logo_url,
        repositoryUrl: t.repositoryUrl || t.repository_url,
        repositoryBranch: t.repositoryBranch || t.repository_branch,
        deploymentStrategy: t.deploymentStrategy || t.deployment_strategy,
        appPort: t.appPort ?? t.app_port ?? 8080,
        minCpuCores: t.minCpuCores ?? t.min_cpu_cores ?? undefined,
        minMemoryMb: t.minMemoryMb ?? t.min_memory_mb ?? undefined,
        isActive: t.isActive ?? t.is_active ?? true,
        deployCount: t.deployCount ?? t.deploy_count ?? 0,
      }));
      setTemplates(items);
    } catch (error: any) {
      console.error("Failed to load PaaS marketplace templates", error);
      toast.error(error?.message || "Failed to load marketplace templates");
    } finally {
      setLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesCategory =
        categoryFilter === "all" || t.category === categoryFilter;
      const haystack = `${t.name} ${t.description} ${t.category} ${t.language ?? ""} ${
        t.framework ?? ""
      }`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [templates, search, categoryFilter]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("General");
    setLanguage("");
    setFramework("");
    setLogoUrl("");
    setRepositoryUrl("");
    setRepositoryBranch("main");
    setDeploymentStrategy("buildpack");
    setAppPort("8080");
    setEditingTemplate(null);
  };

  const handleSaveTemplate = async () => {
    if (!hasToken) return;
    if (!name.trim() || !repositoryUrl.trim()) {
      toast.error("Name and repository URL are required");
      return;
    }
    const port = Number(appPort);
    if (!Number.isFinite(port) || port <= 0) {
      toast.error("Valid application port is required");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: name.trim(),
        description: description.trim(),
        category: category.trim() || "General",
        language: language.trim() || undefined,
        framework: framework.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        repositoryUrl: repositoryUrl.trim(),
        repositoryBranch: repositoryBranch.trim() || "main",
        deploymentStrategy,
        appPort: port,
        minCpuCores: undefined,
        minMemoryMb: undefined,
      };

      const isEditing = Boolean(editingTemplate);
      const url = isEditing
        ? buildApiUrl(`/api/admin/paas/marketplace/${editingTemplate!.id}`)
        : buildApiUrl("/api/admin/paas/marketplace");
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          payload.error ||
            (isEditing
              ? "Failed to update marketplace template"
              : "Failed to create marketplace template")
        );
      }
      toast.success(isEditing ? "Marketplace template updated" : "Marketplace template created");
      setDialogOpen(false);
      resetForm();
      void loadTemplates();
    } catch (error: any) {
      console.error("Failed to create PaaS marketplace template", error);
      toast.error(error?.message || "Failed to create marketplace template");
    } finally {
      setSaving(false);
    }
  };
  const handleToggleActive = async (tpl: MarketplaceTemplate) => {
    if (!hasToken) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/paas/marketplace/${tpl.id}/active`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: !tpl.isActive }),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update template status");
      }
      toast.success(
        tpl.isActive ? "Template deactivated" : "Template activated"
      );
      void loadTemplates();
    } catch (error: any) {
      console.error("Failed to toggle template active state", error);
      toast.error(error?.message || "Failed to update template status");
    }
  };

  const handleDelete = async (tpl: MarketplaceTemplate) => {
    if (!hasToken) return;
    if (
      !window.confirm(
        `Delete template "${tpl.name}"? This cannot be undone and will not affect existing apps.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/paas/marketplace/${tpl.id}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete template");
      }
      toast.success("Template deleted");
      void loadTemplates();
    } catch (error: any) {
      console.error("Failed to delete marketplace template", error);
      toast.error(error?.message || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Marketplace"
        description="Curate one-click templates for deploying applications via PaaS."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
        actions={
          <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        }
      />

      <ContentCard
        title="Templates"
        description="Templates are used by the client PaaS marketplace for one-click deployments."
        headerAction={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search templates…"
              className="h-8 w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => void loadTemplates()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      >
        {filteredTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No templates found. Create your first template to power the PaaS marketplace.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((tpl) => (
              <Card key={tpl.id} className="flex flex-col">
                <CardHeader className="space-y-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">
                      {tpl.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={tpl.isActive ? "default" : "outline"}>
                        {tpl.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {tpl.category && (
                        <Badge variant="secondary">{tpl.category}</Badge>
                      )}
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {tpl.description}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-xs">
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    {tpl.language && <span>{tpl.language}</span>}
                    {tpl.framework && (
                      <span className="border-l pl-2">{tpl.framework}</span>
                    )}
                    <span className="border-l pl-2">
                      Strategy: {tpl.deploymentStrategy}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-muted-foreground">
                    <span>Port {tpl.appPort}</span>
                    {tpl.minCpuCores != null && (
                      <span className="border-l pl-2">
                        
                        {tpl.minCpuCores} vCPU
                      </span>
                    )}
                    {tpl.minMemoryMb != null && (
                      <span className="border-l pl-2">
                        {(tpl.minMemoryMb / 1024).toFixed(1)} GB RAM
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t bg-muted/40 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {tpl.deployCount} deploy{tpl.deployCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setPreviewTemplate(tpl);
                        setPreviewOpen(true);
                      }}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setEditingTemplate(tpl);
                        setName(tpl.name);
                        setDescription(tpl.description);
                        setCategory(tpl.category || "General");
                        setLanguage(tpl.language || "");
                        setFramework(tpl.framework || "");
                        setLogoUrl(tpl.logoUrl || "");
                        setRepositoryUrl(tpl.repositoryUrl);
                        setRepositoryBranch(tpl.repositoryBranch || "main");
                        setDeploymentStrategy(tpl.deploymentStrategy);
                        setAppPort(String(tpl.appPort || 8080));
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={tpl.isActive ? "outline" : "default"}
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleToggleActive(tpl)}
                    >
                      {tpl.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => void handleDelete(tpl)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </ContentCard>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {previewTemplate ? previewTemplate.name : "Template preview"}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground">
                {previewTemplate.description || "No description provided."}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {previewTemplate.category && (
                  <Badge variant="outline">{previewTemplate.category}</Badge>
                )}
                {previewTemplate.language && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {previewTemplate.language}
                  </span>
                )}
                {previewTemplate.framework && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {previewTemplate.framework}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Repository: {previewTemplate.repositoryUrl}</div>
                <div>Branch: {previewTemplate.repositoryBranch}</div>
                <div>Strategy: {previewTemplate.deploymentStrategy}</div>
                <div>App port: {previewTemplate.appPort}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewTemplate(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit marketplace template" : "New marketplace template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Laravel on PostgreSQL"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-description">Description</Label>
              <Textarea
                id="tpl-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tpl-category">Category</Label>
                <Input
                  id="tpl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="General"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-logo">Logo URL (optional)</Label>
                <Input
                  id="tpl-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.svg"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tpl-language">Language (optional)</Label>
                <Input
                  id="tpl-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="PHP"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-framework">Framework (optional)</Label>
                <Input
                  id="tpl-framework"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  placeholder="Laravel"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-repo">Git repository URL</Label>
              <Input
                id="tpl-repo"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
                placeholder="https://github.com/org/app"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tpl-branch">Git branch</Label>
                <Input
                  id="tpl-branch"
                  value={repositoryBranch}
                  onChange={(e) => setRepositoryBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-strategy">Deployment strategy</Label>
                <Select
                  value={deploymentStrategy}
                  onValueChange={(value) =>
                    setDeploymentStrategy(
                      value as MarketplaceTemplate["deploymentStrategy"]
                    )
                  }
                >
                  <SelectTrigger id="tpl-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buildpack">Buildpack</SelectItem>
                    <SelectItem value="dockerfile">Dockerfile</SelectItem>
                    <SelectItem value="image">Pre-built image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tpl-port">Application port</Label>
                <Input
                  id="tpl-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={appPort}
                  onChange={(e) => setAppPort(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveTemplate} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaaSMarketplacePage;
