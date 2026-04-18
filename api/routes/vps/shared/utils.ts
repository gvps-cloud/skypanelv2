import { createHash } from "crypto";

import { query } from '../../../lib/database.js';
import { linodeService } from '../../../services/linodeService.js';
import { handleProviderError } from '../../../lib/errorHandling.js';
import {
  normalizeProviderToken,
  getProviderTokenByType,
} from '../../../lib/providerTokens.js';
import {
  normalizeRegionList,
  parseStoredAllowedRegions,
  shouldFilterByAllowedRegions,
} from '../../../lib/providerRegions.js';
import { config } from '../../../config/index.js';
import { RoleService } from '../../../services/roles.js';
import type { PlanMeta, PlanSpecs, PlanPricing } from "./types.js";
import type { LinodeInstance } from "../../../services/linodeService.js";

export const DEFAULT_RDNS_BASE_DOMAIN = config.RDNS_BASE_DOMAIN;

export const LEGACY_TEMPLATE_PREFIX = "tpl_";
export const BRANDED_TEMPLATE_PREFIX = config.COMPANY_BRAND_NAME + "/";

export const BACKUP_DAY_OPTIONS = new Set([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

export const BACKUP_WINDOW_OPTIONS = new Set([
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

export function isBrandedTemplateId(id: string): boolean {
  return id.startsWith(BRANDED_TEMPLATE_PREFIX);
}

export function isLegacyTemplateId(id: string): boolean {
  return id.startsWith(LEGACY_TEMPLATE_PREFIX);
}

export function toBrandedTemplateId(upstreamImageId: string): string {
  return `${BRANDED_TEMPLATE_PREFIX}${upstreamImageId}`;
}

/** @deprecated Legacy hash-based template ID — kept for backwards compatibility */
export function toLegacyTemplateId(providerId: string, upstreamImageId: string): string {
  const digest = createHash("sha256")
    .update(`${providerId}:${upstreamImageId}`)
    .digest("hex")
    .slice(0, 24);
  return `${LEGACY_TEMPLATE_PREFIX}${digest}`;
}

export function normalizeImageTemplate(
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
  const whiteLabelId = upstreamId.replace(/^linode\//, "");
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

export async function resolveImageForProvider(
  providerId: string,
  requestedImage: string,
  providerApiToken?: string,
): Promise<string | null> {
  const requested = requestedImage.trim();

  if (isBrandedTemplateId(requested)) {
    const whiteLabelId = requested.slice(BRANDED_TEMPLATE_PREFIX.length);
    if (!whiteLabelId.startsWith("linode/")) {
      return `linode/${whiteLabelId}`;
    }
    return whiteLabelId;
  }

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

  return requested;
}

export async function _loadActiveProviderToken(
  providerType: "linode",
): Promise<string | null> {
  const providerInfo = await getProviderTokenByType(providerType);
  return providerInfo?.token ?? null;
}

export async function loadProviderTokenById(
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

export const clampPercent = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

export const PROGRESS_ACTION_MAP: Record<string, string[]> = {
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

export const pickProgressEvent = (
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

export const deriveProgressFromEvents = (
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

export const ensureRegionLabelCache = async (): Promise<Map<string, string>> => {
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

export const resolveRegionLabel = async (
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

export const resolvePlanMeta = async (
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
