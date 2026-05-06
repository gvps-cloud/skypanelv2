import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Power,
  PowerOff,
  RotateCcw,
  Server,
  HardDrive,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Globe2,
  Shield,
  BarChart3,
  SatelliteDish,
  Cloud,
  Copy,
  Edit2,
  Check,
  X,
  Terminal as TerminalIcon,
  FileText,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "@/lib/api";
import VPSDisksTab from "./vps-detail/VPSDisksTab";
import OverviewTab from "./VPSDetail/OverviewTab";
import NotesTab from "./VPSDetail/NotesTab";
import BackupsTab from "./VPSDetail/BackupsTab";
import NetworkingTab from "./VPSDetail/NetworkingTab";
import ActivityTab from "./VPSDetail/ActivityTab";
import FirewallTab from "./VPSDetail/FirewallTab";
import { useBreadcrumb } from "../contexts/BreadcrumbContext";
import { TerminalPageHeader } from "@/components/terminal";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Area, AreaChart, Line, LineChart, XAxis, YAxis } from "recharts";
import { ActiveHoursDisplay } from "@/components/VPS/ActiveHoursDisplay";
import RebuildOSSelect from "@/components/VPS/RebuildOSSelect";
import { egressService } from "@/services/egressService";
import SSHTerminal from "@/components/VPS/SSHTerminal";
import type {
  BackupPricing,
  FirewallRule,
  RdnsSource,
  TabDefinition,
  TabId,
  VpsDetailResponse,
  VpsInstanceDetail,
} from "./VPSDetail/types";

const statusStyles: Record<string, string> = {
  running:
    "border border-green-200 text-green-700 bg-green-100 dark:border-green-900/60 dark:text-green-200 dark:bg-green-900/30",
  stopped:
    "border border-border text-foreground bg-muted border text-muted-foreground bg-card/60",
  provisioning:
    "border border-primary/20 text-primary bg-primary/10 dark:border-primary/60 dark:text-primary dark:bg-primary/30",
  rebooting:
    "border border-amber-200 text-amber-700 bg-amber-100 dark:border-amber-900/60 dark:text-amber-200 dark:bg-amber-900/30",
  error:
    "border border-red-200 text-red-700 bg-red-100 dark:border-red-900/60 dark:text-red-200 dark:bg-red-900/30",
  unknown:
    "border border-slate-200 text-slate-700 bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:bg-slate-800/60",
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

// Calculate elapsed hours since a timestamp
const _calculateActiveHours = (value: string | null): string => {
  if (!value) return "—";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "—";
  const hours = (Date.now() - ts) / 36e5; // 60*60*1000
  return hours.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

const formatRelativeTime = (value: string | null): string => {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
};

const formatMemory = (memoryMb: number): string => {
  if (!Number.isFinite(memoryMb) || memoryMb <= 0) return "—";
  if (memoryMb >= 1024) {
    return `${(memoryMb / 1024).toFixed(1)} GB`;
  }
  return `${memoryMb} MB`;
};

const formatStorage = (disk: number): string => {
  if (!Number.isFinite(disk) || disk <= 0) return "—";
  const diskGb = disk >= 1024 ? disk / 1024 : disk;
  return `${diskGb % 1 === 0 ? diskGb.toFixed(0) : diskGb.toFixed(1)} GB`;
};

const formatTransferAllowance = (transferGb: number): string => {
  if (!Number.isFinite(transferGb) || transferGb <= 0) return "—";
  return `${transferGb} GB`;
};

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  return `$${value.toFixed(2)}`;
};

const formatHourlyCurrency = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "$0.000000";
  return `$${value.toFixed(6)}`;
};

const formatPercent = (value: number): string =>
  `${Math.max(0, value).toFixed(1)}%`;

const formatNetworkRate = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 Mbps";
  const mbps = value / 1_000_000;
  return `${mbps.toFixed(mbps >= 10 ? 1 : 2)} Mbps`;
};

const formatBlocks = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 blk/s";
  return `${value.toFixed(value >= 10 ? 1 : 2)} blk/s`;
};

