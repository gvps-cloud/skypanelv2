import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Grid3X3, RefreshCw, Rocket } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MarketplaceTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  language?: string;
  framework?: string;
  logoUrl?: string;
}

const PaaSMarketplacePage: React.FC = () => {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<MarketplaceTemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);

  const [deployOpen, setDeployOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplateSummary | null>(null);
  const [appName, setAppName] = useState("");
  const [workerNodeId, setWorkerNodeId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTemplate, setDetailsTemplate] = useState<MarketplaceTemplateSummary | null>(null);

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadTemplates = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/client/paas/marketplace/templates"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load templates");
      }
      const items: MarketplaceTemplateSummary[] = (payload.templates || []).map((t: any) => ({
        id: String(t.id),
        name: t.name,
        description: t.description,
        category: t.category || "Other",
        language: t.language,
        framework: t.framework,
        logoUrl: t.logoUrl || t.logo_url,
      }));
      setTemplates(items);

      const uniqueCategories = Array.from(
        new Set(items.map((t) => t.category || "Other"))
      ).sort((a, b) => a.localeCompare(b));
      setCategories(uniqueCategories);
    } catch (error: any) {
      console.error("Failed to load PaaS marketplace templates", error);
      toast.error(error?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesCategory =
        categoryFilter === "all" || t.category === categoryFilter;
      const haystack = `${t.name} ${t.description} ${t.category}`.toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [templates, search, categoryFilter]);

  const openDeploy = (template: MarketplaceTemplateSummary) => {
    setSelectedTemplate(template);
    setDeployOpen(true);
    setAppName(template.name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "my-app");
  };

  const openDetails = (template: MarketplaceTemplateSummary) => {
    setDetailsTemplate(template);
    setDetailsOpen(true);
  };

  const resetDeployForm = () => {
    setAppName("");
    setWorkerNodeId("");
    setSelectedTemplate(null);
  };

  const handleDeploy = async () => {
    if (!hasToken || !selectedTemplate) return;
    if (!appName.trim()) {
      toast.error("Application name is required");
      return;
    }
    setDeploying(true);
    try {
      const body: any = {
        applicationName: appName.trim(),
        workerNodeId: workerNodeId || undefined,
      };

      const res = await fetch(
        buildApiUrl(`/api/client/paas/marketplace/templates/${selectedTemplate.id}/deploy`),
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
        throw new Error(payload.error || "Failed to deploy from template");
      }
      toast.success("Deployment started from template");
      setDeployOpen(false);
      resetDeployForm();
    } catch (error: any) {
      console.error("Failed to deploy PaaS template", error);
      toast.error(error?.message || "Failed to deploy template");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Marketplace"
        description="Deploy ready-made application templates with one click."
        badge={{ text: "PaaS", variant: "secondary" }}
      />

      <ContentCard
        title="Templates"
        description="Browse available PaaS application templates and deploy them to your account."
        headerAction={
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void loadTemplates()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or description"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex gap-2 md:w-64">
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredTemplates.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p className="mb-2 font-medium">No templates available</p>
            <p className="max-w-md">
              Contact support or your administrator if you expect PaaS templates to be
              available for your organization.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">
                        {template.name}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {template.category && <Badge variant="outline">{template.category}</Badge>}
                        {template.language && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                            {template.language}
                          </span>
                        )}
                        {template.framework && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                            {template.framework}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-4 text-sm text-muted-foreground">
                    {template.description || "No description provided."}
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2 pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => openDetails(template)}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => openDeploy(template)}
                  >
                    <Rocket className="h-4 w-4" />
                    Deploy
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </ContentCard>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {detailsTemplate ? detailsTemplate.name : "Template details"}
            </DialogTitle>
          </DialogHeader>
          {detailsTemplate && (
            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground">
                {detailsTemplate.description || "No description provided."}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {detailsTemplate.category && (
                  <Badge variant="outline">{detailsTemplate.category}</Badge>
                )}
                {detailsTemplate.language && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {detailsTemplate.language}
                  </span>
                )}
                {detailsTemplate.framework && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {detailsTemplate.framework}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                You can deploy this template to a PaaS application using the Deploy button.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDetailsOpen(false);
                setDetailsTemplate(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deployOpen}
        onOpenChange={(open) => {
          setDeployOpen(open);
          if (!open) resetDeployForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Deploy template{selectedTemplate ? `: ${selectedTemplate.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="paas-app-name">Application name</Label>
              <Input
                id="paas-app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="my-app"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paas-worker">Target worker node (optional)</Label>
              <Input
                id="paas-worker"
                value={workerNodeId}
                onChange={(e) => setWorkerNodeId(e.target.value)}
                placeholder="Worker node ID (admin-provisioned)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeployOpen(false);
                resetDeployForm();
              }}
              disabled={deploying}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleDeploy} disabled={deploying}>
              {deploying ? "Deploying…" : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaaSMarketplacePage;
