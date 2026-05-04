import { config } from '../config/index.js';
import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';
import type { PoolClient } from 'pg';

export interface CreateRefundRequest {
  organizationId: string;
  userId: string;
  originalTransactionId?: string;
  originalBillingCycleId?: string;
  originalHostingSubscriptionId?: string;
  originalHostingBillingCycleId?: string;
  paypalCaptureId?: string;
  amount: number;
  currency: string;
  reason: string;
  initiatedBy: string;
  initiatedByType: 'admin' | 'user_request' | 'system_prorated';
}

export class RefundService {
  private static hostingRefundSchemaEnsured = false;

  private static async ensureHostingRefundSchema(client?: PoolClient): Promise<void> {
    if (this.hostingRefundSchemaEnsured) {
      return;
    }

    const queryFn = client
      ? (text: string, params?: unknown[]) => client.query(text, params)
      : (text: string, params?: unknown[]) => query(text, params);

    await queryFn(`
      CREATE TABLE IF NOT EXISTS billing_invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        invoice_number text NOT NULL,
        html_content text NOT NULL,
        data jsonb NOT NULL DEFAULT '{}',
        total_amount numeric(12,4) NOT NULL DEFAULT 0.0000,
        currency text NOT NULL DEFAULT 'USD',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryFn(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hosting_billing_cycle_status') THEN
          CREATE TYPE hosting_billing_cycle_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');
        END IF;
      END $$
    `);
    await queryFn(`
      CREATE TABLE IF NOT EXISTS hosting_billing_cycles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        hosting_subscription_id uuid NOT NULL REFERENCES hosting_subscriptions(id) ON DELETE CASCADE,
        plan_id uuid REFERENCES hosting_plans(id) ON DELETE SET NULL,
        plan_name text NOT NULL,
        domain text NOT NULL,
        cycle_type varchar(20) NOT NULL DEFAULT 'renewal',
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        amount numeric(12,6) NOT NULL,
        currency varchar(10) NOT NULL DEFAULT 'USD',
        status hosting_billing_cycle_status NOT NULL DEFAULT 'pending',
        failure_reason text,
        payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
        invoice_id uuid REFERENCES billing_invoices(id) ON DELETE SET NULL,
        refunded_amount numeric(12,6) NOT NULL DEFAULT 0,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryFn(`
      ALTER TABLE refunds
        ADD COLUMN IF NOT EXISTS original_hosting_billing_cycle_id uuid REFERENCES hosting_billing_cycles(id) ON DELETE SET NULL
    `);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_refunds_original_hosting_cycle ON refunds(original_hosting_billing_cycle_id)`);

    this.hostingRefundSchemaEnsured = true;
  }

  static async createRefund(request: CreateRefundRequest): Promise<{ refundId: string; status: string }> {
    await this.ensureHostingRefundSchema();

    const result = await query(
      `INSERT INTO refunds (
         organization_id, user_id, original_transaction_id, original_billing_cycle_id,
         original_hosting_subscription_id, original_hosting_billing_cycle_id,
         paypal_capture_id, amount, currency, reason, status, initiated_by, initiated_by_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
       RETURNING id, status`,
      [
        request.organizationId,
        request.userId,
        request.originalTransactionId || null,
        request.originalBillingCycleId || null,
        request.originalHostingSubscriptionId || null,
        request.originalHostingBillingCycleId || null,
        request.paypalCaptureId || null,
        request.amount,
        request.currency,
        request.reason,
        request.initiatedBy,
        request.initiatedByType,
      ]
    );

    return { refundId: result.rows[0].id, status: result.rows[0].status };
  }

