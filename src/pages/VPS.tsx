/**
 * VPS Management Page
 * Handles VPS instance creation, management, and monitoring
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { useLocation, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Search,
  DollarSign,
  Layers3,
  Check,
  Power,
  PowerOff,
  Copy,
  Trash2,
  RotateCcw,
  Server,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { ProviderType } from "@/types/provider";
import type { CreateVPSForm, VPSInstance } from "@/types/vps";
import { useAuth } from "@/contexts/AuthContext";
import { useEnabledCategoryMappings } from "@/hooks/useCategoryMappings";
import { useFormPersistence } from "@/hooks/use-form-persistence";
import { useMobileNavigation } from "@/hooks/use-mobile-navigation";
import { useMobilePerformance } from "@/hooks/use-mobile-performance";
import { useMobileToast } from "@/components/ui/mobile-toast";
import {
  MobileLoading,
  useMobileLoading,
} from "@/components/ui/mobile-loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogStack } from "@/components/ui/dialog-stack";
import { VpsInstancesTable } from "@/components/VPS/VpsTable";
import { BulkDeleteModal } from "@/components/VPS/BulkDeleteModal";
import { generateUniqueVPSLabel } from "@/lib/vpsLabelGenerator";
import { ProviderSelector } from "@/components/VPS/ProviderSelector";
import { CreateVPSSteps } from "@/components/VPS/CreateVPSSteps";
import { RegionAccordionSelect } from "@/components/VPS/RegionAccordionSelect";
import { RegionMultiSelect } from "@/components/VPS/RegionMultiSelect";
import { PlanAccordionSelect, PlanSummary, type VPSPlan } from "@/components/VPS/PlanAccordionSelect";
import {
  getActiveSteps,
  getCurrentStepDisplay,
  getNextStep,
  getPreviousStep,
  type StepConfiguration,
} from "@/lib/vpsStepConfiguration";
import { paymentService } from "@/services/paymentService";
import { formatCurrency, formatGigabytes } from "@/lib/formatters";
import { VALID_ORIGINAL_CATEGORIES, type OriginalCategory } from "@/types/categoryMappings";

interface ProviderPlan {
  id: string;
  label: string;
  disk: number;
  memory: number;
  vcpus: number;
  transfer: number;
  region?: string;
  provider_id?: string;
  type_class?: string;
  price: {
    hourly: number;
    monthly: number;
  };
}

interface ProviderOption {
  id: string;
  name: string;
  type: ProviderType;
}

interface RegionOption {
  id: string;
  label: string;
  country?: string;
}

interface CreateRegionOption extends RegionOption {
  capabilities?: string[];
}

const DEFAULT_CATEGORY_LABELS: Record<OriginalCategory, string> = {
  standard: "Standard",
  nanode: "Nanode",
  dedicated: "Dedicated CPU",
  premium: "Premium",
  highmem: "High Memory",
  gpu: "GPU",
  accelerated: "Accelerated",
};

const CATEGORY_VARIANT_LABELS: Record<OriginalCategory, string> = {
  standard: "Shared CPU",
  nanode: "Basic VPS",
  dedicated: "Dedicated CPU",
  premium: "Premium Performance",
  highmem: "High Memory",
  gpu: "GPU",
  accelerated: "Accelerated",
};

const DEFAULT_CATEGORY_DESCRIPTIONS: Record<OriginalCategory, string> = {
  standard:
    "Standard VPS plans offer a good mix of performance, resources, and price for most workloads.",
  nanode:
    "Affordable entry-level plans perfect for testing, development, and lightweight applications.",
  dedicated:
    "Dedicated CPU plans give you full access to CPU cores for consistent performance.",
  premium:
    "Premium plans offer the latest high-performance CPUs with consistent performance for demanding workloads.",
  highmem:
    "High Memory plans favor RAM over other resources, great for caching and in-memory databases.",
  gpu: "GPU plans include dedicated GPUs for machine learning, AI, and video transcoding workloads.",
  accelerated:
    "Accelerated plans provide enhanced performance for I/O-intensive workloads.",
};

const getCategoryAvailabilityNote = (typeClass?: string): string => {
  if (typeClass === "premium" || typeClass === "gpu") {
    return "Available in select regions only.";
  }

  return "";
};

const CATEGORY_DISPLAY_ORDER: OriginalCategory[] = [
  "nanode",
  "standard",
  "dedicated",
  "premium",
  "highmem",
  "gpu",
  "accelerated",
];

const VPS: React.FC = () => {
  const [instances, setInstances] = useState<VPSInstance[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshingInstances, setIsRefreshingInstances] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRegionFilters, setSelectedRegionFilters] = useState<string[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<VPSInstance[]>([]);
  const [selectedRowSelection, setSelectedRowSelection] =
    useState<RowSelectionState>({});
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [activeSteps, setActiveSteps] = useState<StepConfiguration[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    id: string;
    label: string;
    input: string;
    password: string;
    twoFactorCode: string;
    confirmCheckbox: boolean;
    loading: boolean;
    error: string;
  }>({
    open: false,
    id: "",
    label: "",
    input: "",
    password: "",
    twoFactorCode: "",
    confirmCheckbox: false,
    loading: false,
    error: "",
  });
  // Form persistence for mobile users
  const {
    data: createForm,
    updateData: setCreateForm,
    save: saveForm,
    clear: _clearForm,
    handleSubmit: handleFormSubmit,
    isDirty: isFormDirty,
    lastSaved,
  } = useFormPersistence<CreateVPSForm>(
    {
      provider_id: "",
      provider_type: "linode" as ProviderType,
      label: "",
      type: "",
      type_class: "standard",
      region: "",
      image: "",
      rootPassword: "",
      sshKeys: [],
      backups: false,
      privateIP: false,
    },
    {
      key: "vps-creation",
      debounceMs: 1000,
      autoSave: true,
      clearOnSubmit: true,
    },
  );
  const { token, user } = useAuth();
  const { data: enabledCategoryMappings } = useEnabledCategoryMappings();
  const location = useLocation();
  const navigate = useNavigate();
  const hasLoadedInstancesRef = useRef(false);

  // Mobile navigation handling
  const { setModalOpen, goBack: _goBack } = useMobileNavigation({
    onBackButton: () => {
      if (showCreateModal) {
        if (isFormDirty) {
          const shouldSave = window.confirm(
            "You have unsaved changes. Would you like to save your progress before going back?",
          );
          if (shouldSave) {
            saveForm();
          }
        }
        setShowCreateModal(false);
        setCreateStep(1);
        return true; // Prevent default back navigation
      }
      return false; // Allow default back navigation
    },
    preventBackOnModal: true,
    confirmBeforeBack: false,
  });

  // Mobile-optimized hooks
  const mobileToast = useMobileToast();
  const mobileLoading = useMobileLoading();
  const { measureRenderTime, getOptimizedSettings } = useMobilePerformance();
  const optimizedSettings = getOptimizedSettings;

  // Performance monitoring
  const endRenderMeasurement = measureRenderTime("VPS");

  const [providerPlans, setProviderPlans] = useState<ProviderPlan[]>([]);
  const [providerImages, setProviderImages] = useState<any[]>([]);
  const [providerStackScripts, setProviderStackScripts] = useState<any[]>([]);
  const [createRegionOptions, setCreateRegionOptions] = useState<CreateRegionOption[]>([]);
  const [createRegionsLoading, setCreateRegionsLoading] = useState(false);
  const [createRegionsError, setCreateRegionsError] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [regionSearch] = useState("");
  const [planSearch] = useState("");
  const [selectedStackScript, setSelectedStackScript] = useState<any | null>(
    null,
  );
  const [stackscriptData, setStackscriptData] = useState<Record<string, any>>(
    {},
  );
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  // Rate limiting for label regeneration
  const [labelRegenerationTimestamps, setLabelRegenerationTimestamps] = useState<number[]>([]);
  // OS selection redesign: tabs, grouping, and per-OS version selection
  const [osTab, setOsTab] = useState<"templates" | "iso">("templates");
  const [selectedOSGroup, setSelectedOSGroup] = useState<string | null>(null);
  const [selectedOSVersion, setSelectedOSVersion] = useState<
    Record<string, string>
  >({});

  const deploymentConfigRequired = useMemo(() => {
    if (!selectedStackScript) return false;
    const fields = Array.isArray(selectedStackScript.user_defined_fields)
      ? selectedStackScript.user_defined_fields
      : [];
    return fields.length > 0;
  }, [selectedStackScript]);

  const hasValidProviderSelection = useMemo(() => {
    if (!createForm.provider_id) return false;
    return providerOptions.some(
      (provider) => provider.id === createForm.provider_id,
    );
  }, [createForm.provider_id, providerOptions]);

  // Group provider images into distributions with versions for cleaner selection cards
  const osGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        name: string;
        key: string;
        versions: Array<{ id: string; label: string }>;
      }
    > = {};
    const add = (key: string, name: string, id: string, label: string) => {
      if (!groups[key]) groups[key] = { key, name, versions: [] };
      groups[key].versions.push({ id, label });
    };
    (providerImages || []).forEach((img: any) => {
      const id: string = img.id || "";
      const label: string = img.label || id;
      const lower = `${id} ${label}`.toLowerCase();
      // Exclude non-OS entries like Kubernetes/LKE from OS selection
      if (/(^|\s)(kubernetes|lke|k8s)(\s|$)/i.test(lower)) {
        return;
      }
      if (lower.includes("ubuntu")) add("ubuntu", "Ubuntu", id, label);
      else if (lower.includes("centos")) add("centos", "CentOS", id, label);
      else if (lower.includes("alma")) add("almalinux", "AlmaLinux", id, label);
      else if (lower.includes("rocky"))
        add("rockylinux", "Rocky Linux", id, label);
      else if (lower.includes("debian")) add("debian", "Debian", id, label);
      else if (lower.includes("fedora")) add("fedora", "Fedora", id, label);
      else if (lower.includes("alpine")) add("alpine", "Alpine", id, label);
      else if (lower.includes("arch")) add("arch", "Arch Linux", id, label);
      else if (lower.includes("opensuse"))
        add("opensuse", "openSUSE", id, label);
      else if (lower.includes("gentoo")) add("gentoo", "Gentoo", id, label);
      else if (lower.includes("slackware"))
        add("slackware", "Slackware", id, label);
    });
    // Sort versions descending by numeric parts in label to prefer latest first
    Object.values(groups).forEach((g) => {
      g.versions.sort((a, b) =>
        b.label.localeCompare(a.label, undefined, { numeric: true }),
      );
    });
    return groups;
  }, [providerImages]);

  // Strip vendor/brand prefix from image IDs to get the base ID for comparison
  // e.g. "linode/ubuntu22.04" → "ubuntu22.04", "SkyPanelV2/ubuntu22.04" → "ubuntu22.04"
  const baseImageId = (id: string) => id.includes("/") ? id.slice(id.indexOf("/") + 1) : id;

  // Constrain visible OS versions when a StackScript specifies allowed base images
  const effectiveOsGroups = useMemo(() => {
    const allowed = Array.isArray(selectedStackScript?.images)
      ? (selectedStackScript!.images as string[])
      : [];
    if (!selectedStackScript) return osGroups;
    // Normalize both sides: StackScript images use "linode/..." prefix, provider images use branded prefix
    const knownBaseIds = new Map(
      (providerImages || []).map((i: any) => [baseImageId(i.id), i.id]),
    );
    const allowedKnown = allowed
      .map((id: string) => knownBaseIds.get(baseImageId(id)))
      .filter((id): id is string => id !== undefined);
    // If the StackScript allows any/all (no specific known image IDs), show all OS groups
    if (allowed.length === 0 || allowedKnown.length === 0) return osGroups;
    const allowedSet = new Set(allowedKnown);
    const filtered: typeof osGroups = {} as any;
    Object.entries(osGroups).forEach(([key, group]) => {
      const versions = group.versions.filter((v) => allowedSet.has(v.id));
      if (versions.length > 0) filtered[key] = { ...group, versions };
    });
    return filtered;
  }, [osGroups, selectedStackScript, providerImages]);

  // Display helper for StackScript allowed images (falls back to Any Linux distribution)
  const allowedImagesDisplay = useMemo(() => {
    if (!selectedStackScript) return "";
    const allowed = Array.isArray(selectedStackScript.images)
      ? (selectedStackScript.images as string[])
      : [];
    const byBaseId = new Map(
      (providerImages || []).map((img: any) => [baseImageId(img.id), img.label || img.id]),
    );
    const knownLabels = allowed
      .map((id) => byBaseId.get(baseImageId(id)))
      .filter((label): label is string => label !== undefined);
    if (allowed.length === 0 || knownLabels.length === 0)
      return "Any Linux distribution";
    return knownLabels.join(", ");
  }, [selectedStackScript, providerImages]);

  const normalizeProviderType = useCallback((value: unknown): ProviderType => {
    const raw = typeof value === "string" ? value.toLowerCase() : "";
    if (raw === "linode") {
      return raw as ProviderType;
    }
    return "linode";
  }, []);

  const ensureCreateLabel = useCallback(() => {
    if (createForm.label.trim().length > 0) {
      return;
    }

    const existingLabels = instances.map((instance) => instance.label);
    const uniqueLabel = generateUniqueVPSLabel("vps", existingLabels);
    setCreateForm({ label: uniqueLabel });
  }, [createForm.label, instances, setCreateForm]);

  const openCreateModal = useCallback(() => {
    setCreateStep(1);
    ensureCreateLabel();
    setShowCreateModal(true);
  }, [ensureCreateLabel]);

  const loadProviderOptions = useCallback(async () => {
    if (!token) {
      setProviderOptions([]);
      return;
    }

    try {
      const response = await fetch("/api/vps/providers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load providers");
      }

      const providersRaw = Array.isArray(data.providers) ? data.providers : [];

      const normalized: ProviderOption[] = providersRaw.map((provider: any) => {
        const type = normalizeProviderType(provider?.type);
        const configuredName =
          typeof provider?.name === "string" && provider.name.trim().length > 0
            ? provider.name.trim()
            : "Configured Provider";
        return {
          id: String(provider?.id ?? ""),
          name: configuredName,
          type,
        };
      });

      setProviderOptions(normalized);
    } catch (error: any) {
      console.error("Failed to load providers:", error);
      toast.error(error?.message || "Failed to load providers");
      setProviderOptions([]);
    }
  }, [normalizeProviderType, token]);

  const loadProviderRegions = useCallback(
    async (providersList: ProviderOption[]) => {
      if (providersList.length === 0) {
        setRegionOptions([]);
        return;
      }

      const supportedTypes = new Set<ProviderType>(["linode"]);
      const aggregate = new Map<
        string,
        {
          label: string;
          country?: string;
        }
      >();

      const tasks = providersList
        .filter((provider) => supportedTypes.has(provider.type))
        .map(async (provider) => {
          try {
            const response = await fetch(
              `/api/vps/providers/${provider.id}/regions`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(
                data.error ||
                  "Failed to load regions for the selected provider",
              );
            }

            const regions = Array.isArray(data.regions) ? data.regions : [];
            regions.forEach((region: any) => {
              if (!region) return;
              const slugRaw = typeof region.id === "string" ? region.id : "";
              const slug = slugRaw.trim();
              if (!slug) return;

              const baseLabel =
                typeof region.label === "string" &&
                region.label.trim().length > 0
                  ? region.label.trim()
                  : slug;
              const country =
                typeof region.country === "string" ? region.country : "";

              const existing = aggregate.get(slug);
              if (existing) {
                if (!existing.country && country) {
                  existing.country = country;
                }
                if (!existing.label && baseLabel) {
                  existing.label = baseLabel;
                }
              } else {
                aggregate.set(slug, {
                  label: baseLabel,
                  country,
                });
              }
            });
          } catch (error) {
            console.error(
              `Failed to load regions for provider ${provider.id}`,
              error,
            );
          }
        });

      if (tasks.length === 0) {
        setRegionOptions([]);
        return;
      }

      await Promise.allSettled(tasks);

      const combined: RegionOption[] = Array.from(aggregate.entries()).map(
        ([id, info]) => ({
          id,
          label: info.label,
          country: info.country,
        }),
      );

      combined.sort((a, b) => a.label.localeCompare(b.label));
      setRegionOptions(combined);
    },
    [token],
  );

  useEffect(() => {
    loadProviderOptions();
  }, [loadProviderOptions]);

  useEffect(() => {
    if (providerOptions.length === 0) {
      setRegionOptions([]);
      return;
    }
    loadProviderRegions(providerOptions);
  }, [providerOptions, loadProviderRegions]);

  useEffect(() => {
    if (providerOptions.length === 0) {
      return;
    }

    if (hasValidProviderSelection) {
      return;
    }

    const normalizedType = normalizeProviderType(createForm.provider_type);
    const fallback =
      providerOptions.find((provider) => provider.type === normalizedType) ??
      providerOptions.find((provider) => provider.type === "linode") ??
      providerOptions[0];

    if (!fallback) {
      return;
    }

    setCreateForm({
      provider_id: fallback.id,
      provider_type: fallback.type,
      type: "",
      region: "",
    });
  }, [
    providerOptions,
    hasValidProviderSelection,
    normalizeProviderType,
    createForm.provider_type,
    setCreateForm,
  ]);

  useEffect(() => {
    if (selectedRegionFilters.length === 0) {
      return;
    }
    // Remove any selected regions that no longer exist in regionOptions
    const validRegionIds = new Set(regionOptions.map((r) => r.id));
    const invalidIds = selectedRegionFilters.filter((id) => !validRegionIds.has(id));
    if (invalidIds.length > 0) {
      setSelectedRegionFilters((prev) => prev.filter((id) => validRegionIds.has(id)));
    }
  }, [regionOptions, selectedRegionFilters]);

  useEffect(() => {
    const fetchCreateRegions = async () => {
      if (!createForm.provider_id || !token) {
        setCreateRegionOptions([]);
        setCreateRegionsError(null);
        setCreateRegionsLoading(false);
        return;
      }

      setCreateRegionsLoading(true);
      setCreateRegionsError(null);

      try {
        const url = createForm.type_class
          ? `/api/vps/providers/${createForm.provider_id}/regions?type_class=${encodeURIComponent(createForm.type_class)}`
          : `/api/vps/providers/${createForm.provider_id}/regions`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Failed to load regions");
        }

        const regions = Array.isArray(data.regions) ? data.regions : [];
        const normalizedRegions: CreateRegionOption[] = regions
          .map((region: any) => ({
            id: String(region?.id ?? ""),
            label:
              typeof region?.label === "string" && region.label.trim().length > 0
                ? region.label.trim()
                : String(region?.id ?? ""),
            country:
              typeof region?.country === "string" && region.country.trim().length > 0
                ? region.country.trim()
                : undefined,
            capabilities: Array.isArray(region?.capabilities)
              ? region.capabilities.filter((capability: unknown) => typeof capability === "string")
              : undefined,
          }))
          .filter((region) => region.id);

        setCreateRegionOptions(normalizedRegions);
      } catch (error: any) {
        console.error("Failed to load create-step regions:", error);
        setCreateRegionOptions([]);
        setCreateRegionsError(error?.message || "Failed to load regions");
      } finally {
        setCreateRegionsLoading(false);
      }
    };

    fetchCreateRegions();
  }, [createForm.provider_id, createForm.type_class, token]);

  // Sync default selection to current form image when images load
  useEffect(() => {
    if (!providerImages || providerImages.length === 0) return;
    const current = providerImages.find((i: any) => i.id === createForm.image);
    const src = `${createForm.image} ${current?.label || ""}`.toLowerCase();
    const key = src.includes("ubuntu")
      ? "ubuntu"
      : src.includes("centos")
        ? "centos"
        : src.includes("alma")
          ? "almalinux"
          : src.includes("rocky")
            ? "rockylinux"
            : src.includes("debian")
              ? "debian"
              : src.includes("fedora")
                ? "fedora"
                : src.includes("alpine")
                  ? "alpine"
                  : src.includes("arch")
                    ? "arch"
                    : null;
    if (key) {
      setSelectedOSGroup((prev) => prev || key);
      setSelectedOSVersion((prev) => ({ ...prev, [key]: createForm.image }));
    }
  }, [providerImages, createForm.image]);

  const allowedRegions = useMemo(
    () =>
      regionOptions.map((region) => ({
        id: region.id,
        label: region.label,
      })),
    [regionOptions],
  );

  // Initialize StackScript data defaults when a script is selected
  useEffect(() => {
    if (
      selectedStackScript &&
      Array.isArray(selectedStackScript.user_defined_fields)
    ) {
      const initial: Record<string, any> = {};
      selectedStackScript.user_defined_fields.forEach((f: any) => {
        if (
          f &&
          typeof f.default !== "undefined" &&
          f.default !== null &&
          String(f.default).length > 0
        ) {
          initial[f.name] = f.default;
        }
      });
      setStackscriptData(initial);
    } else {
      setStackscriptData({});
    }
  }, [selectedStackScript]);

  // Auto-select a compatible image when choosing a StackScript
  useEffect(() => {
    if (!selectedStackScript) return;
    const allowed = Array.isArray(selectedStackScript.images)
      ? (selectedStackScript.images as string[])
      : [];
    // Normalize: map base IDs to branded provider image IDs
    const knownByBase = new Map(
      (providerImages || []).map((i: any) => [baseImageId(i.id), i.id]),
    );
    const allowedKnown = allowed
      .map((id) => knownByBase.get(baseImageId(id)))
      .filter((id): id is string => id !== undefined);
    // If unrestricted (any/all), don't force-change the current image
    if (allowed.length === 0 || allowedKnown.length === 0) return;
    const current = createForm.image;
    const isAllowed = current && allowedKnown.includes(current);
    const pick = isAllowed ? current : allowedKnown[0];
    if (pick && pick !== current) {
      setCreateForm({ image: pick });
      const src = pick.toLowerCase();
      const key = src.includes("ubuntu")
        ? "ubuntu"
        : src.includes("centos")
          ? "centos"
          : src.includes("alma")
            ? "almalinux"
            : src.includes("rocky")
              ? "rockylinux"
              : src.includes("debian")
                ? "debian"
                : src.includes("fedora")
                  ? "fedora"
                  : src.includes("alpine")
                    ? "alpine"
                    : src.includes("arch")
                      ? "arch"
                      : src.includes("opensuse")
                        ? "opensuse"
                        : src.includes("gentoo")
                          ? "gentoo"
                          : src.includes("slackware")
                            ? "slackware"
                            : null;
      if (key) {
        setSelectedOSGroup(key);
        setSelectedOSVersion((prev) => ({ ...prev, [key]: pick }));
      }
    }
  }, [selectedStackScript, providerImages, createForm.image, setCreateForm]);

  const loadVPSPlans = useCallback(async () => {
    if (!token) return;
    try {
      let plansUrl = "/api/vps/plans";

      // If provider, region, and type_class are selected, use the new region-filtered endpoint
      if (createForm.provider_id && createForm.region && createForm.type_class) {
        plansUrl = `/api/vps/providers/${createForm.provider_id}/plans/${createForm.region}?type_class=${createForm.type_class}`;
      }

      const res = await fetch(plansUrl, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const plansPayload = await res.json();
      if (!res.ok) throw new Error(plansPayload.error || "Failed to load VPS plans");

      // Map admin plans to ProviderPlan format
      const mappedPlans: ProviderPlan[] = (plansPayload.plans || []).map(
        (plan: any) => {
          const specs = plan.specifications || {};
          const basePrice = Number(plan.base_price || 0);
          const markupPrice = Number(plan.markup_price || 0);
          const totalPrice = basePrice + markupPrice;

          // Normalize spec fields from various sources
          const disk =
            (typeof specs.disk === "number" ? specs.disk : undefined) ??
            (typeof specs.storage_gb === "number"
              ? specs.storage_gb
              : undefined) ??
            0;

          const memoryMb =
            (typeof specs.memory === "number" ? specs.memory : undefined) ??
            (typeof specs.memory_gb === "number"
              ? specs.memory_gb * 1024
              : undefined) ??
            0;

          const vcpus =
            (typeof specs.vcpus === "number" ? specs.vcpus : undefined) ??
            (typeof specs.cpu_cores === "number"
              ? specs.cpu_cores
              : undefined) ??
            0;

          const transferGb =
            (typeof specs.transfer === "number" ? specs.transfer : undefined) ??
            (typeof specs.transfer_gb === "number"
              ? specs.transfer_gb
              : undefined) ??
            (typeof specs.bandwidth_gb === "number"
              ? specs.bandwidth_gb
              : undefined) ??
            0;

          const region = plan.region_id || specs.region || "";
          const typeClass =
            (typeof plan.type_class === "string" && plan.type_class.trim().length > 0
              ? plan.type_class
              : typeof specs.type_class === "string" && specs.type_class.trim().length > 0
                ? specs.type_class
                : "standard");

          return {
            id: String(plan.id),
            label: `${plan.name} - $${totalPrice.toFixed(2)}/mo`,
            disk: disk,
            memory: memoryMb,
            vcpus: vcpus,
            transfer: transferGb,
            region,
            provider_id: plan.provider_id,
            type_class: typeClass,
            price: {
              hourly: totalPrice / 730,
              monthly: totalPrice,
            },
          };
        },
      );

      setProviderPlans(mappedPlans);
    } catch (error: any) {
      console.error("Failed to load VPS plans:", error);
      toast.error(error.message || "Failed to load VPS plans");
    }
  }, [token, createForm.provider_id, createForm.region, createForm.type_class]);

  const loadProviderImages = useCallback(async () => {
    if (!token || !createForm.provider_id) {
      setProviderImages([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/vps/images?provider_id=${encodeURIComponent(createForm.provider_id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load images");
      setProviderImages(payload.images || []);
    } catch (error: any) {
      console.error("Failed to load provider images:", error);
      toast.error(error.message || "Failed to load images");
    }
  }, [token, createForm.provider_id]);

  const loadProviderStackScripts = useCallback(async () => {
    if (!token) return;
    try {
      // Load admin-configured StackScripts for 1-Click deployments
      const res = await fetch("/api/vps/stackscripts?configured=true", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Failed to load stack scripts");

      const scripts = Array.isArray(payload.stackscripts)
        ? payload.stackscripts
        : [];
      const uniqueScripts = Array.from(
        new Map(
          scripts.map((script: any) => [
            String(script?.id ?? script?.label ?? Math.random()),
            script,
          ]),
        ).values(),
      );
      setProviderStackScripts(uniqueScripts);

      // Auto-select ssh-key script as default (but display as "None")
      const sshKeyScript = scripts.find(
        (script) =>
          script.label === "ssh-key" ||
          script.id === "ssh-key" ||
          (script.label && script.label.toLowerCase().includes("ssh")),
      );

      if (sshKeyScript) {
        setSelectedStackScript(sshKeyScript);
      }
    } catch (error: any) {
      console.error("Failed to load 1-Click deployments:", error);
      toast.error(error.message || "Failed to load deployments");
    }
  }, [token]);

  const loadInstances = useCallback(async (options?: { background?: boolean }) => {
    if (!token) {
      setInstances([]);
      setInitialLoading(false);
      setIsRefreshingInstances(false);
      return;
    }

    const background = options?.background ?? hasLoadedInstancesRef.current;

    if (background) {
      setIsRefreshingInstances(true);
    } else {
      setInitialLoading(true);
    }

    try {
      const res = await fetch("/api/vps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload.error || "Failed to load VPS instances");

      const clampPercent = (value: unknown): number | null => {
        if (value === null || typeof value === "undefined") return null;
        const numeric = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(numeric)) return null;
        if (numeric < 0) return 0;
        if (numeric > 100) return 100;
        return numeric;
      };

      const mapped: VPSInstance[] = (payload.instances || []).map((i: any) => {
        // Prefer API-provided plan specs/pricing; fallback to loaded plans; else zeros
        const apiSpecs = i.plan_specs || null;
        const apiPricing = i.plan_pricing || null;
        const providerType =
          (i.provider_type as ProviderType | undefined) ?? "linode";
        const providerName =
          typeof i.provider_name === "string" &&
          i.provider_name.trim().length > 0
            ? i.provider_name
            : typeof i.providerName === "string" &&
                i.providerName.trim().length > 0
              ? i.providerName
              : null;
        const providerId =
          typeof i.provider_id === "string" ? i.provider_id : null;
        const planForType = providerPlans.find(
          (t) => t.id === (i.configuration?.type || ""),
        );
        const specs = apiSpecs
          ? {
              vcpus: Number(apiSpecs.vcpus || 0),
              memory: Number(apiSpecs.memory || 0),
              disk: Number(apiSpecs.disk || 0),
              transfer: Number(apiSpecs.transfer || 0),
            }
          : planForType
            ? {
                vcpus: planForType.vcpus,
                memory: planForType.memory,
                disk: planForType.disk,
                transfer: planForType.transfer,
              }
            : { vcpus: 0, memory: 0, disk: 0, transfer: 0 };
        const pricing = apiPricing
          ? {
              hourly: Number(apiPricing.hourly || 0),
              monthly: Number(apiPricing.monthly || 0),
            }
          : planForType
            ? {
                hourly: planForType.price.hourly,
                monthly: planForType.price.monthly,
              }
            : { hourly: 0, monthly: 0 };
        const rawProgress =
          i &&
          typeof i.provider_progress === "object" &&
          i.provider_progress !== null
            ? i.provider_progress
            : null;
        const percentFromEvent = rawProgress
          ? clampPercent(rawProgress.percent)
          : null;
        const percentFromRow = clampPercent(i?.progress_percent);
        const progress =
          rawProgress || percentFromRow !== null
            ? {
                percent: percentFromEvent ?? percentFromRow,
                action: rawProgress?.action ?? null,
                status: rawProgress?.status ?? null,
                message: rawProgress?.message ?? null,
                created: rawProgress?.created ?? null,
              }
            : undefined;
        // Normalize status: treat provider 'offline' as 'stopped' for UI/actions
        const normalizedStatus =
          ((i.status as any) || "provisioning") === "offline"
            ? "stopped"
            : (i.status as any) || "provisioning";
        const instance: VPSInstance = {
          id: String(i.id),
          label: i.label,
          status: normalizedStatus,
          type: i.configuration?.type || "",
          region: i.configuration?.region || "",
          regionLabel: i.region_label || undefined,
          image: i.configuration?.image || "",
          ipv4: i.ip_address ? [i.ip_address] : [],
          ipv6: "",
          created: i.created_at,
          provider_id: providerId,
          provider_type: providerType,
          providerName,
          specs,
          stats: {
            cpu: 0,
            memory: 0,
            disk: 0,
            network: { in: 0, out: 0 },
            uptime: "",
          },
          pricing,
          progress: progress ?? undefined,
          planName: i.plan_name || null,
        };
        return instance;
      });

      setInstances(mapped);
      hasLoadedInstancesRef.current = true;
    } catch (error: any) {
      console.error("Failed to load VPS instances:", error);
      toast.error(error.message || "Failed to load VPS instances");
    } finally {
      if (background) {
        setIsRefreshingInstances(false);
      } else {
        setInitialLoading(false);
      }
    }
  }, [token, providerPlans]);

  useEffect(() => {
    loadVPSPlans();
  }, [loadVPSPlans]);

  useEffect(() => {
    hasLoadedInstancesRef.current = false;
    setInitialLoading(Boolean(token));
  }, [token]);

  useEffect(() => {
    if (!token || hasLoadedInstancesRef.current) {
      return;
    }

    loadInstances({ background: false });
  }, [token, loadInstances]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("create") !== "1") {
      return;
    }

    openCreateModal();

    searchParams.delete("create");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: "/vps",
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.search, navigate, openCreateModal]);

  // Adaptive polling: always refresh instances for live status
  // Uses faster interval (10s) for transitioning states, slower (30s) for stable states
  useEffect(() => {
    const hasTransitioning = instances.some(
      (i) => i.status === "provisioning" || i.status === "rebooting" || i.status === "restoring" || i.status === "backing_up",
    );
    const pollingInterval = hasTransitioning ? 10000 : 30000; // 10s for transitioning, 30s for stable

    const interval = setInterval(() => {
      loadInstances({ background: true });
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [instances, loadInstances]);

  // Calculate active steps for the provider workflow
  useEffect(() => {
    const steps = getActiveSteps({
      providerType: createForm.provider_type,
      formData: createForm,
      hasDeploymentConfig: deploymentConfigRequired,
    });

    setActiveSteps(steps);
  }, [createForm.provider_type, createForm, deploymentConfigRequired]);

  useEffect(() => {
    if (activeSteps.length === 0) return;
    const isActive = activeSteps.some(
      (step) => step.originalStepNumber === createStep,
    );
    if (!isActive) {
      const fallback = activeSteps[0]?.originalStepNumber ?? 1;
      setCreateStep(fallback);
    }
  }, [activeSteps, createStep]);

  // Load images and stack scripts when create modal opens
  useEffect(() => {
    if (showCreateModal) {
      loadProviderImages();
      loadProviderStackScripts();
      setModalOpen(true);

      // Preload critical assets for better UX
      // Protected API endpoints require auth headers, so skip preload hints here to avoid 401s.
    } else {
      setModalOpen(false);
    }
  }, [
    showCreateModal,
    loadProviderImages,
    loadProviderStackScripts,
    setModalOpen,
  ]);

  // Marketplace installs are removed — only account-owned StackScripts are supported

  // Performance measurement cleanup - run once on mount
  useEffect(() => {
    const cleanup = endRenderMeasurement;
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstanceAction = async (
    instanceId: string,
    action: "boot" | "shutdown" | "reboot" | "delete",
  ) => {
    try {
      if (action === "delete") {
        const inst = instances.find((i) => i.id === instanceId);
        setDeleteModal({
          open: true,
          id: instanceId,
          label: inst?.label || "",
          input: "",
          password: "",
          twoFactorCode: "",
          confirmCheckbox: false,
          loading: false,
          error: "",
        });
        return;
      }
      let url = `/api/vps/${instanceId}`;
      const method: "POST" | "DELETE" = "POST";
      if (action === "boot") url += "/boot";
      else if (action === "shutdown") url += "/shutdown";
      else if (action === "reboot") url += "/reboot";

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || `Failed to ${action} instance`);

      // Refresh from server for accurate status/IP sync
      await loadInstances();
      toast.success(`Instance ${action} initiated successfully`);
    } catch (error: any) {
      console.error(`Failed to ${action} instance:`, error);
      toast.error(error.message || `Failed to ${action} instance`);
    }
  };

  const handleBulkAction = async (
    action: "boot" | "shutdown" | "reboot" | "delete",
  ) => {
    if (selectedInstances.length === 0) return;

    // For delete action, show modal instead of window.confirm
    if (action === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    // For restart action, show confirmation dialog
    if (action === "reboot") {
      const confirmed = window.confirm(
        `Are you sure you want to restart ${selectedInstances.length} instance${
          selectedInstances.length > 1 ? "s" : ""
        }?\n\n` +
          `The following instances will be restarted:\n` +
          selectedInstances.map((instance) => `• ${instance.label}`).join("\n"),
      );
      if (!confirmed) return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each instance
    for (const instance of selectedInstances) {
      try {
        // Skip if action doesn't make sense for current status
        if (action === "boot" && instance.status === "running") continue;
        if (action === "shutdown" && instance.status === "stopped") continue;
        if (action === "reboot" && instance.status !== "running") continue;

        let url = `/api/vps/${instance.id}`;
        let method: "POST" | "DELETE" = "POST";

        if (action === "boot") url += "/boot";
        else if (action === "shutdown") url += "/shutdown";
        else if (action === "reboot") url += "/reboot";
        else if (action === "delete") method = "DELETE";

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            data.error || `Failed to ${action} ${instance.label}`,
          );

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${instance.label}: ${error.message}`);
        console.error(`Failed to ${action} instance ${instance.label}:`, error);
      }
    }

    // Clear selection
    setSelectedInstances([]);
    setSelectedRowSelection({});

    // Refresh instances
    await loadInstances();

    // Show results
    if (results.success > 0 && results.failed === 0) {
      toast.success(
        `Successfully ${
          action === "boot"
            ? "started"
            : action === "shutdown"
              ? "stopped"
              : action === "reboot"
                ? "restarted"
                : "deleted"
        } ${results.success} instance${results.success > 1 ? "s" : ""}`,
      );
    } else if (results.success > 0 && results.failed > 0) {
      toast.warning(
        `${results.success} instance${results.success > 1 ? "s" : ""} ${
          action === "boot"
            ? "started"
            : action === "shutdown"
              ? "stopped"
              : action === "reboot"
                ? "restarted"
                : "deleted"
        } successfully, ${results.failed} failed`,
      );
    } else if (results.failed > 0) {
      toast.error(
        `Failed to ${action} ${results.failed} instance${
          results.failed > 1 ? "s" : ""
        }${results.errors.length > 0 ? ":\n" + results.errors.join("\n") : ""}`,
      );
    }
  };

  const handleBulkDelete = async (
    password: string,
    twoFactorCode?: string,
  ) => {
    if (selectedInstances.length === 0) return;

    setBulkDeleteLoading(true);

    try {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process each instance
      for (const instance of selectedInstances) {
        try {
          const res = await fetch(`/api/vps/${instance.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ password, twoFactorCode }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(data.error || `Failed to delete ${instance.label}`);

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${instance.label}: ${error.message}`);
          console.error(`Failed to delete instance ${instance.label}:`, error);
        }
      }

      // Clear selection and close modal
      setSelectedInstances([]);
      setSelectedRowSelection({});
      setShowBulkDeleteModal(false);

      // Refresh instances
      await loadInstances();

      // Show results
      if (results.success > 0 && results.failed === 0) {
        toast.success(
          `Successfully deleted ${results.success} instance${
            results.success > 1 ? "s" : ""
          }`,
        );
      } else if (results.success > 0 && results.failed > 0) {
        toast.warning(
          `${results.success} instance${
            results.success > 1 ? "s" : ""
          } deleted successfully, ${results.failed} failed`,
        );
      } else if (results.failed > 0) {
        toast.error(
          `Failed to delete ${results.failed} instance${
            results.failed > 1 ? "s" : ""
          }${
            results.errors.length > 0 ? ":\n" + results.errors.join("\n") : ""
          }`,
        );
      }
    } catch (error: any) {
      console.error("Bulk delete failed:", error);
      throw error; // Re-throw to let modal handle the error
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  const regenerateLabel = () => {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 minutes in milliseconds

    // Filter out timestamps older than 5 minutes
    const recentTimestamps = labelRegenerationTimestamps.filter(
      timestamp => timestamp > fiveMinutesAgo
    );

    // Check if user has exceeded the rate limit (3 uses within 5 minutes)
    if (recentTimestamps.length >= 3) {
      const oldestTimestamp = Math.min(...recentTimestamps);
      const timeUntilReset = Math.ceil((oldestTimestamp + 5 * 60 * 1000 - now) / 1000 / 60); // minutes

      toast.error(
        `Rate limit exceeded. Please wait ${timeUntilReset} minute${timeUntilReset !== 1 ? 's' : ''} before generating another label.`,
        { duration: 5000 }
      );
      return;
    }

    // Generate new label
    const existingLabels = instances.map((i) => i.label);
    const newLabel = generateUniqueVPSLabel("vps", existingLabels);
    setCreateForm({ label: newLabel });

    // Update timestamps with the new click
    setLabelRegenerationTimestamps([...recentTimestamps, now]);

    // Calculate remaining attempts
    const remainingAttempts = 3 - (recentTimestamps.length + 1);
    toast.success(
      `New label generated${remainingAttempts > 0 ? `. ${remainingAttempts} regeneration${remainingAttempts !== 1 ? 's' : ''} remaining (within 5 minutes)` : ''}`,
      { duration: 3000 }
    );
  };

  const confirmDeleteInstance = async () => {
    try {
      if (deleteModal.input.trim() !== deleteModal.label.trim()) {
        setDeleteModal((m) => ({
          ...m,
          error: "Name does not match. Type the exact server name.",
        }));
        return;
      }

      if (!deleteModal.password.trim()) {
        setDeleteModal((m) => ({
          ...m,
          error: "Please enter your account password.",
        }));
        return;
      }

      if (user?.twoFactorEnabled && !deleteModal.twoFactorCode.trim()) {
        setDeleteModal((m) => ({
          ...m,
          error: "Please enter your 2FA code.",
        }));
        return;
      }

      if (!deleteModal.confirmCheckbox) {
        setDeleteModal((m) => ({
          ...m,
          error: "Please confirm deletion by checking the checkbox.",
        }));
        return;
      }

      setDeleteModal((m) => ({ ...m, loading: true, error: "" }));

      const res = await fetch(`/api/vps/${deleteModal.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: deleteModal.password,
          twoFactorCode: deleteModal.twoFactorCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete instance");
      setDeleteModal({
        open: false,
        id: "",
        label: "",
        input: "",
        password: "",
        twoFactorCode: "",
        confirmCheckbox: false,
        loading: false,
        error: "",
      });
      await loadInstances();
      toast.success("Instance deleted");
    } catch (err: any) {
      setDeleteModal((m) => ({
        ...m,
        loading: false,
        error: err.message || "Failed to delete instance",
      }));
      console.error("Delete instance error:", err);
    }
  };

  const handleCreateInstance = async () => {
    if (!createForm.provider_id || !createForm.provider_type) {
      mobileToast.error("Please select a provider");
      return;
    }

    if (!createForm.label || !createForm.rootPassword) {
      mobileToast.error("Label and root password are required");
      return;
    }

    if (!createForm.type) {
      mobileToast.error("Please select a plan");
      return;
    }

    if (!createForm.region) {
      mobileToast.error(
        "Region is required. Please select a plan with a configured region.",
      );
      return;
    }

    // Calculate total cost including backups
    const selectedType = providerPlans.find((t) => t.id === createForm.type);
    if (!selectedType) {
      mobileToast.error("Selected plan not found");
      return;
    }

    // Fetch plan details for backup pricing (flat rate - Linode does daily backups at one price)
    let backupCostHourly = 0;
    if (
      createForm.backups &&
      createForm.backup_frequency &&
      createForm.backup_frequency !== "none"
    ) {
      try {
        const planRes = await fetch("/api/vps/plans", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const planData = await planRes.json();
        const plan = (planData.plans || []).find(
          (p: any) => p.id === createForm.type,
        );

        if (plan) {
          const baseBackupHourly = plan.backup_price_hourly || 0;
          const backupUpchargeHourly = plan.backup_upcharge_hourly || 0;
          backupCostHourly = baseBackupHourly + backupUpchargeHourly;
        }
      } catch (err) {
        console.error("Failed to fetch backup pricing:", err);
        // Continue with 0 backup cost if fetch fails
      }
    }

    const totalHourlyCost = selectedType.price.hourly + backupCostHourly;

    // Show loading overlay with clear steps
    mobileLoading.showLoading(
      "Checking wallet balance",
      "Step 1 of 3: Verifying your account has sufficient funds",
    );

    // Check wallet balance
    try {
      const walletBalance = await paymentService.getWalletBalance();
      if (!walletBalance || walletBalance.balance < totalHourlyCost) {
        mobileLoading.hideLoading();
        mobileToast.error(
          `Insufficient wallet balance. Required: $${totalHourlyCost.toFixed(
            4,
          )}/hour, Available: $${walletBalance?.balance.toFixed(2) || "0.00"}`,
          {
            duration: 8000, // Longer duration for important financial information
          },
        );
        return;
      }
    } catch (error) {
      console.error("Failed to check wallet balance:", error);
      mobileLoading.hideLoading();
      mobileToast.error("Failed to verify wallet balance. Please try again.");
      return;
    }

    try {
      // Enforce image compatibility and validate fields for StackScripts
      if (selectedStackScript && Array.isArray(selectedStackScript.images)) {
        const allowed = selectedStackScript.images as string[];
        const knownByBase = new Map(
          (providerImages || []).map((i: any) => [baseImageId(i.id), i.id]),
        );
        const allowedKnown = allowed
          .map((id) => knownByBase.get(baseImageId(id)))
          .filter((id): id is string => id !== undefined);
        // If the script is unrestricted (any/all), skip strict enforcement
        if (allowedKnown.length > 0) {
          if (!createForm.image || !allowedKnown.includes(createForm.image)) {
            mobileLoading.hideLoading();
            mobileToast.error(
              "Selected OS image is not compatible with the selected application. Choose an allowed image.",
            );
            return;
          }
        }
      }
      if (
        selectedStackScript &&
        Array.isArray(selectedStackScript.user_defined_fields)
      ) {
        const missing = (selectedStackScript.user_defined_fields || []).filter(
          (f: any) => {
            const val = stackscriptData[f.name];
            return val === undefined || val === null || String(val).trim() === "";
          },
        );
        if (missing.length > 0) {
          const first = missing[0];
          mobileLoading.hideLoading();
          mobileToast.error(
            `Please fill required field: ${first.label || first.name}`,
          );
          return;
        }
      }

      const imageToUse = createForm.image;

      const body: any = {
        provider_id: createForm.provider_id,
        provider_type: createForm.provider_type,
        label: createForm.label,
        type: createForm.type,
        region: createForm.region,
        image: imageToUse,
        rootPassword: createForm.rootPassword,
        sshKeys: createForm.sshKeys,
        backups: createForm.backups,
        backup_frequency:
          createForm.backup_frequency ||
          (createForm.backups ? "weekly" : "none"),
        privateIP: createForm.privateIP,
      };

      body.stackscriptId = selectedStackScript?.id || undefined;
      body.stackscriptData = selectedStackScript ? stackscriptData : undefined;

      // Update loading state for VPS creation
      mobileLoading.updateProgress(33, "Step 2 of 3: Provisioning your server");

      const res = await fetch("/api/vps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      mobileLoading.updateProgress(66, "Step 3 of 3: Configuring instance");

      const payload = await res.json();
      if (!res.ok) {
        mobileLoading.hideLoading();

        // Helper to check if error is password-related
        const isPasswordError = (code: string, message: string): boolean => {
          return (
            code === "PASSWORD_TOO_WEAK" ||
            (message &&
              (message.toLowerCase().includes("password") &&
                (message.toLowerCase().includes("strength") ||
                  message.toLowerCase().includes("complexity") ||
                  message.includes("did not meet") ||
                  message.includes("root_pass"))))
          );
        };

        const errorMessage = payload.error || "";
        const errorCode = payload.code || "";

        // Handle password strength errors with special UX - keep modal open and show helpful message
        if (isPasswordError(errorCode, errorMessage)) {
          mobileToast.error(
            "Password does not meet strength requirements. Please use at least 8 characters with uppercase, lowercase, numbers, and special characters.",
            {
              duration: 10000,
            },
          );
          // Keep modal open - user stays on finalize step to update password
          return;
        }

        // Handle specific error codes with better user feedback
        if (payload.code === "INSUFFICIENT_BALANCE") {
          mobileToast.error(
            `Insufficient wallet balance. You need $${
              payload.required?.toFixed(4) || "unknown"
            } but only have $${
              payload.available?.toFixed(2) || "unknown"
            }. Please add funds to your wallet.`,
            {
              duration: 8000,
            },
          );
        } else if (payload.code === "WALLET_NOT_FOUND") {
          mobileToast.error(
            "No wallet found for your organization. Please contact support.",
          );
        } else if (payload.code === "WALLET_CHECK_FAILED") {
          mobileToast.error(
            "Failed to verify wallet balance. Please try again.",
          );
        } else {
          mobileToast.error(errorMessage || "Failed to create VPS");
        }
        return;
      }

      mobileLoading.updateProgress(100, "✓ VPS created successfully!");

      // Brief delay to show completion before hiding loading
      setTimeout(() => {
        mobileLoading.hideLoading();
      }, 1500);

      // VPS creation successful - show appropriate message based on billing status
      if (payload.billing?.success) {
        mobileToast.success(
          `VPS "${createForm.label}" created successfully! ${payload.billing.message}`,
        );
      } else {
        mobileToast.warning(
          `VPS "${createForm.label}" created successfully, but ${
            payload.billing?.message || "initial billing failed"
          }. You will be billed hourly as normal.`,
        );
      }

      // Refresh list from server to reflect new instance
      await loadInstances();

      // Handle form submission (clears saved data)
      handleFormSubmit();

      setShowCreateModal(false);
      setCreateStep(1);
      setSelectedStackScript(null);
      setStackscriptData({});
    } catch (error) {
      console.error("Failed to create VPS instance:", error);
      mobileLoading.hideLoading();
      mobileToast.error("Failed to create VPS instance");
    }
  };

  const activeMonthlySpend = useMemo(
    () =>
      instances
        .filter((instance) => instance.status === "running")
        .reduce((sum, instance) => sum + (instance.pricing?.monthly ?? 0), 0),
    [instances],
  );

  const filteredInstances = instances.filter((instance) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const regionLabel = (
      instance.regionLabel ||
      regionOptions.find((region) => region.id === instance.region)?.label ||
      instance.region
    ).toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      instance.label.toLowerCase().includes(normalizedSearch) ||
      (instance.ipv4[0] ?? "").includes(searchTerm.trim()) ||
      regionLabel.includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "all" || instance.status === statusFilter;
    const matchesRegion =
      selectedRegionFilters.length === 0 ||
      selectedRegionFilters.includes(instance.region);
    return matchesSearch && matchesStatus && matchesRegion;
  });

  const formatSelectedPlanMemory = (bytes: number): string =>
    formatGigabytes(bytes, { fallback: "0 GB" });

  // Filter plans based on selected provider
  const filteredProviderPlans = useMemo(() => {
    if (!createForm.provider_id) {
      return providerPlans;
    }
    return providerPlans.filter(
      (plan) =>
        !plan.provider_id || plan.provider_id === createForm.provider_id,
    );
  }, [providerPlans, createForm.provider_id]);

  const availableCategories = useMemo(() => {
    const categories = new Set<OriginalCategory>();
    filteredProviderPlans.forEach((plan: any) => {
      const typeClass = plan?.type_class as OriginalCategory | undefined;
      if (typeClass && VALID_ORIGINAL_CATEGORIES.includes(typeClass)) {
        categories.add(typeClass);
      }
    });
    return categories;
  }, [filteredProviderPlans]);

  const categoryOptions = useMemo(
    () =>
      CATEGORY_DISPLAY_ORDER.filter(
        (category) =>
          VALID_ORIGINAL_CATEGORIES.includes(category) &&
          availableCategories.has(category),
      ).map((category) => {
        const mapping = enabledCategoryMappings?.find(
          (item) => item.original_category === category,
        );
        const label = mapping?.custom_name || DEFAULT_CATEGORY_LABELS[category];
        const description =
          mapping?.custom_description || DEFAULT_CATEGORY_DESCRIPTIONS[category];

        return {
          value: category,
          label,
          description,
          meta: CATEGORY_VARIANT_LABELS[category],
          keywords: [category, CATEGORY_VARIANT_LABELS[category], label],
          icon: <Layers3 className="h-4 w-4 text-muted-foreground" />,
        };
      }),
    [availableCategories, enabledCategoryMappings],
  );

  const selectedCategoryOption = categoryOptions.find(
    (option) => option.value === createForm.type_class,
  );
  const categoryAvailabilityNote = getCategoryAvailabilityNote(createForm.type_class);
  const categoryHelperText = selectedCategoryOption
    ? `${selectedCategoryOption.description}${categoryAvailabilityNote ? ` ${categoryAvailabilityNote}` : ""}`
    : undefined;
  const normalizedCategorySearch = categorySearch.trim().toLowerCase();
  const filteredCategoryOptions = useMemo(
    () =>
      categoryOptions.filter((option) => {
        if (!normalizedCategorySearch) {
          return true;
        }

        const haystack = [
          option.label,
          option.description,
          option.meta,
          ...(option.keywords ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedCategorySearch);
      }),
    [categoryOptions, normalizedCategorySearch],
  );

  const planOptions = useMemo(
    () =>
      filteredProviderPlans.map((plan) => ({
        value: plan.id,
        label: plan.label,
        description: `${plan.vcpus} vCPU • ${formatSelectedPlanMemory(plan.memory)} RAM • ${Math.round(plan.disk / 1024)} GB storage • ${plan.transfer >= 1000 ? `${plan.transfer / 1000} TB` : `${plan.transfer} GB`} transfer`,
        meta: `${formatCurrency(plan.price.monthly)} / mo`,
        keywords: [
          plan.id,
          plan.label,
          `${plan.vcpus} vcpu`,
          formatSelectedPlanMemory(plan.memory),
          `${Math.round(plan.disk / 1024)} gb`,
          `${plan.transfer} gb`,
          formatCurrency(plan.price.monthly),
        ],
        icon: <Server className="h-4 w-4 text-muted-foreground" />,
      })),
    [filteredProviderPlans],
  );

  const selectedType = providerPlans.find((type) => type.id === createForm.type);
  const normalizedRegionSearch = regionSearch.trim().toLowerCase();
  const filteredCreateRegionOptions = useMemo(
    () =>
      createRegionOptions.filter((region) => {
        if (!normalizedRegionSearch) {
          return true;
        }

        const haystack = [
          region.label,
          region.country,
          ...(region.capabilities ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedRegionSearch);
      }),
    [createRegionOptions, normalizedRegionSearch],
  );
  const selectedCreateRegion = createRegionOptions.find(
    (region) => region.id === createForm.region,
  );
  const normalizedPlanSearch = planSearch.trim().toLowerCase();
  // Keep for potential future use
  const _filteredPlanOptions = useMemo(
    () =>
      planOptions.filter((option) => {
        if (!normalizedPlanSearch) {
          return true;
        }

        const haystack = [
          option.label,
          option.description,
          option.meta,
          ...(option.keywords ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedPlanSearch);
      }),
    [planOptions, normalizedPlanSearch],
  );

  // Multi-step modal helpers
  const { currentDisplayStep, totalDisplaySteps } = useMemo(() => {
    const display = getCurrentStepDisplay(createStep, activeSteps);
    if (display) {
      return {
        currentDisplayStep: display.stepNumber,
        totalDisplaySteps: display.totalSteps,
      };
    }

    const fallbackTotal = activeSteps.length > 0 ? activeSteps.length : 4;
    const fallbackIndex = activeSteps.findIndex(
      (step) => step.originalStepNumber === createStep,
    );
    const fallbackStep =
      fallbackIndex >= 0
        ? fallbackIndex + 1
        : Math.min(createStep, fallbackTotal);

    return {
      currentDisplayStep: fallbackStep,
      totalDisplaySteps: fallbackTotal,
    };
  }, [createStep, activeSteps]);
  const canProceed = useMemo(() => {
    if (createStep === 1)
      return Boolean(
        createForm.provider_id &&
        createForm.label &&
        createForm.type_class,
      );
    if (createStep === 2) return Boolean(createForm.region);
    if (createStep === 3) return Boolean(createForm.type);
    if (createStep === 6) return Boolean(createForm.image);
    return true;
  }, [
    createStep,
    createForm.provider_id,
    createForm.label,
    createForm.type_class,
    createForm.type,
    createForm.region,
    createForm.image,
  ]);

  const handleNext = () => {
    const nextStep = getNextStep(createStep, activeSteps);
    if (nextStep !== null) {
      setCreateStep(nextStep);
    }
  };

  const handleBack = () => {
    const prevStep = getPreviousStep(createStep, activeSteps);
    if (prevStep !== null) {
      setCreateStep(prevStep);
    }
  };

  // Get dynamic step information from active steps configuration
  const getStepInfo = (originalStepNumber: number) => {
    const stepConfig = activeSteps.find(
      (s) => s.originalStepNumber === originalStepNumber,
    );
    return stepConfig || null;
  };

  const creationSteps = [
    {
      id: "plan-label",
      title: getStepInfo(1)?.title || "Label & Category",
      description:
        getStepInfo(1)?.description ||
        "Configure the server label and server category before provisioning.",
      content: (
        <div className="space-y-4">
          <div className="space-y-4">
            {providerOptions.length > 1 && (
              <ProviderSelector
                value={createForm.provider_id}
                onChange={(providerId: string, providerType: ProviderType) => {
                  setCreateForm({
                    provider_id: providerId,
                    provider_type: providerType,
                    type: "",
                    region: "",
                    type_class: "standard",
                  });
                  setCreateStep(1);
                }}
                disabled={false}
                token={token || ""}
              />
            )}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Label *{" "}
                <span className="text-xs text-muted-foreground/70">
                  (auto-generated)
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createForm.label}
                  readOnly
                  disabled
                  className="flex-1 px-4 py-3 min-h-[48px] border border-rounded-md bg-muted text-muted-foreground placeholder-gray-500 dark:placeholder-gray-400 cursor-not-allowed text-base"
                  placeholder="Generating unique label..."
                />
                <button
                  type="button"
                  onClick={regenerateLabel}
                  disabled={(() => {
                    const now = Date.now();
                    const fiveMinutesAgo = now - 5 * 60 * 1000;
                    const recentTimestamps = labelRegenerationTimestamps.filter(
                      (timestamp) => timestamp > fiveMinutesAgo,
                    );
                    return recentTimestamps.length >= 3;
                  })()}
                  className="px-4 py-3 min-h-[48px] border border-rounded-md bg-secondary hover:bg-secondary/80 active:bg-secondary/90 text-muted-foreground hover:text-foreground transition-colors duration-200 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary"
                  title="Generate new label"
                  aria-label="Generate new random label"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A unique server name is automatically generated for you. Click the refresh icon to generate a new one.
                {(() => {
                  const now = Date.now();
                  const fiveMinutesAgo = now - 5 * 60 * 1000;
                  const recentTimestamps = labelRegenerationTimestamps.filter(
                    (timestamp) => timestamp > fiveMinutesAgo,
                  );
                  const remainingAttempts = 3 - recentTimestamps.length;
                  return remainingAttempts < 3
                    ? ` (${remainingAttempts} regeneration${remainingAttempts !== 1 ? "s" : ""} remaining)`
                    : "";
                })()}
              </p>
            </div>
            {createForm.provider_id && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Category *
                </label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose the type of server that best fits your workload
                </p>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Search categories by name or workload..."
                    className="pl-10"
                    aria-label="Search VPS categories"
                  />
                </div>
                <div className="space-y-3">
                  {filteredCategoryOptions.map((option) => {
                    const isSelected = option.value === createForm.type_class;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setCreateForm({
                            type_class: option.value,
                            type: "",
                            region: "",
                          });
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/70">
                            {option.icon ?? <Layers3 className="h-4 w-4 text-muted-foreground" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block">
                              <span className="truncate font-medium text-foreground">
                                {option.label}
                              </span>
                            </span>
                            {option.description && (
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </span>
                          <Check
                            className={`mt-1 h-4 w-4 shrink-0 ${
                              isSelected ? "opacity-100 text-primary" : "opacity-0"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                  {filteredCategoryOptions.length === 0 && (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No categories match your search.
                    </div>
                  )}
                </div>
                {categoryHelperText && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {categoryHelperText}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "region",
      title: getStepInfo(2)?.title || "Choose Region",
      description:
        getStepInfo(2)?.description ||
        "Select the datacenter location for your VPS.",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Select the datacenter location for your VPS
              {createForm.type_class === "premium" && " • Premium plans only available in regions with Premium capability"}
              {createForm.type_class === "gpu" && " • GPU plans only available in regions with GPU capability"}
            </p>
            {selectedCategoryOption && (
              <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                Category: <span className="ml-1 font-medium text-foreground">{selectedCategoryOption.label}</span>
              </div>
            )}
          </div>
          <RegionAccordionSelect
            regions={filteredCreateRegionOptions}
            selectedRegion={createForm.region}
            onSelect={(regionId) => setCreateForm({ ...createForm, region: regionId })}
            loading={createRegionsLoading}
            error={createRegionsError}
          />
          {selectedCreateRegion && (
            <p className="text-xs text-muted-foreground">
              Selected region: {selectedCreateRegion.label}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "plan",
      title: getStepInfo(3)?.title || "Choose Plan",
      description:
        getStepInfo(3)?.description ||
        "Pick the plan size for the selected category and region.",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Available plans for your selected category and region
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedCategoryOption && (
                <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                  Category: <span className="font-medium text-foreground">{selectedCategoryOption.label}</span>
                </span>
              )}
              {selectedCreateRegion && (
                <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
                  Region: <span className="font-medium text-foreground">{selectedCreateRegion.label}</span>
                </span>
              )}
            </div>
          </div>
          <PlanAccordionSelect
            plans={filteredProviderPlans as VPSPlan[]}
            selectedPlanId={createForm.type}
            onSelect={(planId) => setCreateForm({ type: planId })}
          />
          <PlanSummary plan={selectedType as VPSPlan | null} />
        </div>
      ),
    },
    {
      id: "deployments",
      title: getStepInfo(4)?.title || "1-Click Deployments",
      description:
        getStepInfo(4)?.description ||
        "Optionally provision with a StackScript or continue without one.",
      content: (
        <CreateVPSSteps
          step={2}
          providerType={createForm.provider_type}
          formData={createForm}
          onFormChange={setCreateForm}
          token={token || ""}
          linodeStackScripts={providerStackScripts}
          selectedStackScript={selectedStackScript}
          onStackScriptSelect={setSelectedStackScript}
          stackscriptData={stackscriptData}
          onStackScriptDataChange={setStackscriptData}
          allowedImagesDisplay={allowedImagesDisplay}
        />
      ),
    },
  ];

  if (deploymentConfigRequired) {
    creationSteps.push({
      id: "deployment-config",
      title: getStepInfo(5)?.title || "App Configuration",
      description:
        getStepInfo(5)?.description ||
        "Provide required credentials for the selected StackScript.",
      content: (
        <CreateVPSSteps
          step={3}
          providerType={createForm.provider_type}
          formData={createForm}
          onFormChange={setCreateForm}
          token={token || ""}
          linodeStackScripts={providerStackScripts}
          selectedStackScript={selectedStackScript}
          onStackScriptSelect={setSelectedStackScript}
          stackscriptData={stackscriptData}
          onStackScriptDataChange={setStackscriptData}
          allowedImagesDisplay={allowedImagesDisplay}
        />
      ),
    });
  }

  creationSteps.push(
    {
      id: "os",
      title: getStepInfo(6)?.title || "Operating System",
      description:
        getStepInfo(6)?.description ||
        "Pick the base operating system for this VPS.",
      content: (
        <CreateVPSSteps
          step={4}
          providerType={createForm.provider_type}
          formData={createForm}
          onFormChange={setCreateForm}
          token={token || ""}
          effectiveOsGroups={effectiveOsGroups}
          selectedOSGroup={selectedOSGroup}
          onOSGroupSelect={setSelectedOSGroup}
          selectedOSVersion={selectedOSVersion}
          onOSVersionSelect={(key, version) =>
            setSelectedOSVersion((prev) => ({ ...prev, [key]: version }))
          }
          osTab={osTab}
          onOsTabChange={setOsTab}
        />
      ),
    },
    {
      id: "finalize",
      title: getStepInfo(7)?.title || "Finalize & Review",
      description:
        getStepInfo(7)?.description ||
        "Set credentials and optional add-ons before provisioning.",
      content: (
        <CreateVPSSteps
          step={5}
          providerType={createForm.provider_type}
          formData={createForm}
          onFormChange={setCreateForm}
          token={token || ""}
        />
      ),
    },
  );

  const stackFooter = (
    <div className="flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="touch-manipulation"
        onClick={() => {
          if (isFormDirty) {
            const shouldSave = window.confirm(
              "You have unsaved changes. Would you like to save your progress?",
            );
            if (shouldSave) {
              saveForm();
            }
          }
          setShowCreateModal(false);
          setCreateStep(1);
        }}
        aria-label="Cancel VPS creation"
      >
        Cancel
      </Button>
      <div className="flex items-center space-x-3">
        {currentDisplayStep > 1 && (
          <Button
            onClick={handleBack}
            variant="secondary"
            size="lg"
            className="touch-manipulation"
          >
            Back
          </Button>
        )}
        {currentDisplayStep < totalDisplaySteps && (
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            variant={canProceed ? "default" : "secondary"}
            size="lg"
            className="touch-manipulation"
          >
            Next
          </Button>
        )}
        {currentDisplayStep === totalDisplaySteps && (
          <Button
            onClick={handleCreateInstance}
            variant="default"
            size="lg"
            className="touch-manipulation"
          >
            Create VPS
          </Button>
        )}
      </div>
    </div>
  );

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading VPS instances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile loading overlay */}
      <MobileLoading
        isLoading={mobileLoading.isLoading}
        title={mobileLoading.title}
        description={mobileLoading.description}
        progress={mobileLoading.progress}
      />

      {/* Page Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Badge variant="secondary">Infrastructure</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              VPS Instances
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Provision, search, and manage your virtual servers from one place.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {instances.length} total {instances.length === 1 ? "instance" : "instances"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch xl:justify-end" />
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedInstances.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedInstances.length} instance
                  {selectedInstances.length > 1 ? "s" : ""} selected
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleBulkAction("boot")}
                  variant="secondary"
                  size="sm"
                  disabled={selectedInstances.every(
                    (instance) => instance.status === "running",
                  )}
                >
                  <Power className="h-4 w-4 mr-1" />
                  Start
                </Button>
                <Button
                  onClick={() => handleBulkAction("shutdown")}
                  variant="secondary"
                  size="sm"
                  disabled={selectedInstances.every(
                    (instance) => instance.status === "stopped",
                  )}
                >
                  <PowerOff className="h-4 w-4 mr-1" />
                  Stop
                </Button>
                <Button
                  onClick={() => handleBulkAction("reboot")}
                  variant="default"
                  size="sm"
                  disabled={selectedInstances.every(
                    (instance) => instance.status !== "running",
                  )}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restart
                </Button>
                <Button
                  onClick={() => handleBulkAction("delete")}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setSelectedInstances([]);
                    setSelectedRowSelection({});
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VPS Instances Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div>
                <CardTitle>VPS Instances</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filteredInstances.length}{" "}
                  {filteredInstances.length === 1 ? "instance" : "instances"}{" "}
                  found
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  ensureCreateLabel();
                  setShowCreateModal(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Launch VPS
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
              <Card className="min-w-[220px] overflow-hidden sm:w-auto border-0">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Monthly Spend
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                      {formatCurrency(activeMonthlySpend)}
                    </p>
                    <p className="text-xs text-muted-foreground">Active instance monthly cost</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex flex-col gap-4 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by label, IP, or region"
                className="pl-10"
                aria-label="Search VPS instances"
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full lg:w-auto">
              <div className="w-full sm:w-[180px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="vps-status-filter" aria-label="Status filter">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="stopped">Stopped</SelectItem>
                    <SelectItem value="provisioning">Provisioning</SelectItem>
                    <SelectItem value="rebooting">Rebooting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[200px]">
                <RegionMultiSelect
                  regions={regionOptions}
                  selectedRegionIds={selectedRegionFilters}
                  onRegionToggle={(regionId) => {
                    setSelectedRegionFilters(prev =>
                      prev.includes(regionId)
                        ? prev.filter(id => id !== regionId)
                        : [...prev, regionId]
                    );
                  }}
                  onClearAll={() => setSelectedRegionFilters([])}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <VpsInstancesTable
            instances={filteredInstances}
            allowedRegions={allowedRegions}
            onAction={handleInstanceAction}
            onCopy={copyToClipboard}
            onSelectionChange={setSelectedInstances}
            rowSelection={selectedRowSelection}
            onRowSelectionChange={setSelectedRowSelection}
            isLoading={isRefreshingInstances && instances.length > 0}
          />
        </CardContent>
      </Card>

      <DialogStack
        open={showCreateModal}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            ensureCreateLabel();
            setShowCreateModal(true);
            return;
          }

          if (!isOpen && isFormDirty) {
            const shouldSave = window.confirm(
              "You have unsaved changes. Would you like to save your progress?",
            );
            if (shouldSave) {
              saveForm();
            }
          }
          setShowCreateModal(isOpen);
          if (!isOpen) setCreateStep(1);
        }}
        steps={creationSteps.filter((step) =>
          activeSteps.some((activeStep) => activeStep.id === step.id),
        )}
        activeStep={activeSteps.findIndex(
          (s) => s.originalStepNumber === createStep,
        )}
        onStepChange={(index) => {
          const step = activeSteps[index];
          if (step) {
            setCreateStep(step.originalStepNumber);
          }
        }}
        title="Create New VPS Instance"
        description={
          lastSaved
            ? `Provision a VPS using our guided setup. Auto-saved ${new Date(
                lastSaved,
              ).toLocaleTimeString()}`
            : "Provision a VPS using our guided setup."
        }
        footer={stackFooter}
        mobileLayout={
          optimizedSettings.enableAnimations ? "adaptive" : "fullscreen"
        }
        touchOptimized={true}
      />

      {deleteModal.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 bg-background dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border w-full max-w-lg shadow-lg rounded-md bg-card">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-foreground mb-4">
                Confirm Delete
              </h3>
              <p className="text-sm text-gray-600 text-muted-foreground">
                To confirm deletion, type the server name exactly:
              </p>
              <div className="mt-2 flex items-center space-x-2">
                <p className="text-sm font-mono px-2 py-1 bg-secondary text-foreground rounded">
                  {deleteModal.label}
                </p>
                <button
                  onClick={() => copyToClipboard(deleteModal.label)}
                  className="p-3 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground active:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-md touch-manipulation transition-colors duration-200"
                  title="Copy server name"
                  aria-label="Copy server name to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Server name
                  </label>
                  <input
                    type="text"
                    value={deleteModal.input}
                    onChange={(e) =>
                      setDeleteModal((m) => ({
                        ...m,
                        input: e.target.value,
                        error: "",
                      }))
                    }
                    placeholder="Type the server name to confirm"
                    className="w-full px-4 py-3 min-h-[48px] border border-rounded-md bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 text-base touch-manipulation"
                    autoComplete="off"
                    aria-label="Confirm server name for deletion"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Account Password
                  </label>
                  <input
                    type="password"
                    value={deleteModal.password}
                    onChange={(e) =>
                      setDeleteModal((m) => ({
                        ...m,
                        password: e.target.value,
                        error: "",
                      }))
                    }
                    placeholder="Enter your account password"
                    className="w-full px-4 py-3 min-h-[48px] border border-rounded-md bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 text-base touch-manipulation"
                    autoComplete="current-password"
                    aria-label="Enter account password to confirm deletion"
                  />
                </div>

                {user?.twoFactorEnabled && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      2FA Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={deleteModal.twoFactorCode}
                      onChange={(e) =>
                        setDeleteModal((m) => ({
                          ...m,
                          twoFactorCode: e.target.value,
                          error: "",
                        }))
                      }
                      placeholder="Enter your 2FA code"
                      className="w-full px-4 py-3 min-h-[48px] border border-rounded-md bg-secondary text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 text-base touch-manipulation"
                      autoComplete="one-time-code"
                      aria-label="Enter 2FA code to confirm deletion"
                    />
                  </div>
                )}
              </form>

              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={deleteModal.confirmCheckbox}
                    onChange={(e) =>
                      setDeleteModal((m) => ({
                        ...m,
                        confirmCheckbox: e.target.checked,
                        error: "",
                      }))
                    }
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border rounded"
                  />
                  <span className="ml-2 text-sm text-muted-foreground">
                    I understand that this action cannot be undone and will
                    permanently delete the VPS and all its data.
                  </span>
                </label>
                {deleteModal.error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {deleteModal.error}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() =>
                    setDeleteModal({
                      open: false,
                      id: "",
                      label: "",
                      input: "",
                      password: "",
                      twoFactorCode: "",
                      confirmCheckbox: false,
                      loading: false,
                      error: "",
                    })
                  }
                  className="px-6 py-3 min-h-[48px] border border-rounded-md text-sm font-medium text-muted-foreground bg-secondary hover:bg-secondary/80 active:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary touch-manipulation transition-colors duration-200"
                  disabled={deleteModal.loading}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteInstance}
                  disabled={
                    deleteModal.loading ||
                    deleteModal.input.trim() !== deleteModal.label.trim() ||
                    !deleteModal.password.trim() ||
                    (Boolean(user?.twoFactorEnabled) &&
                      !deleteModal.twoFactorCode.trim()) ||
                    !deleteModal.confirmCheckbox
                  }
                  className={`px-6 py-3 min-h-[48px] border border-transparent rounded-md shadow-sm text-sm font-medium text-white touch-manipulation transition-colors duration-200 ${
                    deleteModal.input.trim() === deleteModal.label.trim() &&
                    deleteModal.password.trim() &&
                    (!user?.twoFactorEnabled ||
                      Boolean(deleteModal.twoFactorCode.trim())) &&
                    deleteModal.confirmCheckbox
                      ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
                      : "bg-red-400 cursor-not-allowed"
                  }`}
                  aria-label="Confirm server deletion"
                >
                  {deleteModal.loading ? "Deleting..." : "Delete Server"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        selectedInstances={selectedInstances}
        isLoading={bulkDeleteLoading}
        requiresTwoFactor={Boolean(user?.twoFactorEnabled)}
      />
    </div>
  );
};

export default VPS;
