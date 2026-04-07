/**
 * Egress Hourly Billing Service for SkyPanelV2
 * Runs hourly to poll Linode for transfer usage and deduct pre-paid credits
 *
 * ## How Hourly Billing Works
 *
 * 1. Every hour, the system polls Linode for current transfer usage on all active VPS instances
 * 2. For each VPS, it calculates the delta (change) since the last reading
 * 3. The delta in GB is deducted from the organization's pre-paid egress credits
 * 4. If credits are insufficient, the VPS is automatically shut down and marked as "suspended"
 *
 * ## Monthly Reset Detection
 *
 * Linode resets transfer counters at the start of each month. This service handles this by:
 * - Detecting when the current transfer is less than the previous reading (negative delta)
 * - Treating this as a month boundary and using the current reading as the full delta
 * - This assumes that transfer never decreases within a month (only increases or stays same)
 *
 * ## VPS Status Filtering
 *
 * Only VPS instances in the following states are processed:
 * - `running`: Normal operation
 * - `provisioning`: Being created/initialized
 * - `rebooting`: In reboot process (still consuming transfer)
 * - `migrating`: Being migrated between hosts (still consuming transfer)
 *
 * Instances in `suspended`, `offline`, or `deleted` states are skipped.
 */

import { query } from '../lib/database.js';
import { linodeService } from './linodeService.js';
import {
  deductEgressCredits,
  recordHourlyReading,
  getLastHourlyReading,
  suspendVPSForInsufficientCredits,
  InsufficientCreditsError,
} from './egressCreditService.js';
import { round, normalizeTransferUsageGb } from './egress/egressUtils.js';

// Billing result interface
export interface EgressHourlyBillingResult {
  success: boolean;
  billedCount: number;
  suspendedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

// VPS data for billing
interface VPSForBilling {
  id: string;
  organization_id: string;
  provider_instance_id: string;
  label: string;
  status: string;
  transfer_included_gb: number;
}

/**
 * Get all active VPS instances for egress billing
 * Includes Linode instances in states that may consume transfer:
 * - running: Normal operation
 * - provisioning: Being created/initialized
 * - rebooting: In reboot process
 * - migrating: Being migrated between hosts
 */
async function getActiveVPSInstances(): Promise<VPSForBilling[]> {
  try {
    const result = await query(`
      SELECT
        vi.id,
        vi.organization_id,
        vi.provider_instance_id,
        vi.label,
        vi.status,
        COALESCE(
          NULLIF(vp.specifications->>'transfer', '')::numeric,
          NULLIF(vp.specifications->>'bandwidth', '')::numeric,
          NULLIF(vp.specifications->>'transfer_gb', '')::numeric,
          0
        ) AS transfer_included_gb
      FROM vps_instances vi
      LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
      WHERE vi.provider_type = 'linode'
        AND vi.status IN ('running', 'provisioning', 'rebooting', 'migrating')
        AND vi.provider_instance_id IS NOT NULL
      ORDER BY vi.organization_id, vi.id
    `);

    return result.rows.map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      provider_instance_id: row.provider_instance_id,
      label: row.label,
      status: row.status,
      transfer_included_gb: Number(row.transfer_included_gb ?? 0),
    }));
  } catch (error) {
    console.error('Error getting active VPS instances for egress billing:', error);
    return [];
  }
}

/**
 * Process a single VPS for hourly egress billing
 */
