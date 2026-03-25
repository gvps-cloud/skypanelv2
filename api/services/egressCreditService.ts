/**
 * Egress Credit Service for SkyPanelV2
 * Handles pre-paid egress credits for hourly billing enforcement
 */

import { query, transaction } from '../lib/database.js';
import { randomUUID } from 'crypto';
import { logActivity } from './activityLogger.js';
import { linodeService } from './linodeService.js';
import { round } from './egress/egressUtils.js';
import { InvoiceService } from './invoiceService.js';

// Custom error for insufficient credits
export class InsufficientCreditsError extends Error {
  constructor(
    public organizationId: string,
    public requestedGb: number,
    public availableGb: number,
  ) {
    super(`Insufficient egress credits: requested ${requestedGb.toFixed(6)}GB, available ${availableGb.toFixed(6)}GB`);
    this.name = 'InsufficientCreditsError';
  }
}

// Credit pack configuration interface
export interface CreditPack {
  id: string;
  gb: number;
  price: number;
  isPopular?: boolean;
  isRecommended?: boolean;
}

// Credit purchase record interface
export interface CreditPurchase {
  id: string;
  organizationId: string;
  packId: string;
  creditsGb: number;
  amountPaid: number;
  paymentTransactionId: string | null;
  createdAt: Date;
  reason?: string;
  adjustmentType: 'purchase' | 'admin_add' | 'admin_remove';
}

// Hourly reading interface
export interface HourlyReading {
  id: string;
  vpsInstanceId: string;
  organizationId: string;
  providerInstanceId: number;
  transferUsedGb: number;
  deltaGb: number;
  creditsDeductedGb: number;
  readingAt: Date;
}

// Egress configuration interface
interface EgressConfig {
  warningThresholdGb: number;
  creditPacks: CreditPack[];
}

const normalizeCreditPacks = (rawValue: unknown): CreditPack[] => {
  let parsed = rawValue;

  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const maybePack = item as Record<string, unknown>;
      const id = typeof maybePack.id === 'string' ? maybePack.id.trim() : '';
      const gb = Number(maybePack.gb);
      const price = Number(maybePack.price);

      if (!id || !Number.isFinite(gb) || gb <= 0 || !Number.isFinite(price) || price < 0) {
        return null;
      }

      return {
        id,
        gb,
        price,
        isPopular: Boolean(maybePack.isPopular),
        isRecommended: Boolean(maybePack.isRecommended),
      };
    })
    .filter((pack) => pack !== null) as CreditPack[];
};

const normalizeWarningThreshold = (rawValue: unknown): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 200;
  }
  return Math.floor(parsed);
};

/**
 * Get egress configuration from platform_settings
 * Returns default values if not configured
 */
export async function getEgressConfig(): Promise<EgressConfig> {
  try {
    const result = await query(`
      SELECT key, value
      FROM platform_settings
      WHERE key IN ('egress_warning_threshold_gb', 'egress_credit_packs')
    `);

    const config: EgressConfig = {
      warningThresholdGb: 200, // Default: 200GB
      creditPacks: [],
    };

    for (const row of result.rows) {
      if (row.key === 'egress_warning_threshold_gb') {
        config.warningThresholdGb = normalizeWarningThreshold(row.value);
      } else if (row.key === 'egress_credit_packs') {
        config.creditPacks = normalizeCreditPacks(row.value);
      }
    }

    return config;
  } catch (error) {
    console.error('Error getting egress config:', error);
    // Return defaults on error
    return {
      warningThresholdGb: 200,
      creditPacks: [],
    };
  }
}

/**
 * Get credit balance for an organization in GB
 */
export async function getEgressCreditBalance(organizationId: string): Promise<number> {
  try {
    const result = await query(
      'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1',
      [organizationId],
    );

    if (result.rows.length === 0) {
      // Auto-create with 0 balance for new organizations
      await query(
        'INSERT INTO organization_egress_credits (organization_id, credits_gb) VALUES ($1, 0)',
        [organizationId],
      );
      return 0;
    }

    return Number(result.rows[0].credits_gb || 0);
  } catch (error) {
    console.error('Error getting egress credit balance:', error);
    throw error;
  }
}

/**
 * Get credit balance details with warning status based on configurable threshold
 */
export async function getEgressCreditBalanceDetails(organizationId: string): Promise<{
  creditsGb: number;
  warning: boolean;
}> {
  const creditsGb = await getEgressCreditBalance(organizationId);
  const config = await getEgressConfig();

  // Warning threshold is configurable via platform_settings
  const warning = creditsGb > 0 && creditsGb < config.warningThresholdGb;

  return {
    creditsGb: round(creditsGb, 6),
    warning,
  };
}

