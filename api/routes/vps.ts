import express, { Request, Response } from "express";
import { createHash } from "crypto";
import { authenticateToken, requireOrganization } from "../middleware/auth.js";
import { query } from "../lib/database.js";
import { linodeService } from "../services/linodeService.js";
import { handleProviderError, logError } from "../lib/errorHandling.js";
import type { ProviderType } from "../services/providers/IProviderService.js";
import type {
  CreateLinodeRequest,
  RebuildLinodeRequest,
  LinodeInstance,
  LinodeInstanceBackupsResponse,
  LinodeInstanceStatsResponse,
  LinodeInstanceStatsSeries,
  LinodeBackupSummary,
  LinodeMetricTuple,
} from "../services/linodeService.js";
import { logActivity } from "../services/activityLogger.js";
import { encryptSecret } from "../lib/crypto.js";
import {
  normalizeProviderToken,
  getProviderTokenByType,
} from "../lib/providerTokens.js";
import { BillingService } from "../services/billingService.js";
import { AuthService } from "../services/authService.js";
import {
  normalizeRegionList,
  parseStoredAllowedRegions,
  shouldFilterByAllowedRegions,
} from "../lib/providerRegions.js";
import { RoleService } from "../services/roles.js";
import { EgressBillingService } from "../services/egressBillingService.js";
const router = express.Router();

router.use(authenticateToken, requireOrganization);

import { config } from "../config/index.js";

const DEFAULT_RDNS_BASE_DOMAIN = config.RDNS_BASE_DOMAIN;

const LEGACY_TEMPLATE_PREFIX = "tpl_";
const BRANDED_TEMPLATE_PREFIX = config.COMPANY_BRAND_NAME + "/";

function isBrandedTemplateId(id: string): boolean {
  return id.startsWith(BRANDED_TEMPLATE_PREFIX);
}

function isLegacyTemplateId(id: string): boolean {
  return id.startsWith(LEGACY_TEMPLATE_PREFIX);
}

function toBrandedTemplateId(upstreamImageId: string): string {
  return `${BRANDED_TEMPLATE_PREFIX}${upstreamImageId}`;
}

/** @deprecated Legacy hash-based template ID — kept for backwards compatibility */
function toLegacyTemplateId(providerId: string, upstreamImageId: string): string {
  const digest = createHash("sha256")
    .update(`${providerId}:${upstreamImageId}`)
    .digest("hex")
    .slice(0, 24);
  return `${LEGACY_TEMPLATE_PREFIX}${digest}`;
}

function normalizeImageTemplate(
  image: any,
  _providerId: string,
): {
  id: string;
  label: string;
  description: string | null;
  distribution: string | null;
  minDiskSize: number | null;
  public: boolean;
  deprecated: boolean;
} {
  const upstreamId = String(image?.id || "").trim();
  // Strip 'linode/' prefix from upstream ID for white-labeling
  // e.g., 'linode/ubuntu22.04' -> 'ubuntu22.04'
  const whiteLabelId = upstreamId.replace(/^linode\//, '');
  return {
    id: toBrandedTemplateId(whiteLabelId),
    label: image?.label || upstreamId,
    description: image?.description || null,
    distribution: image?.vendor || null,
    minDiskSize:
      typeof image?.size === "number" && Number.isFinite(image.size)
        ? image.size
        : null,
    public: Boolean(image?.is_public),
    deprecated: Boolean(image?.deprecated),
  };
}

async function resolveImageForProvider(
  providerId: string,
  requestedImage: string,
  providerApiToken?: string,
): Promise<string | null> {
  const requested = requestedImage.trim();

  // Path 1: Branded template ID (e.g. "SkyPanelV2/ubuntu22.04") → strip prefix and restore 'linode/'
  if (isBrandedTemplateId(requested)) {
    const whiteLabelId = requested.slice(BRANDED_TEMPLATE_PREFIX.length);
    // Restore 'linode/' prefix for upstream API (e.g., 'ubuntu22.04' -> 'linode/ubuntu22.04')
    // Only add prefix if not already present (handles edge cases)
    if (!whiteLabelId.startsWith('linode/')) {
      return `linode/${whiteLabelId}`;
    }
    return whiteLabelId;
  }

  // Path 2: Legacy hash-based template ID (e.g. "tpl_4a61d5f6f1f9a9f3e58ab1e2") → lookup
  if (isLegacyTemplateId(requested)) {
    const images = await linodeService.getLinodeImages(providerApiToken);
    for (const image of images) {
      const upstreamId = String(image.id || "").trim();
      if (toLegacyTemplateId(providerId, upstreamId) === requested) {
        return upstreamId;
      }
    }
    return null;
  }

  // Path 3: Bare upstream image ID → pass through as-is
  return requested;
}

async function _loadActiveProviderToken(
  providerType: "linode",
): Promise<string | null> {
  const providerInfo = await getProviderTokenByType(providerType);
  return providerInfo?.token ?? null;
}

async function loadProviderTokenById(
  providerId: string,
  providerType: "linode",
): Promise<string | null> {
  const providerResult = await query(
    "SELECT id, api_key_encrypted FROM service_providers WHERE id = $1 AND type = $2 AND active = true LIMIT 1",
    [providerId, providerType],
  );

  if (providerResult.rows.length === 0) {
    return null;
  }

  const providerRow = providerResult.rows[0];
  return normalizeProviderToken(providerRow.id, providerRow.api_key_encrypted);
}

router.get("/networking/config", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      "SELECT rdns_base_domain FROM networking_config ORDER BY updated_at DESC LIMIT 1",
    );
    const row = result.rows?.[0] ?? null;
    const baseDomain =
      typeof row?.rdns_base_domain === "string" &&
      row.rdns_base_domain.trim().length > 0
        ? row.rdns_base_domain.trim()
        : DEFAULT_RDNS_BASE_DOMAIN;
    res.json({ config: { rdns_base_domain: baseDomain } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load networking configuration";
    if (message.toLowerCase().includes("does not exist")) {
      res.json({
        config: { rdns_base_domain: DEFAULT_RDNS_BASE_DOMAIN },
        warning: message,
      });
      return;
    }
    console.error("Networking config fetch error:", error);
    res.status(500).json({ error: message });
  }
});

// Get active providers (user-accessible, respects display_order)
router.get("/providers", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      "SELECT id, name, type, active, display_order FROM service_providers WHERE active = true ORDER BY display_order ASC NULLS LAST, created_at DESC",
    );
    res.json({ providers: result.rows || [] });
  } catch (err: any) {
    console.error("VPS providers list error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch providers" });
  }
});

/**
 * GET /api/vps/plans
 *
 * Retrieve available VPS plans for users with backup pricing information.
 *
 * Authentication: User authentication required
 *
 * Response includes:
 * - Plan details (name, provider, pricing)
 * - Backup pricing breakdown (base + upcharge)
 * - Available backup frequencies (daily/weekly)
 * - Total costs for different backup options
 *
 * See: repo-docs/FLEXIBLE_BACKUP_PRICING_API.md for detailed documentation
 */
