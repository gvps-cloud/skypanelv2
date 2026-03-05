/**
 * VPS Plan Creation Wizard
 * A multi-step wizard for creating VPS plans with improved UX
 */
import React, { useState, useMemo } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  DollarSign,
  Server,
  Cpu,
  HardDrive,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface LinodeType {
  id: string;
  label: string;
  memory: number;
  vcpus: number;
  disk: number;
  transfer: number;
  type_class: string;
  price: {
    monthly: number;
    hourly: number;
  };
  backup_price_monthly?: number;
  backup_price_hourly?: number;
}

interface NewVPSPlanState {
  name: string;
  description: string;
  selectedProviderId: string;
  selectedType: string;
  markupPrice: number;
  backupPriceMonthly: number | string;
  backupPriceHourly: number | string;
  backupUpchargeMonthly: number | string;
  backupUpchargeHourly: number | string;
  dailyBackupsEnabled: boolean;
  weeklyBackupsEnabled: boolean;
  active: boolean;
  selectedRegions: string[];
}

interface LinodeRegion {
  id: string;
  label: string;
  country: string;
  capabilities: string[];
}

interface VPSPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Provider[];
  linodeTypes: LinodeType[];
  planTypeFilter: string;
  setPlanTypeFilter: (value: string) => void;
  newVPSPlan: NewVPSPlanState;
  setNewVPSPlan: React.Dispatch<React.SetStateAction<NewVPSPlanState>>;
  onProviderChange: (providerId: string) => void;
  onSubmit: () => void;
  regions?: LinodeRegion[];
}

const STEPS = [
  { id: 1, title: "Provider & Plan", icon: Server },
  { id: 2, title: "Regions", icon: Cloud },
  { id: 3, title: "Pricing", icon: DollarSign },
  { id: 4, title: "Review", icon: Check },
];

const PLAN_CATEGORIES = [
  { value: "all", label: "All Types" },
  { value: "standard", label: "Shared CPU (Standard/Nanode)" },
  { value: "cpu", label: "Dedicated CPU" },
  { value: "memory", label: "High Memory" },
  { value: "premium", label: "Premium CPU" },
  { value: "gpu", label: "GPU" },
];

