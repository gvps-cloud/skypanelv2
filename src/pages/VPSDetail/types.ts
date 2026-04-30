import type { LucideIcon } from "lucide-react";

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface MetricSummary {
  average: number;
  peak: number;
  last: number;
}

export interface MetricSeries {
  series: MetricPoint[];
  summary: MetricSummary;
  unit: "percent" | "bitsPerSecond" | "blocksPerSecond";
}

export interface MetricGroup {
  timeframe: { start: number | null; end: number | null };
  cpu?: MetricSeries;
  network?: {
    inbound?: MetricSeries;
    outbound?: MetricSeries;
    privateIn?: MetricSeries;
    privateOut?: MetricSeries;
  };
  io?: {
    read?: MetricSeries;
    swap?: MetricSeries;
  };
}

export interface AccountTransferInfo {
  quotaGb: number;
  usedGb: number;
  billableGb: number;
  remainingGb: number;
}

export interface TransferInfo {
  usedGb: number;
  quotaGb: number;
  billableGb: number;
  utilizationPercent: number;
  account: AccountTransferInfo | null;
  usedBytes?: number;
}

export interface BackupSummary {
  id: number | null;
  label: string | null;
  type: string | null;
  status: string | null;
  created: string | null;
  finished: string | null;
  updated: string | null;
  available: boolean;
  totalSizeMb: number;
  configs: string[];
}

export interface BackupsInfo {
  enabled: boolean;
  available: boolean;
  schedule: { day: string | null; window: string | null } | null;
  lastSuccessful: string | null;
  automatic: BackupSummary[];
  snapshot: BackupSummary | null;
  snapshotInProgress: BackupSummary | null;
}

export interface BackupPricing {
  monthly: number;
  hourly: number;
  currency: string;
}

export interface IPv4Address {
  address: string;
  type: string | null;
  public: boolean;
  rdns: string | null;
  gateway: string | null;
  subnetMask: string | null;
  prefix: number | null;
  region: string | null;
  rdnsEditable: boolean;
}

export interface IPv6Assignment {
  address: string | null;
  prefix: number | null;
  rdns: string | null;
  region: string | null;
  type: string | null;
  gateway: string | null;
}

export interface RdnsSource {
  address: string;
  rdns: string | null;
}

export interface IPv6Range {
  range: string | null;
  prefix: number | null;
  region: string | null;
  routeTarget: string | null;
  type: string | null;
}

export interface NetworkingInfo {
  ipv4: {
    public: IPv4Address[];
    private: IPv4Address[];
    shared: IPv4Address[];
    reserved: IPv4Address[];
  };
  ipv6: {
    linkLocal: IPv6Assignment | null;
    slaac: IPv6Assignment | null;
    global: IPv6Range[];
    ranges: IPv6Range[];
    pools: IPv6Range[];
  } | null;
}

export interface FirewallRule {
  action?: string;
  protocol?: string;
  ports?: string;
  label?: string;
  description?: string | null;
  addresses?: {
    ipv4?: string[];
    ipv6?: string[];
  };
}

export interface FirewallAttachment {
  id: number;
  entityId: number | null;
  entityLabel: string | null;
  type: string | null;
}

export interface FirewallSummary {
  id: number;
  label: string | null;
  status: string | null;
  tags: string[];
  created: string | null;
  updated: string | null;
  pendingChanges: boolean;
  rules: {
    inbound: FirewallRule[];
    outbound: FirewallRule[];
  } | null;
  attachment: FirewallAttachment | null;
}

export interface FirewallOption {
  id: number;
  label: string | null;
  status: string | null;
  tags: string[];
}

export interface ProviderConfigSummary {
  id: number;
  label: string | null;
  kernel: string | null;
  rootDevice: string | null;
  runLevel: string | null;
  comments: string | null;
  virtMode?: string | null;
  memoryLimit?: number | null;
  interfaces: unknown[];
  helpers: Record<string, unknown> | null;
  created: string | null;
  updated: string | null;
}

export interface InstanceEventSummary {
  id: number;
  action: string;
  status: string | null;
  message: string | null;
  created: string | null;
  username: string | null;
  percentComplete: number | null;
  entityLabel: string | null;
}

export type TabId =
  | "overview"
  | "backups"
  | "networking"
  | "activity"
  | "firewall"
  | "metrics"
  | "ssh"
  | "disks"
  | "notes";

export interface TabDefinition {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export interface PlanSpecs {
  vcpus: number;
  memory: number;
  disk: number;
  transfer: number;
}

export interface PlanPricing {
  hourly: number;
  monthly: number;
  currency: string;
}

export interface PlanInfo {
  id: string | null;
  name: string | null;
  providerPlanId: string | null;
  specs: PlanSpecs;
  pricing: PlanPricing;
}

export interface ProviderInfo {
  id: number;
  label: string;
  status: string;
  region: string;
  image: string;
  ipv4: string[];
  ipv6?: string;
  created: string;
  updated: string;
  specs: {
    vcpus: number;
    memory: number;
    disk: number;
    transfer: number;
  };
  watchdog_enabled?: boolean | null;
}

export interface VpsInstanceDetail {
  id: string;
  label: string;
  status: string;
  ipAddress: string | null;
  providerInstanceId: string;
  providerId: string | null;
  providerType: string | null;
  providerName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  notes: string | null;
  region: string | null;
  regionLabel: string | null;
  configuration: Record<string, unknown>;
  image: string | null;
  plan: PlanInfo;
  provider: ProviderInfo | null;
  metrics: MetricGroup | null;
  transfer: TransferInfo | null;
  backups: BackupsInfo | null;
  networking: NetworkingInfo | null;
  firewalls: FirewallSummary[];
  firewallOptions: FirewallOption[];
  providerConfigs: ProviderConfigSummary[];
  activity: InstanceEventSummary[];
  backupPricing: BackupPricing | null;
  rdnsEditable: boolean;
  providerProgress?: {
    percent: number | null;
    action: string | null;
    status: string | null;
    message: string | null;
    created: string | null;
  } | null;
  progressPercent?: number | null;
}

export interface VpsDetailResponse {
  instance: VpsInstanceDetail;
}

export type ActionType = "boot" | "shutdown" | "reboot";
export type BackupActionType = "enable" | "disable" | "snapshot";
export type FirewallActionType = "attach" | `detach-${number}` | null;