async function processVPS(vps: VPSForBilling): Promise<{
  billed: boolean;
  suspended: boolean;
  error?: string;
}> {
  try {
    const providerInstanceId = Number(vps.provider_instance_id);

    if (!Number.isFinite(providerInstanceId)) {
      return { billed: false, suspended: false, error: 'Invalid provider_instance_id' };
    }

    // Fetch current transfer from Linode
    const transfer = await linodeService.getLinodeInstanceTransfer(providerInstanceId);
    const currentTransferGb = normalizeTransferUsageGb(transfer.used);

    // Get last hourly reading to calculate delta
    const lastReading = await getLastHourlyReading(vps.id);

    let deltaGb: number;
    let creditsDeductedGb: number;

    // How many GB of this month's transfer exceed the plan's included allocation.
    // Credits are only consumed for usage beyond the included threshold.
    const includedGb = vps.transfer_included_gb;
    const billableNow = Math.max(currentTransferGb - includedGb, 0);

    if (lastReading) {
      // Calculate delta from last reading
      const rawDelta = currentTransferGb - lastReading.transferUsedGb;

      // Detect month boundary: Linode resets transfer counters at month start
      // We detect this in two ways:
      // 1. Explicit month boundary check (compare UTC months)
      // 2. Negative delta (current < previous), which indicates a reset occurred
      const lastReadingMonth = lastReading.readingAt.getUTCMonth();
      const currentMonth = new Date().getUTCMonth();
      const isMonthBoundary = lastReadingMonth !== currentMonth;

      if (isMonthBoundary || rawDelta < 0) {
        // Month boundary detected - use full current reading as delta
        console.log(
          `Month boundary or transfer reset detected for VPS ${vps.id} (${vps.label}). ` +
          `Previous: ${lastReading.transferUsedGb.toFixed(6)}GB, Current: ${currentTransferGb.toFixed(6)}GB. ` +
          `Using current reading as delta: ${currentTransferGb.toFixed(6)}GB`
        );
        deltaGb = currentTransferGb;
        // On a month boundary the Linode counter resets, so billableNow is the full
        // billable portion for the new month so far.
        creditsDeductedGb = billableNow;
      } else {
        // Normal case: delta is the difference since last reading
        deltaGb = round(rawDelta, 6);
        // Only charge credits for the portion of this delta that is beyond the
        // plan-included threshold.  If the server has not yet exhausted its
        // included allocation, billablePrev and/or billableNow will be 0.
        const billablePrev = Math.max(lastReading.transferUsedGb - includedGb, 0);
        creditsDeductedGb = round(Math.max(billableNow - billablePrev, 0), 6);
      }
    } else {
      // First reading ever for this VPS - use current transfer as initial delta.
      // Only charge credits for the portion that already exceeds included bandwidth.
      deltaGb = currentTransferGb;
      creditsDeductedGb = billableNow;
    }

    // Skip if no new usage at all
    if (deltaGb <= 0) {
      return { billed: false, suspended: false };
    }

    // Skip credit deduction if the entire delta is within the plan-included allocation
    if (creditsDeductedGb <= 0) {
      await recordHourlyReading(
        vps.id,
        vps.organization_id,
        providerInstanceId,
        currentTransferGb,
        deltaGb,
        0,
      );
      return { billed: false, suspended: false };
    }

    // Try to deduct credits
    try {
      await deductEgressCredits(vps.organization_id, creditsDeductedGb, vps.id);

      // Record successful reading
      await recordHourlyReading(
        vps.id,
        vps.organization_id,
        providerInstanceId,
        currentTransferGb,
        deltaGb,
        creditsDeductedGb,
      );

      return { billed: true, suspended: false };
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        // Suspend VPS for insufficient credits
        await suspendVPSForInsufficientCredits(vps.id, vps.organization_id);

        // Still record the reading (with 0 credits deducted since it failed)
        await recordHourlyReading(
          vps.id,
          vps.organization_id,
          providerInstanceId,
          currentTransferGb,
          deltaGb,
          0, // No credits deducted
        );

        return { billed: false, suspended: true };
      }
      throw error; // Re-throw other errors
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing VPS ${vps.id} for egress billing:`, error);
    return { billed: false, suspended: false, error: errorMessage };
  }
}

/**
 * Run hourly egress billing for all active VPS instances
 * This function is called every hour from the server scheduler
 */
export async function runHourlyEgressBilling(): Promise<EgressHourlyBillingResult> {
  const startTime = Date.now();
  console.log('🌐 Starting hourly egress billing cycle...');

  const result: EgressHourlyBillingResult = {
    success: true,
    billedCount: 0,
    suspendedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // Get all active VPS instances
    const activeVPS = await getActiveVPSInstances();

    if (activeVPS.length === 0) {
      console.log('No active VPS instances found for egress billing');
      return result;
    }

    console.log(`Processing ${activeVPS.length} VPS instances for egress billing...`);

    // Process each VPS
    for (const vps of activeVPS) {
      const vpsResult = await processVPS(vps);

      if (vpsResult.billed) {
        result.billedCount++;
      } else if (vpsResult.suspended) {
        result.suspendedCount++;
        console.warn(`⚠️ VPS ${vps.id} (${vps.label}) suspended due to insufficient egress credits`);
      } else if (vpsResult.error) {
        result.errorCount++;
        result.errors.push(`VPS ${vps.id}: ${vpsResult.error}`);
      } else {
        result.skippedCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Hourly egress billing completed in ${duration}s: ` +
      `${result.billedCount} billed, ${result.suspendedCount} suspended, ` +
      `${result.skippedCount} skipped, ${result.errorCount} errors`,
    );

    if (result.errors.length > 0) {
      console.error('Egress billing errors:', result.errors);
    }

    return result;
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Billing cycle failed: ${errorMessage}`);
    console.error('❌ Hourly egress billing cycle failed:', error);
    return result;
  }
}

/**
 * Run hourly egress billing for a specific organization
 * Useful for manual billing or admin operations
 */
export async function runHourlyEgressBillingForOrg(
  organizationId: string,
): Promise<EgressHourlyBillingResult> {
  const startTime = Date.now();
  console.log(`🌐 Starting hourly egress billing for organization ${organizationId}...`);

  const result: EgressHourlyBillingResult = {
    success: true,
    billedCount: 0,
    suspendedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // Get active VPS instances for this organization
    const activeVPS = await query(`
      SELECT
        vi.id,
        vi.organization_id,
        vi.provider_instance_id,
        vi.label,
        vi.status,
        COALESCE(
          NULLIF(vp.specifications->>'transfer', '')::numeric,
          NULLIF(vp.specifications->>'bandwidth', '')::numeric,
          NULLIF(vp.specifications->>'transfer_gb', '')::numeric,
          0
        ) AS transfer_included_gb
      FROM vps_instances vi
      LEFT JOIN vps_plans vp ON (vp.id::text = vi.plan_id OR vp.provider_plan_id = vi.plan_id)
      WHERE vi.organization_id = $1
        AND vi.provider_type = 'linode'
        AND vi.status IN ('running', 'provisioning', 'rebooting', 'migrating')
        AND vi.provider_instance_id IS NOT NULL
      ORDER BY vi.id
    `, [organizationId]);

    if (activeVPS.rows.length === 0) {
      console.log(`No active VPS instances found for organization ${organizationId}`);
      return result;
    }

    console.log(`Processing ${activeVPS.rows.length} VPS instances for organization ${organizationId}...`);

    // Process each VPS
    for (const row of activeVPS.rows) {
      const vps: VPSForBilling = {
        id: row.id,
        organization_id: row.organization_id,
        provider_instance_id: row.provider_instance_id,
        label: row.label,
        status: row.status,
        transfer_included_gb: Number(row.transfer_included_gb ?? 0),
      };

      const vpsResult = await processVPS(vps);

      if (vpsResult.billed) {
        result.billedCount++;
      } else if (vpsResult.suspended) {
        result.suspendedCount++;
        console.warn(`⚠️ VPS ${vps.id} (${vps.label}) suspended due to insufficient egress credits`);
      } else if (vpsResult.error) {
        result.errorCount++;
        result.errors.push(`VPS ${vps.id}: ${vpsResult.error}`);
      } else {
        result.skippedCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `✅ Hourly egress billing for organization ${organizationId} completed in ${duration}s: ` +
      `${result.billedCount} billed, ${result.suspendedCount} suspended, ` +
      `${result.skippedCount} skipped, ${result.errorCount} errors`,
    );

    return result;
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Billing cycle failed: ${errorMessage}`);
    console.error(`❌ Hourly egress billing for organization ${organizationId} failed:`, error);
    return result;
  }
}

// Export service class for convenience
export const EgressHourlyBillingService = {
  runHourlyBilling: runHourlyEgressBilling,
  runForOrg: runHourlyEgressBillingForOrg,
};
