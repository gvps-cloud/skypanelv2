import { config } from '../config/index.js';
import { query, transaction } from '../lib/database.js';
import { logActivity } from './activityLogger.js';

export interface CreateRefundRequest {
  organizationId: string;
  userId: string;
  originalTransactionId?: string;
  originalBillingCycleId?: string;
  originalHostingSubscriptionId?: string;
  paypalCaptureId?: string;
  amount: number;
  currency: string;
  reason: string;
  initiatedBy: string;
  initiatedByType: 'admin' | 'user_request' | 'system_prorated';
}

export class RefundService {
  static async createRefund(request: CreateRefundRequest): Promise<{ refundId: string; status: string }> {
    const result = await query(
      `INSERT INTO refunds (organization_id, user_id, original_transaction_id, original_billing_cycle_id, original_hosting_subscription_id, paypal_capture_id, amount, currency, reason, status, initiated_by, initiated_by_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11)
       RETURNING id, status`,
      [
        request.organizationId,
        request.userId,
        request.originalTransactionId || null,
        request.originalBillingCycleId || null,
        request.originalHostingSubscriptionId || null,
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
    const result = await query(
      `SELECT plan_id, last_billed_at FROM hosting_subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (result.rows.length === 0) return 0;

    const sub = result.rows[0];
    const planResult = await query(
      `SELECT price_monthly FROM hosting_plans WHERE id = $1`,
      [sub.plan_id]
    );
    if (planResult.rows.length === 0) return 0;

    const monthlyPrice = parseFloat(planResult.rows[0].price_monthly);
    const lastBilled = new Date(sub.last_billed_at || sub.created_at);
    const now = new Date();
    const daysSinceLastBill = Math.max(0, (now.getTime() - lastBilled.getTime()) / (1000 * 60 * 60 * 24));
    const daysInMonth = 30;
    const refundAmount = Math.round((monthlyPrice / daysInMonth) * (daysInMonth - daysSinceLastBill) * 100) / 100;

    return Math.max(0, refundAmount);
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
    const amount = await this.calculateProratedHostingRefund(subscriptionId);
    if (amount <= 0) return null;

    const subResult = await query(
      `SELECT organization_id, created_by FROM hosting_subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    if (subResult.rows.length === 0) return null;

    const sub = subResult.rows[0];
    const { refundId } = await this.createRefund({
      organizationId: sub.organization_id,
      userId: sub.created_by,
      originalHostingSubscriptionId: subscriptionId,
      amount,
      currency: 'USD',
      reason: 'Prorated refund for hosting cancellation',
      initiatedBy: actorUserId,
      initiatedByType: 'system_prorated',
    });

    await query(
      `UPDATE wallets SET balance = balance + $1 WHERE organization_id = $2`,
      [amount, sub.organization_id]
    );
    await query(
      `UPDATE refunds SET status = 'completed', updated_at = now() WHERE id = $1`,
      [refundId]
    );

    return refundId;
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
