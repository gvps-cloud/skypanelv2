import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Globe, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface VPSPlanRegionWizardPlan {
  id: string;
  name: string;
  type_class?: string;
  regions?: Array<{ region_id: string }>;
}

export interface VPSPlanRegionWizardRegion {
  id: string;
  label: string;
  country: string;
  capabilities: string[];
}

interface VPSPlanRegionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: VPSPlanRegionWizardPlan | null;
  regions: VPSPlanRegionWizardRegion[];
  initialSelectedRegions: string[];
  saving?: boolean;
  onSave: (regions: string[]) => Promise<void> | void;
}

const STEPS = [
  { id: 1, title: "Select Regions", icon: Globe },
  { id: 2, title: "Review", icon: Check },
];

const REGION_CAPABILITY_FILTER: Record<string, string | null> = {
  premium: "Premium Plans",
  gpu: "GPU Linodes",
  accelerated: "Accelerated",
};

const normalizeRegionId = (value: string): string => value.trim().toLowerCase();

const hasCapability = (
  region: VPSPlanRegionWizardRegion,
  capability: string | null,
): boolean => {
  if (!capability) return true;
  return region.capabilities.some(
    (item) => item.toLowerCase() === capability.toLowerCase(),
  );
};

export const filterRegionsByPlanType = (
  regions: VPSPlanRegionWizardRegion[],
  typeClass?: string,
): VPSPlanRegionWizardRegion[] => {
  const normalizedType = (typeClass || "").toLowerCase().trim();
  const requiredCapability = REGION_CAPABILITY_FILTER[normalizedType] ?? null;
  return regions.filter((region) => hasCapability(region, requiredCapability));
};

export function VPSPlanRegionWizard({
  open,
  onOpenChange,
  plan,
  regions,
  initialSelectedRegions,
  saving = false,
  onSave,
}: VPSPlanRegionWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;

    const unique = Array.from(
      new Set((initialSelectedRegions || []).map(normalizeRegionId)),
    );
    setCurrentStep(1);
    setSelectedRegions(unique);
  }, [initialSelectedRegions, open, plan?.id]);

  const filteredRegions = useMemo(
    () => filterRegionsByPlanType(regions, plan?.type_class),
    [plan?.type_class, regions],
  );

  const filteredRegionSet = useMemo(
    () => new Set(filteredRegions.map((region) => normalizeRegionId(region.id))),
    [filteredRegions],
  );

  const selectedCount = useMemo(
    () => selectedRegions.filter((regionId) => filteredRegionSet.has(regionId)).length,
    [filteredRegionSet, selectedRegions],
  );

  const reviewRows = useMemo(
    () =>
      filteredRegions.filter((region) =>
        selectedRegions.includes(normalizeRegionId(region.id)),
      ),
    [filteredRegions, selectedRegions],
  );

  const canProceedToReview = selectedCount > 0;
  const canSave = reviewRows.length > 0 && !saving && Boolean(plan?.id);

  const handleToggleRegion = (regionId: string, checked: boolean) => {
    const normalizedRegionId = normalizeRegionId(regionId);
    setSelectedRegions((current) => {
      if (checked) {
        return Array.from(new Set([...current, normalizedRegionId]));
      }
      return current.filter((item) => item !== normalizedRegionId);
    });
  };

  const handleSelectAll = () => {
    setSelectedRegions(filteredRegions.map((region) => normalizeRegionId(region.id)));
  };

  const handleClearAll = () => {
    setSelectedRegions([]);
  };

  const handleSave = async () => {
    if (!plan?.id || !canSave) return;
    await onSave(selectedRegions);
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-5 h-0.5 w-10 transition-colors",
                  currentStep > step.id ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderRegionList = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Available Regions</Label>
        <p className="text-xs text-muted-foreground">
          Choose where this plan can be provisioned after creation.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={filteredRegions.length === 0 || saving}
        >
          Select All ({filteredRegions.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={selectedCount === 0 || saving}
        >
          Clear All
        </Button>
      </div>

      <div
        className="h-[260px] overflow-y-scroll rounded-lg border bg-background pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {filteredRegions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No regions are available for this plan type.
          </div>
        ) : (
          <div className="divide-y">
            {filteredRegions.map((region) => {
              const normalizedRegionId = normalizeRegionId(region.id);
              const checked = selectedRegions.includes(normalizedRegionId);

              return (
                <div
                  key={region.id}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id={`edit-plan-region-${region.id}`}
                    checked={checked}
                    onCheckedChange={(next) =>
                      handleToggleRegion(region.id, Boolean(next))
                    }
                    disabled={saving}
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`edit-plan-region-${region.id}`}
                      className="cursor-pointer font-medium"
                    >
                      {region.label}
                    </Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {region.id}
                      </Badge>
                      {region.country && (
                        <Badge variant="outline" className="text-xs">
                          {region.country}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-primary/5 p-3">
        <p className="text-sm font-medium">
          {selectedCount} region{selectedCount === 1 ? "" : "s"} selected
        </p>
        <p className="text-xs text-muted-foreground">
          Customers will only see this plan in selected regions.
        </p>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Review Changes</Label>
        <p className="text-xs text-muted-foreground">
          Confirm the final region list for{" "}
          <span className="font-medium text-foreground">{plan?.name || "this plan"}</span>.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          Selected Regions ({reviewRows.length})
        </div>
        {reviewRows.length === 0 ? (
          <p className="text-xs text-destructive">
            Select at least one region before saving.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {reviewRows.map((region) => (
              <Badge key={region.id} variant="secondary">
                {region.id}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && saving) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="px-6 pb-2 pt-6">
          <DialogTitle>Edit Plan Regions</DialogTitle>
          <DialogDescription>
            Update where customers can provision{" "}
            <span className="font-medium text-foreground">{plan?.name || "this VPS plan"}</span>.
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <ScrollArea className="min-h-[320px] max-h-[56vh] px-6 pb-2">
          {currentStep === 1 ? renderRegionList() : renderReview()}
        </ScrollArea>

        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStep === 1) {
                onOpenChange(false);
              } else {
                setCurrentStep(1);
              }
            }}
            disabled={saving}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep === 1 ? (
            <Button
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedToReview || saving}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!canSave}>
              <Check className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save Regions"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