const formatSizeFromMb = (sizeMb: number): string => {
  if (!Number.isFinite(sizeMb) || sizeMb <= 0) return "—";
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb.toFixed(0)} MB`;
};

const classifyProviderIpv4 = (
  address: string,
): "public" | "private" | "unknown" => {
  const segments = address.split(".").map((part) => Number(part));
  if (
    segments.length !== 4 ||
    segments.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return "unknown";
  }
  const [octet1, octet2] = segments;
  if (octet1 === 10) return "private";
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return "private";
  if (octet1 === 192 && octet2 === 168) return "private";
  if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) return "private";
  return "public";
};

// Helper function to determine if rDNS should be displayed for white-labeling
const shouldDisplayRdns = (rdns: string | null): boolean => {
  if (!rdns || rdns.trim().length === 0) {
    return false;
  }

  // Hide default Linode rDNS domains to maintain white-labeling
  if (rdns.includes(".ip.linodeusercontent.com")) {
    return false;
  }

  // Show any custom rDNS the user has explicitly configured
  return true;
};

const statusActionLabel: Record<"boot" | "shutdown" | "reboot", string> = {
  boot: "Power On",
  shutdown: "Power Off",
  reboot: "Reboot",
};

// Progress indicator helpers
const clampPercent = (value: any): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const getProgressValue = (detail: VpsInstanceDetail | null): number | null => {
  if (!detail) return null;

  const providerPercent = clampPercent(
    detail.providerProgress?.percent ?? detail.progressPercent ?? null,
  );
  if (providerPercent !== null) {
    if (
      providerPercent >= 100 &&
      (detail.status === "running" || detail.status === "stopped")
    ) {
      return null;
    }
    return providerPercent;
  }

  if (detail.status === "provisioning") {
    if (detail.createdAt) {
      const createdTime = new Date(detail.createdAt).getTime();
      if (!Number.isNaN(createdTime)) {
        const now = Date.now();
        const elapsed = now - createdTime;
        const estimatedTotal = 5 * 60 * 1000; // 5 minutes fallback heuristic
        return Math.min(90, (elapsed / estimatedTotal) * 100);
      }
    }
    return 25;
  }
  if (detail.status === "rebooting") return 60;
  if (detail.status === "restoring") return 40;
  if (detail.status === "backing_up") return 70;
  if (detail.status === "rebuilding") return 30;
  return null;
};

const getProgressText = (
  status: string,
  providerMessage?: string | null,
): string => {
  if (
    providerMessage &&
    typeof providerMessage === "string" &&
    providerMessage.trim().length > 0
  ) {
    return providerMessage.trim();
  }
  switch (status) {
    case "provisioning":
      return "Provisioning server...";
    case "rebooting":
      return "Rebooting server...";
    case "restoring":
      return "Restoring backup...";
    case "backing_up":
      return "Creating backup...";
    case "rebuilding":
      return "Rebuilding server...";
    default:
      return "";
  }
};

const isTransitionalState = (status: string): boolean => {
  return ["provisioning", "rebooting", "restoring", "backing_up", "rebuilding"].includes(
    status,
  );
};

const BACKUP_DAY_CHOICES: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto (provider selected)" },
  { value: "Sunday", label: "Sunday" },
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
];

const describeBackupWindow = (value: string): string => {
  if (!value.startsWith("W")) {
    return value;
  }
  const startHour = Number(value.slice(1));
  if (!Number.isFinite(startHour)) {
    return value;
  }
  const endHour = (startHour + 2) % 24;
  const startLabel = `${String(startHour).padStart(2, "0")}:00`;
  const endLabel = `${String(endHour).padStart(2, "0")}:00`;
  return `${startLabel} - ${endLabel} UTC`;
};

const BACKUP_WINDOW_CHOICES: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto (provider selected)" },
  "W0",
  "W2",
  "W4",
  "W6",
  "W8",
  "W10",
  "W12",
  "W14",
  "W16",
  "W18",
  "W20",
  "W22",
].map((option) =>
  typeof option === "string"
    ? { value: option, label: describeBackupWindow(option) }
    : option,
);

const VPSDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { setDynamicOverride, removeDynamicOverride } = useBreadcrumb();

  const [detail, setDetail] = useState<VpsInstanceDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "boot" | "shutdown" | "reboot" | null
  >(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sshModalOpen, setSshModalOpen] = useState(false);
  const [sshConfirmOpen, setSshConfirmOpen] = useState(false);
  const [sshConfirmPassword, setSshConfirmPassword] = useState("");
  const [sshConfirmLoading, setSshConfirmLoading] = useState(false);
  const [sshConfirmError, setSshConfirmError] = useState<string | null>(null);
  const [backupAction, setBackupAction] = useState<
    "enable" | "disable" | "snapshot" | null
  >(null);
  const [scheduleDay, setScheduleDay] = useState<string>("");
  const [scheduleWindow, setScheduleWindow] = useState<string>("");
  const [scheduleBusy, setScheduleBusy] = useState<boolean>(false);
  const [restoreBusyId, setRestoreBusyId] = useState<number | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState<string>("");
  const [selectedFirewallId, setSelectedFirewallId] = useState<number | "">("");
  const [firewallAction, setFirewallAction] = useState<
    "attach" | `detach-${number}` | null
  >(null);
  const [rdnsEditor, setRdnsEditor] = useState<
    Record<string, { value: string; editing: boolean; saving: boolean }>
  >({});

  // Hostname editing state
  const [hostnameEditing, setHostnameEditing] = useState<boolean>(false);
  const [hostnameValue, setHostnameValue] = useState<string>("");
  const [hostnameSaving, setHostnameSaving] = useState<boolean>(false);
  const [hostnameError, setHostnameError] = useState<string>("");

  // Watchdog toggle state
  const [watchdogSaving, setWatchdogSaving] = useState<boolean>(false);

  // Notes state
  const [notesValue, setNotesValue] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState<boolean>(false);
  const [notesSaving, setNotesSaving] = useState<boolean>(false);

  // rDNS base domain configuration
  const [rdnsBaseDomain, setRdnsBaseDomain] =
    useState<string>("ip.rev.example.com");

  // IPv6 RDNS dialog state
  const [ipv6RdnsDialog, setIpv6RdnsDialog] = useState<{
    open: boolean;
    rangeBase: string;
    prefix: number;
    ipAddress: string;
    domain: string;
    saving: boolean;
    deletingAddress: string | null;
    existingRecords: Array<{ address: string; rdns: string }>;
    loadingRecords: boolean;
    recordsFilter: string;
    recordsPage: number;
  }>({
    open: false,
    rangeBase: "",
    prefix: 64,
    ipAddress: "",
    domain: "",
    saving: false,
    deletingAddress: null,
    existingRecords: [],
    loadingRecords: false,
    recordsFilter: "",
    recordsPage: 0,
  });

  // Egress credits state
  const [egressBalance, setEgressBalance] = useState<number | null>(null);
  const [egressLoading, setEgressLoading] = useState<boolean>(false);
  const [egressMonthlyUsed, setEgressMonthlyUsed] = useState<number>(0);

  // Rebuild (reinstall) state
  const [rebuildDialogOpen, setRebuildDialogOpen] = useState<boolean>(false);
  const [rebuildImage, setRebuildImage] = useState<string>("");
  const [rebuildPassword, setRebuildPassword] = useState<string>("");
  const [rebuildConfirmLabel, setRebuildConfirmLabel] = useState<string>("");
  const [rebuildLoading, setRebuildLoading] = useState<boolean>(false);
  const [availableImages, setAvailableImages] = useState<Array<{ id: string; label: string; vendor: string }>>([]);
  const [imagesLoading, setImagesLoading] = useState<boolean>(false);
  const [rebuildSSHKeys, setRebuildSSHKeys] = useState<string[]>([]);
  const [organizationSSHKeys, setOrganizationSSHKeys] = useState<Array<{ id: string; name: string; fingerprint: string }>>([]);
  const [sshKeysLoading, setSshKeysLoading] = useState<boolean>(false);
  const [rebuildBooted, setRebuildBooted] = useState<boolean>(true);
  const [rebuildDiskEncryption, setRebuildDiskEncryption] = useState<string>("");
  const [rebuildMaintenancePolicy, setRebuildMaintenancePolicy] = useState<string>("");
  const [rebuildShowAdvanced, setRebuildShowAdvanced] = useState<boolean>(false);

  const tabDefinitions = useMemo<TabDefinition[]>(() => {
    const tabs: TabDefinition[] = [
      { id: "overview", label: "Overview", icon: Server },
      { id: "backups", label: "Backups", icon: ShieldCheck },
      { id: "networking", label: "Networking", icon: Globe2 },
      { id: "activity", label: "Activity", icon: Activity },
    ];

    // Firewall and Metrics are Linode-specific features
    if (detail?.providerType === "linode" || !detail?.providerType) {
      tabs.push({ id: "firewall", label: "Firewalls", icon: Shield });
      tabs.push({ id: "metrics", label: "Metrics", icon: BarChart3 });
    }

    tabs.push({ id: "ssh", label: "SSH", icon: TerminalIcon });

    if (detail?.providerType === "linode" || !detail?.providerType) {
      tabs.push({ id: "disks", label: "Disks", icon: HardDrive });
    }

    tabs.push({ id: "notes", label: "Notes", icon: FileText });

    return tabs;
  }, [detail?.providerType]);

  const resetSshConfirmState = useCallback(() => {
    setSshConfirmPassword("");
    setSshConfirmError(null);
  }, []);

  const handleOpenSshRequest = useCallback(() => {
    if (!detail?.id) {
      toast.error("Instance ID unavailable. Please refresh and try again.");
      return;
    }

    resetSshConfirmState();
    setSshConfirmLoading(false);
    setSshConfirmOpen(true);
  }, [detail?.id, resetSshConfirmState]);

  const handleConfirmSshAccess = useCallback(async () => {
    if (!sshConfirmPassword.trim()) {
      setSshConfirmError("Password is required");
      return;
    }

    if (!token) {
      setSshConfirmError("Your session has expired. Please log in again.");
      return;
    }

    setSshConfirmLoading(true);
    try {
      await apiClient.post("/api/auth/verify-password", {
        password: sshConfirmPassword,
      });

      setSshConfirmOpen(false);
      resetSshConfirmState();
      setSshModalOpen(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to verify password. Please try again.";
      setSshConfirmError(message);
    } finally {
      setSshConfirmLoading(false);
    }
  }, [resetSshConfirmState, sshConfirmPassword, token]);

  const backupPricing = useMemo<BackupPricing | null>(() => {
    const planMonthlyRaw = detail?.plan?.pricing?.monthly;
    const planHourlyRaw = detail?.plan?.pricing?.hourly;

    const planMonthly = Number.isFinite(Number(planMonthlyRaw))
      ? Number(planMonthlyRaw)
      : Number.NaN;
    const planHourly = Number.isFinite(Number(planHourlyRaw))
      ? Number(planHourlyRaw)
      : Number.NaN;

    let monthlyBase = planMonthly;
    let hourlyBase = planHourly;

    if (
      !Number.isFinite(monthlyBase) &&
      Number.isFinite(hourlyBase) &&
      hourlyBase > 0
    ) {
      monthlyBase = hourlyBase * 730;
    }

    if (
      !Number.isFinite(hourlyBase) &&
      Number.isFinite(monthlyBase) &&
      monthlyBase > 0
    ) {
      hourlyBase = monthlyBase / 730;
    }

    if (
      Number.isFinite(monthlyBase) &&
      monthlyBase > 0 &&
      Number.isFinite(hourlyBase) &&
      hourlyBase > 0
    ) {
      const monthlyRate = monthlyBase * 0.4;
      const hourlyRate = hourlyBase * 0.4;
      return {
        monthly: monthlyRate,
        hourly: hourlyRate,
        currency:
          detail?.plan?.pricing?.currency ??
          detail?.backupPricing?.currency ??
          "USD",
      };
    }

    if (detail?.backupPricing) {
      return detail.backupPricing;
    }

    return null;
  }, [
    detail?.backupPricing,
    detail?.plan?.pricing?.currency,
    detail?.plan?.pricing?.hourly,
    detail?.plan?.pricing?.monthly,
  ]);

  const formatEventAction = (value: string | null | undefined): string => {
    if (!value) return "—";
    const formatted = value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return formatted.replace(/\bLinode\b/g, "VPS");
  };

  const formatStatusLabel = (value: string | null | undefined): string => {
    if (!value) return "Unknown";
    return value
      .replace(/_/g, " ")
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const summarizeFirewallRule = (rule: FirewallRule): string => {
    const action = (rule.action || "ACCEPT").toUpperCase();
    const protocol = rule.protocol ? rule.protocol.toUpperCase() : "ANY";
    const ports = rule.ports ? rule.ports : "all ports";
    return `${action} ${protocol} ${ports}`;
  };

  const statusBadgeClasses = (status: string | null | undefined): string => {
    switch (status) {
      case "completed":
      case "finished":
        return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200";
      case "in_progress":
      case "started":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
      case "scheduled":
        return "bg-primary/10 text-primary dark:bg-primary/40 dark:text-primary";
      default:
        return "bg-muted text-foreground bg-card/60 text-muted-foreground";
    }
  };

  const ipv4Categories = useMemo(() => {
    const ipv4 = detail?.networking?.ipv4;
    return [
      {
        label: "Public IPv4",
        accent: "text-emerald-500",
        addresses: ipv4?.public ?? [],
      },
      {
        label: "Private IPv4",
        accent: "text-purple-500",
        addresses: ipv4?.private ?? [],
      },
    ];
  }, [detail?.networking?.ipv4]);

  const ipv6Info = detail?.networking?.ipv6 ?? null;
  const firewallSummaries = useMemo(
    () => detail?.firewalls ?? [],
    [detail?.firewalls],
  );
  const firewallOptions = useMemo(
    () => detail?.firewallOptions ?? [],
    [detail?.firewallOptions],
  );
  const eventFeed = useMemo(() => detail?.activity ?? [], [detail?.activity]);
  const transferInfo = detail?.transfer ?? null;
  const transferQuotaGb = transferInfo?.quotaGb ?? 0;
  const transferUsedGb = transferInfo?.usedGb ?? 0;
  const transferBillableGb = transferInfo?.billableGb ?? 0;
  const accountTransferInfo = transferInfo?.account ?? null;
  const accountQuotaGb = accountTransferInfo?.quotaGb ?? null;
  const accountUsedGb = accountTransferInfo?.usedGb ?? null;
  const accountBillableGb = accountTransferInfo?.billableGb ?? null;
  const usageQuotaGb = accountQuotaGb ?? transferQuotaGb;
  const usageUsedGb = accountUsedGb ?? transferUsedGb;
  const transferUsagePercent =
    usageQuotaGb > 0
      ? Math.min(100, Math.max(0, (usageUsedGb / usageQuotaGb) * 100))
      : 0;
  const usageRemainingGb =
    usageQuotaGb > 0 ? Math.max(usageQuotaGb - usageUsedGb, 0) : null;
  const transferRemainingGb = transferInfo
    ? Math.max(transferQuotaGb - transferUsedGb, 0)
    : null;
  const transferUsageTitle = accountTransferInfo
    ? `${detail?.label ?? "Server"} transfer pool`
    : `${detail?.label ?? "Server"} transfer usage`;
  const transferUsageDescription = accountTransferInfo
    ? "Bandwidth figures pulled directly from the upstream provider for this server's shared pool."
    : "Track bandwidth consumption for this specific server instance.";
  const usageLabel = accountTransferInfo ? "Account usage" : "Usage";
  const effectiveBillableGb = accountBillableGb ?? transferBillableGb;
  const hasTransferData = Boolean(transferInfo);
  const totalIpv4Count = ipv4Categories.reduce(
    (total, category) => total + category.addresses.length,
    0,
  );
  const publicIpv4Count = detail?.networking?.ipv4?.public?.length ?? 0;
  const privateIpv4Count = detail?.networking?.ipv4?.private?.length ?? 0;
  const hasSlaacIpv6 = Boolean(ipv6Info?.slaac?.address);
  const rdnsEditable = detail?.rdnsEditable ?? true;
  const rdnsSources = useMemo<RdnsSource[]>(() => {
    const sources: RdnsSource[] = [];
    const ipv4Buckets = detail?.networking?.ipv4;
    if (ipv4Buckets) {
      (ipv4Buckets.public ?? []).forEach((addr) => {
        if (addr?.address) {
          sources.push({ address: addr.address, rdns: addr.rdns ?? null });
        }
      });
      (ipv4Buckets.reserved ?? []).forEach((addr) => {
        if (addr?.address) {
          sources.push({ address: addr.address, rdns: addr.rdns ?? null });
        }
      });
      (ipv4Buckets.shared ?? []).forEach((addr) => {
        if (addr?.address) {
          sources.push({ address: addr.address, rdns: addr.rdns ?? null });
        }
      });
    }
    const slaacAddress = detail?.networking?.ipv6?.slaac?.address;
    if (slaacAddress) {
      sources.push({
        address: slaacAddress,
        rdns: detail?.networking?.ipv6?.slaac?.rdns ?? null,
      });
    }
    return sources;
  }, [
    detail?.networking?.ipv4,
    detail?.networking?.ipv6?.slaac?.address,
    detail?.networking?.ipv6?.slaac?.rdns,
  ]);

  const slaacAddress = ipv6Info?.slaac?.address ?? null;
  const slaacEditorState = slaacAddress ? rdnsEditor[slaacAddress] : undefined;
  const slaacEditing = slaacEditorState?.editing ?? false;
  const slaacSaving = slaacEditorState?.saving ?? false;
  const slaacCurrentValue =
    slaacEditorState?.value ?? ipv6Info?.slaac?.rdns ?? "";
  const canEditSlaacRdns = Boolean(slaacAddress && rdnsEditable);

  useEffect(() => {
    setRdnsEditor((prev) => {
      if (rdnsSources.length === 0) {
        return Object.keys(prev).length === 0 ? prev : {};
      }
      const next: Record<
        string,
        { value: string; editing: boolean; saving: boolean }
      > = {};
      rdnsSources.forEach((source) => {
        const previous = prev[source.address];
        next[source.address] = {
          value: previous?.editing ? previous.value : (source.rdns ?? ""),
          editing: previous?.editing ?? false,
          saving: false,
        };
      });
      return next;
    });
  }, [rdnsSources]);

  const availableFirewallOptions = useMemo(() => {
    const attachedIds = new Set(
      firewallSummaries.map((firewall) => firewall.id),
    );
    return firewallOptions.filter((option) => !attachedIds.has(option.id));
  }, [firewallOptions, firewallSummaries]);

  const providerImageLabel = useMemo(() => {
    const raw = detail?.image || detail?.provider?.image;
    if (!raw) return "—";
    const segments = raw.split("/");
    return segments[segments.length - 1] || raw;
  }, [detail?.image, detail?.provider?.image]);

  const providerIpv6Address = useMemo(() => {
    if (detail?.provider?.ipv6) {
      return detail.provider.ipv6;
    }
    return detail?.networking?.ipv6?.slaac?.address || null;
  }, [detail?.networking?.ipv6?.slaac?.address, detail?.provider?.ipv6]);

  const primaryIpv4Rdns = useMemo(() => {
    const ipv4Buckets = detail?.networking?.ipv4;
    if (!ipv4Buckets) {
      return null;
    }
    const orderedBuckets = [
      ipv4Buckets.public ?? [],
      ipv4Buckets.reserved ?? [],
      ipv4Buckets.shared ?? [],
      ipv4Buckets.private ?? [],
    ];
    for (const bucket of orderedBuckets) {
      for (const record of bucket) {
        const candidate = record?.rdns;
        if (typeof candidate === "string" && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }
    }
    return null;
  }, [detail?.networking?.ipv4]);

  const findRdnsSourceValue = useCallback(
    (address: string) => {
      const match = rdnsSources.find((item) => item.address === address);
      return match?.rdns ?? "";
    },
    [rdnsSources],
  );

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!id) return;
      const silent = options?.silent === true;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const payload = await apiClient.get<VpsDetailResponse>(`/api/vps/${id}`);
        const parsed = payload as VpsDetailResponse;
        if (!parsed || !parsed.instance) {
          throw new Error("Malformed response from server");
        }
        setDetail(parsed.instance);
        // Only sync notes from server when user isn't actively editing — prevents
        // the 30-second poll from wiping unsaved text mid-keystroke.
        if (!notesEditing) {
          setNotesValue(parsed.instance.notes || "");
        }
      } catch (err) {
        console.error("Failed to load VPS instance detail:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load instance";
        setError(message);
        toast.error(message);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [id],
  );

  const loadNetworkingConfig = useCallback(async () => {
    if (!token) return;
    try {
      const payload = await apiClient.get<{ config?: { rdns_base_domain?: string } }>("/api/vps/networking/config");
      if (payload.config?.rdns_base_domain) {
        setRdnsBaseDomain(payload.config.rdns_base_domain);
      }
      // If the request fails or no config is found, keep the default value
    } catch (err) {
      console.warn(
        "Failed to load networking configuration, using default rDNS base domain:",
        err,
      );
      // Keep the default value on error
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadNetworkingConfig();
  }, [loadNetworkingConfig]);

  // Adaptive polling: refresh instance detail for live status
  // Uses faster interval (10s) for transitioning states, slower (30s) for stable states
  useEffect(() => {
    if (!detail) return;

    const hasTransitioning =
      detail.status === "provisioning" ||
      detail.status === "rebooting" ||
      detail.status === "restoring" ||
      detail.status === "backing_up";
    const pollingInterval = hasTransitioning ? 10000 : 30000; // 10s for transitioning, 30s for stable

    const interval = setInterval(() => {
      loadData();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [detail, loadData]);

  // Set dynamic breadcrumb when VPS data is loaded
  useEffect(() => {
    if (!id) return;

    if (detail) {
      // Use label (hostname) if available, otherwise fall back to id (UUID)
      const displayName =
        detail.label && detail.label.trim() ? detail.label.trim() : detail.id;

      setDynamicOverride(`/vps/${id}`, `VPS: ${displayName}`);
    } else {
      // Clear override when no data (will show default "VPS Details")
      removeDynamicOverride(`/vps/${id}`);
    }
  }, [detail, id, setDynamicOverride, removeDynamicOverride]);

  const handleCopy = useCallback(async (value: string, label?: string) => {
    if (!value) {
      return;
    }
    try {
      // Try modern Clipboard API first (requires HTTPS)
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(value);
        toast.success(`${label ?? "Value"} copied to clipboard`);
        return;
      }

      // Fallback for non-HTTPS environments
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        toast.success(`${label ?? "Value"} copied to clipboard`);
      } else {
        throw new Error("Copy command failed");
      }
    } catch (err) {
      console.error("Failed to copy value to clipboard:", err);
      toast.error("Unable to copy to clipboard. Please copy manually.");
    }
  }, []);

  useEffect(() => {
    const currentDay = detail?.backups?.schedule?.day;
    const currentWindow = detail?.backups?.schedule?.window;
    setScheduleDay(
      !currentDay || currentDay === "Scheduling" ? "" : currentDay,
    );
    setScheduleWindow(
      !currentWindow || currentWindow === "Scheduling" ? "" : currentWindow,
    );
  }, [detail?.backups?.schedule?.day, detail?.backups?.schedule?.window]);

  // Load egress credit balance
  useEffect(() => {
    const loadEgressData = async () => {
      if (!detail?.id) return;

      setEgressLoading(true);
      try {
        // Get organization's credit balance
        const balanceResult = await egressService.getBalance();
        if (balanceResult.success && balanceResult.data) {
          setEgressBalance(balanceResult.data.creditsGb);
        }

        // Get monthly credits used by this VPS
        const summaryResult = await egressService.getVPSUsageSummary(detail.id);
        if (summaryResult.success && summaryResult.data) {
          setEgressMonthlyUsed(summaryResult.data.monthlyCreditsUsed);
        }
      } catch (err) {
        console.error("Failed to load egress data:", err);
      } finally {
        setEgressLoading(false);
      }
    };

    loadEgressData();
  }, [detail?.id]);

  const performAction = useCallback(
    async (action: "boot" | "shutdown" | "reboot") => {
      if (!detail) return;
      setActionLoading(action);
      try {
        await apiClient.post(`/api/vps/${detail.id}/${action}`);
        toast.success(`${statusActionLabel[action]} request sent`);
        await loadData({ silent: true });
      } catch (err) {
        console.error('Failed to perform VPS action:', { action, error: err });
        const message =
          err instanceof Error ? err.message : `Failed to ${action} instance`;
        toast.error(message);
      } finally {
        setActionLoading(null);
      }
    },
    [detail, loadData],
  );

  const allowStart = detail?.status === "stopped";
  const allowStop = detail?.status === "running";
  const allowReboot =
    detail?.status === "running" || detail?.status === "rebooting";
  const allowRebuild =
    detail?.status === "running" || detail?.status === "stopped";

  const openRebuildDialog = useCallback(async () => {
    setRebuildDialogOpen(true);
    setRebuildImage("");
    setRebuildPassword("");
    setRebuildConfirmLabel("");
    setRebuildSSHKeys([]);
    setRebuildBooted(true);
    setRebuildDiskEncryption("");
    setRebuildMaintenancePolicy("");
    setRebuildShowAdvanced(false);
    
    // Fetch SSH keys for this organization
    if (organizationSSHKeys.length === 0) {
      setSshKeysLoading(true);
      try {
        const data = await apiClient.get<{ keys?: any[] }>("/api/ssh-keys");
        if (Array.isArray(data.keys)) {
          setOrganizationSSHKeys(
            data.keys.map((key: any) => ({
              id: String(key.id),
              name: key.name,
              fingerprint: key.fingerprint,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to fetch SSH keys:", err);
      } finally {
        setSshKeysLoading(false);
      }
    }
    
    // Fetch available images
    if (availableImages.length === 0) {
      setImagesLoading(true);
      try {
        const providerId = detail?.providerId;
        if (!providerId) {
          throw new Error("Provider context missing for image catalog");
        }
        const data = await apiClient.get<{ images?: any[] }>(
          `/api/vps/images?provider_id=${encodeURIComponent(providerId)}`,
        );
        if (Array.isArray(data.images)) {
          setAvailableImages(
            data.images
              .map((img: any) => ({
                id: img.id,
                label: img.label,
                vendor: img.distribution || "",
              }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label)),
          );
        }
      } catch (err) {
        console.error("Failed to fetch images:", err);
        toast.error("Failed to load available images");
      } finally {
        setImagesLoading(false);
      }
    }
  }, [availableImages.length, detail, organizationSSHKeys.length]);

  const performRebuild = useCallback(async () => {
    if (!detail) return;
    if (!rebuildImage) {
      toast.error("Please select an image");
      return;
    }
    if (!rebuildPassword || rebuildPassword.length < 6) {
      toast.error("Root password must be at least 6 characters");
      return;
    }
    if (rebuildConfirmLabel !== detail.label) {
      toast.error("Please type the instance label to confirm");
      return;
    }

    setRebuildLoading(true);
    try {
      await apiClient.post(`/api/vps/${detail.id}/rebuild`, {
        image: rebuildImage,
        rootPassword: rebuildPassword,
        sshKeys: rebuildSSHKeys,
        booted: rebuildBooted,
        ...(rebuildDiskEncryption ? { diskEncryption: rebuildDiskEncryption } : {}),
        ...(rebuildMaintenancePolicy ? { maintenancePolicy: rebuildMaintenancePolicy } : {}),
      });
      toast.success("Rebuild request sent — the server is being reinstalled");
      setRebuildDialogOpen(false);
      setRebuildImage("");
      setRebuildPassword("");
      setRebuildConfirmLabel("");
      setRebuildSSHKeys([]);
      setRebuildBooted(true);
      setRebuildDiskEncryption("");
      setRebuildMaintenancePolicy("");
      setRebuildShowAdvanced(false);
      await loadData({ silent: true });
    } catch (err) {
      console.error("Failed to rebuild VPS instance:", err);
      const message =
        err instanceof Error ? err.message : "Failed to rebuild instance";
      toast.error(message);
    } finally {
      setRebuildLoading(false);
    }
  }, [detail, rebuildImage, rebuildPassword, rebuildConfirmLabel, rebuildSSHKeys, rebuildBooted, rebuildDiskEncryption, rebuildMaintenancePolicy, loadData]);

  const backupsEnabled = detail?.backups?.enabled ?? false;
  const backupToggleBusy =
    backupAction === "enable" || backupAction === "disable";
  const snapshotBusy = backupAction === "snapshot";
  const originalScheduleDay = detail?.backups?.schedule?.day;
  const originalScheduleWindow = detail?.backups?.schedule?.window;
  const normalizedOriginalDay =
    !originalScheduleDay || originalScheduleDay === "Scheduling"
      ? ""
      : originalScheduleDay;
  const normalizedOriginalWindow =
    !originalScheduleWindow || originalScheduleWindow === "Scheduling"
      ? ""
      : originalScheduleWindow;
  const scheduleDirty =
    scheduleDay !== normalizedOriginalDay ||
    scheduleWindow !== normalizedOriginalWindow;
  const snapshotId =
    typeof detail?.backups?.snapshot?.id === "number"
      ? detail.backups.snapshot.id
      : null;
  const snapshotRestoreBusy =
    snapshotId !== null && restoreBusyId === snapshotId;

  const handleBackupAction = useCallback(
    async (action: "enable" | "disable" | "snapshot") => {
      if (!detail) return;
      setBackupAction(action);
      try {
        const endpoint = action === "snapshot" ? "snapshot" : action;
        const body =
          action === "snapshot"
            ? {
                label:
                  snapshotLabel.trim().length > 0
                    ? snapshotLabel.trim()
                    : undefined,
              }
            : undefined;
        await apiClient.post(
          `/api/vps/${detail.id}/backups/${endpoint}`,
          body,
        );
        if (action === "snapshot") {
          toast.success("Snapshot requested");
          setSnapshotLabel("");
        } else if (action === "enable") {
          toast.success("Backups enabled");
        } else {
          toast.success("Backups disabled");
        }
        await loadData({ silent: true });
      } catch (err) {
        console.error("Backup operation failed:", err);
        const message =
          err instanceof Error ? err.message : "Backup operation failed";
        toast.error(message);
      } finally {
        setBackupAction(null);
      }
    },
    [detail, loadData, snapshotLabel],
  );

  const handleBackupScheduleSave = useCallback(async () => {
    if (!detail) return;
    setScheduleBusy(true);
    try {
      await apiClient.post(`/api/vps/${detail.id}/backups/schedule`, {
        day: scheduleDay === "" ? null : scheduleDay,
        window: scheduleWindow === "" ? null : scheduleWindow,
      });
      toast.success("Backup schedule updated");
      await loadData({ silent: true });
    } catch (err) {
      console.error("Failed to update backup schedule:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update backup schedule";
      toast.error(message);
    } finally {
      setScheduleBusy(false);
    }
  }, [detail, loadData, scheduleDay, scheduleWindow]);

  const handleBackupScheduleReset = useCallback(() => {
    setScheduleDay(normalizedOriginalDay);
    setScheduleWindow(normalizedOriginalWindow);
  }, [normalizedOriginalDay, normalizedOriginalWindow]);

  const handleBackupRestore = useCallback(
    async (backupId: number) => {
      if (!detail?.id || !Number.isFinite(backupId)) {
        return;
      }

      const confirmation = window.confirm(
        "Restoring this backup will overwrite all disks on this VPS. Continue?",
      );
      if (!confirmation) {
        return;
      }

      setRestoreBusyId(backupId);
      try {
        await apiClient.post(
          `/api/vps/${detail.id}/backups/${backupId}/restore`,
          { overwrite: true },
        );
        toast.success("Backup restore initiated");
        await loadData({ silent: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to restore backup";
        console.error("Backup restore failed:", err);
        toast.error(message);
      } finally {
        setRestoreBusyId(null);
      }
    },
    [detail?.id, loadData],
  );

  const handleAttachFirewall = useCallback(async () => {
    if (!detail || selectedFirewallId === "" || firewallAction === "attach")
      return;
    setFirewallAction("attach");
    try {
      await apiClient.post(`/api/vps/${detail.id}/firewalls/attach`, {
        firewallId: selectedFirewallId,
      });
      toast.success("Firewall attached to instance");
      setSelectedFirewallId("");
      await loadData({ silent: true });
    } catch (err) {
      console.error("Attach firewall failed:", err);
      const message =
        err instanceof Error ? err.message : "Failed to attach firewall";
      toast.error(message);
    } finally {
      setFirewallAction(null);
    }
  }, [detail, firewallAction, loadData, selectedFirewallId]);

  const handleDetachFirewall = useCallback(
    async (firewallId: number, deviceId: number | null) => {
      if (
        !detail ||
        !Number.isInteger(firewallId) ||
        firewallId <= 0 ||
        !Number.isInteger(deviceId) ||
        (deviceId ?? 0) <= 0
      ) {
        toast.error("Firewall attachment reference missing");
        return;
      }
      const actionId = `detach-${firewallId}` as const;
      if (firewallAction === actionId) return;
      setFirewallAction(actionId);
      try {
        await apiClient.post(`/api/vps/${detail.id}/firewalls/detach`, {
          firewallId,
          deviceId,
        });
        toast.success("Firewall detached from instance");
        await loadData({ silent: true });
      } catch (err) {
        console.error("Detach firewall failed:", err);
        const message =
          err instanceof Error ? err.message : "Failed to detach firewall";
        toast.error(message);
      } finally {
        setFirewallAction(null);
      }
    },
    [detail, firewallAction, loadData],
  );

  const beginEditRdns = useCallback(
    (address: string) => {
      setRdnsEditor((prev) => {
        const next = { ...prev };
        const existing = next[address];
        const sourceValue = findRdnsSourceValue(address);
        next[address] = {
          value: existing?.value ?? sourceValue,
          editing: true,
          saving: false,
        };
        return next;
      });
    },
    [findRdnsSourceValue],
  );

  const cancelEditRdns = useCallback(
    (address: string) => {
      setRdnsEditor((prev) => {
        const next = { ...prev };
        const sourceValue = findRdnsSourceValue(address);
        next[address] = {
          value: sourceValue,
          editing: false,
          saving: false,
        };
        return next;
      });
    },
    [findRdnsSourceValue],
  );

  const updateRdnsValue = useCallback((address: string, value: string) => {
    setRdnsEditor((prev) => {
      const existing = prev[address] ?? {
        value: "",
        editing: true,
        saving: false,
      };
      return {
        ...prev,
        [address]: {
          ...existing,
          value,
        },
      };
    });
  }, []);

  const saveRdns = useCallback(
    async (address: string) => {
      if (!detail) return;
      const editorState = rdnsEditor[address];
      if (!editorState) return;
      setRdnsEditor((prev) => ({
        ...prev,
        [address]: { ...prev[address], saving: true },
      }));
      try {
        await apiClient.post(`/api/vps/${detail.id}/networking/rdns`, {
          address,
          rdns:
            editorState.value.trim().length > 0
              ? editorState.value.trim()
              : null,
        });
        toast.success("Reverse DNS updated");
        await loadData({ silent: true });
      } catch (err) {
        console.error("rDNS update failed:", err);
        const message =
          err instanceof Error ? err.message : "Failed to update reverse DNS";
        toast.error(message);
        setRdnsEditor((prev) => ({
          ...prev,
          [address]: { ...prev[address], saving: false },
        }));
        return;
      }
      setRdnsEditor((prev) => ({
        ...prev,
        [address]: { ...prev[address], saving: false, editing: false },
      }));
    },
    [detail, loadData, rdnsEditor],
  );

  // IPv6 RDNS dialog functions
  const openIpv6RdnsDialog = useCallback(
    async (rangeBase: string, prefix: number) => {
      const defaultAddress = rangeBase.endsWith("::")
        ? `${rangeBase}1`
        : `${rangeBase}::1`;
      setIpv6RdnsDialog({
        open: true,
        rangeBase,
        prefix,
        ipAddress: defaultAddress,
        domain: "",
        saving: false,
        deletingAddress: null,
        existingRecords: [],
        loadingRecords: true,
        recordsFilter: "",
        recordsPage: 0,
      });
      if (!detail) return;
      try {
        const payload = await apiClient.get<{ records?: any[] }>(
          `/api/vps/${detail.id}/networking/ipv6-rdns-records`,
        );
        setIpv6RdnsDialog((prev) => ({
          ...prev,
          existingRecords: payload.records ?? [],
          loadingRecords: false,
        }));
      } catch {
        setIpv6RdnsDialog((prev) => ({ ...prev, loadingRecords: false }));
      }
    },
    [detail],
  );

  const saveIpv6Rdns = useCallback(async () => {
    if (!detail) return;
    const { ipAddress, domain } = ipv6RdnsDialog;
    if (!ipAddress.trim()) {
      toast.error("An IPv6 address is required");
      return;
    }
    setIpv6RdnsDialog((prev) => ({ ...prev, saving: true }));
    try {
      await apiClient.post(`/api/vps/${detail.id}/networking/rdns`, {
        address: ipAddress.trim(),
        rdns: domain.trim().length > 0 ? domain.trim() : null,
      });
      toast.success("Reverse DNS updated");
      setIpv6RdnsDialog((prev) => ({
        ...prev,
        saving: false,
        existingRecords: domain.trim()
          ? [
              ...prev.existingRecords.filter((r) => r.address !== ipAddress.trim()),
              { address: ipAddress.trim(), rdns: domain.trim() },
            ]
          : prev.existingRecords.filter((r) => r.address !== ipAddress.trim()),
        domain: "",
      }));
      await loadData({ silent: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update reverse DNS";
      toast.error(message);
      setIpv6RdnsDialog((prev) => ({ ...prev, saving: false }));
    }
  }, [detail, ipv6RdnsDialog, loadData]);

  const clearIpv6RdnsRecord = useCallback(
    async (address: string) => {
      if (!detail) return;
      setIpv6RdnsDialog((prev) => ({ ...prev, deletingAddress: address }));
      try {
        await apiClient.post(`/api/vps/${detail.id}/networking/rdns`, {
          address,
          rdns: null,
        });
        toast.success("Reverse DNS cleared");
        setIpv6RdnsDialog((prev) => ({
          ...prev,
          deletingAddress: null,
          existingRecords: prev.existingRecords.filter(
            (r) => r.address !== address,
          ),
          recordsPage: 0,
        }));
        await loadData({ silent: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to clear reverse DNS";
        toast.error(message);
        setIpv6RdnsDialog((prev) => ({ ...prev, deletingAddress: null }));
      }
    },
    [detail, loadData],
  );

  // Hostname editing functions
  const validateHostname = useCallback((hostname: string): string => {
    if (!hostname.trim()) {
      return "Hostname is required";
    }
    if (hostname.length < 3) {
      return "Hostname must be at least 3 characters";
    }
    if (hostname.length > 64) {
      return "Hostname must be no more than 64 characters";
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(hostname)) {
      return "Hostname can only contain letters, numbers, hyphens, underscores, and periods";
    }
    if (hostname.startsWith("-") || hostname.endsWith("-")) {
      return "Hostname cannot start or end with a hyphen";
    }
    return "";
  }, []);

  const startEditingHostname = useCallback(() => {
    setHostnameValue(detail?.label || "");
    setHostnameEditing(true);
    setHostnameError("");
  }, [detail?.label]);

  const cancelEditingHostname = useCallback(() => {
    setHostnameEditing(false);
    setHostnameValue("");
    setHostnameError("");
  }, []);

  const saveHostname = useCallback(async () => {
    if (!detail || !hostnameValue.trim()) return;

    const validationError = validateHostname(hostnameValue.trim());
    if (validationError) {
      setHostnameError(validationError);
      return;
    }

    setHostnameSaving(true);
    setHostnameError("");

    try {
      await apiClient.put(`/api/vps/${detail.id}/hostname`, {
        hostname: hostnameValue.trim(),
      });

      toast.success("Hostname updated successfully");
      setHostnameEditing(false);
      setHostnameValue("");
      await loadData({ silent: true });
    } catch (err) {
      console.error("Hostname update failed:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update hostname";
      setHostnameError(message);
      toast.error(message);
    } finally {
      setHostnameSaving(false);
    }
  }, [detail, hostnameValue, validateHostname, loadData]);

  // Toggle watchdog (Lassie) setting
  const toggleWatchdog = useCallback(async (enabled: boolean) => {
    if (!detail?.id) return;

    setWatchdogSaving(true);
    // Optimistic update
    setDetail((prev) => {
      if (!prev || !prev.provider) return prev;
      return {
        ...prev,
        provider: { ...prev.provider, watchdog_enabled: enabled },
      };
    });

    try {
      await apiClient.put(`/api/vps/${detail.id}/watchdog`, {
        watchdog_enabled: enabled,
      });

      toast.success(`Shutdown Watchdog ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error("Watchdog update failed:", err);
      // Revert optimistic update on failure
      setDetail((prev) => {
        if (!prev || !prev.provider) return prev;
        return {
          ...prev,
          provider: { ...prev.provider, watchdog_enabled: !enabled },
        };
      });
      const message =
        err instanceof Error ? err.message : "Failed to update watchdog setting";
      toast.error(message);
    } finally {
      setWatchdogSaving(false);
    }
  }, [detail?.id]);

  // Save notes function
  const saveNotes = useCallback(async () => {
    if (!detail?.id) return;

    setNotesSaving(true);
    try {
      const payload = await apiClient.put<{ message?: string }>(`/api/vps/${detail.id}/notes`, {
        notes: notesValue,
      });

      // Update the detail with new notes
      setDetail((prev) =>
        prev ? { ...prev, notes: notesValue || null } : null,
      );
      setNotesEditing(false);
      toast.success(payload.message || "Notes saved successfully");
    } catch (err) {
      console.error("Failed to save notes:", err);
      const message =
        err instanceof Error ? err.message : "Failed to save notes";
      toast.error(message);
    } finally {
      setNotesSaving(false);
    }
  }, [detail?.id, notesValue]);

  const cancelEditingNotes = useCallback(() => {
    setNotesValue(detail?.notes || "");
    setNotesEditing(false);
  }, [detail?.notes]);

  const cpuSummary = detail?.metrics?.cpu?.summary;
  const inboundSummary = detail?.metrics?.network?.inbound?.summary;
  const outboundSummary = detail?.metrics?.network?.outbound?.summary;
  const ioSummary = detail?.metrics?.io?.read?.summary;
  const swapSummary = detail?.metrics?.io?.swap?.summary;
  const cpuSeries = detail?.metrics?.cpu?.series ?? [];
  const inboundSeries = detail?.metrics?.network?.inbound?.series ?? [];
  const outboundSeries = detail?.metrics?.network?.outbound?.series ?? [];
  const ioSeries = detail?.metrics?.io?.read?.series ?? [];
  const swapSeries = detail?.metrics?.io?.swap?.series ?? [];

  const timeframeLabel = useMemo(() => {
    if (!detail?.metrics?.timeframe?.start || !detail.metrics.timeframe.end)
      return null;
    const start = new Date(detail.metrics.timeframe.start).toLocaleString();
    const end = new Date(detail.metrics.timeframe.end).toLocaleString();
    return `${start} → ${end}`;
  }, [detail?.metrics?.timeframe?.end, detail?.metrics?.timeframe?.start]);

  if (loading && !detail) {
    return (
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
            <div className="h-72 bg-muted rounded-2xl" />
            <div className="h-64 bg-muted rounded-2xl" />
            <div className="h-64 bg-muted rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-card border border-red-200 dark:border-red-900/60 rounded-2xl shadow-sm p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">
              Unable to load server details
            </h1>
            <p className="mt-2 text-gray-600 text-muted-foreground">{error}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => loadData()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <Link
                to="/vps"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 border text-muted-foreground dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to instances
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-full xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
        <TerminalPageHeader pathPrefix={`~/vps/${id ?? ""}`} command="inspect --live" />
      </div>
      <div className="max-w-full xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 pt-0">
        <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-primary dark:text-primary">
              <Link
                to="/vps"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Back to VPS</span>
                <span className="xs:hidden">Back</span>
              </Link>
              <span className="text-muted-foreground ">/</span>
              <span className="text-gray-600 text-muted-foreground truncate">
                {detail?.id}
              </span>
            </div>
            <div className="mt-2 flex items-start gap-2 sm:gap-3">
              <Server className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0 mt-1" />
              {hostnameEditing ? (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={hostnameValue}
                      onChange={(e) => setHostnameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          saveHostname();
                        } else if (e.key === "Escape") {
                          cancelEditingHostname();
                        }
                      }}
                      className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground bg-transparent border-b-2 border-primary focus:outline-none focus:border-primary min-w-0 flex-1"
                      placeholder="Enter hostname"
                      autoFocus
                      disabled={hostnameSaving}
                    />
                    <button
                      type="button"
                      onClick={saveHostname}
                      disabled={hostnameSaving || !hostnameValue.trim()}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-600 text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {hostnameSaving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingHostname}
                      disabled={hostnameSaving}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-600 text-white hover:bg-muted/500 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {hostnameError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {hostnameError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground cursor-pointer hover:text-primary dark:hover:text-primary transition-colors group flex items-center gap-2 break-words"
                    onClick={startEditingHostname}
                    title="Click to edit hostname"
                  >
                    <span className="break-words">
                      {detail?.label || "Cloud Instance"}
                    </span>
                    <Edit2 className="h-4 w-4 sm:h-5 sm:w-5 opacity-0 group-hover:opacity-100 transition-opacity text-primary flex-shrink-0" />
                  </h1>
                </div>
              )}
            </div>
            {detail?.status && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium w-fit ${statusStyles[detail.status] || statusStyles.unknown}`}
                  >
                    <span className="inline-block h-2 w-2 rounded-full bg-current"></span>
                    {detail.status.toUpperCase()}
                  </span>
                  {(detail?.providerName || detail?.providerType) && (
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium w-fit border border-primary/20 text-primary bg-primary/10 dark:border-primary/60 dark:text-primary dark:bg-primary/30">
                      <Cloud className="h-3 w-3" />
                      {/* SECURITY: Use providerName (whitelabel) or generic "Cloud" fallback */}
                      {/* Never expose raw providerType to users */}
                      {detail.providerName || "Cloud"}
                    </span>
                  )}
                  {detail?.updatedAt && (
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Updated {formatRelativeTime(detail.updatedAt)}
                    </span>
                  )}
                </div>
                {isTransitionalState(detail.status) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {getProgressText(
                          detail.status,
                          detail.providerProgress?.message,
                        )}
                      </span>
                      {getProgressValue(detail) !== null && (
                        <span className="text-sm text-muted-foreground font-medium">
                          {Math.round(getProgressValue(detail)!)}%
                        </span>
                      )}
                    </div>
                    <Progress
                      value={getProgressValue(detail) ?? undefined}
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {/* Power Control Buttons */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-2">
              <button
                type="button"
                disabled={!allowStart || actionLoading === "boot"}
                onClick={() => performAction("boot")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-green-400 min-h-[44px] touch-manipulation ${allowStart ? "bg-green-600 hover:bg-green-500 active:bg-green-700" : "bg-green-600/50 cursor-not-allowed"} ${actionLoading === "boot" ? "opacity-75" : ""}`}
              >
                <Power className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">
                  {actionLoading === "boot" ? "Starting…" : "Power On"}
                </span>
              </button>
              <button
                type="button"
                disabled={!allowStop || actionLoading === "shutdown"}
                onClick={() => performAction("shutdown")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[44px] touch-manipulation ${allowStop ? "bg-red-600 hover:bg-red-500 active:bg-red-700" : "bg-red-600/50 cursor-not-allowed"} ${actionLoading === "shutdown" ? "opacity-75" : ""}`}
              >
                <PowerOff className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">
                  {actionLoading === "shutdown" ? "Stopping…" : "Power Off"}
                </span>
              </button>
              <button
                type="button"
                disabled={!allowReboot || actionLoading === "reboot"}
                onClick={() => performAction("reboot")}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted/50 active:bg-muted focus:outline-none focus:ring-2 focus:ring-primary dark:hover:bg-gray-800 dark:active:bg-gray-700 min-h-[44px] touch-manipulation ${!allowReboot || actionLoading === "reboot" ? "opacity-75" : ""}`}
              >
                <RotateCcw
                  className={`h-4 w-4 flex-shrink-0 ${actionLoading === "reboot" ? "animate-spin" : ""}`}
                />
                <span className="hidden xs:inline sm:hidden md:inline">
                  {actionLoading === "reboot" ? "Rebooting…" : "Reboot"}
                </span>
              </button>
              {/* Rebuild Button */}
              <button
                type="button"
                disabled={!allowRebuild || rebuildLoading}
                onClick={openRebuildDialog}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-orange-500/50 px-3 py-2 text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 active:bg-orange-500/20 focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] touch-manipulation ${!allowRebuild || rebuildLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <HardDrive className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">
                  {rebuildLoading ? "Rebuilding…" : "Rebuild"}
                </span>
              </button>
              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => loadData({ silent: true })}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted/50 text-muted-foreground dark:hover:bg-gray-800 min-h-[44px] touch-manipulation"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin text-primary" : ""}`}
                />
                <span className="hidden xs:inline sm:hidden md:inline">
                  Refresh
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Tab Navigation */}
        <div className="mb-6">
          <div className="pb-4">
            <p className="text-sm sm:text-base font-semibold text-muted-foreground mb-4">
              Instance Feature Views
            </p>

            {/* Mobile Dropdown (below lg breakpoint) */}
            <div className="lg:hidden">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabId)}
                className="w-full px-4 py-3.5 text-sm font-medium bg-card border border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:focus:ring-primary dark:focus:border-primary text-foreground"
              >
                {tabDefinitions.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Horizontal Layout (lg and above) */}
            <div className="hidden lg:flex flex-wrap gap-2">
              {tabDefinitions.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg ${
                      isActive
                        ? "text-primary-foreground bg-primary border border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <tab.icon
                      className={`h-4 w-4 transition-colors duration-200 flex-shrink-0 ${
                        isActive
                          ? "text-primary-foreground"
                          : "text-gray-500 group-hover:text-foreground"
                      }`}
                    />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-column layout: Main Content | Provider Telemetry */}
        <div className="flex flex-col xl:flex-row xl:items-start gap-4 sm:gap-6 xl:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6 sm:space-y-8">
            {activeTab === "overview" && (
              <OverviewTab
                detail={detail}
                watchdogSaving={watchdogSaving}
                onToggleWatchdog={toggleWatchdog}
                isTransitionalState={isTransitionalState}
                formatMemory={formatMemory}
                formatStorage={formatStorage}
                formatTransferAllowance={formatTransferAllowance}
                formatCurrency={formatCurrency}
                formatHourlyCurrency={formatHourlyCurrency}
                formatDateTime={formatDateTime}
              />
            )}

            {activeTab === "notes" && (
              <NotesTab
                detail={detail}
                notesEditing={notesEditing}
                notesValue={notesValue}
                notesSaving={notesSaving}
                onStartEditing={() => setNotesEditing(true)}
                onNotesChange={setNotesValue}
                onCancelEditing={cancelEditingNotes}
                onSave={saveNotes}
              />
            )}

            {activeTab === "disks" && (
              <VPSDisksTab instanceId={detail?.id} instanceLabel={detail?.label} />
            )}

            {activeTab === "backups" && (
              <BackupsTab
                detail={detail}
                backupPricing={backupPricing}
                backupsEnabled={backupsEnabled}
                backupToggleBusy={backupToggleBusy}
                snapshotBusy={snapshotBusy}
                snapshotLabel={snapshotLabel}
                scheduleDay={scheduleDay}
                scheduleWindow={scheduleWindow}
                scheduleBusy={scheduleBusy}
                scheduleDirty={scheduleDirty}
                normalizedOriginalDay={normalizedOriginalDay}
                normalizedOriginalWindow={normalizedOriginalWindow}
                restoreBusyId={restoreBusyId}
                snapshotId={snapshotId}
                snapshotRestoreBusy={snapshotRestoreBusy}
                backupDayChoices={BACKUP_DAY_CHOICES}
                backupWindowChoices={BACKUP_WINDOW_CHOICES}
                onSnapshotLabelChange={setSnapshotLabel}
                onScheduleDayChange={setScheduleDay}
                onScheduleWindowChange={setScheduleWindow}
                onBackupAction={handleBackupAction}
                onBackupScheduleSave={handleBackupScheduleSave}
                onBackupScheduleReset={handleBackupScheduleReset}
                onBackupRestore={handleBackupRestore}
                describeBackupWindow={describeBackupWindow}
                formatCurrency={formatCurrency}
                formatHourlyCurrency={formatHourlyCurrency}
                formatDateTime={formatDateTime}
                formatRelativeTime={formatRelativeTime}
                formatSizeFromMb={formatSizeFromMb}
              />
            )}

            {activeTab === "networking" && (
              <NetworkingTab
                transferUsageTitle={transferUsageTitle}
                transferUsageDescription={transferUsageDescription}
                hasTransferData={hasTransferData}
                transferUsagePercent={transferUsagePercent}
                usageLabel={usageLabel}
                usageUsedGb={usageUsedGb}
                usageQuotaGb={usageQuotaGb}
                accountTransferInfo={accountTransferInfo}
                transferUsedGb={transferUsedGb}
                transferRemainingGb={transferRemainingGb}
                usageRemainingGb={usageRemainingGb}
                effectiveBillableGb={effectiveBillableGb}
                egressLoading={egressLoading}
                egressBalance={egressBalance}
                egressMonthlyUsed={egressMonthlyUsed}
                publicIpv4Count={publicIpv4Count}
                privateIpv4Count={privateIpv4Count}
                rdnsEditable={rdnsEditable}
                hasSlaacIpv6={hasSlaacIpv6}
                totalIpv4Count={totalIpv4Count}
                ipv4Categories={ipv4Categories}
                rdnsEditor={rdnsEditor}
                ipv6Info={ipv6Info}
                slaacAddress={slaacAddress}
                slaacCurrentValue={slaacCurrentValue}
                slaacEditing={slaacEditing}
                slaacSaving={slaacSaving}
                canEditSlaacRdns={canEditSlaacRdns}
                onHandleCopy={handleCopy}
                onUpdateRdnsValue={updateRdnsValue}
                onSaveRdns={saveRdns}
                onCancelEditRdns={cancelEditRdns}
                onBeginEditRdns={beginEditRdns}
                onOpenIpv6RdnsDialog={openIpv6RdnsDialog}
                formatStatusLabel={formatStatusLabel}
                shouldDisplayRdns={shouldDisplayRdns}
              />
            )}

            {activeTab === "activity" && (
              <ActivityTab
                eventFeed={eventFeed}
                formatEventAction={formatEventAction}
                formatStatusLabel={formatStatusLabel}
                statusBadgeClasses={statusBadgeClasses}
                formatDateTime={formatDateTime}
              />
            )}

            {activeTab === "firewall" && (
              <FirewallTab
                firewallSummaries={firewallSummaries}
                availableFirewallOptions={availableFirewallOptions}
                selectedFirewallId={selectedFirewallId}
                firewallAction={firewallAction}
                onSelectedFirewallIdChange={setSelectedFirewallId}
                onAttachFirewall={handleAttachFirewall}
                onDetachFirewall={handleDetachFirewall}
                summarizeFirewallRule={summarizeFirewallRule}
                formatDateTime={formatDateTime}
                formatRelativeTime={formatRelativeTime}
                formatStatusLabel={formatStatusLabel}
                statusBadgeClasses={statusBadgeClasses}
              />
            )}

            {activeTab === "metrics" && (
              <section className="rounded-2xl border border bg-card shadow-sm">
                <div className="border-b border-border px-6 py-4 border">
                  <h2 className="text-lg font-semibold text-foreground">
                    Detailed Metrics
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Last reported utilisation from the infrastructure provider.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-6">
                  {detail?.metrics ? (
                    <>
                      {timeframeLabel && (
                        <div className="rounded-xl border border-primary bg-primary px-4 py-3 text-xs text-primary dark:border-primary/40 dark:bg-primary/30 dark:text-primary">
                          Observation window: {timeframeLabel}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            CPU
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {cpuSummary ? formatPercent(cpuSummary.last) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg{" "}
                            {cpuSummary
                              ? formatPercent(cpuSummary.average)
                              : "—"}{" "}
                            · Peak{" "}
                            {cpuSummary ? formatPercent(cpuSummary.peak) : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Network (inbound)
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {inboundSummary
                              ? formatNetworkRate(inboundSummary.last)
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg{" "}
                            {inboundSummary
                              ? formatNetworkRate(inboundSummary.average)
                              : "—"}{" "}
                            · Peak{" "}
                            {inboundSummary
                              ? formatNetworkRate(inboundSummary.peak)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Network (outbound)
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {outboundSummary
                              ? formatNetworkRate(outboundSummary.last)
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg{" "}
                            {outboundSummary
                              ? formatNetworkRate(outboundSummary.average)
                              : "—"}{" "}
                            · Peak{" "}
                            {outboundSummary
                              ? formatNetworkRate(outboundSummary.peak)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/50 p-4 border bg-background">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Disk I/O
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-foreground">
                            {ioSummary ? formatBlocks(ioSummary.last) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Avg{" "}
                            {ioSummary ? formatBlocks(ioSummary.average) : "—"}{" "}
                            · Swap{" "}
                            {swapSummary ? formatBlocks(swapSummary.last) : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <Card className="border bg-background/60 border-primary/25">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-foreground">
                              CPU Usage Over Time
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              {cpuSeries.length > 0
                                ? `${cpuSeries.length} data points`
                                : "No data available"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {cpuSeries.length > 0 ? (
                              <ChartContainer
                                config={{
                                  cpu: {
                                    label: "CPU Usage",
                                    color: "hsl(var(--chart-1))",
                                  },
                                }}
                                className="h-[200px] w-full"
                              >
                                <AreaChart
                                  data={cpuSeries.map((point) => ({
                                    timestamp: point.timestamp,
                                    cpu: point.value,
                                    time: new Date(
                                      point.timestamp,
                                    ).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                  }))}
                                >
                                  <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, 100]}
                                  />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        formatter={(value) => [
                                          `${Number(value).toFixed(1)}%`,
                                          "CPU Usage",
                                        ]}
                                      />
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="cpu"
                                    stroke="hsl(var(--chart-1))"
                                    fill="hsl(var(--chart-1))"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ChartContainer>
                            ) : (
                              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                                No CPU samples recorded.
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border bg-background/60 border-primary/25">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-foreground">
                              Network Throughput
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              Inbound and outbound traffic over time
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {inboundSeries.length > 0 ||
                            outboundSeries.length > 0 ? (
                              <ChartContainer
                                config={{
                                  inbound: {
                                    label: "Inbound",
                                    color: "hsl(var(--chart-2))",
                                  },
                                  outbound: {
                                    label: "Outbound",
                                    color: "hsl(var(--chart-3))",
                                  },
                                }}
                                className="h-[200px] w-full"
                              >
                                <LineChart
                                  data={(() => {
                                    const timestamps = new Set([
                                      ...inboundSeries.map((p) => p.timestamp),
                                      ...outboundSeries.map((p) => p.timestamp),
                                    ]);
                                    return Array.from(timestamps)
                                      .sort()
                                      .map((timestamp) => ({
                                        timestamp,
                                        time: new Date(
                                          timestamp,
                                        ).toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }),
                                        inbound:
                                          inboundSeries.find(
                                            (p) => p.timestamp === timestamp,
                                          )?.value || 0,
                                        outbound:
                                          outboundSeries.find(
                                            (p) => p.timestamp === timestamp,
                                          )?.value || 0,
                                      }));
                                  })()}
                                >
                                  <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, "dataMax + 10"]}
                                    tickFormatter={(value) =>
                                      formatNetworkRate(value)
                                    }
                                  />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        formatter={(value, name) => [
                                          formatNetworkRate(Number(value)),
                                          name === "inbound"
                                            ? "Inbound"
                                            : "Outbound",
                                        ]}
                                      />
                                    }
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="inbound"
                                    stroke="hsl(var(--chart-2))"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="outbound"
                                    stroke="hsl(var(--chart-3))"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                </LineChart>
                              </ChartContainer>
                            ) : (
                              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                                No network samples recorded.
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border bg-background/60 border-primary/25">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-foreground">
                              Disk I/O Activity
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              {ioSeries.length > 0
                                ? `${ioSeries.length} data points`
                                : "No data available"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {ioSeries.length > 0 ? (
                              <ChartContainer
                                config={{
                                  io: {
                                    label: "Disk Reads",
                                    color: "hsl(var(--chart-4))",
                                  },
                                }}
                                className="h-[200px] w-full"
                              >
                                <AreaChart
                                  data={ioSeries.map((point) => ({
                                    timestamp: point.timestamp,
                                    io: point.value,
                                    time: new Date(
                                      point.timestamp,
                                    ).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                  }))}
                                >
                                  <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, "dataMax + 100"]}
                                    tickFormatter={(value) =>
                                      formatBlocks(value)
                                    }
                                  />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        formatter={(value) => [
                                          formatBlocks(Number(value)),
                                          "Disk Reads",
                                        ]}
                                      />
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="io"
                                    stroke="hsl(var(--chart-4))"
                                    fill="hsl(var(--chart-4))"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ChartContainer>
                            ) : (
                              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                                No disk samples recorded.
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border bg-background/60 border-primary/25">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold text-foreground">
                              Swap Activity
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                              {swapSeries.length > 0
                                ? `${swapSeries.length} data points`
                                : "No data available"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {swapSeries.length > 0 ? (
                              <ChartContainer
                                config={{
                                  swap: {
                                    label: "Swap Usage",
                                    color: "hsl(var(--chart-5))",
                                  },
                                }}
                                className="h-[200px] w-full"
                              >
                                <AreaChart
                                  data={swapSeries.map((point) => ({
                                    timestamp: point.timestamp,
                                    swap: point.value,
                                    time: new Date(
                                      point.timestamp,
                                    ).toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }),
                                  }))}
                                >
                                  <XAxis
                                    dataKey="time"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[0, "dataMax + 50"]}
                                    tickFormatter={(value) =>
                                      formatBlocks(value)
                                    }
                                  />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        formatter={(value) => [
                                          formatBlocks(Number(value)),
                                          "Swap Usage",
                                        ]}
                                      />
                                    }
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="swap"
                                    stroke="hsl(var(--chart-5))"
                                    fill="hsl(var(--chart-5))"
                                    fillOpacity={0.2}
                                    strokeWidth={2}
                                  />
                                </AreaChart>
                              </ChartContainer>
                            ) : (
                              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                                No swap samples recorded.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-input bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                      Metrics have not been reported for this instance yet.
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === "ssh" && (
              <section className="rounded-2xl border border bg-card shadow-sm">
                <div className="border-b border-border px-6 py-4 border">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <TerminalIcon className="h-5 w-5 text-primary" />
                    SSH Console
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Single sign-on web shell into this VPS instance.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <p className="text-sm text-gray-600 text-muted-foreground">
                    Launch the embedded SSH console in a dedicated window so you
                    can keep managing other instance details while the session
                    runs.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenSshRequest}
                      disabled={!detail?.id}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <TerminalIcon className="h-4 w-4" />
                      Open SSH Console
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Sessions auto-authenticate using your current account
                      token.
                    </span>
                  </div>
                  {!detail?.id && (
                    <div className="rounded-xl border border-dashed border-input bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground dark:bg-muted/20 dark:text-muted-foreground">
                      Instance ID unavailable. Please refresh and try again.
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Provider Telemetry */}
          <aside className="w-full xl:w-80 2xl:w-96 flex-shrink-0">
            <section className="rounded-2xl border border bg-card shadow-sm">
              <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6 border">
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                  <SatelliteDish className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Provider Telemetry
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Details reported by the infrastructure provider.
                </p>
              </div>
              <div className="px-6 sm:px-8 py-6 sm:py-8 space-y-6 text-xs sm:text-sm text-foreground ">
                <p className="text-xs text-muted-foreground">
                  The following IP details are reported directly by the cloud
                  provider and may include public and private reachability.
                </p>
                <div className="space-y-4 sm:space-y-5">
                  {(detail?.providerName || detail?.providerType) && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium text-foreground flex items-center gap-2 sm:text-right">
                        <Cloud className="h-3.5 w-3.5 text-primary" />
                        {/* SECURITY: Use providerName (whitelabel) or generic "Cloud" fallback */}
                        {detail.providerName || "Cloud"}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Image</span>
                    <span className="font-medium text-foreground break-words sm:text-right">
                      {providerImageLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">
                      Provider status
                    </span>
                    <span className="font-medium text-foreground sm:text-right">
                      {detail?.provider
                        ? detail.provider.status
                        : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Region code</span>
                    <span className="font-medium text-foreground break-words sm:text-right">
                      {detail?.provider?.region || detail?.region || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium text-foreground sm:text-right">
                      {formatDateTime(detail?.provider?.created || null)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Active Hours</span>
                    <div className="sm:text-right">
                      <ActiveHoursDisplay
                        createdAt={
                          detail?.createdAt || detail?.provider?.created || null
                        }
                        hourlyRate={detail?.plan?.pricing?.hourly}
                        context="detail"
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">Last update</span>
                    <span className="font-medium text-foreground sm:text-right">
                      {formatDateTime(detail?.provider?.updated || null)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">rDNS edits</span>
                    <span className="font-medium text-foreground sm:text-right">
                      {rdnsEditable ? "Allowed" : "Read-only"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">IPv4 rDNS</span>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      {shouldDisplayRdns(primaryIpv4Rdns) ? (
                        <>
                          <span
                            className="max-w-full truncate font-medium text-foreground sm:max-w-[220px] sm:text-right"
                            title={primaryIpv4Rdns ?? "Not set"}
                          >
                            {primaryIpv4Rdns}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(primaryIpv4Rdns!, "IPv4 rDNS")
                            }
                            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                            aria-label="Copy IPv4 rDNS"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="italic text-muted-foreground">
                          Setting up...
                        </span>
                      )}
                    </div>
                  </div>
                  {slaacAddress ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">IPv6 rDNS</span>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <span
                          className="max-w-full truncate font-medium text-foreground sm:max-w-[220px] sm:text-right"
                          title={slaacCurrentValue || "Not set"}
                        >
                          {slaacCurrentValue || "Not set"}
                        </span>
                        {slaacCurrentValue ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(slaacCurrentValue, "IPv6 rDNS")
                            }
                            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                            aria-label="Copy IPv6 rDNS"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                {detail?.provider?.ipv4?.length || providerIpv6Address ? (
                  <div className="space-y-2">
                    <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                      Provider IP addresses
                    </span>
                    <ul className="space-y-2 text-xs text-muted-foreground ">
                      {(detail.provider?.ipv4 ?? []).map((ip) => {
                        const classification = classifyProviderIpv4(ip);
                        const descriptor =
                          classification === "private"
                            ? "private network"
                            : classification === "public"
                              ? "public network"
                              : "unclassified";
                        return (
                          <li
                            key={ip}
                            className="flex flex-col gap-2 rounded bg-muted px-3 py-2 sm:flex-row sm:items-center sm:justify-between bg-card"
                          >
                            <div className="min-w-0">
                              <p
                                className="truncate font-semibold text-foreground "
                                title={ip}
                              >
                                {ip}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ({descriptor}, provider assigned)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(ip, "Provider IPv4")}
                              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center self-start rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                              aria-label={`Copy provider IPv4 ${ip}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                      {providerIpv6Address && (
                        <li className="flex flex-col gap-2 rounded bg-muted px-3 py-2 sm:flex-row sm:items-center sm:justify-between bg-card">
                          <div className="min-w-0">
                            <p
                              className="break-all font-semibold text-foreground "
                              title={providerIpv6Address}
                            >
                              {providerIpv6Address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              (ipv6 slaac, provider assigned)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(providerIpv6Address, "Provider IPv6")
                            }
                            className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center self-start rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary border text-muted-foreground dark:hover:border-primary"
                            aria-label="Copy provider IPv6"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </div>
      <Dialog
        open={sshConfirmOpen}
        onOpenChange={(open) => {
          setSshConfirmOpen(open);
          if (!open) {
            resetSshConfirmState();
            setSshConfirmLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Password</DialogTitle>
            <DialogDescription>
              For security purposes, please confirm your account password before
              launching the SSH console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssh-password">Password</Label>
              <Input
                id="ssh-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your account password"
                value={sshConfirmPassword}
                onChange={(event) => {
                  setSshConfirmPassword(event.target.value);
                  if (sshConfirmError) {
                    setSshConfirmError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleConfirmSshAccess();
                  }
                }}
                disabled={sshConfirmLoading}
                autoFocus
              />
            </div>
            {sshConfirmError ? (
              <p className="text-sm text-destructive">{sshConfirmError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSshConfirmOpen(false);
                resetSshConfirmState();
                setSshConfirmLoading(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSshAccess}
              disabled={sshConfirmLoading}
            >
              {sshConfirmLoading ? "Verifying..." : "Confirm & Open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rebuild (Reinstall OS) Dialog */}
      <Dialog open={rebuildDialogOpen} onOpenChange={(open) => {
        if (!rebuildLoading) {
          setRebuildDialogOpen(open);
          if (!open) {
            setRebuildImage("");
            setRebuildPassword("");
            setRebuildConfirmLabel("");
            setRebuildSSHKeys([]);
            setRebuildBooted(true);
            setRebuildDiskEncryption("");
            setRebuildMaintenancePolicy("");
            setRebuildShowAdvanced(false);
          }
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Rebuild Server
            </DialogTitle>
            <DialogDescription>
              This will <strong className="text-destructive">destroy all data</strong> on this server and reinstall with a fresh operating system. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Image Selection */}
            <div className="space-y-2">
              <Label>Operating System</Label>
              <RebuildOSSelect
                images={availableImages}
                selectedImageId={rebuildImage}
                onImageSelect={setRebuildImage}
                loading={imagesLoading}
              />
            </div>

            {/* Root Password */}
            <div className="space-y-2">
              <Label htmlFor="rebuild-password">New Root Password</Label>
              <Input
                id="rebuild-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={rebuildPassword}
                onChange={(e) => setRebuildPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* SSH Keys */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">SSH Keys (Optional)</Label>
              {sshKeysLoading ? (
                <div className="flex items-center justify-center py-4 space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading SSH keys...</span>
                </div>
              ) : organizationSSHKeys.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No SSH keys found. You can add SSH keys in the SSH Keys page.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {organizationSSHKeys.map((key) => {
                    const isSelected = rebuildSSHKeys.includes(String(key.id));
                    return (
                      <div
                        key={key.id}
                        onClick={() => {
                          if (isSelected) {
                            setRebuildSSHKeys(rebuildSSHKeys.filter((id) => id !== String(key.id)));
                          } else {
                            setRebuildSSHKeys([...rebuildSSHKeys, String(key.id)]);
                          }
                        }}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 dark:bg-primary/20"
                            : "border hover:border-input dark:hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 text-primary focus:ring-primary border rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{key.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{key.fingerprint}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <div className="border rounded-md">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setRebuildShowAdvanced(!rebuildShowAdvanced)}
              >
                Advanced Options
                <ChevronDown className={`h-4 w-4 transition-transform ${rebuildShowAdvanced ? "rotate-180" : ""}`} />
              </button>
              {rebuildShowAdvanced && (
                <div className="space-y-4 border-t px-3 py-3">
                  {/* Boot after rebuild */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Boot after rebuild</Label>
                      <p className="text-xs text-muted-foreground">Automatically start the server after rebuild completes</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rebuildBooted}
                      onClick={() => setRebuildBooted(!rebuildBooted)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rebuildBooted ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rebuildBooted ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* Disk Encryption */}
                  <div className="space-y-2">
                    <Label htmlFor="rebuild-disk-encryption">Disk Encryption</Label>
                    <Select value={rebuildDiskEncryption || "default"} onValueChange={(v) => setRebuildDiskEncryption(v === "default" ? "" : v)}>
                      <SelectTrigger className="w-full" id="rebuild-disk-encryption">
                        <SelectValue placeholder="Default (provider setting)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default (provider setting)</SelectItem>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Maintenance Policy */}
                  <div className="space-y-2">
                    <Label htmlFor="rebuild-maintenance-policy">Maintenance Policy</Label>
                    <Select value={rebuildMaintenancePolicy || "default"} onValueChange={(v) => setRebuildMaintenancePolicy(v === "default" ? "" : v)}>
                      <SelectTrigger className="w-full" id="rebuild-maintenance-policy">
                        <SelectValue placeholder="Default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="linode/migrate">Live Migration</SelectItem>
                        <SelectItem value="linode/power_off_on">Power Off / On</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Defines how the server behaves during provider maintenance</p>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation */}
            <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
              <Label htmlFor="rebuild-confirm" className="text-sm font-medium text-destructive">
                Type <strong>{detail?.label || "instance-label"}</strong> to confirm
              </Label>
              <Input
                id="rebuild-confirm"
                type="text"
                placeholder={detail?.label || ""}
                value={rebuildConfirmLabel}
                onChange={(e) => setRebuildConfirmLabel(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={rebuildLoading}
              onClick={() => {
                setRebuildDialogOpen(false);
                setRebuildImage("");
                setRebuildPassword("");
                setRebuildConfirmLabel("");
                setRebuildSSHKeys([]);
                setRebuildBooted(true);
                setRebuildDiskEncryption("");
                setRebuildMaintenancePolicy("");
                setRebuildShowAdvanced(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                rebuildLoading ||
                !rebuildImage ||
                !rebuildPassword ||
                rebuildPassword.length < 6 ||
                rebuildConfirmLabel !== (detail?.label || "")
              }
              onClick={performRebuild}
            >
              {rebuildLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rebuilding...
                </>
              ) : (
                "Rebuild Server"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IPv6 Reverse DNS Dialog */}
      <Dialog
        open={ipv6RdnsDialog.open}
        onOpenChange={(open) => {
          if (!ipv6RdnsDialog.saving) {
            setIpv6RdnsDialog((prev) => ({ ...prev, open }));
          }
        }}
      >
        <DialogContent className="w-full max-w-md sm:max-w-lg max-h-[90dvh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle>Edit Reverse DNS</DialogTitle>
            <DialogDescription className="text-xs">
              Set a custom reverse DNS record for an IPv6 address within{" "}
              <span className="font-mono text-foreground">
                {ipv6RdnsDialog.rangeBase}/{ipv6RdnsDialog.prefix}
              </span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1">
          {/* Compact 2-column grid for inputs on sm+, stacked on mobile */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ipv6-rdns-address" className="text-xs">IPv6 address</Label>
              <Input
                id="ipv6-rdns-address"
                value={ipv6RdnsDialog.ipAddress}
                onChange={(e) =>
                  setIpv6RdnsDialog((prev) => ({
                    ...prev,
                    ipAddress: e.target.value,
                  }))
                }
                placeholder={`${ipv6RdnsDialog.rangeBase}1`}
                className="font-mono text-xs h-8"
                disabled={ipv6RdnsDialog.saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ipv6-rdns-domain" className="text-xs">Domain</Label>
              <Input
                id="ipv6-rdns-domain"
                value={ipv6RdnsDialog.domain}
                onChange={(e) =>
                  setIpv6RdnsDialog((prev) => ({
                    ...prev,
                    domain: e.target.value,
                  }))
                }
                placeholder="mail.example.com"
                className="text-xs h-8"
                disabled={ipv6RdnsDialog.saving}
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground -mt-1">
            Leave domain blank to clear rDNS. Records may take up to 24 hours to propagate.
          </p>

          {/* Existing Records — scrollable list with max height */}
          {(ipv6RdnsDialog.loadingRecords ||
            ipv6RdnsDialog.existingRecords.length > 0) && (() => {
              const PAGE_SIZE = 4;
              const filtered = ipv6RdnsDialog.existingRecords.filter(
                (r) =>
                  ipv6RdnsDialog.recordsFilter.trim() === "" ||
                  r.address
                    .toLowerCase()
                    .includes(ipv6RdnsDialog.recordsFilter.trim().toLowerCase()) ||
                  r.rdns
                    .toLowerCase()
                    .includes(ipv6RdnsDialog.recordsFilter.trim().toLowerCase()),
              );
              const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
              const page = Math.min(ipv6RdnsDialog.recordsPage, totalPages - 1);
              const pageRecords = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
              return (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">
                      Existing Records
                      {!ipv6RdnsDialog.loadingRecords && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({filtered.length})
                        </span>
                      )}
                    </p>
                  </div>

                  {ipv6RdnsDialog.loadingRecords ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          value={ipv6RdnsDialog.recordsFilter}
                          onChange={(e) =>
                            setIpv6RdnsDialog((prev) => ({
                              ...prev,
                              recordsFilter: e.target.value,
                              recordsPage: 0,
                            }))
                          }
                          placeholder="Filter…"
                          className="pl-7 h-7 text-xs"
                        />
                      </div>

                      {pageRecords.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          No records match your filter.
                        </p>
                      ) : (
                        <ScrollArea className="max-h-40">
                          <ul className="space-y-1">
                          {pageRecords.map((record) => {
                            const isDeleting = ipv6RdnsDialog.deletingAddress === record.address;
                            return (
                              <li
                                key={record.address}
                                className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs group"
                              >
                                <button
                                  type="button"
                                  className="flex flex-col gap-0.5 text-left min-w-0 flex-1 hover:opacity-75 transition-opacity"
                                  title="Click to edit"
                                  onClick={() =>
                                    setIpv6RdnsDialog((prev) => ({
                                      ...prev,
                                      ipAddress: record.address,
                                      domain: record.rdns,
                                    }))
                                  }
                                >
                                  <span className="font-mono font-medium text-foreground truncate block text-[10px]">
                                    {record.address}
                                  </span>
                                  <span className="text-muted-foreground truncate block">
                                    {record.rdns}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  title="Clear rDNS"
                                  disabled={
                                    isDeleting ||
                                    ipv6RdnsDialog.saving ||
                                    ipv6RdnsDialog.deletingAddress !== null
                                  }
                                  onClick={() => clearIpv6RdnsRecord(record.address)}
                                  className="flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:border-destructive hover:text-destructive focus:outline-none focus:opacity-100 disabled:pointer-events-none disabled:opacity-40"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-2.5 w-2.5" />
                                  )}
                                </button>
                              </li>
                            );
                          })}
</ul>
                        </ScrollArea>
                       )}

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {page + 1}/{totalPages}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={page === 0}
                              onClick={() =>
                                setIpv6RdnsDialog((prev) => ({
                                  ...prev,
                                  recordsPage: prev.recordsPage - 1,
                                }))
                              }
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={page >= totalPages - 1}
                              onClick={() =>
                                setIpv6RdnsDialog((prev) => ({
                                  ...prev,
                                  recordsPage: prev.recordsPage + 1,
                                }))
                              }
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          </ScrollArea>

          <DialogFooter className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setIpv6RdnsDialog((prev) => ({ ...prev, open: false }))
              }
              disabled={ipv6RdnsDialog.saving}
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={saveIpv6Rdns}
              disabled={ipv6RdnsDialog.saving || !ipv6RdnsDialog.ipAddress.trim()}
            >
              {ipv6RdnsDialog.saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SSH Console Modal */}
      <Dialog open={sshModalOpen} onOpenChange={setSshModalOpen}>
        <DialogContent className="max-w-[90vw] w-full h-[80vh] flex flex-col p-0 gap-0 bg-background border-border">
          <DialogHeader className="px-4 py-2 border-b border-border/20 bg-muted/10 shrink-0">
            <DialogTitle className="text-sm font-mono flex items-center gap-2 text-foreground">
              <TerminalIcon className="h-4 w-4" />
              SSH Console{" "}
              {detail?.id && (
                <span className="opacity-50">:: {detail?.label || detail?.id}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden relative bg-background">
            {sshModalOpen && detail?.id && (
              <SSHTerminal
                instanceId={detail.id}
                fitContainer={true}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VPSDetail;