export function VPSPlanWizard({
  open,
  onOpenChange,
  providers,
  linodeTypes,
  planTypeFilter,
  setPlanTypeFilter,
  newVPSPlan,
  setNewVPSPlan,
  onProviderChange,
  onSubmit,
  regions = [],
}: VPSPlanWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const filteredPlanTypes = useMemo(() => {
    if (planTypeFilter === "all") return linodeTypes;
    return linodeTypes.filter((t) => {
      const tc = t.type_class?.toLowerCase() || "";
      switch (planTypeFilter) {
        case "standard":
          return tc.includes("standard") || tc.includes("nanode");
        case "cpu":
          return tc.includes("dedicated") && !tc.includes("premium");
        case "memory":
          return tc.includes("highmem");
        case "premium":
          return tc.includes("premium");
        case "gpu":
          return tc.includes("gpu");
        default:
          return true;
      }
    });
  }, [linodeTypes, planTypeFilter]);

  const selectedType = useMemo(
    () => linodeTypes.find((t) => t.id === newVPSPlan.selectedType),
    [linodeTypes, newVPSPlan.selectedType]
  );

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === newVPSPlan.selectedProviderId),
    [providers, newVPSPlan.selectedProviderId]
  );

  // Filter regions based on plan type capabilities
  const filteredRegions = useMemo(() => {
    if (!selectedType) return [];

    const typeClass = selectedType.type_class?.toLowerCase() || "";

    // For premium, GPU, and accelerated plans, filter by region capabilities
    if (typeClass === "premium") {
      return regions.filter((r) =>
        r.capabilities.includes("Premium Plans")
      );
    }
    if (typeClass === "gpu") {
      return regions.filter((r) =>
        r.capabilities.includes("GPU Linodes")
      );
    }
    if (typeClass === "accelerated") {
      return regions.filter((r) =>
        r.capabilities.includes("Accelerated")
      );
    }

    // For standard, cpu, memory plans - all regions are available
    return regions;
  }, [selectedType, regions]);

  const canProceedToStep2 = newVPSPlan.selectedProviderId && newVPSPlan.selectedType;
  const canProceedToStep3 = canProceedToStep2 && newVPSPlan.selectedRegions.length > 0;
  const canProceedToStep4 = canProceedToStep3;

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(1);
    setNewVPSPlan({
      name: "",
      description: "",
      selectedProviderId: "",
      selectedType: "",
      markupPrice: 0,
      backupPriceMonthly: 0,
      backupPriceHourly: 0,
      backupUpchargeMonthly: 0,
      backupUpchargeHourly: 0,
      dailyBackupsEnabled: false,
      weeklyBackupsEnabled: true,
      active: true,
      selectedRegions: [],
    });
  };

  const handleSubmit = () => {
    onSubmit();
    setCurrentStep(1);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6 px-4">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                    : isCompleted
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mb-5 transition-colors",
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Provider</Label>
        <Select
          value={newVPSPlan.selectedProviderId}
          onValueChange={(value) => {
            onProviderChange(value);
            setPlanTypeFilter("all");
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {providers
              .filter((p) => p.active)
              .map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-muted-foreground" />
                    {provider.name} ({provider.type})
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Filter by Category</Label>
        <Select
          value={planTypeFilter}
          onValueChange={setPlanTypeFilter}
          disabled={!newVPSPlan.selectedProviderId}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="All plan types" />
          </SelectTrigger>
          <SelectContent>
            {PLAN_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plan Type Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Plan Type</Label>
        <Select
          value={newVPSPlan.selectedType}
          onValueChange={(value) => {
            const type = linodeTypes.find((t) => t.id === value);
            setNewVPSPlan((prev) => ({
              ...prev,
              selectedType: value,
              backupPriceMonthly: type?.backup_price_monthly || 0,
              backupPriceHourly: type?.backup_price_hourly || 0,
            }));
          }}
          disabled={!newVPSPlan.selectedProviderId}
        >
          <SelectTrigger className="h-11">
            <SelectValue
              placeholder={
                newVPSPlan.selectedProviderId
                  ? "Select a plan type"
                  : "Select provider first"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {filteredPlanTypes.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No plans in this category
              </div>
            ) : (
              filteredPlanTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <span className="font-medium">{type.label}</span>
                  <span className="text-muted-foreground ml-2">
                    {type.vcpus} vCPU · {type.memory}MB · {Math.round(type.disk / 1024)}GB · ${type.price.monthly}/mo
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Plan Preview */}
      {selectedType && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            Selected Plan Details
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">vCPUs:</span>
              <span className="font-medium">{selectedType.vcpus}</span>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Memory:</span>
              <span className="font-medium">{selectedType.memory} MB</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Storage:</span>
              <span className="font-medium">{Math.round(selectedType.disk / 1024)} GB</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Base Price:</span>
              <span className="font-medium">${selectedType.price.monthly}/mo</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Select Available Regions</Label>
        <p className="text-xs text-muted-foreground">
          Choose which regions this plan should be available in.
          {selectedType?.type_class === "premium" && (
            <span className="text-amber-500 ml-2">Premium plans are only available in regions with Premium Plans capability.</span>
          )}
          {selectedType?.type_class === "gpu" && (
            <span className="text-purple-500 ml-2">GPU plans are only available in regions with GPU Linodes capability.</span>
          )}
          {selectedType?.type_class === "accelerated" && (
            <span className="text-blue-500 ml-2">Accelerated plans are only available in regions with Accelerated capability.</span>
          )}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (filteredRegions.length > 0) {
              setNewVPSPlan((prev) => ({
                ...prev,
                selectedRegions: filteredRegions.map((r) => r.id),
              }));
            }
          }}
          disabled={filteredRegions.length === 0}
        >
          Select All ({filteredRegions.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewVPSPlan((prev) => ({
              ...prev,
              selectedRegions: [],
            }));
          }}
        >
          Clear All
        </Button>
      </div>

      {/* Region List */}
      <div className="max-h-[240px] overflow-y-auto rounded-lg border bg-background">
        {filteredRegions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No regions available for this plan type.
          </div>
        ) : (
          <div className="divide-y">
            {filteredRegions.map((region) => (
              <div
                key={region.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`region-${region.id}`}
                  checked={newVPSPlan.selectedRegions?.includes(region.id) || false}
                  onCheckedChange={(checked) => {
                    setNewVPSPlan((prev) => ({
                      ...prev,
                      selectedRegions: checked
                        ? [...(prev.selectedRegions || []), region.id]
                        : (prev.selectedRegions || []).filter((r) => r !== region.id),
                    }));
                  }}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={`region-${region.id}`}
                    className="cursor-pointer font-medium"
                  >
                    {region.label}
                  </Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {region.id}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {region.country}
                    </Badge>
                    {region.capabilities.includes("Premium Plans") && (
                      <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-600">
                        Premium
                      </Badge>
                    )}
                    {region.capabilities.includes("GPU Linodes") && (
                      <Badge variant="default" className="text-xs bg-purple-500 hover:bg-purple-600">
                        GPU
                      </Badge>
                    )}
                    {region.capabilities.includes("Accelerated") && (
                      <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600">
                        Accelerated
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {newVPSPlan.selectedRegions && newVPSPlan.selectedRegions.length > 0 && (
        <div className="rounded-lg border bg-primary/5 p-3">
          <p className="text-sm font-medium">
            {newVPSPlan.selectedRegions.length} region{newVPSPlan.selectedRegions.length !== 1 ? "s" : ""} selected
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This plan will be available in: {newVPSPlan.selectedRegions.join(", ")}
          </p>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="plan-name" className="text-sm font-medium">
          Display Name <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="plan-name"
          placeholder={selectedType?.label || "e.g. Premium 4GB - Newark"}
          value={newVPSPlan.name}
          onChange={(e) =>
            setNewVPSPlan((prev) => ({ ...prev, name: e.target.value }))
          }
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to use the default plan name: {selectedType?.label}
        </p>
      </div>

      {/* Markup Price */}
      <div className="space-y-2">
        <Label htmlFor="plan-markup" className="text-sm font-medium">
          Markup (USD)
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="plan-markup"
            type="number"
            step="0.01"
            min={0}
            value={Number.isFinite(newVPSPlan.markupPrice) ? newVPSPlan.markupPrice : 0}
            onChange={(e) =>
              setNewVPSPlan((prev) => ({
                ...prev,
                markupPrice: Number(e.target.value) || 0,
              }))
            }
            className="h-11 pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Additional amount added on top of base price (${selectedType?.price.monthly || 0})
        </p>
      </div>

      {/* Backup Pricing Section */}
      <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Backup Pricing</h4>
          {selectedType?.backup_price_monthly && Number(selectedType.backup_price_monthly) > 0 && (
            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
              Auto-filled from provider
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Base Monthly (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder={selectedType?.backup_price_monthly 
                  ? `Default: $${(Number(selectedType.backup_price_monthly) || 0).toFixed(2)}`
                  : "0.00"}
                value={newVPSPlan.backupPriceMonthly}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setNewVPSPlan((prev) => ({
                      ...prev,
                      backupPriceMonthly: value,
                    }));
                  }
                }}
                className="h-10 pl-9"
              />
            </div>
            {selectedType?.backup_price_monthly && Number(selectedType.backup_price_monthly) > 0 && (
              <p className="text-xs text-muted-foreground">
                Provider default: ${(Number(selectedType.backup_price_monthly) || 0).toFixed(2)}/mo
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Base Hourly (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.000001"
                min={0}
                placeholder={selectedType?.backup_price_hourly
                  ? `Default: $${(Number(selectedType.backup_price_hourly) || 0).toFixed(6)}`
                  : "0.000000"}
                value={newVPSPlan.backupPriceHourly}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setNewVPSPlan((prev) => ({
                      ...prev,
                      backupPriceHourly: value,
                    }));
                  }
                }}
                className="h-10 pl-9"
              />
            </div>
            {selectedType?.backup_price_hourly && Number(selectedType.backup_price_hourly) > 0 && (
              <p className="text-xs text-muted-foreground">
                Provider default: ${(Number(selectedType.backup_price_hourly) || 0).toFixed(6)}/hr
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Your Upcharge Monthly (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                value={newVPSPlan.backupUpchargeMonthly}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    const numericValue = value === "" ? 0 : parseFloat(value) || 0;
                    setNewVPSPlan((prev) => ({
                      ...prev,
                      backupUpchargeMonthly: value,
                      backupUpchargeHourly: numericValue / 730,
                    }));
                  }
                }}
                className="h-10 pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Additional markup on backup service
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Upcharge Hourly (auto-calculated)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={`${((parseFloat(String(newVPSPlan.backupUpchargeMonthly)) || 0) / 730).toFixed(6)}`}
                disabled
                className="h-10 pl-9 bg-muted"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly ÷ 730 hours
            </p>
          </div>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Enable for customers</p>
          <p className="text-xs text-muted-foreground">
            Make this plan available for purchase
          </p>
        </div>
        <Switch
          checked={newVPSPlan.active}
          onCheckedChange={(checked) =>
            setNewVPSPlan((prev) => ({ ...prev, active: checked }))
          }
        />
      </div>
    </div>
  );

  const renderStep4 = () => {
    const finalPrice = (selectedType?.price.monthly || 0) + newVPSPlan.markupPrice;
    const backupTotal =
      (parseFloat(String(newVPSPlan.backupPriceMonthly)) || 0) +
      (parseFloat(String(newVPSPlan.backupUpchargeMonthly)) || 0);

    return (
      <div className="space-y-5">
        <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
          <h4 className="font-semibold text-lg mb-4">Plan Summary</h4>
          
          <div className="space-y-4">
            {/* Plan Info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="text-muted-foreground">Plan Name</div>
              <div className="font-medium">{newVPSPlan.name || selectedType?.label || "—"}</div>
              
              <div className="text-muted-foreground">Provider</div>
              <div className="font-medium">{selectedProvider?.name || "—"}</div>
              
              <div className="text-muted-foreground">Type Class</div>
              <div className="font-medium capitalize">{selectedType?.type_class?.replace(/_/g, " ") || "—"}</div>
            </div>

            <div className="h-px bg-border" />

            {/* Specifications */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-md bg-background p-3">
                <div className="text-lg font-bold text-primary">{selectedType?.vcpus || 0}</div>
                <div className="text-xs text-muted-foreground">vCPUs</div>
              </div>
              <div className="rounded-md bg-background p-3">
                <div className="text-lg font-bold text-primary">{selectedType?.memory || 0}</div>
                <div className="text-xs text-muted-foreground">MB RAM</div>
              </div>
              <div className="rounded-md bg-background p-3">
                <div className="text-lg font-bold text-primary">{Math.round((selectedType?.disk || 0) / 1024)}</div>
                <div className="text-xs text-muted-foreground">GB SSD</div>
              </div>
              <div className="rounded-md bg-background p-3">
                <div className="text-lg font-bold text-primary">{selectedType?.transfer || 0}</div>
                <div className="text-xs text-muted-foreground">GB Transfer</div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Price</span>
                <span>${(selectedType?.price.monthly || 0).toFixed(2)}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Markup</span>
                <span className="text-primary">+${newVPSPlan.markupPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Final Price</span>
                <span className="text-lg text-primary">${finalPrice.toFixed(2)}/mo</span>
              </div>
            </div>

            {/* Backup Pricing */}
            <div className="h-px bg-border" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Backup Pricing</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Backup</span>
                <span>${(parseFloat(String(newVPSPlan.backupPriceMonthly)) || 0).toFixed(2)}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Upcharge</span>
                <span className="text-primary">+${(parseFloat(String(newVPSPlan.backupUpchargeMonthly)) || 0).toFixed(2)}</span>
              </div>
              {backupTotal > 0 && (
                <div className="flex justify-between text-sm pt-1 border-t border-dashed">
                  <span className="text-muted-foreground">Total Backup</span>
                  <span className="font-medium">${backupTotal.toFixed(2)}/mo</span>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  newVPSPlan.active
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                )}
              >
                {newVPSPlan.active ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Create VPS Plan</DialogTitle>
          <DialogDescription>
            Configure a new VPS plan for your customers
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          {renderStepIndicator()}
        </div>

        <div className="px-6 pb-2 min-h-[340px] max-h-[50vh] overflow-y-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStep === 1) {
                handleClose();
              } else {
                setCurrentStep((prev) => prev - 1);
              }
            }}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={
                currentStep === 1
                  ? !canProceedToStep2
                  : currentStep === 2
                  ? !canProceedToStep3
                  : !canProceedToStep4
              }
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!newVPSPlan.selectedType}>
              <Check className="w-4 h-4 mr-1" />
              Create Plan
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
