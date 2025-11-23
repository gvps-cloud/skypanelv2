import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DollarSign, Plus, RefreshCw, Trash2, Edit } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";

interface PricingPlan {
  id: number;
  name: string;
  slug: string;
  description?: string;
  plan_type: "monthly" | "per_resource" | "custom";
  monthly_price?: number;
  cpu_cores?: number;
  ram_mb?: number;
  disk_gb?: number;
  bandwidth_gb?: number;
  max_applications?: number;
  buildpack_support: boolean;
  custom_domain_support: boolean;
  ssl_support: boolean;
  max_custom_domains: number;
  is_active: boolean;
  is_visible: boolean;
  is_default: boolean;
}

interface AddonPricing {
  id: number;
  addon_type: string;
  name: string;
  slug: string;
  description?: string;
  monthly_price: number;
  storage_gb?: number;
  max_connections?: number;
  ram_mb?: number;
  cpu_cores?: number;
  backup_enabled: boolean;
  backup_retention_days: number;
  high_availability: boolean;
  is_active: boolean;
  is_visible: boolean;
}

const AdminPaaSPricingPage: React.FC = () => {
  const { token } = useAuth();

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [addons, setAddons] = useState<AddonPricing[]>([]);
  const [loading, setLoading] = useState(false);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planSlug, setPlanSlug] = useState("");
  const [planType, setPlanType] = useState<PricingPlan["plan_type"]>("monthly");
  const [planMonthlyPrice, setPlanMonthlyPrice] = useState("0");
  
  // Per-resource pricing fields
  const [planCpuHourPrice, setPlanCpuHourPrice] = useState("0");
  const [planRamGbHourPrice, setPlanRamGbHourPrice] = useState("0");
  const [planDiskGbMonthPrice, setPlanDiskGbMonthPrice] = useState("0");
  const [planBandwidthGbPrice, setPlanBandwidthGbPrice] = useState("0");

  // Resource limits for monthly plans
  const [planCpuCores, setPlanCpuCores] = useState("1");
  const [planRamMb, setPlanRamMb] = useState("512");
  const [planDiskGb, setPlanDiskGb] = useState("10");
  const [planBandwidthGb, setPlanBandwidthGb] = useState("100");

  const [planMaxApps, setPlanMaxApps] = useState("10");
  const [planBuildpacks, setPlanBuildpacks] = useState(true);
  const [planCustomDomains, setPlanCustomDomains] = useState(true);
  const [planSsl, setPlanSsl] = useState(true);

  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [savingAddon, setSavingAddon] = useState(false);
  const [addonName, setAddonName] = useState("");
  const [addonSlug, setAddonSlug] = useState("");
  const [addonType, setAddonType] = useState("postgres");
  const [addonMonthlyPrice, setAddonMonthlyPrice] = useState("10");

  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [calcPlanId, setCalcPlanId] = useState<string>("");
  const [calcApps, setCalcApps] = useState("1");

  const hasToken = useMemo(() => Boolean(token), [token]);

  const loadPricing = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    try {
      const [plansRes, addonsRes] = await Promise.all([
        fetch(buildApiUrl("/api/admin/paas/pricing/plans"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl("/api/admin/paas/pricing/addons"), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const plansPayload = await plansRes.json().catch(() => ({}));
      const addonsPayload = await addonsRes.json().catch(() => ({}));
      if (!plansRes.ok) {
        throw new Error(plansPayload.error || "Failed to load pricing plans");
      }
      if (!addonsRes.ok) {
        throw new Error(addonsPayload.error || "Failed to load addon pricing");
      }
      setPlans(plansPayload.plans || []);
      setAddons(addonsPayload.addons || []);
    } catch (error: any) {
      console.error("Failed to load PaaS pricing", error);
      toast.error(error?.message || "Failed to load PaaS pricing");
    } finally {
      setLoading(false);
    }
  }, [hasToken, token]);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  const resetPlanForm = () => {
    setPlanName("");
    setPlanSlug("");
    setPlanType("monthly");
    setPlanMonthlyPrice("0");
    setPlanMaxApps("10");
    setPlanBuildpacks(true);
    setPlanCustomDomains(true);
    setPlanSsl(true);
    setEditingPlan(null);
  };

  const resetAddonForm = () => {
    setAddonName("");
    setAddonSlug("");
    setAddonType("postgres");
    setAddonMonthlyPrice("10");
  };

  const handleCreatePlan = async () => {
    if (!hasToken) return;
    if (!planName.trim() || !planSlug.trim()) {
      toast.error("Plan name and slug are required");
      return;
    }
    const price = Number(planMonthlyPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Monthly price must be a non-negative number");
      return;
    }
    const maxApps = Number(planMaxApps);
    setSavingPlan(true);
    try {
      const body: any = {
        name: planName.trim(),
        slug: planSlug.trim(),
        plan_type: planType,
        max_applications: Number.isFinite(maxApps) && maxApps > 0 ? maxApps : null,
        buildpack_support: planBuildpacks,
        custom_domain_support: planCustomDomains,
        ssl_support: planSsl,
      };

      if (planType === "monthly") {
        body.monthly_price = price;
        body.cpu_cores = Number(planCpuCores);
        body.ram_mb = Number(planRamMb);
        body.disk_gb = Number(planDiskGb);
        body.bandwidth_gb = Number(planBandwidthGb);
      } else if (planType === "per_resource") {
        body.price_per_cpu_hour = Number(planCpuHourPrice);
        body.price_per_ram_gb_hour = Number(planRamGbHourPrice);
        body.price_per_disk_gb_month = Number(planDiskGbMonthPrice);
        body.price_per_bandwidth_gb = Number(planBandwidthGbPrice);
      }

      const isEditing = Boolean(editingPlan);
      const url = isEditing
        ? buildApiUrl(`/api/admin/paas/pricing/plans/${editingPlan!.id}`)
        : buildApiUrl("/api/admin/paas/pricing/plans");
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
            (isEditing ? "Failed to update pricing plan" : "Failed to create pricing plan")
        );
      }
      toast.success(isEditing ? "Pricing plan updated" : "Pricing plan created");
      setPlanDialogOpen(false);
      resetPlanForm();
      void loadPricing();
    } catch (error: any) {
      console.error("Failed to save PaaS pricing plan", error);
      toast.error(error?.message || "Failed to save pricing plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!hasToken) return;
    if (!window.confirm("Delete this pricing plan?")) return;
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/pricing/plans/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete pricing plan");
      }
      toast.success("Pricing plan deleted");
      void loadPricing();
    } catch (error: any) {
      console.error("Failed to delete PaaS pricing plan", error);
      toast.error(error?.message || "Failed to delete pricing plan");
    }
  };

  const handleCreateAddon = async () => {
    if (!hasToken) return;
    if (!addonName.trim() || !addonSlug.trim()) {
      toast.error("Addon name and slug are required");
      return;
    }
    const price = Number(addonMonthlyPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Monthly price must be a non-negative number");
      return;
    }
    setSavingAddon(true);
    try {
      const body: any = {
        name: addonName.trim(),
        slug: addonSlug.trim(),
        addon_type: addonType,
        monthly_price: price,
        backup_enabled: false,
        backup_retention_days: 7,
        high_availability: false,
        is_active: true,
        is_visible: true,
      };
      const res = await fetch(buildApiUrl("/api/admin/paas/pricing/addons"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to create addon pricing");
      }
      toast.success("Addon pricing created");
      setAddonDialogOpen(false);
      resetAddonForm();
      void loadPricing();
    } catch (error: any) {
      console.error("Failed to create PaaS addon pricing", error);
      toast.error(error?.message || "Failed to create addon pricing");
    } finally {
      setSavingAddon(false);
    }
  };

  const handleDeleteAddon = async (id: number) => {
    if (!hasToken) return;
    if (!window.confirm("Delete this addon pricing entry?")) return;
    try {
      const res = await fetch(buildApiUrl(`/api/admin/paas/pricing/addons/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to delete addon pricing");
      }
      toast.success("Addon pricing deleted");
      void loadPricing();
    } catch (error: any) {
      console.error("Failed to delete PaaS addon pricing", error);
      toast.error(error?.message || "Failed to delete addon pricing");
    }
  };

  const formatCurrency = (value?: number) => {
    if (value == null || !Number.isFinite(value)) return "—";
    return `$${value.toFixed(2)}`;
  };

  const selectedCalcPlan = useMemo(
    () => plans.find((p) => String(p.id) === calcPlanId) || null,
    [plans, calcPlanId]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Pricing"
        description="Configure pricing plans and database add-ons for the PaaS platform."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Application plans"
        description="Plans control base pricing, features, and limits for PaaS applications."
        headerAction={
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              resetPlanForm();
              setPlanDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        }
      >
        {plans.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No application plans defined yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Max apps</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">{plan.slug}</div>
                  </TableCell>
                  <TableCell className="capitalize text-xs">{plan.plan_type}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(plan.monthly_price)}</TableCell>
                  <TableCell className="text-xs">
                    {plan.max_applications != null ? plan.max_applications : "unlimited"}
                  </TableCell>
                  <TableCell className="text-xs space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {plan.buildpack_support && <Badge variant="outline">Buildpacks</Badge>}
                      {plan.custom_domain_support && <Badge variant="outline">Custom domains</Badge>}
                      {plan.ssl_support && <Badge variant="outline">SSL</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={plan.is_active ? "default" : "outline"}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {plan.is_default && <Badge variant="secondary">Default</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingPlan(plan);
                          setPlanName(plan.name);
                          setPlanSlug(plan.slug);
                          setPlanType(plan.plan_type);
                          setPlanMonthlyPrice(String(plan.monthly_price ?? 0));
                          setPlanMaxApps(
                            plan.max_applications != null
                              ? String(plan.max_applications)
                              : "0"
                          );
                          setPlanBuildpacks(plan.buildpack_support);
                          setPlanCustomDomains(plan.custom_domain_support);
                          setPlanSsl(plan.ssl_support);
                          setPlanDialogOpen(true);
                        }}
                        title="Edit plan"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeletePlan(plan.id)}
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

      <ContentCard
        title="Addon pricing"
        description="Database and cache add-ons that can be attached to PaaS applications."
        headerAction={
          <Button size="sm" className="gap-2" onClick={() => setAddonDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New addon
          </Button>
        }
      >
        {addons.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No addon pricing defined yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons.map((addon) => (
                <TableRow key={addon.id}>
                  <TableCell>
                    <div className="font-medium">{addon.name}</div>
                    <div className="text-xs text-muted-foreground">{addon.slug}</div>
                  </TableCell>
                  <TableCell className="uppercase text-xs">{addon.addon_type}</TableCell>
                  <TableCell className="text-sm">{formatCurrency(addon.monthly_price)}</TableCell>
                  <TableCell className="text-xs">
                    {addon.storage_gb != null ? `${addon.storage_gb} GB` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {addon.max_connections != null ? addon.max_connections : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={addon.is_active ? "default" : "outline"}>
                        {addon.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {addon.backup_enabled && <Badge variant="outline">Backups</Badge>}
                      {addon.high_availability && <Badge variant="outline">HA</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteAddon(addon.id)}
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

      <Dialog
        open={planDialogOpen}
        onOpenChange={(open) => {
          setPlanDialogOpen(open);
          if (!open) resetPlanForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New application plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Standard"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-slug">Slug</Label>
              <Input
                id="plan-slug"
                value={planSlug}
                onChange={(e) => setPlanSlug(e.target.value)}
                placeholder="standard"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="plan-type">Plan type</Label>
                <Select
                  value={planType}
                  onValueChange={(value) =>
                    setPlanType(value as PricingPlan["plan_type"])
                  }
                >
                  <SelectTrigger id="plan-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="per_resource">Per resource</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {planType === "monthly" && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="plan-monthly">Monthly price (USD)</Label>
                    <Input
                      id="plan-monthly"
                      type="number"
                      min={0}
                      step="0.01"
                      value={planMonthlyPrice}
                      onChange={(e) => setPlanMonthlyPrice(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label>CPU Cores</Label>
                      <Input
                        type="number"
                        value={planCpuCores}
                        onChange={(e) => setPlanCpuCores(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>RAM (MB)</Label>
                      <Input
                        type="number"
                        value={planRamMb}
                        onChange={(e) => setPlanRamMb(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Disk (GB)</Label>
                      <Input
                        type="number"
                        value={planDiskGb}
                        onChange={(e) => setPlanDiskGb(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Bandwidth (GB/mo)</Label>
                      <Input
                        type="number"
                        value={planBandwidthGb}
                        onChange={(e) => setPlanBandwidthGb(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {planType === "per_resource" && (
                <div className="col-span-2 space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Hourly Resource Rates
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CPU / Hour ($)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={planCpuHourPrice}
                        onChange={(e) => setPlanCpuHourPrice(e.target.value)}
                        placeholder="0.0100"
                      />
                    </div>
                    <div>
                      <Label>RAM GB / Hour ($)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={planRamGbHourPrice}
                        onChange={(e) => setPlanRamGbHourPrice(e.target.value)}
                        placeholder="0.0050"
                      />
                    </div>
                    <div>
                      <Label>Disk GB / Month ($)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={planDiskGbMonthPrice}
                        onChange={(e) => setPlanDiskGbMonthPrice(e.target.value)}
                        placeholder="0.1000"
                      />
                    </div>
                    <div>
                      <Label>Bandwidth / GB ($)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={planBandwidthGbPrice}
                        onChange={(e) => setPlanBandwidthGbPrice(e.target.value)}
                        placeholder="0.0900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="plan-max-apps">Max applications</Label>
                <Input
                  id="plan-max-apps"
                  type="number"
                  min={0}
                  value={planMaxApps}
                  onChange={(e) => setPlanMaxApps(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  0 for unlimited.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Included features</Label>
                <div className="flex flex-col gap-2 rounded-md border p-3 text-xs">
                  <label className="flex items-center justify-between gap-2">
                    <span>Buildpack deployments</span>
                    <Switch
                      checked={planBuildpacks}
                      onCheckedChange={setPlanBuildpacks}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span>Custom domains</span>
                    <Switch
                      checked={planCustomDomains}
                      onCheckedChange={setPlanCustomDomains}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span>Managed SSL</span>
                    <Switch checked={planSsl} onCheckedChange={setPlanSsl} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPlanDialogOpen(false);
                resetPlanForm();
              }}
              disabled={savingPlan}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreatePlan} disabled={savingPlan}>
              {savingPlan ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addonDialogOpen}
        onOpenChange={(open) => {
          setAddonDialogOpen(open);
          if (!open) resetAddonForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New addon pricing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="addon-name">Name</Label>
              <Input
                id="addon-name"
                value={addonName}
                onChange={(e) => setAddonName(e.target.value)}
                placeholder="PostgreSQL Hobby"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addon-slug">Slug</Label>
              <Input
                id="addon-slug"
                value={addonSlug}
                onChange={(e) => setAddonSlug(e.target.value)}
                placeholder="postgres-hobby"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="addon-type">Addon type</Label>
                <Select
                  value={addonType}
                  onValueChange={(value) => setAddonType(value)}
                >
                  <SelectTrigger id="addon-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="addon-monthly">Monthly price (USD)</Label>
                <Input
                  id="addon-monthly"
                  type="number"
                  min={0}
                  step="0.01"
                  value={addonMonthlyPrice}
                  onChange={(e) => setAddonMonthlyPrice(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddonDialogOpen(false);
                resetAddonForm();
              }}
              disabled={savingAddon}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateAddon} disabled={savingAddon}>
              {savingAddon ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaaSPricingPage;