router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
         provider_id,
         provider_plan_id,
         base_price,
         markup_price,
         backup_price_monthly,
         backup_price_hourly,
         backup_upcharge_monthly,
         backup_upcharge_hourly,
         daily_backups_enabled,
         weekly_backups_enabled,
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications
       FROM vps_plans
       WHERE active = true
       ORDER BY created_at DESC`,
    );

    const plans = (result.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      provider_id: row.provider_id,
      provider_plan_id: row.provider_plan_id,
      base_price: row.base_price,
      markup_price: row.markup_price,
      backup_price_monthly: row.backup_price_monthly || 0,
      backup_price_hourly: row.backup_price_hourly || 0,
      backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
      backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
      daily_backups_enabled: row.daily_backups_enabled || false,
      weekly_backups_enabled: row.weekly_backups_enabled !== false,
      region_id: row.region_id,
      specifications: row.specifications,
    }));

    res.json({ plans });
  } catch (error) {
    console.error("VPS plans fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch plans";
    res.status(500).json({ error: message });
  }
});

const BACKUP_DAY_OPTIONS = new Set([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const BACKUP_WINDOW_OPTIONS = new Set([
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
]);

interface MetricPoint {
  timestamp: number;
  value: number;
}

interface MetricSummary {
  average: number;
  peak: number;
  last: number;
}

interface MetricSeriesPayload {
  series: MetricPoint[];
  summary: MetricSummary;
  unit: "percent" | "bitsPerSecond" | "blocksPerSecond";
}

interface AccountTransferPayload {
  quotaGb: number;
  usedGb: number;
  billableGb: number;
  remainingGb: number;
}

interface TransferPayload {
  usedGb: number;
  quotaGb: number;
  billableGb: number;
  utilizationPercent: number;
  account: AccountTransferPayload | null;
  usedBytes: number;
}

interface BackupsPayload {
  enabled: boolean;
  available: boolean;
  schedule: { day: string | null; window: string | null } | null;
  lastSuccessful: string | null;
  automatic: BackupSummaryPayload[];
  snapshot: BackupSummaryPayload | null;
  snapshotInProgress: BackupSummaryPayload | null;
}

interface BackupSummaryPayload {
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

interface PlanSpecs {
  vcpus: number;
  memory: number;
  disk: number;
  transfer: number;
}

interface PlanPricing {
  hourly: number;
  monthly: number;
}

interface PlanMeta {
  planRow: any;
  specs: PlanSpecs;
  pricing: PlanPricing;
  providerPlanId: string | null;
}

const normalizeProviderStatus = (status: string | null | undefined): string => {
  if (!status) return "unknown";
  return status === "offline" ? "stopped" : status;
};

const isMetricTuple = (value: unknown): value is LinodeMetricTuple =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number";

const normalizeSeries = (series: unknown): MetricPoint[] => {
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

const summarizeSeries = (series: MetricPoint[]): MetricSummary => {
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

const deriveTimeframe = (
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

const bytesToGigabytes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value / 1_000_000_000;
};

const extractTransferUsedBytes = (value: unknown): number => {
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

const extractTransferBillableBytes = (value: unknown): number => {
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

const mapBackupSummary = (
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

const toStringOrNull = (value: any): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
};

const toNumberOrNull = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
};

const mapIPv4Address = (entry: any): any | null => {
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

const mapIPv6Assignment = (entry: any): any | null => {
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

const mapIPv6Range = (entry: any): any | null => {
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

const mapIPv6RangeCollection = (value: any): any[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(mapIPv6Range)
    .filter((item: any): item is Record<string, unknown> => Boolean(item));
};

const pickIPv4Array = (source: any, key: string): any[] => {
  if (source && Array.isArray(source[key])) {
    return source[key];
  }
  return [];
};

const pickIPv6Pool = (source: any): any[] => {
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

const mapFirewallAttachment = (entry: any): any | null => {
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

const mapFirewallSummary = (entry: any, attachment?: any): any | null => {
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

const mapFirewallOption = (entry: any): any | null => {
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

const mapConfigProfile = (entry: any): any | null => {
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

const mapEventSummary = (entry: any): any | null => {
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

const clampPercent = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const PROGRESS_ACTION_MAP: Record<string, string[]> = {
  provisioning: [
    "linode_create",
    "linode_clone",
    "linode_migrate",
    "linode_migration_begin",
  ],
  rebooting: ["linode_reboot", "linode_shutdown", "linode_boot"],
  restoring: [
    "linode_snapshot_clone",
    "linode_snapshot_restore",
    "linode_migrate",
  ],
  backing_up: ["linode_snapshot", "linode_snapshot_create"],
  rebuilding: ["linode_rebuild"],
};

const pickProgressEvent = (
  events: Array<Record<string, any>>,
  instanceStatus: string,
): Record<string, any> | null => {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const normalizedStatus = (instanceStatus || "").toLowerCase();
  const actionCandidates = PROGRESS_ACTION_MAP[normalizedStatus];

  if (Array.isArray(actionCandidates) && actionCandidates.length > 0) {
    const actionSet = new Set(
      actionCandidates.map((action) => action.toLowerCase()),
    );
    const byAction = events.find((event) => {
      const action =
        typeof event?.action === "string" ? event.action.toLowerCase() : "";
      return actionSet.has(action);
    });
    if (byAction) {
      return byAction;
    }
  }

  const activeByPercent = events.find((event) => {
    const percent = clampPercent(event?.percentComplete ?? null);
    return percent !== null && percent < 100;
  });
  if (activeByPercent) {
    return activeByPercent;
  }

  const activeByStatus = events.find((event) => {
    const status =
      typeof event?.status === "string" ? event.status.toLowerCase() : "";
    return status && status !== "finished" && status !== "notification";
  });
  if (activeByStatus) {
    return activeByStatus;
  }

  const anyWithPercent = events.find(
    (event) => clampPercent(event?.percentComplete ?? null) !== null,
  );
  return anyWithPercent || null;
};

const deriveProgressFromEvents = (
  instanceStatus: string,
  events: Array<Record<string, any>>,
): {
  percent: number | null;
  action: string | null;
  status: string | null;
  message: string | null;
  created: string | null;
} | null => {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  const bestEvent = pickProgressEvent(events, instanceStatus);
  if (!bestEvent) {
    return null;
  }

  const rawPercent = clampPercent(bestEvent?.percentComplete ?? null);
  let percent = rawPercent;
  if (percent === null) {
    const status =
      typeof bestEvent?.status === "string"
        ? bestEvent.status.toLowerCase()
        : "";
    if (
      status === "finished" ||
      status === "completed" ||
      status === "success"
    ) {
      percent = 100;
    } else if (status === "failed" || status === "error") {
      percent = 100;
    } else if (status === "started" || status === "running") {
      percent = 10;
    }
  }

  return {
    percent,
    action: typeof bestEvent?.action === "string" ? bestEvent.action : null,
    status: typeof bestEvent?.status === "string" ? bestEvent.status : null,
    message: typeof bestEvent?.message === "string" ? bestEvent.message : null,
    created: typeof bestEvent?.created === "string" ? bestEvent.created : null,
  };
};

let regionLabelCache: Map<string, string> | null = null;

const ensureRegionLabelCache = async (): Promise<Map<string, string>> => {
  if (regionLabelCache) {
    return regionLabelCache;
  }
  try {
    const regions = await linodeService.getLinodeRegions();
    regionLabelCache = new Map(
      regions.map((region) => [region.id, region.label]),
    );
  } catch (err) {
    console.warn("Failed to populate region label cache:", err);
    regionLabelCache = new Map();
  }
  return regionLabelCache;
};

const resolveRegionLabel = async (
  regionId: string | null,
): Promise<string | null> => {
  if (!regionId) {
    return null;
  }
  const cache = await ensureRegionLabelCache();
  if (cache.has(regionId)) {
    return cache.get(regionId) ?? null;
  }
  try {
    const regions = await linodeService.getLinodeRegions();
    regionLabelCache = new Map(
      regions.map((region) => [region.id, region.label]),
    );
    return regionLabelCache.get(regionId) ?? null;
  } catch (err) {
    console.warn("Failed to refresh region labels:", err);
    return null;
  }
};

const resolvePlanMeta = async (
  instanceRow: any,
  providerDetail: LinodeInstance | null,
): Promise<PlanMeta> => {
  let planRow: any = null;
  const configuration =
    instanceRow?.configuration && typeof instanceRow.configuration === "object"
      ? instanceRow.configuration
      : {};
  const configuredType =
    typeof configuration?.type === "string" ? configuration.type : undefined;
  const providerType = providerDetail?.type;

  const planIdCandidate = instanceRow?.plan_id;

  try {
    if (planIdCandidate) {
      const res = await query("SELECT * FROM vps_plans WHERE id = $1 LIMIT 1", [
        planIdCandidate,
      ]);
      planRow = res.rows[0] ?? null;
    }
    if (!planRow && configuredType) {
      const res = await query(
        "SELECT * FROM vps_plans WHERE provider_plan_id = $1 LIMIT 1",
        [configuredType],
      );
      planRow = res.rows[0] ?? null;
    }
    if (!planRow && providerType) {
      const res = await query(
        "SELECT * FROM vps_plans WHERE provider_plan_id = $1 LIMIT 1",
        [providerType],
      );
      planRow = res.rows[0] ?? null;
    }
  } catch (err) {
    console.warn("Failed to resolve VPS plan metadata:", err);
  }

  const providerPlanId =
    typeof planRow?.provider_plan_id === "string"
      ? String(planRow.provider_plan_id)
      : (configuredType ?? providerType ?? null);

  const specs: PlanSpecs = { vcpus: 0, memory: 0, disk: 0, transfer: 0 };
  const pricing: PlanPricing = { hourly: 0, monthly: 0 };

  if (planRow) {
    const rawSpecs =
      planRow.specifications && typeof planRow.specifications === "object"
        ? planRow.specifications
        : {};

    const sanitizeNumber = (value: any): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };

    const pickNumber = (candidates: Array<number | undefined>): number => {
      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return candidate;
        }
      }
      return 0;
    };

    const storageMb = sanitizeNumber(rawSpecs.storage_mb);
    const storageGb = sanitizeNumber(rawSpecs.storage_gb);
    const memoryMb = sanitizeNumber(rawSpecs.memory_mb);
    const memoryGb = sanitizeNumber(rawSpecs.memory_gb);

    const diskValues: Array<number | undefined> = [
      sanitizeNumber(rawSpecs.disk),
      storageMb,
      storageGb !== undefined ? storageGb * 1024 : undefined,
    ];

    const memoryValues: Array<number | undefined> = [
      sanitizeNumber(rawSpecs.memory),
      memoryMb,
      memoryGb !== undefined ? memoryGb * 1024 : undefined,
    ];

    const cpuValues: Array<number | undefined> = [
      sanitizeNumber(rawSpecs.vcpus),
      sanitizeNumber(rawSpecs.cpu_cores),
    ];

    const transferValues: Array<number | undefined> = [
      sanitizeNumber(rawSpecs.transfer),
      sanitizeNumber(rawSpecs.transfer_gb),
      sanitizeNumber(rawSpecs.bandwidth_gb),
    ];

    specs.disk = pickNumber(diskValues);
    specs.memory = pickNumber(memoryValues);
    specs.vcpus = pickNumber(cpuValues);
    specs.transfer = pickNumber(transferValues);

    const basePrice = Number(planRow.base_price ?? 0);
    const markupPrice = Number(planRow.markup_price ?? 0);
    const monthly = basePrice + markupPrice;
    pricing.monthly = monthly;
    pricing.hourly = monthly > 0 ? monthly / 730 : 0;
  } else if (providerDetail?.specs) {
    specs.vcpus = Number(providerDetail.specs.vcpus ?? 0);
    specs.memory = Number(providerDetail.specs.memory ?? 0);
    specs.disk = Number(providerDetail.specs.disk ?? 0);
    specs.transfer = Number(providerDetail.specs.transfer ?? 0);
  }

  return {
    planRow,
    specs,
    pricing,
    providerPlanId: providerPlanId ?? null,
  };
};

// Get available admin-configured apps / StackScripts
// NOTE: This endpoint previously returned Linode marketplace/community StackScripts.
// We intentionally restrict this to admin-configured StackScript entries only
// so creation workflows use curated, provider-account-owned StackScripts.
router.get("/apps", async (req: Request, res: Response) => {
  try {
    // Return only enabled StackScript configs created by admins
    const configsRes = await query(
      `SELECT stackscript_id, label, description, is_enabled, display_order, metadata
         FROM vps_stackscript_configs
        WHERE is_enabled = TRUE
        ORDER BY display_order ASC, created_at ASC`,
    );

    const configs = configsRes.rows || [];

    if (configs.length === 0) {
      return res.json({ apps: [] });
    }

    // Try to fetch provider-owned StackScripts (mineOnly true)
    const ownedScripts = await linodeService
      .getLinodeStackScripts({ mineOnly: true })
      .catch(() => []);
    const scriptMap = new Map<number, any>();
    ownedScripts.forEach((s: any) => scriptMap.set(Number(s.id), s));

    const apps: any[] = [];
    for (const row of configs) {
      const id = Number(row.stackscript_id);
      let script = scriptMap.get(id);
      if (!script) {
        try {
          script = await linodeService.getStackScript(id);
        } catch (err) {
          // If a script cannot be fetched, skip it (admins can fix via admin UI)
          console.warn(
            `Configured StackScript ${id} could not be loaded:`,
            err?.message || err,
          );
          continue;
        }
      }

      const displayLabel = row.label || script.label || `StackScript ${id}`;
      const displayDescription =
        row.description || script.description || script.rev_note || "";
      const user_defined_fields = Array.isArray(script.user_defined_fields)
        ? script.user_defined_fields
        : [];

      apps.push({
        slug: `stackscript-${id}`,
        id,
        name: script.label || displayLabel,
        display_name: displayLabel,
        description: displayDescription,
        summary: script.description || script.rev_note || "",
        images: Array.isArray(script.images) ? script.images : [],
        user_defined_fields,
        stackscript_id: id,
        isMarketplace: false,
      });
    }

    res.json({ apps });
  } catch (err: any) {
    console.error("Configured apps fetch error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch configured apps" });
  }
});

// Get available Linode images
router.get("/images", async (req: Request, res: Response) => {
  try {
    const providerId =
      typeof req.query.provider_id === "string" ? req.query.provider_id.trim() : "";

    if (!providerId) {
      return res.status(400).json({
        error: "provider_id query parameter is required",
        code: "PROVIDER_ID_REQUIRED",
      });
    }

    const providerToken = await loadProviderTokenById(providerId, "linode");
    if (!providerToken) {
      return res.status(404).json({
        error: "Provider not found or inactive",
        code: "PROVIDER_NOT_FOUND",
      });
    }

    const images = await linodeService.getLinodeImages(providerToken);
    const templates = images.map((image) =>
      normalizeImageTemplate(image, providerId),
    );
    res.json({ images: templates });
  } catch (err: any) {
    console.error("Images fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch images" });
  }
});

// Get available regions for a specific provider
// Optionally filtered by type_class to only show regions with active plans of that type
router.get(
  "/providers/:providerId/regions",
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { type_class } = req.query as any;

      // Fetch provider details
      const providerResult = await query(
        "SELECT id, type, api_key_encrypted, allowed_regions FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
        [providerId],
      );

      if (providerResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Provider not found or inactive" });
      }

      const provider = providerResult.rows[0];
      const providerType = provider.type as "linode";

      let allowedRegions: string[] = [];

      try {
        const overridesResult = await query(
          "SELECT region FROM provider_region_overrides WHERE provider_id = $1",
          [providerId],
        );

        if (overridesResult.rows.length > 0) {
          allowedRegions = normalizeRegionList(
            overridesResult.rows
              .map((row) => row.region)
              .filter((value): value is string => typeof value === "string"),
          );
        }
      } catch (overrideErr: any) {
        const message = String(overrideErr?.message || "").toLowerCase();
        const relationMissing =
          message.includes("relation") &&
          message.includes("provider_region_overrides");
        if (!relationMissing) {
          throw overrideErr;
        }
      }

      if (allowedRegions.length === 0) {
        allowedRegions = parseStoredAllowedRegions(
          provider.allowed_regions ?? null,
        );
      }

      const normalizedAllowedRegions =
        allowedRegions.length > 0 ? allowedRegions : [];
      const shouldApplyAllowedRegionFilter = shouldFilterByAllowedRegions(
        normalizedAllowedRegions,
      );

      if (providerType !== "linode") {
        return res.status(400).json({ error: "Unsupported provider type" });
      }

      const allRegions = await linodeService.getLinodeRegions();

      // Filter regions based on allowed_regions configuration
      let regions = allRegions;
      if (shouldApplyAllowedRegionFilter) {
        const allowedSet = new Set(normalizedAllowedRegions);
        regions = allRegions.filter(
          (region) =>
            region &&
            typeof region.id === "string" &&
            allowedSet.has(region.id.toLowerCase()),
        );
      }

      // If type_class is specified, filter to only show regions with active plans of that type
      if (type_class && typeof type_class === "string") {
        try {
          // Get unique region IDs that have active plans with the specified type_class
          const plansResult = await query(
            `SELECT DISTINCT vpr.region_id
             FROM vps_plan_regions vpr
             INNER JOIN vps_plans p ON vpr.vps_plan_id = p.id
             WHERE p.provider_id = $1
               AND p.active = true
               AND p.type_class = $2`,
            [providerId, type_class],
          );

          const regionsWithPlans = new Set(
            (plansResult.rows || []).map((row: any) => row.region_id),
          );

          // Only return regions that have active plans for this type_class
          regions = regions.filter(
            (region) =>
              region &&
              typeof region.id === "string" &&
              regionsWithPlans.has(region.id),
          );
        } catch (plansErr: any) {
          const message = String(plansErr?.message || "").toLowerCase();
          // If the vps_plan_regions table doesn't exist yet, just return all regions
          if (
            !message.includes("does not exist") &&
            !message.includes("relation")
          ) {
            throw plansErr;
          }
        }
      }

      res.json({ regions });
    } catch (err: any) {
      console.error("Regions fetch error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch regions" });
    }
  },
);

/**
 * GET /api/vps/providers/:providerId/plans/:regionId
 *
 * Get VPS plans available for a specific provider and region.
 *
 * Query parameters:
 * - type_class: Optional filter by plan type (standard, cpu, memory, premium, gpu, accelerated)
 *
 * Returns plans that are:
 * - Active
 * - Belong to the specified provider
 * - Available in the specified region (via vps_plan_regions junction table)
 * - Optionally filtered by type_class
 */
router.get(
  "/providers/:providerId/plans/:regionId",
  async (req: Request, res: Response) => {
    try {
      const { providerId, regionId } = req.params;
      const { type_class } = req.query as any;

      // Verify provider exists
      const providerCheck = await query(
        "SELECT id FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
        [providerId],
      );

      if (providerCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Provider not found or inactive" });
      }

      let queryText = `
        SELECT
          p.id,
          p.name,
          COALESCE(p.specifications->>'description', '') AS description,
          p.provider_id,
          p.provider_plan_id,
          p.base_price,
          p.markup_price,
          p.backup_price_monthly,
          p.backup_price_hourly,
          p.backup_upcharge_monthly,
          p.backup_upcharge_hourly,
          p.daily_backups_enabled,
          p.weekly_backups_enabled,
          p.type_class,
          p.specifications
        FROM vps_plans p
        INNER JOIN vps_plan_regions vpr ON p.id = vpr.vps_plan_id
        WHERE p.active = true
          AND p.provider_id = $1
          AND vpr.region_id = $2
      `;

      const queryParams: any[] = [providerId, regionId];

      if (type_class && typeof type_class === "string") {
        queryText += ` AND p.type_class = $3`;
        queryParams.push(type_class);
      }

      queryText += ` ORDER BY p.base_price ASC`;

      const result = await query(queryText, queryParams);

      const plans = (result.rows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        provider_id: row.provider_id,
        provider_plan_id: row.provider_plan_id,
        base_price: row.base_price,
        markup_price: row.markup_price,
        backup_price_monthly: row.backup_price_monthly || 0,
        backup_price_hourly: row.backup_price_hourly || 0,
        backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
        backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
        daily_backups_enabled: row.daily_backups_enabled || false,
        weekly_backups_enabled: row.weekly_backups_enabled !== false,
        type_class: row.type_class || "standard",
        specifications: row.specifications,
      }));

      res.json({ plans });
    } catch (error) {
      console.error("Region-filtered plans fetch error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch plans";
      res.status(500).json({ error: message });
    }
  },
);

// Get available Linode stack scripts
router.get("/stackscripts", async (req: Request, res: Response) => {
  const isTruthy = (value: any) => String(value || "").toLowerCase() === "true";
  const configuredOnly = isTruthy(
    (req.query as any).configured ||
      (req.query as any).allowed ||
      (req.query as any).allowedOnly,
  );
  const mineOnly = isTruthy(req.query.mine);

  try {
    if (configuredOnly) {
      let configs: any[] = [];
      try {
        const configRes = await query(
          `SELECT stackscript_id, label, description, is_enabled, display_order, metadata
             FROM vps_stackscript_configs
            WHERE is_enabled = TRUE
            ORDER BY display_order ASC, created_at ASC`,
        );
        configs = configRes.rows || [];
      } catch (configErr: any) {
        const msg = String(configErr?.message || "").toLowerCase();
        if (
          msg.includes("does not exist") ||
          (msg.includes("relation") && msg.includes("vps_stackscript_configs"))
        ) {
          console.warn(
            "StackScript config table missing; returning empty configured list",
          );
          return res.json({ stackscripts: [] });
        }
        throw configErr;
      }

      if (configs.length === 0) {
        return res.json({ stackscripts: [] });
      }

      let ownedScripts: any[] = [];
      const scriptMap = new Map<number, any>();
      try {
        ownedScripts = await linodeService.getLinodeStackScripts({
          mineOnly: true,
        });
        ownedScripts.forEach((script) => scriptMap.set(script.id, script));
      } catch (err) {
        console.warn(
          "Failed to fetch owned StackScripts list, will query individually:",
          err,
        );
      }

      const enriched: any[] = [];
      for (const row of configs) {
        const stackscriptId = Number(row.stackscript_id);
        let script = scriptMap.get(stackscriptId);
        if (!script) {
          try {
            const single = await linodeService.getStackScript(stackscriptId);
            if (single) {
              script = single;
              scriptMap.set(single.id, single);
            }
          } catch (err) {
            console.warn(`Failed to fetch StackScript ${stackscriptId}:`, err);
          }
        }

        if (!script) {
          continue;
        }

        const displayLabel =
          row.label || script.label || `StackScript ${stackscriptId}`;
        const displayDescription =
          row.description || script.description || script.rev_note || "";
        const metadata =
          row.metadata && typeof row.metadata === "object" ? row.metadata : {};

        enriched.push({
          ...script,
          label: displayLabel,
          description: displayDescription,
          config: {
            stackscript_id: stackscriptId,
            label: row.label,
            description: row.description,
            is_enabled: row.is_enabled !== false,
            display_order: Number(row.display_order || 0),
            metadata,
          },
        });
      }

      enriched.sort((a, b) => {
        const orderA = Number(a?.config?.display_order ?? 0);
        const orderB = Number(b?.config?.display_order ?? 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a?.label || "").localeCompare(
          String(b?.label || ""),
          undefined,
          { sensitivity: "base" },
        );
      });

      return res.json({ stackscripts: enriched });
    }

    const stackscripts = await linodeService.getLinodeStackScripts({
      mineOnly,
    });
    return res.json({ stackscripts });
  } catch (err: any) {
    console.error("StackScripts fetch error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch stack scripts" });
  }
});

// Get SSH keys for the active organization (organization-scoped for security)
// SECURITY: This endpoint queries the local database to ensure organization isolation
// and prevent cross-organization SSH key exposure.
router.get("/providers/:providerId/ssh-keys", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const organizationId = (req as any).user?.organizationId;
    if (!userId || !organizationId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const canViewKeys = await RoleService.checkPermission(
      userId,
      organizationId,
      "ssh_keys_view",
    );
    if (!canViewKeys) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view SSH keys" });
    }

    // SECURITY FIX: Query local database with organization scoping
    // instead of fetching ALL keys from Linode API (which would expose cross-org keys)
    const result = await query(
      `SELECT id, name, public_key, fingerprint, linode_key_id, created_at
       FROM user_ssh_keys
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    // Map to expected format for LinodeConfiguration component
    const keys = result.rows.map(row => ({
      id: row.linode_key_id || row.id,
      label: row.name,
      ssh_key: row.public_key,
      fingerprint: row.fingerprint,
      created: row.created_at,
    }));

    return res.json({ ssh_keys: keys });
  } catch (err: any) {
    console.error("SSH keys fetch error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to fetch SSH keys" });
  }
});

