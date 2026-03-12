import { query, transaction } from '../lib/database.js';
import { linodeService } from './linodeService.js';
import { PayPalService } from './paypalService.js';

interface TransferPricingConfig {
  providerRatePerGb: number;
  customerRatePerGb: number;
  markupType: 'flat' | 'multiplier';
  markupValue: number;
}

export interface TransferUsageRow {
  vpsInstanceId: string;
  organizationId: string | null;
  userId: string | null;
  label: string;
  providerInstanceId: string;
  regionId: string | null;
  includedTransferGb: number;
  outboundTransferGb: number;
  inboundTransferGb: number;
  providerRatePerGb: number;
  customerRatePerGb: number;
  projectedOverageGb: number;
  projectedOverageCostUsd: number;
}

export interface OrganizationTransferSummary {
  periodMonth: string;
  organizationId: string;
  includedTransferGb: number;
  outboundTransferGb: number;
  inboundTransferGb: number;
  poolQuotaGb: number;
  poolUsedGb: number;
  poolBillableGb: number;
  remainingIncludedGb: number;
  projectedOverageGb: number;
  projectedOverageCostUsd: number;
  vps: TransferUsageRow[];
}

export interface AdminTransferOverview {
  periodMonth: string;
  accountQuotaGb: number;
  accountUsedGb: number;
  accountBillableGb: number;
  totalIncludedGb: number;
  totalOutboundGb: number;
  totalInboundGb: number;
  projectedRevenueUsd: number;
  projectedProviderCostUsd: number;
  organizations: Array<{
    organizationId: string | null;
    organizationName: string;
    outboundTransferGb: number;
    includedTransferGb: number;
    projectedOverageGb: number;
    projectedOverageCostUsd: number;
  }>;
}

const DEFAULT_PROVIDER_RATE = 0.005;
const SPECIAL_REGION_PROVIDER_RATES: Record<string, number> = {
  'id-cgk': 0.015,
  'br-gru': 0.007,
  'distributed': 0.01,
};

const roundNumber = (value: number, precision = 3): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const roundCurrency = (value: number): number => roundNumber(value, 4);

const getPeriodMonth = (date = new Date()): string => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

const normalizeTransferUsage = (usage: unknown): { inboundGb: number; outboundGb: number; totalGb: number } => {
  if (typeof usage === 'number') {
    return { inboundGb: 0, outboundGb: roundNumber(usage), totalGb: roundNumber(usage) };
  }

  if (!usage || typeof usage !== 'object') {
    return { inboundGb: 0, outboundGb: 0, totalGb: 0 };
  }

  const record = usage as Record<string, unknown>;
  const inbound = Number(record.inbound ?? record.in ?? 0);
  const outbound = Number(record.outbound ?? record.out ?? record.total ?? 0);
  const total = Number(record.total ?? (inbound + outbound));

  return {
    inboundGb: roundNumber(Number.isFinite(inbound) ? inbound : 0),
    outboundGb: roundNumber(Number.isFinite(outbound) ? outbound : 0),
    totalGb: roundNumber(Number.isFinite(total) ? total : 0),
  };
};

export class TransferBillingService {
  static getProviderRatePerGb(regionId: string | null | undefined): number {
    if (!regionId) return DEFAULT_PROVIDER_RATE;
    return SPECIAL_REGION_PROVIDER_RATES[regionId] ?? DEFAULT_PROVIDER_RATE;
  }