  static async processPayPalRefund(refundId: string): Promise<{ success: boolean; message: string }> {
    const refundResult = await query(`SELECT * FROM refunds WHERE id = $1`, [refundId]);
    if (refundResult.rows.length === 0) {
      return { success: false, message: 'Refund not found' };
    }
    const refund = refundResult.rows[0];

    if (!refund.paypal_capture_id) {
      return { success: false, message: 'No PayPal capture ID available for refund' };
    }

    try {
      // Use raw PayPal API for refunds since the SDK may not expose it directly
      const basicAuth = Buffer.from(
        `${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`
      ).toString('base64');

      const isProduction = config.PAYPAL_MODE === 'production' || config.PAYPAL_MODE === 'live';
      const baseUrl = isProduction
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

      const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to obtain PayPal access token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const refundResponse = await fetch(
        `${baseUrl}/v2/payments/captures/${refund.paypal_capture_id}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `refund-${refundId}`,
          },
          body: JSON.stringify({
            amount: {
              value: refund.amount.toFixed(2),
              currency_code: refund.currency,
            },
            note_to_payer: refund.reason,
          }),
        }
      );

      const refundData = await refundResponse.json();

      if (refundResponse.ok) {
        await query(
          `UPDATE refunds SET status = 'completed', provider_refund_id = $1, provider_response = $2, updated_at = now() WHERE id = $3`,
          [refundData.id, JSON.stringify(refundData), refundId]
        );

        // Credit wallet for the refund amount
        await query(
          `UPDATE wallets SET balance = balance + $1 WHERE organization_id = $2`,
          [refund.amount, refund.organization_id]
        );

        await logActivity({
          userId: refund.initiated_by,
          organizationId: refund.organization_id,
          eventType: 'billing.refund.completed',
          entityType: 'refund',
          entityId: refundId,
          message: `PayPal refund of ${refund.amount} ${refund.currency} processed`,
          status: 'success',
          metadata: { paypal_refund_id: refundData.id, amount: refund.amount },
        });

        return { success: true, message: 'Refund processed successfully' };
      } else {
        await query(
          `UPDATE refunds SET status = 'failed', provider_response = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(refundData), refundId]
        );
        return { success: false, message: refundData.message || 'PayPal refund failed' };
      }
    } catch (error: any) {
      await query(
        `UPDATE refunds SET status = 'failed', provider_response = $1, updated_at = now() WHERE id = $2`,
        [JSON.stringify({ error: error.message }), refundId]
      );
      return { success: false, message: error.message || 'Refund processing failed' };
    }
  }

  static async calculateProratedVpsRefund(billingCycleId: string): Promise<number> {
    const result = await query(
      `SELECT hourly_rate, last_billed_at, vps_instance_id
       FROM vps_billing_cycles WHERE id = $1`,
      [billingCycleId]
    );
    if (result.rows.length === 0) return 0;

    const cycle = result.rows[0];
    const hourlyRate = parseFloat(cycle.hourly_rate);
    const lastBilled = new Date(cycle.last_billed_at);
    const now = new Date();
    const hoursSinceLastBill = Math.max(0, (now.getTime() - lastBilled.getTime()) / (1000 * 60 * 60));
    const refundAmount = Math.round(hoursSinceLastBill * hourlyRate * 100) / 100;

    return refundAmount;
  }

  static async calculateProratedHostingRefund(subscriptionId: string): Promise<number> {
    const details = await this.calculateProratedHostingRefundDetails(subscriptionId);
    return details.amount;
  }

  private static async calculateProratedHostingRefundDetails(subscriptionId: string): Promise<{
    amount: number;
    hostingBillingCycleId?: string;
    originalTransactionId?: string;
  }> {
    await this.ensureHostingRefundSchema();

    const cycleResult = await query(
      `SELECT id, amount, refunded_amount, period_start, period_end, payment_transaction_id
       FROM hosting_billing_cycles
       WHERE hosting_subscription_id = $1
         AND status = 'paid'
         AND period_start <= now()
         AND period_end > now()
       ORDER BY period_start DESC
       LIMIT 1`,
      [subscriptionId]
    );

    if (cycleResult.rows.length > 0) {
      const cycle = cycleResult.rows[0];
      const periodStart = new Date(cycle.period_start);
      const periodEnd = new Date(cycle.period_end);
      const now = new Date();
      const totalMs = periodEnd.getTime() - periodStart.getTime();
      const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
      const chargedAmount = parseFloat(cycle.amount);
      const refundedAmount = parseFloat(cycle.refunded_amount ?? 0);
      const refundableAmount = Math.max(0, chargedAmount - refundedAmount);

      if (totalMs > 0 && refundableAmount > 0) {
        return {
          amount: Math.round(refundableAmount * (remainingMs / totalMs) * 100) / 100,
          hostingBillingCycleId: cycle.id,
          originalTransactionId: cycle.payment_transaction_id || undefined,
        };
      }

      return {
        amount: 0,
        hostingBillingCycleId: cycle.id,
        originalTransactionId: cycle.payment_transaction_id || undefined,
      };
    }

    const result = await query(
      `SELECT plan_id, last_billed_at, created_at FROM hosting_subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (result.rows.length === 0) return { amount: 0 };

    const sub = result.rows[0];
    if (!sub.plan_id) return { amount: 0 };

    const planResult = await query(
      `SELECT price_monthly FROM hosting_plans WHERE id = $1`,
      [sub.plan_id]
    );
    if (planResult.rows.length === 0) return { amount: 0 };

    const monthlyPrice = parseFloat(planResult.rows[0].price_monthly);
    if (isNaN(monthlyPrice) || monthlyPrice <= 0) return { amount: 0 };

    const lastBilled = new Date(sub.last_billed_at || sub.created_at);
    if (isNaN(lastBilled.getTime())) return { amount: 0 };

    const now = new Date();
    const daysSinceLastBill = Math.max(0, (now.getTime() - lastBilled.getTime()) / (1000 * 60 * 60 * 24));
    const daysInMonth = 30;
    const refundAmount = Math.round((monthlyPrice / daysInMonth) * (daysInMonth - daysSinceLastBill) * 100) / 100;

    return { amount: Math.max(0, refundAmount) };
  }

  static async createProratedVpsRefund(billingCycleId: string, actorUserId: string): Promise<string | null> {
    const amount = await this.calculateProratedVpsRefund(billingCycleId);
    if (amount <= 0) return null;

    const cycleResult = await query(
      `SELECT organization_id, user_id FROM vps_billing_cycles WHERE id = $1`,
      [billingCycleId]
    );
    if (cycleResult.rows.length === 0) return null;

    const cycle = cycleResult.rows[0];
    const { refundId } = await this.createRefund({
      organizationId: cycle.organization_id,
      userId: cycle.user_id,
      originalBillingCycleId: billingCycleId,
      amount,
      currency: 'USD',
      reason: 'Prorated refund for VPS deletion',
      initiatedBy: actorUserId,
      initiatedByType: 'system_prorated',
    });

    // For system prorated refunds, auto-process as wallet credit (no PayPal refund)
    await query(
      `UPDATE wallets SET balance = balance + $1 WHERE organization_id = $2`,
      [amount, cycle.organization_id]
    );
    await query(
      `UPDATE refunds SET status = 'completed', updated_at = now() WHERE id = $1`,
      [refundId]
    );

    return refundId;
  }

  static async createProratedHostingRefund(subscriptionId: string, actorUserId: string): Promise<string | null> {
    const refundDetails = await this.calculateProratedHostingRefundDetails(subscriptionId);
    if (refundDetails.amount <= 0) return null;

    const subResult = await query(
      `SELECT organization_id, created_by FROM hosting_subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (subResult.rows.length === 0) return null;

    const sub = subResult.rows[0];
    const { refundId } = await this.createRefund({
      organizationId: sub.organization_id,
      userId: sub.created_by,
      originalTransactionId: refundDetails.originalTransactionId,
      originalHostingSubscriptionId: subscriptionId,
      originalHostingBillingCycleId: refundDetails.hostingBillingCycleId,
      amount: refundDetails.amount,
      currency: 'USD',
      reason: 'Prorated refund for hosting cancellation',
      initiatedBy: actorUserId,
      initiatedByType: 'system_prorated',
    });

    await transaction(async (client) => {
      await this.creditHostingWalletForRefund(client, {
        organizationId: sub.organization_id,
        subscriptionId,
        refundId,
        amount: refundDetails.amount,
        reason: 'Prorated refund for hosting cancellation',
        hostingBillingCycleId: refundDetails.hostingBillingCycleId,
      });

      if (refundDetails.hostingBillingCycleId) {
        await client.query(
          `UPDATE hosting_billing_cycles
           SET refunded_amount = refunded_amount + $1,
               status = CASE
                 WHEN refunded_amount + $1 >= amount THEN 'refunded'::hosting_billing_cycle_status
                 ELSE status
               END,
               updated_at = now()
           WHERE id = $2`,
          [refundDetails.amount, refundDetails.hostingBillingCycleId]
        );
      }

      await client.query(
        `UPDATE refunds SET status = 'completed', updated_at = now() WHERE id = $1`,
        [refundId]
      );
    });

    return refundId;
  }

  static async processHostingWalletRefund(refundId: string): Promise<{ success: boolean; message: string }> {
    await this.ensureHostingRefundSchema();

    const refundResult = await query(`SELECT * FROM refunds WHERE id = $1`, [refundId]);
    if (refundResult.rows.length === 0) {
      return { success: false, message: 'Refund not found' };
    }

    const refund = refundResult.rows[0];
    if (!refund.original_hosting_subscription_id) {
      return { success: false, message: 'Refund is not linked to a hosting subscription' };
    }
    if (refund.status !== 'pending') {
      return { success: false, message: `Refund is ${refund.status}, not pending` };
    }

    await transaction(async (client) => {
      await this.creditHostingWalletForRefund(client, {
        organizationId: refund.organization_id,
        subscriptionId: refund.original_hosting_subscription_id,
        refundId,
        amount: parseFloat(refund.amount),
        reason: refund.reason,
        hostingBillingCycleId: refund.original_hosting_billing_cycle_id || undefined,
      });

      if (refund.original_hosting_billing_cycle_id) {
        await client.query(
          `UPDATE hosting_billing_cycles
           SET refunded_amount = refunded_amount + $1,
               status = CASE
                 WHEN refunded_amount + $1 >= amount THEN 'refunded'::hosting_billing_cycle_status
                 ELSE status
               END,
               updated_at = now()
           WHERE id = $2`,
          [refund.amount, refund.original_hosting_billing_cycle_id]
        );
      }

      await client.query(
        `UPDATE refunds SET status = 'completed', updated_at = now() WHERE id = $1`,
        [refundId]
      );
    });

    await logActivity({
      userId: refund.initiated_by,
      organizationId: refund.organization_id,
      eventType: 'billing.refund.completed',
      entityType: 'refund',
      entityId: refundId,
      message: `Hosting wallet refund of ${refund.amount} ${refund.currency} processed`,
      status: 'success',
      metadata: {
        amount: refund.amount,
        hosting_subscription_id: refund.original_hosting_subscription_id,
      },
    });

    return { success: true, message: 'Hosting wallet refund credited successfully' };
  }

  private static async creditHostingWalletForRefund(
    client: { query: PoolClient['query'] },
    input: {
      organizationId: string;
      subscriptionId: string;
      refundId: string;
      amount: number;
      reason: string;
      hostingBillingCycleId?: string;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO hosting_wallets (organization_id, balance, currency)
       VALUES ($1, 0, 'USD')
       ON CONFLICT (organization_id) DO NOTHING`,
      [input.organizationId]
    );

    const walletResult = await client.query(
      `SELECT id, balance FROM hosting_wallets WHERE organization_id = $1 FOR UPDATE`,
      [input.organizationId]
    );
    if (walletResult.rows.length === 0) {
      throw new Error('Hosting wallet not found');
    }

    const wallet = walletResult.rows[0];
    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = Number((balanceBefore + input.amount).toFixed(6));

    await client.query(
      `UPDATE hosting_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    await client.query(
      `INSERT INTO payment_transactions (
         organization_id, amount, currency, payment_method, payment_provider,
         status, description, metadata
       )
       VALUES ($1, $2, 'USD', 'hosting_wallet_credit', 'internal', 'completed', $3, $4)`,
      [
        input.organizationId,
        input.amount,
        input.reason,
        JSON.stringify({
          wallet_type: 'hosting',
          refund_id: input.refundId,
          hosting_subscription_id: input.subscriptionId,
          hosting_billing_cycle_id: input.hostingBillingCycleId || null,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        }),
      ]
    );
  }

  static async listRefunds(filters: {
    organizationId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let sql = `SELECT r.*, u.email as user_email, org.name as organization_name, ib.email as initiated_by_email
               FROM refunds r
               JOIN users u ON u.id = r.user_id
               JOIN organizations org ON org.id = r.organization_id
               LEFT JOIN users ib ON ib.id = r.initiated_by
               WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.organizationId) {
      sql += ` AND r.organization_id = $${paramIndex++}`;
      params.push(filters.organizationId);
    }
    if (filters.status) {
      sql += ` AND r.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY r.created_at DESC`;

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  }
}
