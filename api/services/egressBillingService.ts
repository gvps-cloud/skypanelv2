import { query, transaction } from '../lib/database.js';
import { linodeService, type AccountTransferResponse, type LinodeRegion } from './linodeService.js';
import type { InvoiceItem } from './invoiceService.js';

export interface RegionEgressPricingRecord {
  id: string;
  provider_type: string;
  region_id: string;
  region_label: string | null;
  pricing_scope: 'global' | 'region';
  pricing_category: 'core' | 'special' | 'distributed';
  base_price_per_gb: number;
  upcharge_price_per_gb: number;
  final_price_per_gb: number;
  billing_enabled: boolean;
  source: string;
  sync_status: 'pending' | 'synced' | 'manual' | 'error';
  source_reference: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolAllocationItem {
  organizationId: string;
  organizationName: string;
  vpsInstanceId: string;
  providerInstanceId: string;
  label: string;
  regionId: string;
  measuredUsageGb: number;
  usageShare: number;
  allocatedPoolQuotaGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  amount: number;
}

export interface PoolAllocationPreview {
  poolId: string;
  poolScope: 'global' | 'region';
  regionId: string | null;
  regionLabel: string | null;
  pricingCategory: 'core' | 'special' | 'distributed';
  billingEnabled: boolean;
  basePricePerGb: number;
  upchargePricePerGb: number;
  finalPricePerGb: number;
  accountUsageGb: number;
  accountQuotaGb: number;
  accountBillableGb: number;
  totalMeasuredUsageGb: number;
  totalAllocatedQuotaGb: number;
  totalAllocatedBillableGb: number;
  items: PoolAllocationItem[];
}

export interface EgressBillingHistoryRecord {
  id: string;
  billingMonth: string;
  poolId: string;
  poolScope: 'global' | 'region';
  regionId: string | null;
  organizationId: string;
  organizationName: string | null;
  totalMeasuredUsageGb: number;
  allocatedPoolQuotaGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  totalAmount: number;
  status: 'projected' | 'pending' | 'billed' | 'failed' | 'void';
  billedTransactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationEgressServerCharge {
  billingMonth: string;
  poolId: string;
  poolScope: 'global' | 'region';
  regionId: string | null;
  vpsInstanceId: string | null;
  providerInstanceId: string | null;
  label: string;
  measuredUsageGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  amount: number;
  status: 'projected' | 'pending' | 'billed' | 'failed' | 'void';
  updatedAt: string;
}

export interface OrganizationEgressOverview {
  organizationId: string;
  billingMonth: string;
  projectedTotals: {
    totalMeasuredUsageGb: number;
    totalBillableGb: number;
    totalAmount: number;
    activePoolCount: number;
    billingEnabledPoolCount: number;
    updatedAt: string | null;
  };
  servers: OrganizationEgressServerCharge[];
  recentCycles: EgressBillingHistoryRecord[];
}

interface UsageRow {
  organization_id: string;
  organization_name: string;
  vps_instance_id: string;
  provider_instance_id: string;
  label: string;
  region_id: string;
  region_label: string | null;
  transfer_included_gb: number;
  measured_usage_gb: number;
}

const CORE_PRICE = 0.005;
const JAKARTA_PRICE = 0.015;
const SAO_PAULO_PRICE = 0.007;
const DISTRIBUTED_PRICE = 0.01;
const DEFAULT_SOURCE_REFERENCE = 'https://techdocs.akamai.com/cloud-computing/docs/network-transfer-usage-and-costs';

const SPECIAL_REGION_PRICING: Record<string, number> = {
  'id-cgk': JAKARTA_PRICE,
  'br-gru': SAO_PAULO_PRICE,
};

const round = (value: number, digits = 6): number => {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
};

const bytesToGigabytes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value / 1_000_000_000;
};

const getBillingMonthDate = (month?: string): string => {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return `${month}-01`;
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};

const extractTransferUsedBytes = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const directCandidate =
      source.total ?? source.bytes ?? source.amount ?? source.used;
    if (
      typeof directCandidate === 'number' &&
      Number.isFinite(directCandidate)
    ) {
      return directCandidate;
    }

    const inboundCandidate = source.in ?? source.ingress ?? source.inbound;
    const outboundCandidate = source.out ?? source.egress ?? source.outbound;
    let total = 0;
    if (
      typeof inboundCandidate === 'number' &&
      Number.isFinite(inboundCandidate)
    ) {
      total += inboundCandidate;
    }
    if (
      typeof outboundCandidate === 'number' &&
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

const normalizeTransferUsageGb = (used: unknown): number => {
  return round(bytesToGigabytes(extractTransferUsedBytes(used)), 6);
};

const normalizePoolTransferGb = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value >= 100_000) {
    return round(bytesToGigabytes(value), 6);
  }

  return round(value, 6);
};

const regionLabelMapFromRows = (rows: UsageRow[]): Record<string, string> => {
  return rows.reduce<Record<string, string>>((acc, row) => {
    if (row.region_id && row.region_label) {
      acc[row.region_id] = row.region_label;
    }
    return acc;
  }, {});
};

const getPricingCategory = (region: Pick<LinodeRegion, 'id' | 'site_type'>): 'core' | 'special' | 'distributed' => {
  if (region.site_type === 'distributed') {
    return 'distributed';
  }
  if (SPECIAL_REGION_PRICING[region.id]) {
    return 'special';
  }
  return 'core';
};