// List VPS instances for the user's organization with permission-based filtering
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;

    let result;

    if (userRole === "admin") {
      // System admins see all VPS instances for the current organization
      // If organizationId is not set, they might see nothing or need to handle personal view
      if (user.organizationId) {
        result = await query(
          "SELECT * FROM vps_instances WHERE organization_id = $1 ORDER BY created_at DESC",
          [user.organizationId],
        );
      } else {
        // Fallback for admin with no org (should be rare/impossible with current auth)
        result = await query(
          "SELECT * FROM vps_instances WHERE organization_id IS NULL ORDER BY created_at DESC",
        );
      }
    } else {
      const organizationId = user.organizationId;

      const hasVpsViewPermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_view",
      );

      if (hasVpsViewPermission) {
        result = await query(
          "SELECT * FROM vps_instances WHERE organization_id = $1 ORDER BY created_at DESC",
          [organizationId],
        );
      } else {
        result = await query(
          "SELECT * FROM vps_instances WHERE organization_id IS NULL AND created_by = $1 ORDER BY created_at DESC",
          [userId],
        );
      }
    }

    const rows = result.rows || [];

    const providerIdList = Array.from(
      new Set(
        rows
          .map((row) => row.provider_id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0,
          ),
      ),
    );

    const providerMetadata = new Map<
      string,
      { id: string; name: string | null; type: ProviderType }
    >();
    if (providerIdList.length > 0) {
      try {
        const providersRes = await query(
          `SELECT id, name, type FROM service_providers WHERE id = ANY($1::uuid[])`,
          [providerIdList],
        );
        for (const providerRow of providersRes.rows || []) {
          providerMetadata.set(providerRow.id, {
            id: providerRow.id,
            name:
              typeof providerRow.name === "string" &&
              providerRow.name.trim().length > 0
                ? providerRow.name
                : null,
            type: (providerRow.type || "linode") as ProviderType,
          });
        }
      } catch (providerErr) {
        console.warn("Failed to fetch provider metadata:", providerErr);
      }
    }

    let linodeRegionLabelMap: Record<string, string> = {};
    const hasLinodeRows = rows.some((row) => {
      const providerInfo = row.provider_id
        ? providerMetadata.get(row.provider_id)
        : null;
      const inferredType = (row.provider_type ||
        providerInfo?.type ||
        "linode") as ProviderType;
      return inferredType === "linode";
    });
    if (hasLinodeRows) {
      try {
        const regions = await linodeService.getLinodeRegions();
        linodeRegionLabelMap = Object.fromEntries(
          regions.map((region) => [region.id, region.label]),
        );
      } catch (regionErr) {
        console.warn("Failed to fetch Linode regions for labeling:", regionErr);
      }
    }

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const providerInfo = row.provider_id
          ? providerMetadata.get(row.provider_id)
          : null;
        const providerType = (row.provider_type ||
          providerInfo?.type ||
          "linode") as ProviderType;
        (row as any).provider_type = providerType;
        const providerName = providerInfo?.name ?? null;
        (row as any).provider_name = providerName;
        (row as any).providerName = providerName;

        const providerInstanceId = Number(row.provider_instance_id);
        let configuration =
          row.configuration && typeof row.configuration === "object"
            ? row.configuration
            : {};

        if (providerType === "linode" && Number.isFinite(providerInstanceId)) {
          try {
            const detail =
              await linodeService.getLinodeInstance(providerInstanceId);

            const currentIp =
              Array.isArray(detail.ipv4) && detail.ipv4.length > 0
                ? detail.ipv4[0]
                : null;
            const normalized =
              detail.status === "offline" ? "stopped" : detail.status;

            if (row.status !== normalized || row.ip_address !== currentIp) {
              await query(
                "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
                [normalized, currentIp, row.id],
              );
              row.status = normalized;
              row.ip_address = currentIp;
            } else {
              row.status = normalized;
              row.ip_address = currentIp;
            }

            const newConf = {
              ...configuration,
              image: detail.image || configuration.image,
              region: detail.region || configuration.region,
              type: detail.type || configuration.type,
            };
            configuration = newConf;
            row.configuration = newConf;

            const regionCode = newConf.region || "";
            (row as any).region_label =
              linodeRegionLabelMap[regionCode] ?? null;

            let planSpecs = { vcpus: 0, memory: 0, disk: 0, transfer: 0 };
            let planPricing = { hourly: 0, monthly: 0 };
            let planRow: any = null;
            try {
              if (row.plan_id) {
                const byId = await query(
                  "SELECT * FROM vps_plans WHERE id = $1 LIMIT 1",
                  [row.plan_id],
                );
                planRow = byId.rows[0] || null;
              }
              if (!planRow && newConf.type) {
                const byProviderId = await query(
                  "SELECT * FROM vps_plans WHERE provider_plan_id = $1 LIMIT 1",
                  [newConf.type],
                );
                planRow = byProviderId.rows[0] || null;
              }

              if (planRow) {
                const specs = planRow.specifications || {};
                const disk =
                  (typeof specs.disk === "number" ? specs.disk : undefined) ??
                  (typeof specs.storage_gb === "number"
                    ? specs.storage_gb
                    : undefined) ??
                  0;
                const memoryMb =
                  (typeof specs.memory === "number"
                    ? specs.memory
                    : undefined) ??
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
                  (typeof specs.transfer === "number"
                    ? specs.transfer
                    : undefined) ??
                  (typeof specs.transfer_gb === "number"
                    ? specs.transfer_gb
                    : undefined) ??
                  (typeof specs.bandwidth_gb === "number"
                    ? specs.bandwidth_gb
                    : undefined) ??
                  0;

                const basePrice = Number(planRow.base_price || 0);
                const markupPrice = Number(planRow.markup_price || 0);
                const monthly = basePrice + markupPrice;

                planSpecs = {
                  vcpus,
                  memory: memoryMb,
                  disk,
                  transfer: transferGb,
                };
                planPricing = {
                  hourly: monthly > 0 ? monthly / 730 : 0,
                  monthly,
                };
              } else if (detail && detail.specs) {
                planSpecs = {
                  vcpus: Number(detail.specs.vcpus || 0),
                  memory: Number(detail.specs.memory || 0),
                  disk: Number(detail.specs.disk || 0),
                  transfer: Number(detail.specs.transfer || 0),
                };
              }
            } catch (planErr) {
              console.warn("Failed to attach plan specs/pricing:", planErr);
            }

            (row as any).plan_specs = planSpecs;
            (row as any).plan_pricing = planPricing;
            (row as any).plan_name = planRow ? planRow.name : null;

            const normalizedStatus =
              typeof row.status === "string" ? row.status.toLowerCase() : "";
            if (
              ["provisioning", "rebooting", "restoring", "backing_up"].includes(
                normalizedStatus,
              )
            ) {
              try {
                const eventsData = await linodeService.getLinodeInstanceEvents(
                  providerInstanceId,
                  { pageSize: 50 },
                );
                const events = Array.isArray((eventsData as any)?.data)
                  ? (eventsData as any).data
                      .map(mapEventSummary)
                      .filter(Boolean)
                  : [];
                const progress = deriveProgressFromEvents(
                  normalizedStatus,
                  events,
                );
                (row as any).provider_progress = progress;
                (row as any).progress_percent = progress?.percent ?? null;
              } catch (eventError) {
                console.warn(
                  "Failed to fetch instance events for progress:",
                  eventError,
                );
              }
            } else {
              (row as any).provider_progress = null;
              (row as any).progress_percent = null;
            }
          } catch (err) {
            console.warn("Failed to enrich instance with Linode details:", err);
          }
        } else {
          if (row.status === "offline") {
            (row as any).status = "stopped";
          }
          (row as any).provider_progress = null;
          (row as any).progress_percent = null;
        }

        if ((row as any).status === "offline") {
          (row as any).status = "stopped";
        }

        return row;
      }),
    );

    res.json({ instances: enriched });
  } catch (err: any) {
    console.error("VPS list error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch VPS instances" });
  }
});

