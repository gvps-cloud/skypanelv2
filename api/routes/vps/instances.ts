import express from "express";
import type { Request, Response } from "express";
import { authenticateToken, requireOrganization } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { linodeService } from "../../services/linodeService.js";
import { handleProviderError, logError, sendSafeErrorResponse } from "../../lib/errorHandling.js";
import type { ProviderType } from "../../services/providers/IProviderService.js";
import type {
  CreateLinodeRequest,
  RebuildLinodeRequest,
  LinodeInstance,
  LinodeInstanceBackupsResponse,
  LinodeInstanceStatsResponse,
  LinodeInstanceStatsSeries,
  LinodeBackupSummary,
  LinodeMetricTuple,
} from "../../services/linodeService.js";
import { logActivity } from "../../services/activityLogger.js";
import { encryptSecret } from "../../lib/crypto.js";
import { BillingService } from "../../services/billingService.js";
import { AuthService } from "../../services/authService.js";
import { RoleService } from "../../services/roles.js";
import { EgressBillingService } from "../../services/egressBillingService.js";
import { config } from "../../config/index.js";
import { normalizeProviderToken } from "../../lib/providerTokens.js";
import {
  getPanelIpv6PrefixRangesForRdns,
  ipv6AddressOwnedByLinodeInstance,
  ipv6AddressInRange,
} from "../../lib/ipv6.js";
import {
  isBrandedTemplateId,
  toBrandedTemplateId,
  isLegacyTemplateId,
  normalizeImageTemplate,
  resolveImageForProvider,
  loadProviderTokenById,
  clampPercent,
  deriveProgressFromEvents,
  resolveRegionLabel,
  resolvePlanMeta,
  DEFAULT_RDNS_BASE_DOMAIN,
  BACKUP_DAY_OPTIONS,
  BACKUP_WINDOW_OPTIONS,
} from "./shared/utils.js";
import {
  normalizeProviderStatus,
  toStringOrNull,
  toNumberOrNull,
  mapIPv4Address,
  mapIPv6Assignment,
  mapIPv6Range,
  mapIPv6RangeCollection,
  pickIPv4Array,
  pickIPv6Pool,
  mapFirewallAttachment,
  mapFirewallSummary,
  mapFirewallOption,
  mapConfigProfile,
  mapEventSummary,
  mapBackupSummary,
  bytesToGigabytes,
  extractTransferUsedBytes,
  extractTransferBillableBytes,
  normalizeSeries,
  summarizeSeries,
  deriveTimeframe,
  MetricSeriesPayload,
  TransferPayload,
  BackupsPayload,
  BackupSummaryPayload,
} from "./shared/types.js";