const getBasePriceForRegion = (region: Pick<LinodeRegion, 'id' | 'site_type'>): number => {
  if (region.site_type === 'distributed') {
    return DISTRIBUTED_PRICE;
  }
  if (SPECIAL_REGION_PRICING[region.id]) {
    return SPECIAL_REGION_PRICING[region.id];
  }
  return CORE_PRICE;
};

const mapPricingRow = (row: Record<string, unknown>): RegionEgressPricingRecord => ({
  id: String(row.id),
  provider_type: String(row.provider_type || 'linode'),
  region_id: String(row.region_id),
  region_label: row.region_label ? String(row.region_label) : null,
  pricing_scope: (row.pricing_scope === 'region' ? 'region' : 'global'),
  pricing_category: row.pricing_category === 'distributed' || row.pricing_category === 'special' ? row.pricing_category : 'core',
  base_price_per_gb: Number(row.base_price_per_gb || 0),
  upcharge_price_per_gb: Number(row.upcharge_price_per_gb || 0),
  final_price_per_gb: round(Number(row.base_price_per_gb || 0) + Number(row.upcharge_price_per_gb || 0), 6),
  billing_enabled: Boolean(row.billing_enabled),
  source: String(row.source || 'manual'),
  sync_status: row.sync_status === 'synced' || row.sync_status === 'manual' || row.sync_status === 'error' ? row.sync_status : 'pending',
  source_reference: row.source_reference ? String(row.source_reference) : null,
  synced_at: row.synced_at ? String(row.synced_at) : null,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

const parseMetadataRecord = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

const mapHistoryRow = (row: Record<string, unknown>): EgressBillingHistoryRecord => ({
  id: String(row.id),
  billingMonth: String(row.billing_month),
  poolId: String(row.pool_id),
  poolScope: row.pool_scope === 'region' ? 'region' : 'global',
  regionId: row.region_id ? String(row.region_id) : null,
  organizationId: String(row.organization_id),
  organizationName: row.organization_name ? String(row.organization_name) : null,
  totalMeasuredUsageGb: Number(row.total_measured_usage_gb || 0),
  allocatedPoolQuotaGb: Number(row.allocated_pool_quota_gb || 0),
  allocatedBillableGb: Number(row.allocated_billable_gb || 0),
  unitPricePerGb: Number(row.unit_price_per_gb || 0),
  totalAmount: Number(row.total_amount || 0),
  status:
    row.status === 'preview'
      ? 'projected'
      : row.status === 'pending' ||
          row.status === 'billed' ||
          row.status === 'failed' ||
          row.status === 'void'
        ? row.status
        : 'projected',
  billedTransactionId: row.billed_transaction_id ? String(row.billed_transaction_id) : null,
  metadata: parseMetadataRecord(row.metadata),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

export class EgressBillingService {
  static async syncRegionPricing(providerType = 'linode'): Promise<RegionEgressPricingRecord[]> {
    const regions = await linodeService.getLinodeRegions();
    const now = new Date().toISOString();

    await transaction(async (client) => {
      for (const region of regions) {
        const category = getPricingCategory(region);
        const basePrice = getBasePriceForRegion(region);
        const scope = category === 'core' ? 'global' : 'region';

        await client.query(
          `INSERT INTO region_egress_pricing (
             provider_type, region_id, region_label, pricing_scope, pricing_category,
             base_price_per_gb, customer_rate_per_gb, source, sync_status, source_reference, synced_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $6, 'akamai-techdocs', 'synced', $7, $8, $8, $8)
           ON CONFLICT (provider_type, region_id)
           DO UPDATE SET
             region_label = EXCLUDED.region_label,
             pricing_scope = EXCLUDED.pricing_scope,
             pricing_category = EXCLUDED.pricing_category,
             base_price_per_gb = EXCLUDED.base_price_per_gb,
             customer_rate_per_gb = COALESCE(region_egress_pricing.customer_rate_per_gb, EXCLUDED.customer_rate_per_gb),
             source = EXCLUDED.source,
             sync_status = EXCLUDED.sync_status,
             source_reference = EXCLUDED.source_reference,
             synced_at = EXCLUDED.synced_at,
             updated_at = EXCLUDED.updated_at`,
          [providerType, region.id, region.label, scope, category, basePrice, DEFAULT_SOURCE_REFERENCE, now],
        );
      }
    });

    return this.listRegionPricing(providerType);
  }

  static async listRegionPricing(providerType = 'linode'): Promise<RegionEgressPricingRecord[]> {
    const result = await query(
      `SELECT *
       FROM region_egress_pricing
       WHERE provider_type = $1
       ORDER BY pricing_scope ASC, region_label ASC, region_id ASC`,
      [providerType],
    );

    return (result.rows || []).map(mapPricingRow);
  }

  static async updateRegionPricing(input: {
    providerType?: string;
    regionId: string;
    upchargePricePerGb?: number;
    billingEnabled?: boolean;
    regionLabel?: string;
  }): Promise<RegionEgressPricingRecord | null> {
    const providerType = input.providerType || 'linode';
    const fields: string[] = [];
    const values: Array<string | number | boolean> = [];
    let parameterIndex = 1;

    if (typeof input.upchargePricePerGb === 'number') {
      fields.push(`upcharge_price_per_gb = $${parameterIndex}`);
      values.push(round(input.upchargePricePerGb, 6));
      parameterIndex += 1;
      fields.push(`customer_rate_per_gb = COALESCE(base_price_per_gb, 0) + $${parameterIndex}`);
      values.push(round(input.upchargePricePerGb, 6));
      parameterIndex += 1;
    }

    if (typeof input.billingEnabled === 'boolean') {
      fields.push(`billing_enabled = $${parameterIndex}`);
      values.push(input.billingEnabled);
      parameterIndex += 1;
    }

    if (typeof input.regionLabel === 'string' && input.regionLabel.trim().length > 0) {
      fields.push(`region_label = $${parameterIndex}`);
      values.push(input.regionLabel.trim());
      parameterIndex += 1;
    }

    if (fields.length === 0) {
      const existing = await query(
        `SELECT *
         FROM region_egress_pricing
         WHERE provider_type = $1
           AND region_id = $2
         LIMIT 1`,
        [providerType, input.regionId],
      );

      return existing.rows[0] ? mapPricingRow(existing.rows[0]) : null;
    }

    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE region_egress_pricing
       SET ${fields.join(', ')}
       WHERE provider_type = $${parameterIndex}
         AND region_id = $${parameterIndex + 1}
       RETURNING *`,
      [...values, providerType, input.regionId],
    );

    return result.rows[0] ? mapPricingRow(result.rows[0]) : null;
  }

  static async getLiveUsage(month?: string): Promise<PoolAllocationPreview[]> {
    const billingMonth = getBillingMonthDate(month);
    const [pricingRows, usageRows, accountTransfer, regions] = await Promise.all([
      this.listRegionPricing('linode'),
      this.collectUsageRows(billingMonth),
      linodeService.getAccountTransfer(),
      linodeService.getLinodeRegions(),
    ]);

    const pricingByRegion = new Map(pricingRows.map((row) => [row.region_id, row]));
    const regionLabelMap = regionLabelMapFromRows(usageRows);
    for (const region of regions) {
      regionLabelMap[region.id] = region.label;
    }

    const pools = this.buildPools({ usageRows, accountTransfer, pricingByRegion, regionLabelMap });
    await this.persistProjection(billingMonth, pools);
    return pools;
  }

  static async captureDeletionSnapshot(vpsInstanceId: string): Promise<void> {
    const billingMonth = getBillingMonthDate();
    const result = await query(
      `SELECT
         vi.id AS vps_instance_id,
         vi.organization_id,
         vi.provider_instance_id,
         vi.label,
         COALESCE(vi.configuration->>'region', vp_region.region_id, 'unknown') AS region_id,
         up_regions.region_label AS region_label,
         COALESCE(
           NULLIF(vp.specifications->>'transfer', '')::numeric,
           NULLIF(vp.specifications->>'bandwidth', '')::numeric,
           NULLIF(vp.specifications->>'transfer_gb', '')::numeric,
           0
         ) AS transfer_included_gb
       FROM vps_instances vi
       LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
       LEFT JOIN LATERAL (
         SELECT region_id
         FROM vps_plan_regions
         WHERE vps_plan_id = vp.id
         ORDER BY region_id ASC
         LIMIT 1
       ) vp_region ON true
       LEFT JOIN region_egress_pricing up_regions ON up_regions.region_id = COALESCE(vi.configuration->>'region', vp_region.region_id)
       WHERE vi.id = $1
         AND COALESCE(vi.provider_type, 'linode') = 'linode'
       LIMIT 1`,
      [vpsInstanceId],
    );

    const row = result.rows[0];
    if (!row) {
      return;
    }

    const regionId = String(row.region_id || 'unknown');
    if (regionId === 'unknown') {
      throw new Error(`Unable to determine region for VPS ${vpsInstanceId}`);
    }

    const providerInstanceId = Number(row.provider_instance_id);
    if (!Number.isFinite(providerInstanceId)) {
      throw new Error(`Invalid provider_instance_id for VPS ${vpsInstanceId}`);
    }

    const transfer = await linodeService.getLinodeInstanceTransfer(providerInstanceId);
    const measuredUsageGb = normalizeTransferUsageGb(transfer.used);

    await query(
      `INSERT INTO vps_egress_usage_snapshots (
         vps_instance_id,
         organization_id,
         provider_instance_id,
         label,
         region_id,
         region_label,
         transfer_included_gb,
         measured_usage_gb,
         billing_month,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (vps_instance_id, billing_month)
       DO UPDATE SET
         provider_instance_id = EXCLUDED.provider_instance_id,
         label = EXCLUDED.label,
         region_id = EXCLUDED.region_id,
         region_label = EXCLUDED.region_label,
         transfer_included_gb = EXCLUDED.transfer_included_gb,
         measured_usage_gb = EXCLUDED.measured_usage_gb,
         updated_at = NOW()`,
      [
        vpsInstanceId,
        String(row.organization_id),
        String(row.provider_instance_id),
        String(row.label || row.provider_instance_id || 'Unnamed VPS'),
        regionId,
        row.region_label ? String(row.region_label) : null,
        Number(row.transfer_included_gb || 0),
        measuredUsageGb,
        billingMonth,
      ],
    );
  }

  static async executeLiveBilling(month?: string): Promise<{
    success: boolean;
    billedCount: number;
    failedCount: number;
    invoiceCount: number;
    errors: string[];
  }> {
    const billingMonth = getBillingMonthDate(month);
    const result = {
      success: true,
      billedCount: 0,
      failedCount: 0,
      invoiceCount: 0,
      errors: [] as string[],
    };

    const cycleRows = await query(
      `SELECT
         c.id,
         c.billing_month,
         c.pool_id,
         c.pool_scope,
         c.region_id,
         c.organization_id,
         o.name AS organization_name,
         c.total_measured_usage_gb,
         c.allocated_pool_quota_gb,
         c.allocated_billable_gb,
         c.unit_price_per_gb,
         c.total_amount,
         c.status,
         c.metadata,
         c.created_at,
         c.updated_at
       FROM organization_egress_billing_cycles c
       LEFT JOIN organizations o ON o.id = c.organization_id
       WHERE c.billing_month = $1
         AND c.status = 'preview'
       ORDER BY c.created_at ASC`,
      [billingMonth],
    );

    for (const cycle of cycleRows.rows || []) {
      try {
        const amount = Number(cycle.total_amount || 0);
        if (!(amount > 0)) {
          await query(
            `UPDATE organization_egress_billing_cycles
             SET status = 'void', updated_at = NOW()
             WHERE id = $1`,
            [cycle.id],
          );
          continue;
        }

        const orgId = String(cycle.organization_id);
        const description = `Egress Overage Billing - ${cycle.pool_id} - ${String(cycle.billing_month).slice(0, 7)}`;

        const chargeResult = await transaction(async (client) => {
          const walletResult = await client.query(
            'SELECT balance FROM wallets WHERE organization_id = $1',
            [orgId],
          );

          if (walletResult.rows.length === 0) {
            throw new Error(`Wallet not found for organization ${orgId}`);
          }

          const currentBalance = Number(walletResult.rows[0].balance || 0);
          if (currentBalance < amount) {
            await client.query(
              `UPDATE organization_egress_billing_cycles
               SET status = 'failed',
                   metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                   updated_at = NOW()
               WHERE id = $1`,
              [
                cycle.id,
                JSON.stringify({
                  failure_reason: 'insufficient_balance',
                  balance_before: currentBalance,
                  attempted_amount: amount,
                }),
              ],
            );
            return { billed: false, transactionId: null as string | null };
          }

          const newBalance = Number((currentBalance - amount).toFixed(4));
          await client.query(
            'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE organization_id = $2',
            [newBalance, orgId],
          );

          const transactionInsert = await client.query(
            `INSERT INTO payment_transactions (
               organization_id, amount, currency, payment_method, payment_provider, status, description, metadata
             ) VALUES ($1, $2, 'USD', 'wallet_debit', 'internal', 'completed', $3, $4)
             RETURNING id`,
            [
              orgId,
              -amount,
              description,
              JSON.stringify({
                balance_before: currentBalance,
                balance_after: newBalance,
                billing_type: 'egress_overage',
                billing_month: billingMonth,
                pool_id: cycle.pool_id,
                pool_scope: cycle.pool_scope,
                region_id: cycle.region_id,
                cycle_id: cycle.id,
              }),
            ],
          );

          const transactionId = String(transactionInsert.rows[0].id);
          await client.query(
            `UPDATE organization_egress_billing_cycles
             SET status = 'billed',
                 billed_transaction_id = $2,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [
              cycle.id,
              transactionId,
              JSON.stringify({
                balance_before: currentBalance,
                balance_after: newBalance,
                invoice_strategy: 'merged_vps_invoice',
              }),
            ],
          );

          return { billed: true, transactionId };
        });

        if (!chargeResult.billed || !chargeResult.transactionId) {
          result.failedCount += 1;
          result.success = false;
          continue;
        }

        result.billedCount += 1;
      } catch (error) {
        result.failedCount += 1;
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : 'Unknown egress billing error');
        await query(
          `UPDATE organization_egress_billing_cycles
           SET status = 'failed',
               metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
               updated_at = NOW()
           WHERE id = $1`,
          [
            cycle.id,
            JSON.stringify({
              failure_reason: error instanceof Error ? error.message : 'Unknown egress billing error',
            }),
          ],
        );
      }
    }

    return result;
  }

  static async listBillingHistory(month?: string): Promise<EgressBillingHistoryRecord[]> {
    const params: string[] = [];
    let whereClause = '';
    if (month) {
      params.push(getBillingMonthDate(month));
      whereClause = 'WHERE c.billing_month = $1';
    }

    const result = await query(
      `SELECT
         c.id,
         c.billing_month,
         c.pool_id,
         c.pool_scope,
         c.region_id,
         c.organization_id,
         o.name AS organization_name,
         c.total_measured_usage_gb,
         c.allocated_pool_quota_gb,
         c.allocated_billable_gb,
         c.unit_price_per_gb,
         c.total_amount,
         c.status,
         c.billed_transaction_id,
         c.metadata,
         c.created_at,
         c.updated_at
       FROM organization_egress_billing_cycles c
       LEFT JOIN organizations o ON o.id = c.organization_id
       ${whereClause}
       ORDER BY c.billing_month DESC, c.created_at DESC`,
      params,
    );

    return (result.rows || []).map((row) => mapHistoryRow(row));
  }

  static async listInvoiceItemsForPeriod(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<InvoiceItem[]> {
    const result = await query(
      `SELECT
         a.vps_instance_id,
         a.provider_instance_id,
         a.allocated_billable_gb,
         a.unit_price_per_gb,
         a.total_amount,
         a.metadata,
         c.billing_month,
         c.pool_id,
         c.pool_scope,
         c.region_id
       FROM organization_egress_billing_allocations a
       JOIN organization_egress_billing_cycles c ON c.id = a.billing_cycle_id
       JOIN payment_transactions pt ON pt.id = c.billed_transaction_id
       WHERE c.organization_id = $1
         AND c.status = 'billed'
         AND pt.created_at >= $2
         AND pt.created_at <= $3
       ORDER BY pt.created_at DESC, a.total_amount DESC, a.created_at ASC`,
      [organizationId, startDate, endDate],
    );

    return (result.rows || []).map((row) => {
      const metadata = parseMetadataRecord(row.metadata);
      const label =
        typeof metadata.label === 'string' && metadata.label.trim().length > 0
          ? metadata.label.trim()
          : row.provider_instance_id
            ? `VPS ${String(row.provider_instance_id)}`
            : 'Unnamed VPS';
      const billableGb = Number(row.allocated_billable_gb || 0);
      const unitPrice = Number(row.unit_price_per_gb || 0);
      const amount = Number(row.total_amount || 0);
      const billingMonthLabel = String(row.billing_month).slice(0, 7);
      const regionSuffix =
        row.pool_scope === 'region' && row.region_id
          ? ` • ${String(row.region_id)}`
          : '';

      return {
        description: `${label} - Egress Overage (${billableGb.toFixed(4)} GB for ${billingMonthLabel}${regionSuffix})`,
        quantity: billableGb,
        unitPrice,
        amount,
      };
    });
  }

  static async getOrganizationOverview(
    organizationId: string,
    month?: string,
  ): Promise<OrganizationEgressOverview> {
    const billingMonth = getBillingMonthDate(month);
    const currentMonth = getBillingMonthDate();

    // For current month, use live data; for historical, use persisted tables
    if (billingMonth === currentMonth) {
      return this.getOrganizationOverviewLive(organizationId, billingMonth);
    }

    // Historical months: read from persisted tables
    const [cycleResult, allocationResult, recentCyclesResult] = await Promise.all([
      query(
        `SELECT
           c.id,
           c.billing_month,
           c.pool_id,
           c.pool_scope,
           c.region_id,
           c.organization_id,
           c.total_measured_usage_gb,
           c.allocated_pool_quota_gb,
           c.allocated_billable_gb,
           c.unit_price_per_gb,
           c.total_amount,
           c.status,
           c.billed_transaction_id,
           c.metadata,
           c.created_at,
           c.updated_at
         FROM organization_egress_billing_cycles c
         WHERE c.organization_id = $1
           AND c.billing_month = $2
         ORDER BY c.pool_id ASC, c.created_at ASC`,
        [organizationId, billingMonth],
      ),
      query(
        `SELECT
           a.billing_month,
           a.pool_id,
           a.pool_scope,
           a.region_id,
           a.vps_instance_id,
           a.provider_instance_id,
           a.measured_usage_gb,
           a.allocated_billable_gb,
           a.unit_price_per_gb,
           a.total_amount,
           a.metadata,
           c.status,
           c.updated_at
         FROM organization_egress_billing_allocations a
         JOIN organization_egress_billing_cycles c ON c.id = a.billing_cycle_id
         WHERE a.organization_id = $1
           AND a.billing_month = $2
         ORDER BY a.total_amount DESC, a.created_at ASC`,
        [organizationId, billingMonth],
      ),
      query(
        `SELECT
           c.id,
           c.billing_month,
           c.pool_id,
           c.pool_scope,
           c.region_id,
           c.organization_id,
           o.name AS organization_name,
           c.total_measured_usage_gb,
           c.allocated_pool_quota_gb,
           c.allocated_billable_gb,
           c.unit_price_per_gb,
           c.total_amount,
           c.status,
           c.billed_transaction_id,
           c.metadata,
           c.created_at,
           c.updated_at
         FROM organization_egress_billing_cycles c
         LEFT JOIN organizations o ON o.id = c.organization_id
         WHERE c.organization_id = $1
         ORDER BY c.billing_month DESC, c.created_at DESC
         LIMIT 12`,
        [organizationId],
      ),
    ]);

    const cycleRows = cycleResult.rows || [];
    const allocationRows = allocationResult.rows || [];
    const recentCycles = (recentCyclesResult.rows || []).map((row) => mapHistoryRow(row));
    const latestUpdatedAt =
      cycleRows
        .map((row) => (row.updated_at ? String(row.updated_at) : null))
        .filter((value): value is string => Boolean(value))
        .sort()
        .pop() || null;

    const billingEnabledPoolCount = cycleRows.reduce((count, row) => {
      const metadata = parseMetadataRecord(row.metadata);
      return metadata.billing_enabled === true ? count + 1 : count;
    }, 0);

    return {
      organizationId,
      billingMonth,
      projectedTotals: {
        totalMeasuredUsageGb: round(
          cycleRows.reduce((sum, row) => sum + Number(row.total_measured_usage_gb || 0), 0),
          6,
        ),
        totalBillableGb: round(
          cycleRows.reduce((sum, row) => sum + Number(row.allocated_billable_gb || 0), 0),
          6,
        ),
        totalAmount: round(
          cycleRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
          6,
        ),
        activePoolCount: cycleRows.length,
        billingEnabledPoolCount,
        updatedAt: latestUpdatedAt,
      },
      servers: allocationRows.map((row) => {
        const metadata = parseMetadataRecord(row.metadata);
        return {
          billingMonth: String(row.billing_month),
          poolId: String(row.pool_id),
          poolScope: row.pool_scope === 'region' ? 'region' : 'global',
          regionId: row.region_id ? String(row.region_id) : null,
          vpsInstanceId: row.vps_instance_id ? String(row.vps_instance_id) : null,
          providerInstanceId: row.provider_instance_id ? String(row.provider_instance_id) : null,
          label:
            typeof metadata.label === 'string' && metadata.label.trim().length > 0
              ? metadata.label.trim()
              : row.provider_instance_id
                ? `VPS ${String(row.provider_instance_id)}`
                : 'Unnamed VPS',
          measuredUsageGb: Number(row.measured_usage_gb || 0),
          allocatedBillableGb: Number(row.allocated_billable_gb || 0),
          unitPricePerGb: Number(row.unit_price_per_gb || 0),
          amount: Number(row.total_amount || 0),
          status: row.status === 'preview' ? 'projected' : (row.status as OrganizationEgressServerCharge['status']),
          updatedAt: String(row.updated_at),
        };
      }),
      recentCycles,
    };
  }

  private static async getOrganizationOverviewLive(
    organizationId: string,
    billingMonth: string,
  ): Promise<OrganizationEgressOverview> {
    // Get live usage for the current month
    const pools = await this.getLiveUsage(billingMonth);

    // Aggregate totals across all pools for this organization
    let totalMeasuredUsageGb = 0;
    let totalBillableGb = 0;
    let totalAmount = 0;
    let activePoolCount = 0;
    let billingEnabledPoolCount = 0;
    const servers: OrganizationEgressServerCharge[] = [];
    const updatedAt = new Date().toISOString();

    for (const pool of pools) {
      let poolHasOrgItem = false;

      for (const item of pool.items) {
        if (item.organizationId === organizationId) {
          if (!poolHasOrgItem) {
            poolHasOrgItem = true;
            activePoolCount++;
            if (pool.billingEnabled) {
              billingEnabledPoolCount++;
            }
          }

          totalMeasuredUsageGb += item.measuredUsageGb;
          totalBillableGb += item.allocatedBillableGb;
          totalAmount += item.amount;

          // Add server-level breakdown for VPS instances
          if (item.vpsInstanceId) {
            servers.push({
              billingMonth,
              poolId: pool.poolId,
              poolScope: pool.poolScope,
              regionId: pool.regionId || null,
              vpsInstanceId: item.vpsInstanceId,
              providerInstanceId: item.providerInstanceId || null,
              label: item.label || item.providerInstanceId || `VPS ${item.providerInstanceId || 'Unknown'}`,
              measuredUsageGb: item.measuredUsageGb,
              allocatedBillableGb: item.allocatedBillableGb,
              unitPricePerGb: item.unitPricePerGb,
              amount: item.amount,
              status: 'projected', // Live data is always "projected"
              updatedAt,
            });
          }
        }
      }
    }

    return {
      organizationId,
      billingMonth,
      projectedTotals: {
        totalMeasuredUsageGb: round(totalMeasuredUsageGb, 6),
        totalBillableGb: round(totalBillableGb, 6),
        totalAmount: round(totalAmount, 6),
        activePoolCount,
        billingEnabledPoolCount,
        updatedAt,
      },
      servers,
      recentCycles: [], // Empty for live view (historical cycles require persisted data)
    };
  }

  private static async collectUsageRows(billingMonth: string): Promise<UsageRow[]> {
    const result = await query(
      `SELECT
         vi.id AS vps_instance_id,
         vi.organization_id,
         o.name AS organization_name,
         vi.provider_instance_id,
         vi.label,
         COALESCE(vi.configuration->>'region', vp_region.region_id, 'unknown') AS region_id,
         up_regions.region_label AS region_label,
         COALESCE(
           NULLIF(vp.specifications->>'transfer', '')::numeric,
           NULLIF(vp.specifications->>'bandwidth', '')::numeric,
           NULLIF(vp.specifications->>'transfer_gb', '')::numeric,
           0
         ) AS transfer_included_gb
       FROM vps_instances vi
       JOIN organizations o ON o.id = vi.organization_id
       LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
       LEFT JOIN LATERAL (
         SELECT region_id
         FROM vps_plan_regions
         WHERE vps_plan_id = vp.id
         ORDER BY region_id ASC
         LIMIT 1
       ) vp_region ON true
       LEFT JOIN region_egress_pricing up_regions ON up_regions.region_id = COALESCE(vi.configuration->>'region', vp_region.region_id)
       WHERE COALESCE(vi.provider_type, 'linode') = 'linode'`,
    );

    const rows = result.rows || [];
    const activeRows = await Promise.all(
      rows.map(async (row): Promise<UsageRow> => {
        const providerInstanceId = Number(row.provider_instance_id);
        let measuredUsageGb = 0;

        if (Number.isFinite(providerInstanceId)) {
          try {
            const transfer = await linodeService.getLinodeInstanceTransfer(providerInstanceId);
            measuredUsageGb = normalizeTransferUsageGb(transfer.used);
          } catch (error) {
            console.warn(`Unable to fetch transfer usage for Linode ${row.provider_instance_id}:`, error);
          }
        }

        return {
          organization_id: String(row.organization_id),
          organization_name: String(row.organization_name || 'Unknown Organization'),
          vps_instance_id: String(row.vps_instance_id),
          provider_instance_id: String(row.provider_instance_id),
          label: String(row.label || row.provider_instance_id || 'Unnamed VPS'),
          region_id: String(row.region_id || 'unknown'),
          region_label: row.region_label ? String(row.region_label) : null,
          transfer_included_gb: Number(row.transfer_included_gb || 0),
          measured_usage_gb: measuredUsageGb,
        };
      }),
    );

    const snapshotResult = await query(
      `SELECT
         s.organization_id,
         o.name AS organization_name,
         s.vps_instance_id,
         s.provider_instance_id,
         s.label,
         s.region_id,
         s.region_label,
         s.transfer_included_gb,
         s.measured_usage_gb
       FROM vps_egress_usage_snapshots s
       JOIN organizations o ON o.id = s.organization_id
       LEFT JOIN vps_instances vi ON vi.id = s.vps_instance_id
       WHERE s.billing_month = $1
         AND vi.id IS NULL`,
      [billingMonth],
    );

    const snapshotRows = (snapshotResult.rows || []).map((row): UsageRow => ({
      organization_id: String(row.organization_id),
      organization_name: String(row.organization_name || 'Unknown Organization'),
      vps_instance_id: String(row.vps_instance_id),
      provider_instance_id: String(row.provider_instance_id || ''),
      label: String(row.label || row.provider_instance_id || 'Unnamed VPS'),
      region_id: String(row.region_id || 'unknown'),
      region_label: row.region_label ? String(row.region_label) : null,
      transfer_included_gb: Number(row.transfer_included_gb || 0),
      measured_usage_gb: Number(row.measured_usage_gb || 0),
    }));

    return [...activeRows, ...snapshotRows].filter((row) => row.region_id !== 'unknown');
  }

  private static buildPools(args: {
    usageRows: UsageRow[];
    accountTransfer: AccountTransferResponse;
    pricingByRegion: Map<string, RegionEgressPricingRecord>;
    regionLabelMap: Record<string, string>;
  }): PoolAllocationPreview[] {
    const { usageRows, accountTransfer, pricingByRegion, regionLabelMap } = args;
    const rowsByPool = new Map<string, UsageRow[]>();

    for (const row of usageRows) {
      const pricing = pricingByRegion.get(row.region_id);
      const poolScope = pricing?.pricing_scope === 'region' ? 'region' : 'global';
      const poolId = poolScope === 'region' ? row.region_id : 'global';
      const existing = rowsByPool.get(poolId) || [];
      existing.push(row);
      rowsByPool.set(poolId, existing);
    }

    const regionTransferMap = new Map<string, { quota: number; billable: number; used: number }>();
    for (const regionTransfer of accountTransfer.region_transfers || []) {
      if (!regionTransfer?.id) continue;
      regionTransferMap.set(regionTransfer.id, {
        quota: normalizePoolTransferGb(regionTransfer.quota),
        billable: normalizePoolTransferGb(regionTransfer.billable),
        used: normalizePoolTransferGb(regionTransfer.used),
      });
    }

    const pools: PoolAllocationPreview[] = [];

    for (const [poolId, rows] of rowsByPool.entries()) {
      const firstRegion = rows[0]?.region_id || null;
      const pricing = firstRegion ? pricingByRegion.get(firstRegion) : null;
      const poolScope = pricing?.pricing_scope === 'region' ? 'region' : 'global';
      const isGlobal = poolScope === 'global';
      const accountPool = !isGlobal && firstRegion ? regionTransferMap.get(firstRegion) : null;
      const accountUsageGb = isGlobal
        ? normalizePoolTransferGb(accountTransfer.used)
        : Number(accountPool?.used || 0);
      const accountQuotaGb = isGlobal
        ? normalizePoolTransferGb(accountTransfer.quota)
        : Number(accountPool?.quota || 0);
      const accountBillableGb = isGlobal
        ? normalizePoolTransferGb(accountTransfer.billable)
        : Number(accountPool?.billable || 0);
      const totalMeasuredUsageGb = rows.reduce((sum, row) => sum + Number(row.measured_usage_gb || 0), 0);
      const totalIncludedQuotaGb = rows.reduce((sum, row) => sum + Number(row.transfer_included_gb || 0), 0);
      const effectiveQuotaGb = accountQuotaGb > 0 ? accountQuotaGb : totalIncludedQuotaGb;
      const effectiveBillableGb = accountBillableGb > 0
        ? accountBillableGb
        : Math.max(totalMeasuredUsageGb - effectiveQuotaGb, 0);
      const unitPrice = pricing?.final_price_per_gb || 0;
      const items: PoolAllocationItem[] = rows.map((row) => {
        const measuredUsageGb = Number(row.measured_usage_gb || 0);
        const usageShare = totalMeasuredUsageGb > 0 ? measuredUsageGb / totalMeasuredUsageGb : 0;
        const allocatedPoolQuotaGb = effectiveQuotaGb * usageShare;
        const allocatedBillableGb = Math.max(measuredUsageGb - allocatedPoolQuotaGb, 0);
        const cappedBillableGb = effectiveBillableGb > 0
          ? Math.min(allocatedBillableGb, effectiveBillableGb * usageShare || allocatedBillableGb)
          : 0;
        const amount = pricing?.billing_enabled ? cappedBillableGb * unitPrice : 0;

        return {
          organizationId: row.organization_id,
          organizationName: row.organization_name,
          vpsInstanceId: row.vps_instance_id,
          providerInstanceId: row.provider_instance_id,
          label: row.label,
          regionId: row.region_id,
          measuredUsageGb: round(measuredUsageGb, 6),
          usageShare: round(usageShare, 10),
          allocatedPoolQuotaGb: round(allocatedPoolQuotaGb, 6),
          allocatedBillableGb: round(cappedBillableGb, 6),
          unitPricePerGb: round(unitPrice, 6),
          amount: round(amount, 6),
        };
      });

      pools.push({
        poolId,
        poolScope,
        regionId: isGlobal ? null : firstRegion,
        regionLabel: isGlobal ? 'Global Transfer Pool' : regionLabelMap[firstRegion || ''] || firstRegion,
        pricingCategory: pricing?.pricing_category || 'core',
        billingEnabled: Boolean(pricing?.billing_enabled),
        basePricePerGb: round(pricing?.base_price_per_gb || 0, 6),
        upchargePricePerGb: round(pricing?.upcharge_price_per_gb || 0, 6),
        finalPricePerGb: round(unitPrice, 6),
        accountUsageGb: round(accountUsageGb, 6),
        accountQuotaGb: round(effectiveQuotaGb, 6),
        accountBillableGb: round(effectiveBillableGb, 6),
        totalMeasuredUsageGb: round(totalMeasuredUsageGb, 6),
        totalAllocatedQuotaGb: round(items.reduce((sum, item) => sum + item.allocatedPoolQuotaGb, 0), 6),
        totalAllocatedBillableGb: round(items.reduce((sum, item) => sum + item.allocatedBillableGb, 0), 6),
        items,
      });
    }

    return pools.sort((a, b) => a.poolId.localeCompare(b.poolId));
  }

  private static async persistProjection(billingMonth: string, pools: PoolAllocationPreview[]): Promise<void> {
    await transaction(async (client) => {
      await client.query('DELETE FROM organization_egress_billing_allocations WHERE billing_month = $1', [billingMonth]);
      await client.query('DELETE FROM organization_egress_billing_cycles WHERE billing_month = $1', [billingMonth]);

      for (const pool of pools) {
        const byOrg = new Map<string, PoolAllocationItem[]>();
        for (const item of pool.items) {
          const existing = byOrg.get(item.organizationId) || [];
          existing.push(item);
          byOrg.set(item.organizationId, existing);
        }

        for (const [organizationId, items] of byOrg.entries()) {
          // Collect all unique vps_instance_ids and validate they exist in the database
          const vpsInstanceIds = Array.from(new Set(
            items.filter(item => item.vpsInstanceId).map(item => item.vpsInstanceId)
          ));
          
          let validVpsIds: Set<string> = new Set();
          if (vpsInstanceIds.length > 0) {
            const vpsCheckResult = await client.query(
              `SELECT id FROM vps_instances WHERE id = ANY($1::uuid[])`,
              [vpsInstanceIds]
            );
            validVpsIds = new Set(vpsCheckResult.rows.map((row) => String(row.id)));
          }

          // Replace vps_instance_id with NULL if the referenced VPS instance no longer exists
          const itemsWithValidVpsIds = items.map((item) => {
            if (item.vpsInstanceId && !validVpsIds.has(item.vpsInstanceId)) {
              console.warn(
                `VPS instance ${item.vpsInstanceId} no longer exists; setting vps_instance_id to NULL for allocation ` +
                `(organization: ${organizationId}, label: ${item.label}, provider: ${item.providerInstanceId})`
              );
              return { ...item, vpsInstanceId: null as any };
            }
            return item;
          });
          const organizationName = itemsWithValidVpsIds[0]?.organizationName || null;
          const totalMeasured = round(itemsWithValidVpsIds.reduce((sum, item) => sum + item.measuredUsageGb, 0), 6);
          const totalQuota = round(itemsWithValidVpsIds.reduce((sum, item) => sum + item.allocatedPoolQuotaGb, 0), 6);
          const totalBillable = round(itemsWithValidVpsIds.reduce((sum, item) => sum + item.allocatedBillableGb, 0), 6);
          const totalAmount = round(itemsWithValidVpsIds.reduce((sum, item) => sum + item.amount, 0), 6);

          const cycleResult = await client.query(
            `INSERT INTO organization_egress_billing_cycles (
               billing_month, pool_id, pool_scope, region_id, organization_id,
               total_measured_usage_gb, allocated_pool_usage_gb, allocated_pool_quota_gb,
               allocated_billable_gb, unit_price_per_gb, total_amount, status, metadata,
               created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, 'preview', $11, NOW(), NOW())
             RETURNING id`,
            [
              billingMonth,
              pool.poolId,
              pool.poolScope,
              pool.regionId,
              organizationId,
              totalMeasured,
              totalQuota,
              totalBillable,
              pool.finalPricePerGb,
              totalAmount,
              JSON.stringify({
                organization_name: organizationName,
                account_usage_gb: pool.accountUsageGb,
                account_quota_gb: pool.accountQuotaGb,
                account_billable_gb: pool.accountBillableGb,
                billing_enabled: pool.billingEnabled,
              }),
            ],
          );

          const billingCycleId = cycleResult.rows[0]?.id;
          for (const item of itemsWithValidVpsIds) {
            await client.query(
              `INSERT INTO organization_egress_billing_allocations (
                 billing_cycle_id, billing_month, pool_id, pool_scope, region_id, organization_id,
                 vps_instance_id, provider_instance_id, measured_usage_gb, usage_share,
                 allocated_pool_usage_gb, allocated_pool_quota_gb, allocated_billable_gb,
                 unit_price_per_gb, total_amount, metadata, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $11, $12, $13, $14, $15, NOW(), NOW())`,
              [
                billingCycleId,
                billingMonth,
                pool.poolId,
                pool.poolScope,
                pool.regionId,
                organizationId,
                item.vpsInstanceId,
                item.providerInstanceId,
                item.measuredUsageGb,
                item.usageShare,
                item.allocatedPoolQuotaGb,
                item.allocatedBillableGb,
                item.unitPricePerGb,
                item.amount,
                JSON.stringify({
                  label: item.label,
                  organization_name: item.organizationName,
                  region_id: item.regionId,
                }),
              ],
            );
          }
        }
      }
    });
  }
}