// Get VPS uptime summary for billing display
// this endpoint should only return data scoped to a user's organization or
// their own personal VPSes. Previously the admin role bypassed all filters
// and returned every VPS in the database which exposed other customers' data.
//
// To fix the privacy bug we drop the special admin branch and enforce the
// same logic that applies to regular users.  The route is also now protected
// by `requireOrganization` so callers must have an organization context.
router.get("/uptime-summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const organizationId = user.organizationId;

    // users that belong to an organization and have the `vps_view`
    // permission can see every VPS in that organization; otherwise they only
    // see their own personal instances (organization_id IS NULL).
    const hasVpsViewPermission = await RoleService.checkPermission(
      userId,
      organizationId,
      "vps_view",
    );

    let result;

    if (hasVpsViewPermission) {
      result = await query(
        `SELECT
            vi.id,
            vi.label,
            vi.status,
            vi.created_at,
            vi.last_billed_at,
            vi.plan_id,
            vp.base_price,
            vp.markup_price,
            vp.provider_plan_id
          FROM vps_instances vi
          LEFT JOIN vps_plans vp ON vi.plan_id::uuid = vp.id
          WHERE vi.organization_id = $1
          ORDER BY vi.created_at DESC`,
        [organizationId],
      );
    } else {
      result = await query(
        `SELECT
            vi.id,
            vi.label,
            vi.status,
            vi.created_at,
            vi.last_billed_at,
            vi.plan_id,
            vp.base_price,
            vp.markup_price,
            vp.provider_plan_id
          FROM vps_instances vi
          LEFT JOIN vps_plans vp ON vi.plan_id::uuid = vp.id
          WHERE vi.organization_id IS NULL AND vi.created_by = $1
          ORDER BY vi.created_at DESC`,
        [userId],
      );
    }

    const instances = result.rows || [];

    if (instances.length === 0) {
      return res.json({
        totalActiveHours: 0,
        totalEstimatedCost: 0,
        vpsInstances: [],
      });
    }

    const currentTime = new Date();
    let totalActiveHours = 0;
    let totalEstimatedCost = 0;

    const vpsInstances = instances.map((instance: any) => {
      // Calculate active hours from creation to now
      const createdAt = new Date(instance.created_at);
      const activeMilliseconds = currentTime.getTime() - createdAt.getTime();
      const activeHours = activeMilliseconds / (1000 * 60 * 60);

      // Calculate hourly rate from plan pricing
      // Default fallback rate if plan data is missing
      let hourlyRate = 0.027;

      if (instance.base_price !== null && instance.markup_price !== null) {
        const basePrice = parseFloat(instance.base_price) || 0;
        const markupPrice = parseFloat(instance.markup_price) || 0;
        const monthlyPrice = basePrice + markupPrice;
        // Convert monthly to hourly (730 hours per month average)
        hourlyRate = monthlyPrice / 730;
      }

      // Calculate estimated cost
      const estimatedCost = activeHours * hourlyRate;

      totalActiveHours += activeHours;
      totalEstimatedCost += estimatedCost;

      return {
        id: instance.id,
        label: instance.label,
        status: instance.status,
        createdAt: instance.created_at,
        deletedAt: null, // Not tracking deletions yet
        activeHours: Math.round(activeHours * 10) / 10, // Round to 1 decimal
        hourlyRate: Math.round(hourlyRate * 100000) / 100000, // Round to 5 decimals
        estimatedCost: Math.round(estimatedCost * 100) / 100, // Round to 2 decimals
        lastBilledAt: instance.last_billed_at,
      };
    });

    res.json({
      totalActiveHours: Math.round(totalActiveHours * 10) / 10,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      vpsInstances,
    });
  } catch (error) {
    console.error("VPS uptime summary error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch VPS uptime data";
    res.status(500).json({ error: message });
  }
});

// Get VPS instance details with multi-provider support
// Routes to appropriate provider API based on provider_type stored in database
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_view permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsViewPermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_view",
      );

      if (!hasVpsViewPermission) {
        // Only allow access to personal VPSs
        const personalVpsCheck = await query(
          "SELECT * FROM vps_instances WHERE id = $1 AND organization_id IS NULL AND created_by = $2 LIMIT 1",
          [id, userId],
        );

        if (personalVpsCheck.rows.length === 0) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: "vps_view",
          });
        }
      }
    }

    let detailRes;
    if (user.role === "admin") {
      detailRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 LIMIT 1",
        [id],
      );
    } else {
      detailRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2 LIMIT 1",
        [id, organizationId],
      );
    }

    if (detailRes.rows.length === 0) {
      res.status(404).json({ error: "Instance not found" });
      return;
    }

    const instanceRow = detailRes.rows[0];
    let configuration =
      instanceRow?.configuration &&
      typeof instanceRow.configuration === "object"
        ? instanceRow.configuration
        : {};

    // Determine provider type - default to 'linode' for backward compatibility
    const providerType = instanceRow.provider_type || "linode";
    const isLinodeProvider = providerType === "linode";
    const providerInstanceId = Number(instanceRow.provider_instance_id);

    // Fetch provider metadata if provider_id exists
    let providerName: string | null = null;
    if (instanceRow.provider_id) {
      try {
        const providerResult = await query(
          "SELECT name, api_key_encrypted FROM service_providers WHERE id = $1",
          [instanceRow.provider_id],
        );
        if (providerResult.rows.length > 0) {
          const providerRow = providerResult.rows[0];
          providerName =
            typeof providerRow.name === "string" ? providerRow.name : null;
        }
      } catch (err) {
        console.warn("Failed to fetch provider metadata:", err);
      }
    }

    let providerDetail: LinodeInstance | null = null;

    // Route to appropriate provider based on provider_type
    if (isLinodeProvider && Number.isFinite(providerInstanceId)) {
      try {
        providerDetail =
          await linodeService.getLinodeInstance(providerInstanceId);
      } catch (err) {
        console.warn(
          'Failed to fetch Linode provider detail for instance %s:',
          instanceRow.provider_instance_id,
          err,
        );
      }
    }

    if (providerDetail) {
      const newConfiguration = {
        ...configuration,
        image: providerDetail.image || configuration?.image,
        region: providerDetail.region || configuration?.region,
        type: providerDetail.type || configuration?.type,
      };
      configuration = newConfiguration;
    }

    const normalizedStatus = normalizeProviderStatus(
      providerDetail?.status ?? instanceRow.status,
    );
    const providerIp =
      Array.isArray(providerDetail?.ipv4) && providerDetail.ipv4.length > 0
        ? providerDetail.ipv4[0]
        : (instanceRow.ip_address ?? null);

    if (
      instanceRow.status !== normalizedStatus ||
      instanceRow.ip_address !== providerIp
    ) {
      try {
        await query(
          "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
          [normalizedStatus, providerIp, instanceRow.id],
        );
      } catch (err) {
        console.warn("Failed to synchronize instance cache fields:", err);
      }
      instanceRow.status = normalizedStatus;
      instanceRow.ip_address = providerIp;
    } else {
      instanceRow.status = normalizedStatus;
      instanceRow.ip_address = providerIp;
    }

    const regionCode = providerDetail?.region ?? configuration?.region ?? null;
    const regionLabel = await resolveRegionLabel(
      typeof regionCode === "string" ? regionCode : null,
    );

    const planMeta = await resolvePlanMeta(instanceRow, providerDetail);

    let metrics: {
      timeframe: { start: number | null; end: number | null };
      cpu?: MetricSeriesPayload;
      network?: {
        inbound?: MetricSeriesPayload;
        outbound?: MetricSeriesPayload;
        privateIn?: MetricSeriesPayload;
        privateOut?: MetricSeriesPayload;
      };
      io?: {
        read?: MetricSeriesPayload;
        swap?: MetricSeriesPayload;
      };
    } | null = null;

    if (providerDetail && Number.isFinite(providerInstanceId)) {
      try {
        const stats: LinodeInstanceStatsResponse =
          await linodeService.getLinodeInstanceStats(providerInstanceId);
        const statsPayload =
          stats?.data && typeof stats.data === "object" ? stats.data : stats;
        const metricsSource: LinodeInstanceStatsSeries =
          statsPayload && typeof statsPayload === "object"
            ? (statsPayload as LinodeInstanceStatsSeries)
            : {};
        const cpuSeries = normalizeSeries(metricsSource?.cpu);
        const ipv4InSeries = normalizeSeries(metricsSource?.netv4?.in);
        const ipv4OutSeries = normalizeSeries(metricsSource?.netv4?.out);
        const ipv4PrivateInSeries = normalizeSeries(
          metricsSource?.netv4?.private_in,
        );
        const ipv4PrivateOutSeries = normalizeSeries(
          metricsSource?.netv4?.private_out,
        );
        const ioSeries = normalizeSeries(metricsSource?.io?.io);
        const swapSeries = normalizeSeries(metricsSource?.io?.swap);

        metrics = {
          timeframe: deriveTimeframe([
            cpuSeries,
            ipv4InSeries,
            ipv4OutSeries,
            ipv4PrivateInSeries,
            ipv4PrivateOutSeries,
            ioSeries,
            swapSeries,
          ]),
          cpu: {
            series: cpuSeries,
            summary: summarizeSeries(cpuSeries),
            unit: "percent",
          },
          network: {
            inbound: {
              series: ipv4InSeries,
              summary: summarizeSeries(ipv4InSeries),
              unit: "bitsPerSecond",
            },
            outbound: {
              series: ipv4OutSeries,
              summary: summarizeSeries(ipv4OutSeries),
              unit: "bitsPerSecond",
            },
          },
          io: {
            read: {
              series: ioSeries,
              summary: summarizeSeries(ioSeries),
              unit: "blocksPerSecond",
            },
            swap: {
              series: swapSeries,
              summary: summarizeSeries(swapSeries),
              unit: "blocksPerSecond",
            },
          },
        };

        if (ipv4PrivateInSeries.length > 0 || ipv4PrivateOutSeries.length > 0) {
          metrics.network = metrics.network ?? {};
          metrics.network.privateIn = {
            series: ipv4PrivateInSeries,
            summary: summarizeSeries(ipv4PrivateInSeries),
            unit: "bitsPerSecond",
          };
          metrics.network.privateOut = {
            series: ipv4PrivateOutSeries,
            summary: summarizeSeries(ipv4PrivateOutSeries),
            unit: "bitsPerSecond",
          };
        }
      } catch (err) {
        console.warn("Failed to fetch instance metrics:", err);
      }
    }

    let transfer: TransferPayload | null = null;
    let networking: any = null;
    let firewalls: any[] = [];
    let firewallOptions: any[] = [];
    let providerConfigs: any[] = [];
    let instanceEvents: any[] = [];

    if (
      isLinodeProvider &&
      providerDetail &&
      Number.isFinite(providerInstanceId)
    ) {
      try {
        const transferData =
          await linodeService.getLinodeInstanceTransfer(providerInstanceId);

        const transferSource = (transferData ?? {}) as Record<string, unknown>;
        const usedBytes = extractTransferUsedBytes(transferSource.used);
        const usedGb = bytesToGigabytes(usedBytes);
        const billableBytes = extractTransferBillableBytes(
          transferSource.billable,
        );
        const billableGb = bytesToGigabytes(billableBytes);

        // Use the plan's transfer allocation as the quota instead of the API's quota field
        // The API's quota field appears to return account-level pooled transfer data (in bytes)
        const quotaGb =
          planMeta.specs.transfer > 0
            ? planMeta.specs.transfer
            : bytesToGigabytes(Number(transferSource.quota ?? 0));
        const utilizationPercent =
          quotaGb > 0
            ? Math.min(100, Math.max(0, (usedGb / quotaGb) * 100))
            : 0;

        // Only use instance-specific transfer data, no account-level data
        transfer = {
          usedGb,
          quotaGb,
          billableGb,
          utilizationPercent,
          account: null,
          usedBytes,
        };
      } catch (err) {
        console.warn("Failed to fetch transfer usage:", err);
      }
    }

    let backups: BackupsPayload | null = null;
    if (
      isLinodeProvider &&
      providerDetail &&
      Number.isFinite(providerInstanceId)
    ) {
      const providerBackups = providerDetail.backups ?? null;
      let backupCollection: LinodeInstanceBackupsResponse | null = null;
      try {
        backupCollection =
          await linodeService.getLinodeInstanceBackups(providerInstanceId);
      } catch (err) {
        console.warn("Failed to fetch instance backups:", err);
      }

      const automatic = Array.isArray(backupCollection?.automatic)
        ? backupCollection!.automatic
            .map(mapBackupSummary)
            .filter((item): item is BackupSummaryPayload => Boolean(item))
        : [];

      const snapshot = mapBackupSummary(backupCollection?.snapshot?.current);
      const snapshotInProgress = mapBackupSummary(
        backupCollection?.snapshot?.in_progress,
      );

      backups = {
        enabled: Boolean(providerBackups?.enabled),
        available: Boolean(providerBackups?.available),
        schedule: providerBackups?.schedule
          ? {
              day: providerBackups.schedule.day ?? null,
              window: providerBackups.schedule.window ?? null,
            }
          : null,
        lastSuccessful: providerBackups?.last_successful ?? null,
        automatic,
        snapshot,
        snapshotInProgress,
      };
    }

    if (
      isLinodeProvider &&
      providerDetail &&
      Number.isFinite(providerInstanceId)
    ) {
      try {
        const catalog = await linodeService.listFirewalls();
        firewallOptions = catalog
          .map(mapFirewallOption)
          .filter((item): item is Record<string, unknown> => Boolean(item));
      } catch (err) {
        console.warn("Failed to fetch firewall catalog:", err);
      }

      try {
        const ipData =
          await linodeService.getLinodeInstanceIPs(providerInstanceId);
        const ipv4Data = (ipData as any)?.ipv4 || {};
        const ipv6Data = (ipData as any)?.ipv6 || null;
        networking = {
          ipv4: {
            public: pickIPv4Array(ipv4Data, "public")
              .map(mapIPv4Address)
              .filter(Boolean),
            private: pickIPv4Array(ipv4Data, "private")
              .map(mapIPv4Address)
              .filter(Boolean),
            shared: pickIPv4Array(ipv4Data, "shared")
              .map(mapIPv4Address)
              .filter(Boolean),
            reserved: pickIPv4Array(ipv4Data, "reserved")
              .map(mapIPv4Address)
              .filter(Boolean),
          },
          ipv6: ipv6Data
            ? {
                slaac: mapIPv6Assignment(ipv6Data.slaac),
                linkLocal: mapIPv6Assignment(ipv6Data.link_local),
                global: mapIPv6RangeCollection(ipv6Data.global),
                ranges: mapIPv6RangeCollection(ipv6Data.ranges),
                pools: mapIPv6RangeCollection(pickIPv6Pool(ipv6Data)),
              }
            : null,
        };
      } catch (err) {
        console.warn("Failed to fetch instance networking:", err);
      }

      try {
        const firewallData =
          await linodeService.getLinodeInstanceFirewalls(providerInstanceId);
        const firewallRows = Array.isArray((firewallData as any)?.data)
          ? (firewallData as any).data
          : [];
        const resolved = await Promise.all(
          firewallRows.map(async (row: any) => {
            const firewallId = toNumberOrNull(row?.id);
            let attachment: Record<string, unknown> | null = null;
            if (firewallId !== null) {
              try {
                const devices =
                  await linodeService.getFirewallDevices(firewallId);
                const matches = devices.find((device) => {
                  const mapped = mapFirewallAttachment(device);
                  if (!mapped) {
                    return false;
                  }
                  const type = (mapped.type || "").toLowerCase();
                  return (
                    type === "linode" &&
                    Number(mapped.entityId) === providerInstanceId
                  );
                });
                if (matches) {
                  attachment = matches as Record<string, unknown>;
                }
              } catch (deviceErr) {
                console.warn(
                  `Failed to fetch firewall devices for ${firewallId}:`,
                  deviceErr,
                );
              }
            }
            return mapFirewallSummary(row, attachment);
          }),
        );
        firewalls = resolved.filter((item): item is Record<string, unknown> =>
          Boolean(item),
        );
      } catch (err) {
        console.warn("Failed to fetch instance firewalls:", err);
      }

      try {
        const configData =
          await linodeService.getLinodeInstanceConfigs(providerInstanceId);
        providerConfigs = Array.isArray((configData as any)?.data)
          ? (configData as any).data.map(mapConfigProfile).filter(Boolean)
          : [];
      } catch (err) {
        console.warn("Failed to fetch instance configurations:", err);
      }

      try {
        const eventsData = await linodeService.getLinodeInstanceEvents(
          providerInstanceId,
          { pageSize: 50 },
        );
        instanceEvents = Array.isArray((eventsData as any)?.data)
          ? (eventsData as any).data.map(mapEventSummary).filter(Boolean)
          : [];
      } catch (err) {
        console.warn("Failed to fetch instance events:", err);
      }
    }

    // Calculate progress information for transitional states
    let providerProgress: {
      percent: number | null;
      action: string | null;
      status: string | null;
      message: string | null;
      created: string | null;
    } | null = null;
    let progressPercent: number | null = null;
    if (
      ["provisioning", "rebooting", "restoring", "backing_up"].includes(
        normalizedStatus,
      )
    ) {
      providerProgress = deriveProgressFromEvents(
        normalizedStatus,
        instanceEvents,
      );
      progressPercent = providerProgress?.percent ?? null;
    }

    const planBasePrice = planMeta.planRow
      ? Number(planMeta.planRow.base_price ?? 0)
      : 0;
    const planMarkupPrice = planMeta.planRow
      ? Number(planMeta.planRow.markup_price ?? 0)
      : 0;
    const combinedPlanPrice = planBasePrice + planMarkupPrice;
    const referencePlanPrice =
      combinedPlanPrice > 0 ? combinedPlanPrice : planMeta.pricing.monthly;
    const backupMonthlyCost =
      referencePlanPrice > 0 ? referencePlanPrice * 0.3 : 0;
    const backupPricing =
      backupMonthlyCost > 0
        ? {
            monthly: Math.round(backupMonthlyCost * 100) / 100,
            hourly: Math.round((backupMonthlyCost / 730) * 100000) / 100000,
            currency: "USD" as const,
          }
        : null;

    const allIPv4Collections = networking?.ipv4
      ? [
          ...(Array.isArray(networking.ipv4.public)
            ? networking.ipv4.public
            : []),
          ...(Array.isArray(networking.ipv4.private)
            ? networking.ipv4.private
            : []),
          ...(Array.isArray(networking.ipv4.shared)
            ? networking.ipv4.shared
            : []),
          ...(Array.isArray(networking.ipv4.reserved)
            ? networking.ipv4.reserved
            : []),
        ]
      : [];
    const rdnsEnabledOnIpv4 = allIPv4Collections.some(
      (entry: any) =>
        entry && typeof entry === "object" && entry.rdnsEditable === true,
    );
    const slaacAddress =
      networking?.ipv6 && typeof networking.ipv6 === "object"
        ? (networking.ipv6 as { slaac?: { address?: string | null } | null })
            .slaac?.address
        : null;
    const rdnsEditable =
      rdnsEnabledOnIpv4 ||
      (typeof slaacAddress === "string" && slaacAddress.trim().length > 0);

    res.json({
      instance: {
        id: instanceRow.id,
        label: instanceRow.label,
        status: instanceRow.status,
        ipAddress: instanceRow.ip_address ?? null,
        providerInstanceId: instanceRow.provider_instance_id,
        providerId: instanceRow.provider_id ?? null,
        providerType: instanceRow.provider_type ?? "linode",
        providerName: providerName,
        createdAt: instanceRow.created_at ?? null,
        updatedAt: instanceRow.updated_at ?? null,
        notes: instanceRow.notes ?? null,
        region: typeof regionCode === "string" ? regionCode : null,
        regionLabel,
        configuration,
        image: configuration?.image ?? providerDetail?.image ?? null,
        plan: {
          id: planMeta.planRow?.id ?? null,
          name:
            typeof planMeta.planRow?.name === "string"
              ? planMeta.planRow.name
              : null,
          providerPlanId: planMeta.providerPlanId,
          specs: planMeta.specs,
          pricing: {
            hourly: planMeta.pricing.hourly,
            monthly: planMeta.pricing.monthly,
            currency: "USD",
          },
        },
        provider: providerDetail
          ? {
              id: providerDetail.id,
              label: providerDetail.label,
              status: normalizeProviderStatus(providerDetail.status),
              region: providerDetail.region,
              image: providerDetail.image,
              ipv4: providerDetail.ipv4,
              ipv6: providerDetail.ipv6,
              created: providerDetail.created,
              updated: providerDetail.updated,
              specs: providerDetail.specs,
            }
          : null,
        metrics,
        transfer,
        backups,
        networking,
        firewalls,
        firewallOptions,
        providerConfigs,
        activity: instanceEvents,
        backupPricing,
        rdnsEditable,
        providerProgress,
        progressPercent,
      },
    });
  } catch (err: any) {
    console.error("VPS detail error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch VPS instance details" });
  }
});