const router = express.Router();
router.use(authenticateToken, requireOrganization);

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
    sendSafeErrorResponse(res, error, 500, { fallbackMessage: "Failed to fetch VPS uptime data" });
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
              watchdog_enabled: providerDetail.watchdog_enabled ?? null,
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
      const structuredError = handleProviderError(providerErr, "linode", "validate provider credentials");
      res.status(structuredError.statusCode).json({ error: structuredError.message, code: structuredError.code });
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
            6,
          )}, Available: $${currentBalance.toFixed(
            6,
          )}. Please add funds to your wallet.`,
          code: "INSUFFICIENT_BALANCE",
          required: hourlyRate,
          available: currentBalance,
        });
        return;
      }
    } catch (walletErr) {
      sendSafeErrorResponse(res, walletErr, 500, { fallbackMessage: "Failed to verify wallet balance. Please try again." });
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
            try {
              // SECURITY FIX: Query local database with organization scoping
              // instead of fetching ALL keys from provider API to prevent cross-org exposure
              const dbKeys = await query(
                `SELECT id, linode_key_id, public_key
                 FROM user_ssh_keys
                 WHERE organization_id = $1`,
                [organizationId],
              );

              const keyLookup = new Map();
              for (const row of dbKeys.rows) {
                if (row.id) keyLookup.set(String(row.id), row.public_key);
                if (row.linode_key_id)
                  keyLookup.set(String(row.linode_key_id), row.public_key);
              }

              for (const keyId of requestedKeyIds) {
                const matchedKey = keyLookup.get(keyId);
                if (matchedKey && matchedKey.trim().length > 0) {
                  resolvedKeys.push(matchedKey.trim());
                } else {
                  console.warn(
                    "Selected SSH key could not be resolved to a public key for this organization",
                    {
                      keyId,
                      organizationId,
                    },
                  );
                }
              }

              if (
                resolvedKeys.length <
                directPublicKeys.length + requestedKeyIds.length
              ) {
                console.warn(
                  "Some SSH keys were not resolved to public keys or do not belong to this organization",
                  {
                    requested: requestedKeyIds,
                    resolved: resolvedKeys.length,
                  },
                );
              }
            } catch (sshKeyErr) {
              logError("SSH key resolution", sshKeyErr, {
                organizationId,
                requestedKeys: requestedKeyIds,
              });
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
              6,
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
    const structuredError = handleProviderError(err, "linode", "boot VPS instance");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "shutdown VPS instance");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "reboot VPS instance");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
        try {
          // SECURITY FIX: Query local database with organization scoping
          // instead of fetching ALL keys from provider API to prevent cross-org exposure
          const dbKeys = await query(
            `SELECT id, linode_key_id, public_key
             FROM user_ssh_keys
             WHERE organization_id = $1`,
            [organizationId],
          );

          const keyLookup = new Map();
          for (const dbRow of dbKeys.rows) {
            if (dbRow.id) keyLookup.set(String(dbRow.id), dbRow.public_key);
            if (dbRow.linode_key_id)
              keyLookup.set(String(dbRow.linode_key_id), dbRow.public_key);
          }

          for (const keyId of requestedKeyIds) {
            const matchedKey = keyLookup.get(keyId);
            if (matchedKey && matchedKey.trim().length > 0) {
              resolvedKeys.push(matchedKey.trim());
            } else {
              console.warn(
                "Selected SSH key could not be resolved for rebuild in this organization",
                {
                  keyId,
                  organizationId,
                  vpsId: id,
                },
              );
            }
          }

          if (
            resolvedKeys.length <
            directPublicKeys.length + requestedKeyIds.length
          ) {
            console.warn(
              "Some SSH keys were not resolved to public keys or do not belong to this organization during rebuild",
              {
                requested: requestedKeyIds,
                resolved: resolvedKeys.length,
              },
            );
          }
        } catch (sshKeyErr) {
          logError("SSH key resolution during rebuild", sshKeyErr, {
            organizationId,
            requestedKeys: requestedKeyIds,
          });
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
    const structuredError = handleProviderError(err, "linode", "enable backups");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "disable backups");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "update backup schedule");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "trigger snapshot");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
      const structuredError = handleProviderError(err, "linode", "restore backup");
      res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "attach firewall");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "detach firewall");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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

    const isIPv6 = normalizedAddress.includes(":");

    try {
      const ipPayload =
        await linodeService.getLinodeInstanceIPs(providerInstanceId);

      if (isIPv6) {
        if (!ipv6AddressOwnedByLinodeInstance(normalizedAddress, ipPayload)) {
          return res
            .status(400)
            .json({ error: "IPv6 address not assigned to this instance" });
        }
      } else {
        // IPv4 ownership check (existing logic)
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
    const structuredError = handleProviderError(err, "linode", "update rDNS");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

// Get IPv6 RDNS records for ranges assigned to this instance
router.get("/:id/networking/ipv6-rdns-records", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    if (userRole !== "admin") {
      const hasPermission = await RoleService.checkPermission(userId, organizationId, "vps_manage");
      if (!hasPermission) {
        return res.status(403).json({ error: "Insufficient permissions", required: "vps_manage" });
      }
    }

    let rowRes;
    if (userRole === "admin") {
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
      return res.status(400).json({ error: "Instance is missing provider reference" });
    }

    const ipPayload = await linodeService.getLinodeInstanceIPs(providerInstanceId);
    const ranges = getPanelIpv6PrefixRangesForRdns(ipPayload);

    if (ranges.length === 0) {
      return res.json({ records: [] });
    }

    // Fetch all account IPs and filter to those in instance ranges with RDNS set
    const records: Array<{ address: string; rdns: string }> = [];
    try {
      const accountIPs = await linodeService.getAccountNetworkingIPs();
      const ipList = accountIPs?.data ?? [];
      for (const ip of ipList) {
        if (!ip.address || !ip.rdns) continue;
        if (!ip.address.includes(":")) continue; // IPv6 only
        if (ip.rdns.includes(".ip.linodeusercontent.com")) continue; // skip default
        for (const r of ranges) {
          if (ipv6AddressInRange(ip.address, r.range, r.prefix)) {
            records.push({ address: ip.address, rdns: ip.rdns });
            break;
          }
        }
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch account IPs for IPv6 RDNS records:", fetchErr);
    }

    res.json({ records });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "fetch IPv6 RDNS records");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "update hostname");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
  }
});

// Update watchdog (Lassie) setting
router.put("/:id/watchdog", async (req: Request, res: Response) => {
  try {
    const { watchdog_enabled } = (req.body || {}) as { watchdog_enabled?: unknown };

    if (typeof watchdog_enabled !== "boolean") {
      return res.status(400).json({ error: "watchdog_enabled must be a boolean" });
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
    if (userRole === "admin") {
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

    // Update watchdog via Linode API
    await linodeService.updateLinodeInstance(providerInstanceId, {
      watchdog_enabled,
    });

    // Log watchdog update activity
    try {
      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "vps.watchdog.update",
          entityType: "vps",
          entityId: String(id),
          message: `${watchdog_enabled ? "Enabled" : "Disabled"} Shutdown Watchdog (Lassie) for VPS '${row.label}'`,
          status: "success",
          metadata: { watchdog_enabled },
        },
        req as any,
      );
    } catch (logErr) {
      console.warn("Failed to log vps.watchdog.update activity:", logErr);
    }

    res.json({
      success: true,
      watchdog_enabled,
      message: `Shutdown Watchdog ${watchdog_enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (err: any) {
    const structuredError = handleProviderError(err, "linode", "update watchdog setting");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
    const structuredError = handleProviderError(err, "linode", "delete VPS instance");
    res.status(structuredError.statusCode).json({ error: structuredError.message });
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
  } catch (err) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to update notes" });
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
  } catch (err) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch notes" });
  }
});

export default router;