  private static async ensureWalletExists(organizationId: string): Promise<void> {
    await query(
      `INSERT INTO wallets (organization_id, balance, currency)
       VALUES ($1, 0, 'USD')
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId],
    );
  }

  private static computeCustomerRate(providerRatePerGb: number, markupType?: string | null, markupValue?: number | null): TransferPricingConfig {
    const safeMarkupType = markupType === 'multiplier' ? 'multiplier' : 'flat';
    const safeMarkupValue = Number.isFinite(Number(markupValue)) ? Number(markupValue) : 0;
    const customerRatePerGb = safeMarkupType === 'multiplier'
      ? providerRatePerGb * Math.max(safeMarkupValue || 1, 0)
      : providerRatePerGb + Math.max(safeMarkupValue, 0);

    return {
      providerRatePerGb: roundCurrency(providerRatePerGb),
      customerRatePerGb: roundCurrency(customerRatePerGb),
      markupType: safeMarkupType,
      markupValue: roundCurrency(safeMarkupValue),
    };
  }

  static async syncCurrentMonthUsage(periodMonth = getPeriodMonth()): Promise<{ periodMonth: string; syncedInstances: number }> {
    const [instances, accountTransfer] = await Promise.all([
      query(`
        SELECT
          vi.id,
          vi.organization_id,
          vi.provider_instance_id,
          vi.label,
          COALESCE(NULLIF(vi.configuration::jsonb->>'region', ''), vi.configuration::jsonb->>'region_id') AS region_id,
          o.owner_id AS user_id,
          vp.transfer_overage_markup_type,
          vp.transfer_overage_markup_value,
          vp.transfer_overage_enabled,
          COALESCE(
            NULLIF(vp.specifications->>'transfer_gb', '')::numeric,
            NULLIF(vp.specifications->>'transfer', '')::numeric,
            NULLIF(vp.specifications->>'bandwidth_gb', '')::numeric,
            0
          ) AS included_transfer_gb
        FROM vps_instances vi
        LEFT JOIN organizations o ON o.id = vi.organization_id
        LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
        WHERE vi.provider_instance_id IS NOT NULL
      `),
      linodeService.getAccountTransfer(),
    ]);

    await query(
      `INSERT INTO account_transfer_pool_snapshots (
        period_month, provider_type, quota_gb, used_gb, billable_gb, region_transfers, source_payload, last_synced_at, updated_at
      ) VALUES ($1, 'linode', $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (period_month, provider_type)
      DO UPDATE SET
        quota_gb = EXCLUDED.quota_gb,
        used_gb = EXCLUDED.used_gb,
        billable_gb = EXCLUDED.billable_gb,
        region_transfers = EXCLUDED.region_transfers,
        source_payload = EXCLUDED.source_payload,
        last_synced_at = NOW(),
        updated_at = NOW()`,
      [
        periodMonth,
        roundNumber(Number(accountTransfer.quota ?? 0)),
        roundNumber(Number(accountTransfer.used ?? 0)),
        roundNumber(Number(accountTransfer.billable ?? 0)),
        JSON.stringify(accountTransfer.region_transfers ?? []),
        JSON.stringify(accountTransfer),
      ],
    );

    let syncedInstances = 0;
    for (const row of instances.rows) {
      const providerInstanceId = Number.parseInt(String(row.provider_instance_id), 10);
      if (!Number.isFinite(providerInstanceId)) {
        continue;
      }

      try {
        const transfer = await linodeService.getLinodeInstanceTransfer(providerInstanceId);
        const normalized = normalizeTransferUsage(transfer.used);

        await query(
          `INSERT INTO vps_transfer_usage_monthly (
            period_month, vps_instance_id, organization_id, provider_type, provider_instance_id, region_id,
            included_transfer_gb, outbound_transfer_gb, inbound_transfer_gb, stats_window, source_payload,
            last_synced_at, updated_at
          ) VALUES ($1, $2, $3, 'linode', $4, $5, $6, $7, $8, 'month-to-date', $9, NOW(), NOW())
          ON CONFLICT (period_month, vps_instance_id)
          DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            provider_instance_id = EXCLUDED.provider_instance_id,
            region_id = EXCLUDED.region_id,
            included_transfer_gb = EXCLUDED.included_transfer_gb,
            outbound_transfer_gb = EXCLUDED.outbound_transfer_gb,
            inbound_transfer_gb = EXCLUDED.inbound_transfer_gb,
            stats_window = EXCLUDED.stats_window,
            source_payload = EXCLUDED.source_payload,
            last_synced_at = NOW(),
            updated_at = NOW()`,
          [
            periodMonth,
            row.id,
            row.organization_id,
            String(row.provider_instance_id),
            row.region_id,
            roundNumber(Number(row.included_transfer_gb ?? 0)),
            normalized.outboundGb,
            normalized.inboundGb,
            JSON.stringify(transfer),
          ],
        );
        syncedInstances += 1;
      } catch (error) {
        console.warn(`Failed to sync transfer for VPS ${row.id}:`, error);
      }
    }

    await this.calculateCurrentMonthOverageAllocations(periodMonth);

    return { periodMonth, syncedInstances };
  }

  static async calculateCurrentMonthOverageAllocations(periodMonth = getPeriodMonth()): Promise<void> {
    const usageResult = await query(
      `SELECT
        u.vps_instance_id,
        u.organization_id,
        u.provider_instance_id,
        u.region_id,
        u.included_transfer_gb,
        u.outbound_transfer_gb,
        u.inbound_transfer_gb,
        vi.label,
        o.owner_id AS user_id,
        COALESCE(vp.transfer_overage_markup_type, 'flat') AS transfer_overage_markup_type,
        COALESCE(vp.transfer_overage_markup_value, 0) AS transfer_overage_markup_value,
        COALESCE(vp.transfer_overage_enabled, true) AS transfer_overage_enabled
      FROM vps_transfer_usage_monthly u
      JOIN vps_instances vi ON vi.id = u.vps_instance_id
      LEFT JOIN organizations o ON o.id = u.organization_id
      LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
      WHERE u.period_month = $1
      ORDER BY u.outbound_transfer_gb DESC, vi.created_at ASC`,
      [periodMonth],
    );

    const poolResult = await query(
      `SELECT quota_gb, used_gb, billable_gb
       FROM account_transfer_pool_snapshots
       WHERE period_month = $1 AND provider_type = 'linode'
       LIMIT 1`,
      [periodMonth],
    );

    const rows = usageResult.rows;
    const totalOutbound = rows.reduce((sum, row) => sum + Number(row.outbound_transfer_gb ?? 0), 0);
    const totalIncluded = rows.reduce((sum, row) => sum + Number(row.included_transfer_gb ?? 0), 0);
    const providerReportedBillable = Number(poolResult.rows[0]?.billable_gb ?? 0);
    const computedBillable = Math.max(totalOutbound - totalIncluded, 0);
    const accountOverageGb = roundNumber(Math.max(providerReportedBillable, computedBillable));

    await query(`DELETE FROM transfer_overage_allocations WHERE period_month = $1`, [periodMonth]);

    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      const outbound = Number(row.outbound_transfer_gb ?? 0);
      const included = Number(row.included_transfer_gb ?? 0);
      const usageFraction = totalOutbound > 0 ? outbound / totalOutbound : 0;
      const allocatedOverageGb = accountOverageGb > 0 ? usageFraction * accountOverageGb : 0;
      const providerRatePerGb = this.getProviderRatePerGb(row.region_id);
      const pricing = this.computeCustomerRate(
        providerRatePerGb,
        row.transfer_overage_enabled === false ? 'flat' : row.transfer_overage_markup_type,
        row.transfer_overage_enabled === false ? 0 : Number(row.transfer_overage_markup_value ?? 0),
      );
      const providerCostUsd = allocatedOverageGb * pricing.providerRatePerGb;
      const customerCostUsd = allocatedOverageGb * pricing.customerRatePerGb;

      await query(
        `INSERT INTO transfer_overage_allocations (
          period_month, vps_instance_id, organization_id, user_id, region_id, usage_fraction,
          included_transfer_gb, outbound_transfer_gb, allocated_overage_gb,
          provider_rate_per_gb, customer_rate_per_gb,
          provider_cost_usd, customer_cost_usd, markup_type, markup_value,
          status, source_payload, last_calculated_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'calculated', $16, NOW(), NOW())`,
        [
          periodMonth,
          row.vps_instance_id,
          row.organization_id,
          row.user_id,
          row.region_id,
          roundNumber(usageFraction, 8),
          roundNumber(included),
          roundNumber(outbound),
          roundNumber(allocatedOverageGb),
          pricing.providerRatePerGb,
          pricing.customerRatePerGb,
          roundCurrency(providerCostUsd),
          roundCurrency(customerCostUsd),
          pricing.markupType,
          pricing.markupValue,
          JSON.stringify({
            totalOutboundGb: roundNumber(totalOutbound),
            totalIncludedGb: roundNumber(totalIncluded),
            accountOverageGb,
          }),
        ],
      );
    }
  }

  static async getOrganizationTransferSummary(
    organizationId: string,
    options?: { skipSync?: boolean; periodMonth?: string },
  ): Promise<OrganizationTransferSummary> {
    const periodMonth = options?.periodMonth ?? getPeriodMonth();
    if (!options?.skipSync) {
      await this.syncCurrentMonthUsage(periodMonth);
    }

    const [usageResult, poolResult] = await Promise.all([
      query(
        `SELECT
          u.vps_instance_id,
          u.organization_id,
          vi.label,
          u.provider_instance_id,
          u.region_id,
          u.included_transfer_gb,
          u.outbound_transfer_gb,
          u.inbound_transfer_gb,
          COALESCE(a.provider_rate_per_gb, 0) AS provider_rate_per_gb,
          COALESCE(a.customer_rate_per_gb, 0) AS customer_rate_per_gb,
          COALESCE(a.allocated_overage_gb, 0) AS allocated_overage_gb,
          COALESCE(a.customer_cost_usd, 0) AS customer_cost_usd
        FROM vps_transfer_usage_monthly u
        JOIN vps_instances vi ON vi.id = u.vps_instance_id
        LEFT JOIN transfer_overage_allocations a
          ON a.period_month = u.period_month AND a.vps_instance_id = u.vps_instance_id
        WHERE u.period_month = $1 AND u.organization_id = $2
        ORDER BY u.outbound_transfer_gb DESC, vi.label ASC`,
        [periodMonth, organizationId],
      ),
      query(
        `SELECT quota_gb, used_gb, billable_gb
         FROM account_transfer_pool_snapshots
         WHERE period_month = $1 AND provider_type = 'linode'
         LIMIT 1`,
        [periodMonth],
      ),
    ]);

    const vps = usageResult.rows.map((row): TransferUsageRow => ({
      vpsInstanceId: row.vps_instance_id,
      organizationId: row.organization_id,
      userId: null,
      label: row.label,
      providerInstanceId: row.provider_instance_id,
      regionId: row.region_id,
      includedTransferGb: roundNumber(Number(row.included_transfer_gb ?? 0)),
      outboundTransferGb: roundNumber(Number(row.outbound_transfer_gb ?? 0)),
      inboundTransferGb: roundNumber(Number(row.inbound_transfer_gb ?? 0)),
      providerRatePerGb: roundCurrency(Number(row.provider_rate_per_gb ?? 0)),
      customerRatePerGb: roundCurrency(Number(row.customer_rate_per_gb ?? 0)),
      projectedOverageGb: roundNumber(Number(row.allocated_overage_gb ?? 0)),
      projectedOverageCostUsd: roundCurrency(Number(row.customer_cost_usd ?? 0)),
    }));

    const includedTransferGb = vps.reduce((sum, item) => sum + item.includedTransferGb, 0);
    const outboundTransferGb = vps.reduce((sum, item) => sum + item.outboundTransferGb, 0);
    const inboundTransferGb = vps.reduce((sum, item) => sum + item.inboundTransferGb, 0);
    const projectedOverageGb = vps.reduce((sum, item) => sum + item.projectedOverageGb, 0);
    const projectedOverageCostUsd = vps.reduce((sum, item) => sum + item.projectedOverageCostUsd, 0);

    return {
      periodMonth,
      organizationId,
      includedTransferGb: roundNumber(includedTransferGb),
      outboundTransferGb: roundNumber(outboundTransferGb),
      inboundTransferGb: roundNumber(inboundTransferGb),
      poolQuotaGb: roundNumber(Number(poolResult.rows[0]?.quota_gb ?? 0)),
      poolUsedGb: roundNumber(Number(poolResult.rows[0]?.used_gb ?? 0)),
      poolBillableGb: roundNumber(Number(poolResult.rows[0]?.billable_gb ?? 0)),
      remainingIncludedGb: roundNumber(Math.max(includedTransferGb - outboundTransferGb, 0)),
      projectedOverageGb: roundNumber(projectedOverageGb),
      projectedOverageCostUsd: roundCurrency(projectedOverageCostUsd),
      vps,
    };
  }

  static async getAdminTransferOverview(periodMonth = getPeriodMonth()): Promise<AdminTransferOverview> {
    await this.syncCurrentMonthUsage(periodMonth);

    const [poolResult, orgsResult] = await Promise.all([
      query(
        `SELECT quota_gb, used_gb, billable_gb
         FROM account_transfer_pool_snapshots
         WHERE period_month = $1 AND provider_type = 'linode'
         LIMIT 1`,
        [periodMonth],
      ),
      query(
        `SELECT
          u.organization_id,
          COALESCE(o.name, 'Unassigned') AS organization_name,
          COALESCE(SUM(u.included_transfer_gb), 0) AS included_transfer_gb,
          COALESCE(SUM(u.outbound_transfer_gb), 0) AS outbound_transfer_gb,
          COALESCE(SUM(u.inbound_transfer_gb), 0) AS inbound_transfer_gb,
          COALESCE(SUM(a.allocated_overage_gb), 0) AS allocated_overage_gb,
          COALESCE(SUM(a.provider_cost_usd), 0) AS provider_cost_usd,
          COALESCE(SUM(a.customer_cost_usd), 0) AS customer_cost_usd
        FROM vps_transfer_usage_monthly u
        LEFT JOIN organizations o ON o.id = u.organization_id
        LEFT JOIN transfer_overage_allocations a
          ON a.period_month = u.period_month AND a.vps_instance_id = u.vps_instance_id
        WHERE u.period_month = $1
        GROUP BY u.organization_id, o.name
        ORDER BY outbound_transfer_gb DESC, organization_name ASC`,
        [periodMonth],
      ),
    ]);

    const organizations = orgsResult.rows.map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      outboundTransferGb: roundNumber(Number(row.outbound_transfer_gb ?? 0)),
      includedTransferGb: roundNumber(Number(row.included_transfer_gb ?? 0)),
      projectedOverageGb: roundNumber(Number(row.allocated_overage_gb ?? 0)),
      projectedOverageCostUsd: roundCurrency(Number(row.customer_cost_usd ?? 0)),
    }));

    return {
      periodMonth,
      accountQuotaGb: roundNumber(Number(poolResult.rows[0]?.quota_gb ?? 0)),
      accountUsedGb: roundNumber(Number(poolResult.rows[0]?.used_gb ?? 0)),
      accountBillableGb: roundNumber(Number(poolResult.rows[0]?.billable_gb ?? 0)),
      totalIncludedGb: roundNumber(orgsResult.rows.reduce((sum, row) => sum + Number(row.included_transfer_gb ?? 0), 0)),
      totalOutboundGb: roundNumber(orgsResult.rows.reduce((sum, row) => sum + Number(row.outbound_transfer_gb ?? 0), 0)),
      totalInboundGb: roundNumber(orgsResult.rows.reduce((sum, row) => sum + Number(row.inbound_transfer_gb ?? 0), 0)),
      projectedRevenueUsd: roundCurrency(orgsResult.rows.reduce((sum, row) => sum + Number(row.customer_cost_usd ?? 0), 0)),
      projectedProviderCostUsd: roundCurrency(orgsResult.rows.reduce((sum, row) => sum + Number(row.provider_cost_usd ?? 0), 0)),
      organizations,
    };
  }

  static async processMonthEndOverageCharges(periodMonth = getPeriodMonth()): Promise<{ chargedOrganizations: number; totalChargedUsd: number }> {
    await this.syncCurrentMonthUsage(periodMonth);

    const result = await query(
      `SELECT
        organization_id,
        COALESCE(SUM(customer_cost_usd), 0) AS customer_cost_usd
      FROM transfer_overage_allocations
      WHERE period_month = $1
        AND status = 'calculated'
        AND organization_id IS NOT NULL
      GROUP BY organization_id
      HAVING COALESCE(SUM(customer_cost_usd), 0) > 0`,
      [periodMonth],
    );

    let chargedOrganizations = 0;
    let totalChargedUsd = 0;

    for (const row of result.rows) {
      const organizationId = row.organization_id as string;
      const amount = roundCurrency(Number(row.customer_cost_usd ?? 0));
      if (amount <= 0) continue;

      await this.ensureWalletExists(organizationId);
      const success = await PayPalService.deductFundsFromWallet(
        organizationId,
        amount,
        `Network Transfer Overage - ${periodMonth}`,
      );

      if (!success) continue;

      chargedOrganizations += 1;
      totalChargedUsd += amount;

      await transaction(async (client) => {
        await client.query(
          `UPDATE transfer_overage_allocations
           SET status = 'charged', updated_at = NOW(), last_calculated_at = NOW()
           WHERE period_month = $1 AND organization_id = $2`,
          [periodMonth, organizationId],
        );
      });
    }

    return {
      chargedOrganizations,
      totalChargedUsd: roundCurrency(totalChargedUsd),
    };
  }
}