/**
 * POST /api/vps
 *
 * Create a new VPS instance with region and backup frequency selection.
 *
 * Authentication: User authentication required
 *
 * Required fields:
 * - plan_id: UUID of the VPS plan
 * - region: Datacenter region (now required from user, not from plan)
 * - label: Instance name
 * - root_password: Root password for the instance
 *
 * Optional fields:
 * - backup_frequency: "daily" or "weekly" (required if backups_enabled is true)
 * - backups_enabled: Enable backup service
 * - ssh_keys: Array of SSH public keys
 * - image: OS image identifier
 * - stackscript_id: Linode StackScript ID
 * - private_ip: Enable private IP
 *
 * Validation:
 * - Region must be available for the provider
 * - Backup frequency must be supported by the plan
 * - Sufficient wallet balance required
 *
 * See: repo-docs/FLEXIBLE_BACKUP_PRICING_API.md for detailed documentation
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasVpsCreatePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_create",
      );

      if (!hasVpsCreatePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_create",
        });
      }
    }

    const {
      provider_id,
      provider_type,
      label,
      type,
      region,
      image,
      rootPassword,
      sshKeys = [],
      backups = false,
      backup_frequency = "weekly",
      privateIP = false,
      stackscriptId,
      stackscriptData,
    } = req.body || {};

    // Validate required fields
    if (!label || !type || !image || !rootPassword) {
      res
        .status(400)
        .json({ error: "label, type, image, and rootPassword are required" });
      return;
    }

    // Validate provider parameters
    if (!provider_id || !provider_type) {
      res
        .status(400)
        .json({ error: "provider_id and provider_type are required" });
      return;
    }

    // Fetch provider details from database
    let providerDetails: any = null;
    let providerApiToken: string | null = null;
    try {
      const providerResult = await query(
        "SELECT id, name, type, api_key_encrypted, active FROM service_providers WHERE id = $1",
        [provider_id],
      );

      if (providerResult.rows.length === 0) {
        res.status(400).json({ error: "Provider not found" });
        return;
      }

      providerDetails = providerResult.rows[0];

      if (!providerDetails.active) {
        res.status(400).json({
          error:
            "Selected provider is not active. Please contact your administrator.",
        });
        return;
      }

      if (providerDetails.type !== provider_type) {
        res.status(400).json({
          error: "Provider type mismatch",
        });
        return;
      }

      try {
        providerApiToken = await normalizeProviderToken(
          providerDetails.id,
          providerDetails.api_key_encrypted,
        );
      } catch (tokenErr) {
        logError("Provider token resolution", tokenErr, {
          provider_id,
          provider_type,
        });
        res.status(503).json({
          error: {
            code: "PROVIDER_TOKEN_UNAVAILABLE",
            message:
              "Unable to access provider credentials. Please verify the provider token and try again.",
            provider: provider_type,
          },
        });
        return;
      }
    } catch (providerErr) {
      console.error("Error fetching provider details:", providerErr);
      res.status(500).json({ error: "Failed to validate provider" });
      return;
    }

    const requestedImage = String(image).trim();
    const resolvedImage = await resolveImageForProvider(
      String(provider_id),
      requestedImage,
      providerApiToken || undefined,
    );
    if (!resolvedImage) {
      return res.status(400).json({
        error: "Invalid OS template selected for the chosen provider.",
        code: "INVALID_OS_TEMPLATE",
      });
    }

    // Resolve plan details from database
    // Plans store provider plan id in provider_plan_id and region under specifications.region
    let regionToUse: string | undefined = region;
    let planIdForInstance: string | undefined = undefined;
    let providerPlanId: string | undefined = undefined;

    try {
      // First, try lookup by provider_plan_id (expected frontend value)
      let planRes = await query(
        "SELECT id, provider_id, provider_plan_id, specifications FROM vps_plans WHERE provider_plan_id = $1 AND provider_id = $2 LIMIT 1",
        [type, provider_id],
      );
      // If not found, user may have passed internal plan UUID; try that
      if (planRes.rows.length === 0) {
        planRes = await query(
          "SELECT id, provider_id, provider_plan_id, specifications FROM vps_plans WHERE id = $1 AND provider_id = $2 LIMIT 1",
          [type, provider_id],
        );
      }

      if (planRes.rows.length > 0) {
        const planRow = planRes.rows[0];
        planIdForInstance = String(planRow.id);
        const specs = planRow.specifications || {};

        // Get provider_plan_id from plan row
        if (
          typeof planRow.provider_plan_id === "string" &&
          planRow.provider_plan_id.trim().length > 0
        ) {
          providerPlanId = planRow.provider_plan_id.trim();
        }

        // Get region from plan specifications if not provided
        if (
          !regionToUse &&
          specs &&
          typeof specs.region === "string" &&
          specs.region.trim().length > 0
        ) {
          regionToUse = specs.region.trim();
        }
      }
    } catch (lookupErr) {
      console.warn("Failed to lookup plan for type:", type, lookupErr);
    }

    if (!providerPlanId) {
      res.status(400).json({
        error:
          "Invalid plan type. Provide a valid provider plan id or a configured plan UUID from /admin.",
      });
      return;
    }

    // Region is now optional; clients select region at deployment time
    // Ensure region is provided at provisioning time (from request body)
    if (!regionToUse) {
      res.status(400).json({
        error:
          "Region is required for VPS provisioning. Please select a region.",
      });
      return;
    }

    // Validate backup frequency against plan configuration
    let validatedBackupFrequency = "none";
    if (backups && planIdForInstance) {
      try {
        const planResult = await query(
          "SELECT daily_backups_enabled, weekly_backups_enabled FROM vps_plans WHERE id = $1",
          [planIdForInstance],
        );
        if (planResult.rows.length > 0) {
          const plan = planResult.rows[0];
          if (backup_frequency === "daily" && !plan.daily_backups_enabled) {
            res.status(400).json({
              error: "Daily backups not available for this plan",
              code: "INVALID_BACKUP_FREQUENCY",
            });
            return;
          }
          if (backup_frequency === "weekly" && !plan.weekly_backups_enabled) {
            res.status(400).json({
              error: "Weekly backups not available for this plan",
              code: "INVALID_BACKUP_FREQUENCY",
            });
            return;
          }
          validatedBackupFrequency = backup_frequency;
        }
      } catch (validationErr) {
        console.warn("Failed to validate backup frequency:", validationErr);
      }
    }

    // Calculate hourly rate for pre-billing validation including backup costs
    let hourlyRate = 0.027; // Default fallback rate
    try {
      if (planIdForInstance) {
        const planResult = await query(
          `SELECT
            base_price, markup_price,
            backup_price_hourly, backup_upcharge_hourly
           FROM vps_plans WHERE id = $1`,
          [planIdForInstance],
        );
        if (planResult.rows.length > 0) {
          const plan = planResult.rows[0];
          const baseMonthlyCost =
            parseFloat(plan.base_price) + parseFloat(plan.markup_price);
          let baseHourlyRate = baseMonthlyCost / 730;

          // Add backup costs if backups are enabled (flat rate - Linode does daily backups at one price)
          if (backups && validatedBackupFrequency !== "none") {
            const baseBackupHourly = parseFloat(plan.backup_price_hourly) || 0;
            const backupUpchargeHourly =
              parseFloat(plan.backup_upcharge_hourly) || 0;
            baseHourlyRate += baseBackupHourly + backupUpchargeHourly;
          }

          hourlyRate = baseHourlyRate;
        }
      }
    } catch (planErr) {
      console.warn("Failed to calculate hourly rate from plan:", planErr);
    }

    // Check wallet balance before creating VPS
    try {
      const walletResult = await query(
        "SELECT balance FROM wallets WHERE organization_id = $1",
        [organizationId],
      );

      if (walletResult.rows.length === 0) {
        res.status(400).json({
          error:
            "No wallet found for your organization. Please contact support.",
          code: "WALLET_NOT_FOUND",
        });
        return;
      }

      const currentBalance = parseFloat(walletResult.rows[0].balance);
      if (currentBalance < hourlyRate) {
        res.status(400).json({
          error: `Insufficient wallet balance. Required: $${hourlyRate.toFixed(
            4,
          )}, Available: $${currentBalance.toFixed(
            2,
          )}. Please add funds to your wallet.`,
          code: "INSUFFICIENT_BALANCE",
          required: hourlyRate,
          available: currentBalance,
        });
        return;
      }
    } catch (walletErr) {
      console.error("Error checking wallet balance:", walletErr);
      res.status(500).json({
        error: "Failed to verify wallet balance. Please try again.",
        code: "WALLET_CHECK_FAILED",
      });
      return;
    }

    // Create VPS instance through provider service
    let created: any;
    let providerInstanceId: string;

    try {
      // Handle provider-specific creation logic
      if (provider_type === "linode") {
        let resolvedAuthorizedKeys: string[] | undefined;

        if (Array.isArray(sshKeys) && sshKeys.length > 0) {
          const normalizedKeys = (sshKeys as any[])
            .map((value) => {
              if (typeof value === "string" || typeof value === "number") {
                return String(value).trim();
              }
              if (value && typeof value === "object" && "id" in value) {
                return String((value as { id: unknown }).id).trim();
              }
              return "";
            })
            .filter((value) => value.length > 0);

          const directPublicKeys: string[] = [];
          const requestedKeyIds: string[] = [];

          for (const key of normalizedKeys) {
            if (key.startsWith("ssh-") || key.startsWith("sk-")) {
              directPublicKeys.push(key);
            } else {
              requestedKeyIds.push(key);
            }
          }

          const resolvedKeys: string[] = [...directPublicKeys];

          if (requestedKeyIds.length > 0) {
            if (providerApiToken) {
              try {
                const providerKeys =
                  await linodeService.getSSHKeys(providerApiToken);

                const keyLookup = new Map(
                  providerKeys.map((providerKey: any) => [
                    String(providerKey.id),
                    String(providerKey.ssh_key || ""),
                  ]),
                );

                for (const keyId of requestedKeyIds) {
                  const matchedKey = keyLookup.get(keyId);
                  if (matchedKey && matchedKey.trim().length > 0) {
                    resolvedKeys.push(matchedKey.trim());
                  } else {
                    console.warn(
                      "Selected Linode SSH key could not be resolved to a public key",
                      {
                        keyId,
                        provider_id,
                      },
                    );
                  }
                }

                if (
                  resolvedKeys.length <
                  directPublicKeys.length + requestedKeyIds.length
                ) {
                  console.warn(
                    "Some Linode SSH keys were not resolved to public keys",
                    {
                      requested: requestedKeyIds,
                      resolved: resolvedKeys.length,
                    },
                  );
                }
              } catch (sshKeyErr) {
                logError("Linode SSH key resolution", sshKeyErr, {
                  organizationId,
                  provider_id,
                  requestedKeys: requestedKeyIds,
                });
              }
            } else {
              console.warn(
                "Linode provider API token unavailable; cannot resolve SSH key IDs",
                {
                  provider_id,
                  requestedKeyIds,
                },
              );
            }
          }

          if (resolvedKeys.length > 0) {
            resolvedAuthorizedKeys = Array.from(new Set(resolvedKeys));
          }
        }

        const linodeCreatePayload: CreateLinodeRequest = {
          type: providerPlanId,
          region: regionToUse,
          image: resolvedImage,
          label,
          root_pass: rootPassword,
          backups_enabled: backups,
          private_ip: privateIP,
          tags: [config.VPS_TAG],
          group: config.VPS_TAG,
        };

        if (resolvedAuthorizedKeys && resolvedAuthorizedKeys.length > 0) {
          linodeCreatePayload.authorized_keys = resolvedAuthorizedKeys;
        }

        if (stackscriptId !== undefined && stackscriptId !== null) {
          const stackscriptIdNumber = Number(stackscriptId);
          if (!Number.isNaN(stackscriptIdNumber)) {
            linodeCreatePayload.stackscript_id = stackscriptIdNumber;
          }
        }

        if (
          stackscriptData &&
          typeof stackscriptData === "object" &&
          !Array.isArray(stackscriptData)
        ) {
          linodeCreatePayload.stackscript_data = stackscriptData as Record<
            string,
            any
          >;
        }

        created = await linodeService.createLinodeInstance(
          linodeCreatePayload,
          providerApiToken || undefined,
        );
        providerInstanceId = String(created.id);
      } else {
        res.status(400).json({
          error: `Unsupported provider type: ${provider_type}`,
        });
        return;
      }
    } catch (createErr: any) {
      logError("VPS creation", createErr, {
        organizationId,
        provider_type,
        provider_id,
        label,
        region: regionToUse,
        image,
        resolvedImage,
      });

      // Handle provider-specific errors
      const structuredError = handleProviderError(
        createErr,
        "linode",
        "create VPS instance",
      );

      res.status(structuredError.statusCode).json({
        error: structuredError.message,
        code: structuredError.code,
        details: structuredError.details,
      });
      return;
    }

    // Persist instance record with provider information
    const configuration = {
      type: providerPlanId,
      region: regionToUse,
      image: resolvedImage,
      template_id: isBrandedTemplateId(requestedImage) || isLegacyTemplateId(requestedImage)
        ? requestedImage
        : toBrandedTemplateId(resolvedImage),
      provider_template_id: resolvedImage,
      backups,
      backup_frequency: validatedBackupFrequency,
      privateIP,
      // Linode-specific fields
      stackscriptId: provider_type === "linode" ? stackscriptId : undefined,
      stackscriptData: provider_type === "linode" ? stackscriptData : undefined,
      auth: {
        method: "password",
        user: "root",
        password_enc: encryptSecret(String(rootPassword)),
      },
    };

    // Extract IP address (format varies by provider)
    let ip: string | null = null;
    if (provider_type === "linode") {
      ip =
        Array.isArray(created.ipv4) && created.ipv4.length > 0
          ? created.ipv4[0]
          : null;
    }

    const status = created.status || "provisioning";

    const insertRes = await query(
      `INSERT INTO vps_instances (organization_id, plan_id, provider_id, provider_type, provider_instance_id, label, status, ip_address, configuration, backup_frequency, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        organizationId,
        planIdForInstance || type,
        provider_id,
        provider_type,
        providerInstanceId,
        label,
        status,
        ip,
        configuration,
        validatedBackupFrequency,
        userId,
      ],
    );
    const instance = insertRes.rows[0];

    // Schedule custom rDNS setup as a background task (non-blocking) - Linode only
    if (provider_type === "linode") {
      setImmediate(async () => {
        try {
          // Fetch configured base domain from admin networking config
          let baseDomain = DEFAULT_RDNS_BASE_DOMAIN;
          try {
            const cfgRes = await query(
              "SELECT rdns_base_domain FROM networking_config ORDER BY updated_at DESC LIMIT 1",
            );
            const row = cfgRes.rows?.[0];
            if (
              row &&
              typeof row.rdns_base_domain === "string" &&
              row.rdns_base_domain.trim().length > 0
            ) {
              baseDomain = String(row.rdns_base_domain).trim();
            }
          } catch (cfgErr: any) {
            // If the table is missing or any error occurs, fallback to default without failing provisioning
            const msg = (cfgErr?.message || "").toLowerCase();
            if (msg.includes("relation") && msg.includes("does not exist")) {
              console.warn(
                "networking_config table not found; using default rDNS base domain",
              );
            } else {
              console.warn(
                "Failed to read networking rDNS config; using default base domain:",
                cfgErr,
              );
            }
          }

          await linodeService.setupCustomRDNSAsync(
            Number(providerInstanceId),
            label,
            baseDomain,
          );
        } catch (rdnsErr) {
          console.warn(
            'Background rDNS setup failed for VPS %s (%s):',
            label,
            providerInstanceId,
            rdnsErr,
          );
        }
      });
    }

    // Process initial billing for VPS creation
    let billingSuccess = false;
    try {
      billingSuccess = await BillingService.billVPSCreation(
        String(instance.id),
        organizationId,
        hourlyRate,
        label,
      );

      if (!billingSuccess) {
        console.warn(
          `VPS created but billing failed for ${label} (${instance.id})`,
        );
        // Note: We don't fail the VPS creation if billing fails, but we log it
        // The hourly billing service will pick this up later
      }
    } catch (billingErr) {
      console.error("Error processing VPS creation billing:", billingErr);
      // Continue with VPS creation even if billing fails
    }

    // Log instance creation
    try {
      const user = (req as any).user;
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.create",
          entityType: "vps",
          entityId: String(instance.id),
          message: `Created VPS '${label}' on ${providerDetails.name} (${instance.provider_instance_id})`,
          status: "success",
          metadata: {
            label,
            type: providerPlanId,
            region: regionToUse,
            image,
            hourlyRate,
            provider_type,
            provider_name: providerDetails.name,
          },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.create activity:", logErr);
    }

    res.status(201).json({
      instance,
      billing: {
        success: billingSuccess,
        hourlyRate: hourlyRate,
        message: billingSuccess
          ? `Initial billing of $${hourlyRate.toFixed(
              4,
            )}/hour processed successfully`
          : "Initial billing failed - will be retried by hourly billing service",
      },
    });
  } catch (err: any) {
    console.error("VPS create error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to create VPS instance" });
  }
});
// Instance actions: boot
router.post("/:id/boot", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0)
      return res.status(404).json({ error: "Instance not found" });

    const row = rowRes.rows[0];
    const providerType = row.provider_type || "linode";
    const providerInstanceId = Number(row.provider_instance_id);

    await linodeService.bootLinodeInstance(providerInstanceId);
    const detail = await linodeService.getLinodeInstance(providerInstanceId);
    const status = normalizeProviderStatus(detail.status);
    const ip =
      Array.isArray(detail.ipv4) && detail.ipv4.length > 0
        ? detail.ipv4[0]
        : null;

    await query(
      "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
      [status, ip, id],
    );

    // Log boot action
    try {
      const user = (req as any).user;
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.boot",
          entityType: "vps",
          entityId: String(id),
          message: `Booted VPS '${row.label}' on ${providerType}`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.boot activity:", logErr);
    }
    res.json({ status });
  } catch (err: any) {
    console.error("VPS boot error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to boot VPS instance" });
  }
});

// Instance actions: shutdown
router.post("/:id/shutdown", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0)
      return res.status(404).json({ error: "Instance not found" });

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);

    await linodeService.shutdownLinodeInstance(providerInstanceId);
    const detail = await linodeService.getLinodeInstance(providerInstanceId);
    const status = normalizeProviderStatus(detail.status);
    const ip =
      Array.isArray(detail.ipv4) && detail.ipv4.length > 0
        ? detail.ipv4[0]
        : null;

    await query(
      "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
      [status, ip, id],
    );

    // Log shutdown action
    try {
      const user = (req as any).user;
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.shutdown",
          entityType: "vps",
          entityId: String(id),
          message: `Shutdown VPS '${row.label}'`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.shutdown activity:", logErr);
    }
    res.json({ status });
  } catch (err: any) {
    console.error("VPS shutdown error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to shutdown VPS instance" });
  }
});

// Instance actions: reboot
router.post("/:id/reboot", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0)
      return res.status(404).json({ error: "Instance not found" });

    const row = rowRes.rows[0];
    const providerType = row.provider_type || "linode";
    const providerInstanceId = Number(row.provider_instance_id);

    await linodeService.rebootLinodeInstance(providerInstanceId);
    const detail = await linodeService.getLinodeInstance(providerInstanceId);
    const status = normalizeProviderStatus(detail.status);
    const ip =
      Array.isArray(detail.ipv4) && detail.ipv4.length > 0
        ? detail.ipv4[0]
        : null;

    await query(
      "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
      [status, ip, id],
    );

    // Log reboot action
    try {
      const user = (req as any).user;
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.reboot",
          entityType: "vps",
          entityId: String(id),
          message: `Rebooted VPS '${row.label}' on ${providerType}`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.reboot activity:", logErr);
    }
    res.json({ status });
  } catch (err: any) {
    console.error("VPS reboot error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to reboot VPS instance" });
  }
});

// Instance actions: rebuild (reinstall OS)
router.post("/:id/rebuild", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    // Validate required fields
    const {
      image,
      rootPassword,
      sshKeys = [],
      authorizedUsers,
      booted,
      diskEncryption,
      maintenancePolicy,
      metadata,
      stackscriptId,
      stackscriptData,
      linodeType,
    } = req.body || {};

    if (!image || typeof image !== "string" || image.trim().length === 0) {
      return res.status(400).json({
        error: "Image is required for rebuild",
        code: "MISSING_IMAGE",
      });
    }

    if (
      !rootPassword ||
      typeof rootPassword !== "string" ||
      rootPassword.length < 6
    ) {
      return res.status(400).json({
        error:
          "Root password is required and must be at least 6 characters long",
        code: "INVALID_ROOT_PASSWORD",
      });
    }

    // Fetch instance record
    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0)
      return res.status(404).json({ error: "Instance not found" });

    const row = rowRes.rows[0];
    let providerApiToken: string | null = null;
    try {
      const providerTokenRes = await query(
        "SELECT id, api_key_encrypted FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
        [row.provider_id],
      );
      if (providerTokenRes.rows.length > 0) {
        providerApiToken = await normalizeProviderToken(
          providerTokenRes.rows[0].id,
          providerTokenRes.rows[0].api_key_encrypted,
        );
      }
    } catch (tokenErr) {
      console.warn("Failed to load provider token for rebuild:", tokenErr);
    }

    const requestedImage = image.trim();
    const resolvedImage = await resolveImageForProvider(
      String(row.provider_id || "default"),
      requestedImage,
      providerApiToken || undefined,
    );
    if (!resolvedImage) {
      return res.status(400).json({
        error: "Invalid OS template selected for rebuild",
        code: "INVALID_OS_TEMPLATE",
      });
    }
    
    // Fetch provider name for whitelabeling
    const providerResult = await query(
      "SELECT name FROM service_providers WHERE id = $1 LIMIT 1",
      [row.provider_id]
    );
    const providerName = providerResult.rows[0]?.name || "Cloud Provider";

    const providerType = row.provider_type || "linode";
    const providerInstanceId = Number(row.provider_instance_id);

    // Resolve SSH keys (same logic as create route)
    let resolvedAuthorizedKeys: string[] | undefined;

    if (Array.isArray(sshKeys) && sshKeys.length > 0) {
      const normalizedKeys = (sshKeys as any[])
        .map((value) => {
          if (typeof value === "string" || typeof value === "number") {
            return String(value).trim();
          }
          if (value && typeof value === "object" && "id" in value) {
            return String((value as { id: unknown }).id).trim();
          }
          return "";
        })
        .filter((value) => value.length > 0);

      const directPublicKeys: string[] = [];
      const requestedKeyIds: string[] = [];

      for (const key of normalizedKeys) {
        if (key.startsWith("ssh-") || key.startsWith("sk-")) {
          directPublicKeys.push(key);
        } else {
          requestedKeyIds.push(key);
        }
      }

      const resolvedKeys: string[] = [...directPublicKeys];

      if (requestedKeyIds.length > 0) {
        // Load provider API token for SSH key resolution
        let providerApiTokenForKeys: string | null = providerApiToken;
        try {
          if (!providerApiTokenForKeys) {
            const providerResult = await query(
              "SELECT id, api_key_encrypted FROM service_providers WHERE id = $1 AND active = true LIMIT 1",
              [row.provider_id],
            );
            if (providerResult.rows.length > 0) {
              providerApiTokenForKeys = await normalizeProviderToken(
                providerResult.rows[0].id,
                providerResult.rows[0].api_key_encrypted,
              );
            }
          }
        } catch (tokenErr) {
          console.warn("Failed to load provider token for SSH key resolution:", tokenErr);
        }

        if (providerApiTokenForKeys) {
          try {
            const providerKeys =
              await linodeService.getSSHKeys(providerApiTokenForKeys);
            const keyLookup = new Map(
              providerKeys.map((providerKey: any) => [
                String(providerKey.id),
                String(providerKey.ssh_key || ""),
              ]),
            );

            for (const keyId of requestedKeyIds) {
              const matchedKey = keyLookup.get(keyId);
              if (matchedKey && matchedKey.trim().length > 0) {
                resolvedKeys.push(matchedKey.trim());
              } else {
                console.warn(
                  "Selected SSH key could not be resolved for rebuild",
                  { keyId, provider_id: row.provider_id },
                );
              }
            }
          } catch (sshKeyErr) {
            logError("SSH key resolution during rebuild", sshKeyErr, {
              organizationId,
              provider_id: row.provider_id,
              requestedKeys: requestedKeyIds,
            });
          }
        }
      }

      if (resolvedKeys.length > 0) {
        resolvedAuthorizedKeys = Array.from(new Set(resolvedKeys));
      }
    }

    // Build rebuild request
    const rebuildPayload: RebuildLinodeRequest = {
      image: resolvedImage,
      root_pass: rootPassword,
    };

    if (resolvedAuthorizedKeys && resolvedAuthorizedKeys.length > 0) {
      rebuildPayload.authorized_keys = resolvedAuthorizedKeys;
    }

    // authorized_users — Linode usernames whose SSH keys are added
    if (Array.isArray(authorizedUsers) && authorizedUsers.length > 0) {
      rebuildPayload.authorized_users = authorizedUsers
        .map((u: any) => String(u).trim())
        .filter((u: string) => u.length > 0);
    }

    // booted — whether to boot after rebuild (defaults to true on Linode side)
    if (typeof booted === "boolean") {
      rebuildPayload.booted = booted;
    }

    // disk_encryption — 'enabled' or 'disabled'
    if (
      typeof diskEncryption === "string" &&
      ["enabled", "disabled"].includes(diskEncryption)
    ) {
      rebuildPayload.disk_encryption = diskEncryption as "enabled" | "disabled";
    }

    // maintenance_policy — 'linode/migrate' or 'linode/power_off_on'
    if (
      typeof maintenancePolicy === "string" &&
      ["linode/migrate", "linode/power_off_on"].includes(maintenancePolicy)
    ) {
      rebuildPayload.maintenance_policy = maintenancePolicy as
        | "linode/migrate"
        | "linode/power_off_on";
    }

    // metadata — user-defined metadata object
    if (
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
    ) {
      rebuildPayload.metadata = metadata;
    }

    // stackscript_id — StackScript to run during deployment
    if (
      stackscriptId !== undefined &&
      stackscriptId !== null &&
      Number.isFinite(Number(stackscriptId))
    ) {
      rebuildPayload.stackscript_id = Number(stackscriptId);
    }

    // stackscript_data — UDF data for the StackScript
    if (
      stackscriptData &&
      typeof stackscriptData === "object" &&
      !Array.isArray(stackscriptData)
    ) {
      rebuildPayload.stackscript_data = stackscriptData;
    }

    // type — Linode type ID to resize to during rebuild
    if (
      typeof linodeType === "string" &&
      linodeType.trim().length > 0
    ) {
      rebuildPayload.type = linodeType.trim();
    }

    // Call Linode rebuild API
    const rebuilt = await linodeService.rebuildLinodeInstance(
      providerInstanceId,
      rebuildPayload,
      providerApiToken || undefined,
    );

    const status = rebuilt.status || "rebuilding";
    const ip =
      Array.isArray(rebuilt.ipv4) && rebuilt.ipv4.length > 0
        ? rebuilt.ipv4[0]
        : null;

    // Update the stored configuration with the new image and encrypted password
    const existingConfig =
      row.configuration && typeof row.configuration === "object"
        ? row.configuration
        : {};

    const updatedConfig = {
      ...existingConfig,
      image: resolvedImage,
      template_id: isBrandedTemplateId(requestedImage) || isLegacyTemplateId(requestedImage)
        ? requestedImage
        : toBrandedTemplateId(resolvedImage),
      provider_template_id: resolvedImage,
      auth: {
        method: "password",
        user: "root",
        password_enc: encryptSecret(String(rootPassword)),
      },
    };

    await query(
      "UPDATE vps_instances SET status = $1, ip_address = $2, configuration = $3, updated_at = NOW() WHERE id = $4",
      [status, ip, updatedConfig, id],
    );

    // Log rebuild action
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.rebuild",
          entityType: "vps",
          entityId: String(id),
          message: `Rebuilt VPS '${row.label}' with template '${requestedImage}' on ${providerType}`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.rebuild activity:", logErr);
    }

    res.json({ status, image: requestedImage, providerName });
  } catch (err: any) {
    console.error("VPS rebuild error:", err);

    // Handle provider-specific errors
    const structuredError = handleProviderError(
      err,
      "linode",
      "rebuild VPS instance",
    );

    res.status(structuredError.statusCode || 500).json({
      error: structuredError.message || err.message || "Failed to rebuild VPS instance",
      code: structuredError.code,
      details: structuredError.details,
    });
  }
});

router.post("/:id/backups/enable", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.enableLinodeBackups(providerInstanceId);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.enable",
          entityType: "vps",
          entityId: String(id),
          message: `Enabled backups for VPS '${row.label}'`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.enable activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS enable backups error:", err);
    res.status(500).json({ error: err.message || "Failed to enable backups" });
  }
});

router.post("/:id/backups/disable", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.cancelLinodeBackups(providerInstanceId);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.disable",
          entityType: "vps",
          entityId: String(id),
          message: `Disabled backups for VPS '${row.label}'`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.disable activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS disable backups error:", err);
    res.status(500).json({ error: err.message || "Failed to disable backups" });
  }
});

router.post("/:id/backups/schedule", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    const { day: rawDay, window: rawWindow } = req.body ?? {};

    let dayValue: string | null | undefined = undefined;
    if (rawDay !== undefined) {
      if (rawDay === null) {
        dayValue = null;
      } else if (typeof rawDay === "string") {
        const trimmed = rawDay.trim();
        if (trimmed === "") {
          dayValue = null;
        } else if (BACKUP_DAY_OPTIONS.has(trimmed)) {
          dayValue = trimmed;
        } else {
          return res.status(400).json({ error: "Invalid backup day selected" });
        }
      } else {
        return res.status(400).json({ error: "Invalid backup day payload" });
      }
    }

    let windowValue: string | null | undefined = undefined;
    if (rawWindow !== undefined) {
      if (rawWindow === null) {
        windowValue = null;
      } else if (typeof rawWindow === "string") {
        const trimmed = rawWindow.trim().toUpperCase();
        if (trimmed === "") {
          windowValue = null;
        } else if (BACKUP_WINDOW_OPTIONS.has(trimmed)) {
          windowValue = trimmed;
        } else {
          return res
            .status(400)
            .json({ error: "Invalid backup window selected" });
        }
      } else {
        return res.status(400).json({ error: "Invalid backup window payload" });
      }
    }

    const scheduleUpdate: { day?: string | null; window?: string | null } = {};
    if (dayValue !== undefined) {
      scheduleUpdate.day = dayValue;
    }
    if (windowValue !== undefined) {
      scheduleUpdate.window = windowValue;
    }

    if (Object.keys(scheduleUpdate).length === 0) {
      return res.status(400).json({ error: "No schedule changes supplied" });
    }

    await linodeService.updateLinodeBackupSchedule(
      providerInstanceId,
      scheduleUpdate,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.schedule",
          entityType: "vps",
          entityId: String(id),
          message: `Updated backup schedule for VPS '${row.label}'`,
          metadata: {
            day: dayValue ?? "auto",
            window: windowValue ?? "auto",
          },
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.schedule activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS update backup schedule error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to update backup schedule" });
  }
});

router.post("/:id/backups/snapshot", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { label } = (req.body || {}) as { label?: string };
    const snapshotLabel =
      typeof label === "string" && label.trim().length > 0
        ? label.trim()
        : undefined;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.createLinodeBackup(providerInstanceId, snapshotLabel);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.backups.snapshot",
          entityType: "vps",
          entityId: String(id),
          message: `Triggered manual snapshot for VPS '${row.label}'${
            snapshotLabel ? ` (${snapshotLabel})` : ""
          }`,
          status: "success",
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.backups.snapshot activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS snapshot error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to trigger snapshot" });
  }
});

router.post(
  "/:id/backups/:backupId/restore",
  async (req: Request, res: Response) => {
    try {
      const { id, backupId } = req.params;
      const user = (req as any).user;
      const userId = user.id;
      const userRole = user.role;
      const organizationId = user.organizationId;
      const parsedBackupId = Number(backupId);
      if (!Number.isInteger(parsedBackupId) || parsedBackupId <= 0) {
        return res.status(400).json({ error: "A valid backupId is required" });
      }

      const { overwrite } = (req.body || {}) as { overwrite?: boolean };

      // Check vps_manage permission for non-admin users
      if (userRole !== "admin") {
        const hasVpsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          "vps_manage",
        );

        if (!hasVpsManagePermission) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: "vps_manage",
          });
        }
      }

      let rowRes;
      if (user.role === "admin") {
        rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
      } else {
        rowRes = await query(
          "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
          [id, organizationId],
        );
      }

      if (rowRes.rows.length === 0) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const row = rowRes.rows[0];
      const providerInstanceId = Number(row.provider_instance_id);
      if (!Number.isFinite(providerInstanceId)) {
        return res
          .status(400)
          .json({ error: "Instance is missing provider reference" });
      }

      await linodeService.restoreLinodeBackup(
        providerInstanceId,
        parsedBackupId,
        {
          overwrite: overwrite !== undefined ? Boolean(overwrite) : true,
          targetInstanceId: providerInstanceId,
        },
      );

      try {
        await logActivity(
          {
            userId: user.id,
            organizationId: user.organizationId,
            eventType: "vps.backups.restore",
            entityType: "vps",
            entityId: String(id),
            message: `Initiated restore from backup ${parsedBackupId} for VPS '${row.label}'`,
            status: "success",
            metadata: {
              backupId: parsedBackupId,
              overwrite: overwrite !== undefined ? Boolean(overwrite) : true,
            },
          },
          req as any,
        );
      } catch (logErr) {
        console.warn("Failed to log vps.backups.restore activity:", logErr);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("VPS restore backup error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to restore from backup" });
    }
  },
);

router.post("/:id/firewalls/attach", async (req: Request, res: Response) => {
  try {
    const { firewallId } = (req.body || {}) as { firewallId?: number };
    const parsedFirewallId = Number(firewallId);
    if (!Number.isInteger(parsedFirewallId) || parsedFirewallId <= 0) {
      return res.status(400).json({ error: "Valid firewallId is required" });
    }

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.attachFirewallToLinode(
      parsedFirewallId,
      providerInstanceId,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.firewall.attach",
          entityType: "vps",
          entityId: String(id),
          message: `Attached firewall ${parsedFirewallId} to VPS '${row.label}'`,
          status: "success",
          metadata: { firewallId: parsedFirewallId },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.firewall.attach activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS attach firewall error:", err);
    res.status(500).json({ error: err.message || "Failed to attach firewall" });
  }
});

router.post("/:id/firewalls/detach", async (req: Request, res: Response) => {
  try {
    const { firewallId, deviceId } = (req.body || {}) as {
      firewallId?: number;
      deviceId?: number;
    };
    const parsedFirewallId = Number(firewallId);
    const parsedDeviceId = Number(deviceId);
    if (
      !Number.isInteger(parsedFirewallId) ||
      parsedFirewallId <= 0 ||
      !Number.isInteger(parsedDeviceId) ||
      parsedDeviceId <= 0
    ) {
      return res
        .status(400)
        .json({ error: "Valid firewallId and deviceId are required" });
    }

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    await linodeService.detachFirewallFromLinode(
      parsedFirewallId,
      parsedDeviceId,
    );

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.firewall.detach",
          entityType: "vps",
          entityId: String(id),
          message: `Detached firewall ${parsedFirewallId} from VPS '${row.label}'`,
          status: "success",
          metadata: { firewallId: parsedFirewallId, deviceId: parsedDeviceId },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.firewall.detach activity:", logErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("VPS detach firewall error:", err);
    res.status(500).json({ error: err.message || "Failed to detach firewall" });
  }
});

router.post("/:id/networking/rdns", async (req: Request, res: Response) => {
  try {
    const { address, rdns } = (req.body || {}) as {
      address?: string;
      rdns?: string | null;
    };
    if (typeof address !== "string" || address.trim().length === 0) {
      return res.status(400).json({ error: "A valid IP address is required" });
    }
    const normalizedAddress = address.trim();
    const rdnsValue =
      typeof rdns === "string" && rdns.trim().length > 0 ? rdns.trim() : null;

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    try {
      const ipPayload =
        await linodeService.getLinodeInstanceIPs(providerInstanceId);
      const ipv4Sets =
        ipPayload?.ipv4 && typeof ipPayload.ipv4 === "object"
          ? Object.values(ipPayload.ipv4)
          : [];
      const flattened = Array.isArray(ipv4Sets)
        ? (ipv4Sets as unknown[]).reduce<string[]>((acc, value) => {
            if (Array.isArray(value)) {
              value.forEach((entry) => {
                const addr = (entry as any)?.address;
                if (typeof addr === "string") {
                  acc.push(addr);
                }
              });
            }
            return acc;
          }, [])
        : [];

      if (!flattened.includes(normalizedAddress)) {
        return res
          .status(400)
          .json({ error: "Address not assigned to this instance" });
      }
    } catch (addressErr) {
      console.warn(
        "Failed to verify IP ownership before rDNS update:",
        addressErr,
      );
    }

    await linodeService.updateIPAddressReverseDNS(normalizedAddress, rdnsValue);

    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.network.rdns",
          entityType: "vps",
          entityId: String(id),
          message: `Updated rDNS for ${normalizedAddress} on VPS '${row.label}'`,
          status: "success",
          metadata: { ip: normalizedAddress, rdns: rdnsValue },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.network.rdns activity:", logErr);
    }

    res.json({ success: true, rdns: rdnsValue });
  } catch (err: any) {
    console.error("VPS rDNS update error:", err);
    res.status(500).json({ error: err.message || "Failed to update rDNS" });
  }
});

// Update hostname
router.put("/:id/hostname", async (req: Request, res: Response) => {
  try {
    const { hostname } = (req.body || {}) as { hostname?: string };

    // Validate hostname format
    if (typeof hostname !== "string" || hostname.trim().length === 0) {
      return res.status(400).json({ error: "Hostname is required" });
    }

    const normalizedHostname = hostname.trim();

    // Validate hostname format (3-64 characters, alphanumeric with hyphens, underscores, periods)
    if (normalizedHostname.length < 3 || normalizedHostname.length > 64) {
      return res
        .status(400)
        .json({ error: "Hostname must be between 3 and 64 characters" });
    }

    const hostnamePattern = /^[a-zA-Z0-9._-]+$/;
    if (!hostnamePattern.test(normalizedHostname)) {
      return res.status(400).json({
        error:
          "Hostname can only contain letters, numbers, hyphens, underscores, and periods",
      });
    }

    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];
    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      return res
        .status(400)
        .json({ error: "Instance is missing provider reference" });
    }

    // Update hostname via Linode API
    await linodeService.updateLinodeInstance(providerInstanceId, {
      label: normalizedHostname,
    });

    // Update local database
    await query(
      "UPDATE vps_instances SET label = $1, updated_at = NOW() WHERE id = $2",
      [normalizedHostname, id],
    );

    // Log hostname update activity
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.hostname.update",
          entityType: "vps",
          entityId: String(id),
          message: `Updated hostname for VPS '${row.label}' to '${normalizedHostname}'`,
          status: "success",
          metadata: { oldHostname: row.label, newHostname: normalizedHostname },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.hostname.update activity:", logErr);
    }

    res.json({
      success: true,
      hostname: normalizedHostname,
      message: "Hostname updated successfully",
    });
  } catch (err: any) {
    console.error("VPS hostname update error:", err);
    res.status(500).json({ error: err.message || "Failed to update hostname" });
  }
});

// Delete instance
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, twoFactorCode } = req.body;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Verify password before allowing deletion
    if (!password) {
      return res
        .status(400)
        .json({ error: "Password is required for VPS deletion" });
    }

    try {
      await AuthService.login({ email: user.email, password });
    } catch {
      return res.status(400).json({ error: "Invalid password" });
    }

    try {
      await AuthService.verifyTwoFactorCode(userId, twoFactorCode);
    } catch (error: any) {
      return res.status(400).json({
        error:
          error.message ||
          "Two-factor authentication verification failed",
      });
    }

    // Check vps_delete permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsDeletePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_delete",
      );

      if (!hasVpsDeletePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_delete",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
    } else {
      rowRes = await query(
        "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0)
      return res.status(404).json({ error: "Instance not found" });

    const row = rowRes.rows[0];
    const providerType = row.provider_type || "linode";
    const providerInstanceId = Number(row.provider_instance_id);

    if (providerType === "linode") {
      await EgressBillingService.captureDeletionSnapshot(String(id));
    }

    await linodeService.deleteLinodeInstance(providerInstanceId);

    // Delete from database
    await query("DELETE FROM vps_instances WHERE id = $1", [id]);

    // Log delete action
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.delete",
          entityType: "vps",
          entityId: String(id),
          message: `Deleted VPS '${row.label}'`,
          status: "success",
          metadata: {
            provider_type: providerType,
            provider_instance_id: providerInstanceId,
          },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.delete activity:", logErr);
    }
    res.json({ deleted: true });
  } catch (err: any) {
    console.error("VPS delete error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to delete VPS instance" });
  }
});

// Update VPS notes
router.put("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { notes } = (req.body || {}) as { notes?: string };
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    // Validate notes (allow empty string to clear notes)
    if (typeof notes !== "string") {
      return res.status(400).json({ error: "Notes must be a string" });
    }

    // Limit notes length
    if (notes.length > 10000) {
      return res
        .status(400)
        .json({ error: "Notes cannot exceed 10,000 characters" });
    }

    // Check vps_manage permission for non-admin users
    if (userRole !== "admin") {
      const hasVpsManagePermission = await RoleService.checkPermission(
        userId,
        organizationId,
        "vps_manage",
      );

      if (!hasVpsManagePermission) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: "vps_manage",
        });
      }
    }

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query(
        "SELECT id, label FROM vps_instances WHERE id = $1",
        [id],
      );
    } else {
      rowRes = await query(
        "SELECT id, label FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    const row = rowRes.rows[0];

    // Update notes in database
    await query(
      "UPDATE vps_instances SET notes = $1, updated_at = NOW() WHERE id = $2",
      [notes.trim() || null, id],
    );

    // Log notes update activity
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.notes.update",
          entityType: "vps",
          entityId: String(id),
          message: notes.trim()
            ? `Updated notes for VPS '${row.label}'`
            : `Cleared notes for VPS '${row.label}'`,
          status: "success",
          metadata: {
            notes_length: notes.trim().length,
          },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.notes.update activity:", logErr);
    }

    res.json({
      success: true,
      notes: notes.trim() || null,
      message: notes.trim() ? "Notes updated successfully" : "Notes cleared",
    });
  } catch (err: any) {
    console.error("VPS notes update error:", err);
    res.status(500).json({ error: err.message || "Failed to update notes" });
  }
});

// Get VPS notes
router.get("/:id/notes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const organizationId = user.organizationId;

    let rowRes;
    if (user.role === "admin") {
      rowRes = await query("SELECT notes FROM vps_instances WHERE id = $1", [
        id,
      ]);
    } else {
      rowRes = await query(
        "SELECT notes FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
    }

    if (rowRes.rows.length === 0) {
      return res.status(404).json({ error: "Instance not found" });
    }

    res.json({ notes: rowRes.rows[0].notes || null });
  } catch (err: any) {
    console.error("VPS notes fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notes" });
  }
});

export default router;
