import type { LinodeBackupSummary, LinodeMetricTuple } from "../../../services/linodeService.js";

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface MetricSummary {
  average: number;
  peak: number;
  last: number;
}

export interface MetricSeriesPayload {
  series: MetricPoint[];
  summary: MetricSummary;
  unit: "percent" | "bitsPerSecond" | "blocksPerSecond";
}

export interface AccountTransferPayload {
  quotaGb: number;
  usedGb: number;
  billableGb: number;
  remainingGb: number;
}

export interface TransferPayload {
  usedGb: number;
  quotaGb: number;
  billableGb: number;
  utilizationPercent: number;
  account: AccountTransferPayload | null;
  usedBytes: number;
}

export interface BackupsPayload {
  enabled: boolean;
  available: boolean;
  schedule: { day: string | null; window: string | null } | null;
  lastSuccessful: string | null;
  automatic: BackupSummaryPayload[];
  snapshot: BackupSummaryPayload | null;
  snapshotInProgress: BackupSummaryPayload | null;
}

export interface BackupSummaryPayload {
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

export interface PlanSpecs {
  vcpus: number;
  memory: number;
  disk: number;
  transfer: number;
}

export interface PlanPricing {
  hourly: number;
  monthly: number;
}

export interface PlanMeta {
  planRow: any;
  specs: PlanSpecs;
  pricing: PlanPricing;
  providerPlanId: string | null;
}

export const normalizeProviderStatus = (status: string | null | undefined): string => {
  if (!status) return "unknown";
  return status === "offline" ? "stopped" : status;
};

export const isMetricTuple = (value: unknown): value is LinodeMetricTuple =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number";

export const normalizeSeries = (series: unknown): MetricPoint[] => {
  if (!Array.isArray(series)) {
    return [];
  }
  return (series as unknown[])
    .filter(isMetricTuple)
    .map(([timestamp, value]) => ({ timestamp, value }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) && Number.isFinite(point.value),
    );
};

export const summarizeSeries = (series: MetricPoint[]): MetricSummary => {
  if (series.length === 0) {
    return { average: 0, peak: 0, last: 0 };
  }
  let total = 0;
  let peak = -Infinity;
  for (const point of series) {
    total += point.value;
    if (point.value > peak) {
      peak = point.value;
    }
  }
  return {
    average: total / series.length,
    peak: peak === -Infinity ? 0 : peak,
    last: series[series.length - 1]?.value ?? 0,
  };
};

export const deriveTimeframe = (
  collections: MetricPoint[][],
): { start: number | null; end: number | null } => {
  const timestamps: number[] = [];
  collections.forEach((series) => {
    series.forEach((point) => {
      if (Number.isFinite(point.timestamp)) {
        timestamps.push(point.timestamp);
      }
    });
  });
  if (timestamps.length === 0) {
    return { start: null, end: null };
  }
  return {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps),
  };
};

export const bytesToGigabytes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value / 1_000_000_000;
};

export const extractTransferUsedBytes = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const directCandidate =
      source.total ?? source.bytes ?? source.amount ?? source.used;
    if (
      typeof directCandidate === "number" &&
      Number.isFinite(directCandidate)
    ) {
      return directCandidate;
    }
    const inboundCandidate = source.in ?? source.ingress ?? source.inbound;
    const outboundCandidate = source.out ?? source.egress ?? source.outbound;
    let total = 0;
    if (
      typeof inboundCandidate === "number" &&
      Number.isFinite(inboundCandidate)
    ) {
      total += inboundCandidate;
    }
    if (
      typeof outboundCandidate === "number" &&
      Number.isFinite(outboundCandidate)
    ) {
      total += outboundCandidate;
    }
    if (total > 0) {
      return total;
    }
  }
  return 0;
};

export const extractTransferBillableBytes = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const directCandidate =
      source.total ?? source.bytes ?? source.amount ?? source.billable;
    if (
      typeof directCandidate === "number" &&
      Number.isFinite(directCandidate)
    ) {
      return directCandidate;
    }
  }
  return 0;
};

export const mapBackupSummary = (
  backup: LinodeBackupSummary | null | undefined,
): BackupSummaryPayload | null => {
  if (!backup || typeof backup !== "object") {
    return null;
  }
  const disks = Array.isArray(backup.disks) ? backup.disks : [];
  const totalSizeMb = disks.reduce<number>((sum, disk) => {
    const diskSize =
      typeof (disk as { size?: unknown }).size === "number"
        ? (disk as { size?: number }).size!
        : 0;
    return sum + diskSize;
  }, 0);

  return {
    id: typeof backup.id === "number" ? backup.id : null,
    label: typeof backup.label === "string" ? backup.label : null,
    type: typeof backup.type === "string" ? backup.type : null,
    status: typeof backup.status === "string" ? backup.status : null,
    created: typeof backup.created === "string" ? backup.created : null,
    finished: typeof backup.finished === "string" ? backup.finished : null,
    updated: typeof backup.updated === "string" ? backup.updated : null,
    available: Boolean((backup as { available?: boolean }).available),
    totalSizeMb,
    configs: Array.isArray(backup.configs) ? backup.configs : [],
  };
};

export const toStringOrNull = (value: any): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
};

export const toNumberOrNull = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
};