/**
 * Purchase egress credits from a payment transaction
 */
export async function purchaseEgressCredits(
  organizationId: string,
  packId: string,
  paymentTransactionId: string,
  userId: string,
): Promise<void> {
  try {
    // Get credit pack configuration
    const settingsResult = await query(
      "SELECT value FROM platform_settings WHERE key = 'egress_credit_packs'",
    );

    if (settingsResult.rows.length === 0) {
      throw new Error('Egress credit packs not configured');
    }

    const packs = normalizeCreditPacks(settingsResult.rows[0].value);
    const pack = packs.find((p) => p.id === packId);

    if (!pack) {
      throw new Error(`Invalid credit pack ID: ${packId}`);
    }

    // Get payment transaction details
    const transactionResult = await query(
      'SELECT amount, currency FROM payment_transactions WHERE id = $1 AND organization_id = $2',
      [paymentTransactionId, organizationId],
    );

    if (transactionResult.rows.length === 0) {
      throw new Error('Payment transaction not found');
    }

    const transaction = transactionResult.rows[0];
    const paidAmount = Number(transaction.amount);

    // Verify amount matches pack price (allow small rounding differences)
    if (Math.abs(paidAmount - pack.price) > 0.01) {
      throw new Error(`Payment amount $${paidAmount} does not match pack price $${pack.price}`);
    }

    // Add credits in transaction
    await transaction(async (client) => {
      // Insert or update credits balance
      await client.query(
        `INSERT INTO organization_egress_credits (organization_id, credits_gb)
         VALUES ($1, $2)
         ON CONFLICT (organization_id)
         DO UPDATE SET credits_gb = organization_egress_credits.credits_gb + EXCLUDED.credits_gb,
                      updated_at = NOW()`,
        [organizationId, pack.gb],
      );

      // Record purchase
      await client.query(
        `INSERT INTO egress_credit_packs (organization_id, pack_id, credits_gb, amount_paid, payment_transaction_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [organizationId, packId, pack.gb, pack.price, paymentTransactionId],
      );
    });

    // Log activity
    await logActivity({
      userId,
      organizationId,
      eventType: 'egress.credits.purchased',
      entityType: 'egress_credits',
      message: `Purchased ${pack.gb}GB egress credit pack`,
      status: 'success',
      metadata: {
        packId,
        creditsGb: pack.gb,
        amountPaid: pack.price,
        paymentTransactionId,
      },
    });
  } catch (error) {
    console.error('Error purchasing egress credits:', error);
    throw error;
  }
}

/**
 * Deduct egress credits, throws InsufficientCreditsError if balance too low
 */
export async function deductEgressCredits(
  organizationId: string,
  gb: number,
  _vpsInstanceId?: string,
): Promise<number> {
  try {
    const gbToDeduct = round(gb, 6);

    if (gbToDeduct <= 0) {
      return 0; // No deduction needed
    }

    return await transaction(async (client) => {
      // Get current balance with FOR UPDATE to lock the row
      const balanceResult = await client.query(
        'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1 FOR UPDATE',
        [organizationId],
      );

      if (balanceResult.rows.length === 0) {
        // Auto-create with 0 balance for new organizations
        await client.query(
          'INSERT INTO organization_egress_credits (organization_id, credits_gb) VALUES ($1, 0)',
          [organizationId],
        );
        throw new InsufficientCreditsError(organizationId, gbToDeduct, 0);
      }

      const currentBalance = Number(balanceResult.rows[0].credits_gb || 0);

      if (currentBalance < gbToDeduct) {
        throw new InsufficientCreditsError(organizationId, gbToDeduct, currentBalance);
      }

      // Deduct credits
      const newBalance = round(currentBalance - gbToDeduct, 6);
      await client.query(
        'UPDATE organization_egress_credits SET credits_gb = $1, updated_at = NOW() WHERE organization_id = $2',
        [newBalance, organizationId],
      );

      return newBalance;
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw error; // Re-throw as-is
    }
    console.error('Error deducting egress credits:', error);
    throw error;
  }
}

/**
 * Admin function to manually add credits
 */
export async function addEgressCredits(
  organizationId: string,
  gb: number,
  adminUserId: string,
  reason?: string,
): Promise<number> {
  try {
    const gbToAdd = round(gb, 6);

    if (gbToAdd <= 0) {
      throw new Error('Credits to add must be greater than 0');
    }

    const newBalance = await transaction(async (client) => {
      // Update balance
      const result = await client.query(
        `INSERT INTO organization_egress_credits (organization_id, credits_gb)
         VALUES ($1, $2)
         ON CONFLICT (organization_id)
         DO UPDATE SET credits_gb = organization_egress_credits.credits_gb + EXCLUDED.credits_gb,
                      updated_at = NOW()
         RETURNING credits_gb`,
        [organizationId, gbToAdd],
      );

      // Record the adjustment in egress_credit_packs
      await client.query(
        `INSERT INTO egress_credit_packs
         (organization_id, pack_id, credits_gb, amount_paid, adjustment_type, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [organizationId, 'admin_adjustment', gbToAdd, 0, 'admin_add', reason || 'Admin credit addition'],
      );

      // Create payment transaction record for the adjustment
      await client.query(
        `INSERT INTO payment_transactions (
           organization_id, amount, currency, payment_method, payment_provider,
           status, description, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          0, // Admin adjustments are free
          'USD',
          'admin_adjustment',
          'admin',
          'completed',
          `Admin added ${gbToAdd}GB egress credits`,
          JSON.stringify({ adjustment_type: 'admin_add', credits_gb: gbToAdd, reason, admin_id: adminUserId })
        ]
      );

      // Generate invoice for the adjustment (inside same transaction for atomicity)
      const invoiceNumber = `INV-EGRESS-ADD-${randomUUID()}-${organizationId.slice(0, 8)}`;
      const invoiceMetadata = {
        sourceType: 'egress_admin_add',
        credits_gb: gbToAdd,
        reason,
        admin_id: adminUserId
      };
      const invoiceData = {
        id: `inv-${randomUUID()}`,
        invoiceNumber,
        organizationId,
        items: [{
          description: `Egress Credits Added (${gbToAdd}GB)`,
          quantity: 1,
          unitPrice: 0,
          amount: 0
        }],
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: 'USD' as const,
        createdAt: new Date(),
        status: 'paid' as const,
      };

      const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);
      await InvoiceService.createInvoice(
        organizationId,
        invoiceNumber,
        htmlContent,
        invoiceMetadata,
        invoiceData.total,
        invoiceData.currency,
        client
      );

      return Number(result.rows[0].credits_gb);
    });

    // Log activity for audit trail
    await logActivity({
      userId: adminUserId,
      organizationId,
      eventType: 'egress.credits.added',
      entityType: 'egress_credits',
      message: `Admin added ${gbToAdd}GB egress credits${reason ? `: ${reason}` : ''}`,
      status: 'success',
      metadata: {
        addedGb: gbToAdd,
        newBalance,
        reason,
      },
    });

    return newBalance;
  } catch (error) {
    console.error('Error adding egress credits:', error);
    throw error;
  }
}

/**
 * Admin function to manually remove credits
 */
export async function removeEgressCredits(
  organizationId: string,
  gb: number,
  adminUserId: string,
  reason?: string,
): Promise<number> {
  try {
    const gbToRemove = round(gb, 6);

    if (gbToRemove <= 0) {
      throw new Error('Credits to remove must be greater than 0');
    }

    const newBalance = await transaction(async (client) => {
      // Get current balance with lock
      const balanceResult = await client.query(
        'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1 FOR UPDATE',
        [organizationId],
      );

      if (balanceResult.rows.length === 0) {
        throw new Error('Organization has no egress credits record');
      }

      const currentBalance = Number(balanceResult.rows[0].credits_gb || 0);

      // Validate removal amount - use actual balance (UI now shows full precision)
      if (currentBalance < gbToRemove) {
        throw new Error(`Cannot remove ${gbToRemove}GB: organization only has ${currentBalance}GB`);
      }

      // Update balance - use GREATEST to prevent negative values due to precision
      // If balance is 0.009968 and user removes 0.01, result caps at 0 (not -0.000032)
      const result = await client.query(
        `UPDATE organization_egress_credits
         SET credits_gb = GREATEST(0, credits_gb - $1), updated_at = NOW()
         WHERE organization_id = $2
         RETURNING credits_gb`,
        [gbToRemove, organizationId],
      );

      // Record the adjustment in egress_credit_packs
      await client.query(
        `INSERT INTO egress_credit_packs
         (organization_id, pack_id, credits_gb, amount_paid, adjustment_type, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [organizationId, 'admin_adjustment', gbToRemove, 0, 'admin_remove', reason || 'Admin credit removal'],
      );

      // Create payment transaction record for the adjustment
      await client.query(
        `INSERT INTO payment_transactions (
           organization_id, amount, currency, payment_method, payment_provider,
           status, description, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          0, // Admin adjustments are free
          'USD',
          'admin_adjustment',
          'admin',
          'completed',
          `Admin removed ${gbToRemove}GB egress credits`,
          JSON.stringify({ adjustment_type: 'admin_remove', credits_gb: gbToRemove, reason, admin_id: adminUserId })
        ]
      );

      // Generate invoice for the adjustment (inside same transaction for atomicity)
      const invoiceNumber = `INV-EGRESS-REM-${randomUUID()}-${organizationId.slice(0, 8)}`;
      const invoiceMetadata = {
        sourceType: 'egress_admin_remove',
        credits_gb: gbToRemove,
        reason,
        admin_id: adminUserId
      };
      const invoiceData = {
        id: `inv-${randomUUID()}`,
        invoiceNumber,
        organizationId,
        items: [{
          description: `Egress Credits Removed (${gbToRemove}GB)`,
          quantity: 1,
          unitPrice: 0,
          amount: 0
        }],
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: 'USD' as const,
        createdAt: new Date(),
        status: 'paid' as const,
      };

      const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData);
      await InvoiceService.createInvoice(
        organizationId,
        invoiceNumber,
        htmlContent,
        invoiceMetadata,
        invoiceData.total,
        invoiceData.currency,
        client
      );

      return Number(result.rows[0].credits_gb);
    });

    // Log activity for audit trail
    await logActivity({
      userId: adminUserId,
      organizationId,
      eventType: 'egress.credits.removed',
      entityType: 'egress_credits',
      message: `Admin removed ${gbToRemove}GB egress credits${reason ? `: ${reason}` : ''}`,
      status: 'success',
      metadata: {
        removedGb: gbToRemove,
        newBalance,
        reason,
      },
    });

    return newBalance;
  } catch (error) {
    console.error('Error removing egress credits:', error);
    throw error;
  }
}

/**
 * Get purchase history for an organization with pagination
 */
export async function getEgressCreditPurchaseHistory(
  organizationId: string,
  page = 1,
  limit = 10,
): Promise<{ purchases: CreditPurchase[]; total: number; page: number; limit: number; totalPages: number }> {
  try {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM egress_credit_packs WHERE organization_id = $1',
      [organizationId],
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Get paginated results
    const result = await query(
      `SELECT id, organization_id, pack_id, credits_gb, amount_paid, payment_transaction_id, 
              adjustment_type, reason, created_at
       FROM egress_credit_packs
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset],
    );

    const purchases = result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      packId: row.pack_id,
      creditsGb: Number(row.credits_gb),
      amountPaid: Number(row.amount_paid),
      paymentTransactionId: row.payment_transaction_id,
      adjustmentType: row.adjustment_type,
      reason: row.reason,
      createdAt: row.created_at,
    }));

    return {
      purchases,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    console.error('Error getting egress credit purchase history:', error);
    throw error;
  }
}

/**
 * Get available credit packs
 */
export async function getAvailableCreditPacks(): Promise<CreditPack[]> {
  try {
    const result = await query(
      "SELECT value FROM platform_settings WHERE key = 'egress_credit_packs'",
    );

    if (result.rows.length === 0) {
      return [];
    }

    return normalizeCreditPacks(result.rows[0].value);
  } catch (error) {
    console.error('Error getting available credit packs:', error);
    throw error;
  }
}

/**
 * Suspend VPS when credits are insufficient
 */
export async function suspendVPSForInsufficientCredits(
  vpsInstanceId: string,
  organizationId: string,
): Promise<void> {
  try {
    // Get VPS details
    const vpsResult = await query(
      'SELECT provider_instance_id, label FROM vps_instances WHERE id = $1',
      [vpsInstanceId],
    );

    if (vpsResult.rows.length === 0) {
      throw new Error(`VPS instance not found: ${vpsInstanceId}`);
    }

    const { provider_instance_id, label } = vpsResult.rows[0];
    const providerInstanceId = Number(provider_instance_id);

    if (!Number.isFinite(providerInstanceId)) {
      throw new Error(`Invalid provider_instance_id for VPS ${vpsInstanceId}`);
    }

    // Shutdown the Linode instance
    await linodeService.shutdownLinodeInstance(providerInstanceId);

    // Update VPS status to suspended
    await query(
      "UPDATE vps_instances SET status = 'suspended', updated_at = NOW() WHERE id = $1",
      [vpsInstanceId],
    );

    // Log activity
    await logActivity({
      userId: null, // System action
      organizationId,
      eventType: 'vps.suspended',
      entityType: 'vps',
      entityId: vpsInstanceId,
      message: `VPS "${label}" suspended due to insufficient egress credits`,
      status: 'warning',
      metadata: {
        reason: 'insufficient_egress_credits',
      },
    });
  } catch (error) {
    console.error('Error suspending VPS for insufficient credits:', error);
    throw error;
  }
}

/**
 * Get last hourly reading for a VPS
 */
export async function getLastHourlyReading(vpsInstanceId: string): Promise<HourlyReading | null> {
  try {
    const result = await query(
      `SELECT id, vps_instance_id, organization_id, provider_instance_id, transfer_used_gb, delta_gb, credits_deducted_gb, reading_at
       FROM vps_egress_hourly_readings
       WHERE vps_instance_id = $1
       ORDER BY reading_at DESC
       LIMIT 1`,
      [vpsInstanceId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      vpsInstanceId: row.vps_instance_id,
      organizationId: row.organization_id,
      providerInstanceId: Number(row.provider_instance_id),
      transferUsedGb: Number(row.transfer_used_gb),
      deltaGb: Number(row.delta_gb),
      creditsDeductedGb: Number(row.credits_deducted_gb),
      readingAt: row.reading_at,
    };
  } catch (error) {
    console.error('Error getting last hourly reading:', error);
    throw error;
  }
}

/**
 * Record hourly reading for a VPS
 */
export async function recordHourlyReading(
  vpsInstanceId: string,
  organizationId: string,
  providerInstanceId: number,
  transferUsedGb: number,
  deltaGb: number,
  creditsDeductedGb: number,
): Promise<void> {
  try {
    await query(
      `INSERT INTO vps_egress_hourly_readings
       (vps_instance_id, organization_id, provider_instance_id, transfer_used_gb, delta_gb, credits_deducted_gb)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        vpsInstanceId,
        organizationId,
        providerInstanceId,
        round(transferUsedGb, 6),
        round(deltaGb, 6),
        round(creditsDeductedGb, 6),
      ],
    );
  } catch (error) {
    console.error('Error recording hourly reading:', error);
    throw error;
  }
}

/**
 * Get hourly usage for a specific VPS
 */
export async function getVPSHourlyUsage(
  vpsInstanceId: string,
  organizationId: string,
  limit = 100,
): Promise<HourlyReading[]> {
  try {
    const result = await query(
      `SELECT id, vps_instance_id, organization_id, provider_instance_id, transfer_used_gb, delta_gb, credits_deducted_gb, reading_at
       FROM vps_egress_hourly_readings
       WHERE vps_instance_id = $1 AND organization_id = $2
       ORDER BY reading_at DESC
       LIMIT $3`,
      [vpsInstanceId, organizationId, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      vpsInstanceId: row.vps_instance_id,
      organizationId: row.organization_id,
      providerInstanceId: Number(row.provider_instance_id),
      transferUsedGb: Number(row.transfer_used_gb),
      deltaGb: Number(row.delta_gb),
      creditsDeductedGb: Number(row.credits_deducted_gb),
      readingAt: row.reading_at,
    }));
  } catch (error) {
    console.error('Error getting VPS hourly usage:', error);
    throw error;
  }
}

/**
 * Get total credits used by a VPS in current month
 */
export async function getVPSMonthlyCreditsUsed(
  vpsInstanceId: string,
  organizationId: string,
): Promise<number> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const result = await query(
      `SELECT COALESCE(SUM(credits_deducted_gb), 0) as total_used
       FROM vps_egress_hourly_readings
       WHERE vps_instance_id = $1 AND organization_id = $2 AND created_at >= $3`,
      [vpsInstanceId, organizationId, startOfMonth],
    );

    return Number(result.rows[0].total_used || 0);
  } catch (error) {
    console.error('Error getting VPS monthly credits used:', error);
    throw error;
  }
}

// Export service class for convenience
export const EgressCreditService = {
  getBalance: getEgressCreditBalance,
  getBalanceDetails: getEgressCreditBalanceDetails,
  purchaseCredits: purchaseEgressCredits,
  deductCredits: deductEgressCredits,
  addCredits: addEgressCredits,
  getPurchaseHistory: getEgressCreditPurchaseHistory,
  getAvailablePacks: getAvailableCreditPacks,
  suspendVPS: suspendVPSForInsufficientCredits,
  getLastReading: getLastHourlyReading,
  recordReading: recordHourlyReading,
  getVPSHourlyUsage,
  getVPSMonthlyCreditsUsed,
};