export const mapIPv4Address = (entry: any): any | null => {
  if (!entry || typeof entry !== "object") return null;
  const address = toStringOrNull(entry.address);
  if (!address) return null;
  const editable = entry?.rdns_editable;
  return {
    address,
    type: toStringOrNull(entry.type),
    public: Boolean(entry.public),
    rdns: toStringOrNull(entry.rdns),
    gateway: toStringOrNull(entry.gateway),
    subnetMask: toStringOrNull(entry.subnet_mask),
    prefix: toNumberOrNull(entry.prefix),
    region: toStringOrNull(entry.region),
    rdnsEditable: typeof editable === "boolean" ? editable : true,
  };
};

export const mapIPv6Assignment = (entry: any): any | null => {
  if (!entry || typeof entry !== "object") return null;
  const address = toStringOrNull(entry.address);
  if (!address) return null;
  return {
    address,
    prefix: toNumberOrNull(entry.prefix),
    rdns: toStringOrNull(entry.rdns),
    region: toStringOrNull(entry.region),
    type: toStringOrNull(entry.type),
    gateway: toStringOrNull(entry.gateway),
  };
};

export const mapIPv6Range = (entry: any): any | null => {
  if (!entry || typeof entry !== "object") return null;
  const range = toStringOrNull(entry.range);
  const prefix = toNumberOrNull(entry.prefix);
  if (!range && prefix === null) {
    return null;
  }
  return {
    range,
    prefix,
    region: toStringOrNull(entry.region),
    routeTarget: toStringOrNull(entry.route_target),
    type: toStringOrNull(entry.type),
  };
};

export const mapIPv6RangeCollection = (value: any): any[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(mapIPv6Range)
    .filter((item: any): item is Record<string, unknown> => Boolean(item));
};

export const pickIPv4Array = (source: any, key: string): any[] => {
  if (source && Array.isArray(source[key])) {
    return source[key];
  }
  return [];
};

export const pickIPv6Pool = (source: any): any[] => {
  if (!source) {
    return [];
  }
  if (Array.isArray(source.pools)) {
    return source.pools;
  }
  if (Array.isArray(source.pool)) {
    return source.pool;
  }
  return [];
};

export const mapFirewallAttachment = (entry: any): any | null => {
  const deviceId = toNumberOrNull(entry?.id);
  if (deviceId === null) {
    return null;
  }

  const entity =
    entry?.entity && typeof entry.entity === "object" ? entry.entity : {};
  const entityId = toNumberOrNull((entity as any)?.id);

  return {
    id: deviceId,
    entityId,
    entityLabel: toStringOrNull((entity as any)?.label),
    type: toStringOrNull(entry?.type ?? (entity as any)?.type),
  };
};

export const mapFirewallSummary = (entry: any, attachment?: any): any | null => {
  const id = toNumberOrNull(entry?.id);
  if (id === null) {
    return null;
  }
  const tags = Array.isArray(entry?.tags)
    ? entry.tags
        .map((tag: any) => toStringOrNull(tag))
        .filter((tag): tag is string => Boolean(tag))
    : [];

  return {
    id,
    label: toStringOrNull(entry?.label),
    status: toStringOrNull(entry?.status),
    tags,
    created: toStringOrNull(entry?.created),
    updated: toStringOrNull(entry?.updated),
    pendingChanges: Boolean(entry?.has_pending_changes),
    rules:
      entry?.rules && typeof entry.rules === "object"
        ? {
            inbound: Array.isArray(entry.rules.inbound)
              ? entry.rules.inbound
              : [],
            outbound: Array.isArray(entry.rules.outbound)
              ? entry.rules.outbound
              : [],
          }
        : null,
    attachment: attachment ? mapFirewallAttachment(attachment) : null,
  };
};

export const mapFirewallOption = (entry: any): any | null => {
  const id = toNumberOrNull(entry?.id);
  if (id === null) {
    return null;
  }

  const tags = Array.isArray(entry?.tags)
    ? entry.tags
        .map((tag: any) => toStringOrNull(tag))
        .filter((tag): tag is string => Boolean(tag))
    : [];

  return {
    id,
    label: toStringOrNull(entry?.label),
    status: toStringOrNull(entry?.status),
    tags,
  };
};

export const mapConfigProfile = (entry: any): any | null => {
  const id = toNumberOrNull(entry?.id);
  if (id === null) {
    return null;
  }
  return {
    id,
    label: toStringOrNull(entry?.label),
    kernel: toStringOrNull(entry?.kernel),
    rootDevice: toStringOrNull(entry?.root_device),
    runLevel: toStringOrNull(entry?.run_level),
    comments: toStringOrNull(entry?.comments),
    virtMode: toStringOrNull(entry?.virt_mode),
    memoryLimit: toNumberOrNull(entry?.memory_limit),
    interfaces: Array.isArray(entry?.interfaces) ? entry.interfaces : [],
    helpers:
      entry?.helpers && typeof entry.helpers === "object"
        ? entry.helpers
        : null,
    created: toStringOrNull(entry?.created),
    updated: toStringOrNull(entry?.updated),
  };
};

export const mapEventSummary = (entry: any): any | null => {
  const id = toNumberOrNull(entry?.id);
  if (id === null) {
    return null;
  }
  return {
    id,
    action: toStringOrNull(entry?.action) ?? "unknown",
    status: toStringOrNull(entry?.status),
    message: toStringOrNull(entry?.message),
    created: toStringOrNull(entry?.created),
    username: toStringOrNull(entry?.username),
    percentComplete: toNumberOrNull(entry?.percent_complete),
    entityLabel: toStringOrNull(entry?.entity?.label),
  };
};
