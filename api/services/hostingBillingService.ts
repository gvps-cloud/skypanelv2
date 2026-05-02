import { query, transaction } from '../lib/database.js';
import { getEnhanceWebsiteOrgId } from '../lib/hostingEnhanceOrg.js';
import { EnhanceService } from './enhanceService.js';
import { EnhanceToggleService } from './enhanceToggle.js';
import { logActivity } from './activityLogger.js';

export class HostingBillingService {
  static async runMonthlyHostingBilling(runType: string = 'scheduled'): Promise<void> {
    const enabled = await EnhanceToggleService.isEffectivelyEnabled();
    if (!enabled) {
      console.log('⏭️ Hosting billing skipped: Enhance is not effectively enabled');
      return;
    }

    console.log('🔄 Starting monthly hosting billing process', { runType });

    try {
      const result = await query(
        `SELECT hs.id, hs.organization_id, hs.plan_id, hs.enhance_subscription_id, hs.enhance_website_id,
                hs.domain, hs.next_billing_at, hs.last_billed_at, hs.created_by,
                org.enhance_customer_id AS enhance_customer_org_id
         FROM hosting_subscriptions hs
         JOIN organizations org ON org.id = hs.organization_id
         WHERE status = 'active' AND next_billing_at <= now()`
      );

      const subscriptions = result.rows;
      console.log(`📊 Found ${subscriptions.length} active hosting subscriptions due for billing`);

      for (const sub of subscriptions) {
        try {
          await this.billSubscription(sub);
        } catch (error: any) {
          console.error(`Failed to bill hosting subscription ${sub.id}:`, error);
          await this.handleBillingFailure(sub, error.message);
        }
      }

      console.log('✅ Monthly hosting billing process completed');
    } catch (error) {
      console.error('❌ Monthly hosting billing process failed:', error);
    }
  }

  private static async billSubscription(sub: any): Promise<void> {
    await transaction(async (client) => {
      // Lock wallet
      const walletResult = await client.query(
        `SELECT id, balance FROM wallets WHERE organization_id = $1 FOR UPDATE`,
        [sub.organization_id]
      );
      if (walletResult.rows.length === 0) {
        throw new Error('Wallet not found');
      }
      const wallet = walletResult.rows[0];

      // Get plan price
      const planResult = await client.query(
        `SELECT price_monthly, name FROM hosting_plans WHERE id = $1`,
        [sub.plan_id]
      );
      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }
      const plan = planResult.rows[0];
      const amount = parseFloat(plan.price_monthly);

      if (wallet.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Deduct wallet
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [amount, wallet.id]
      );

      // Record debit transaction
      await client.query(
        `INSERT INTO payment_transactions (organization_id, amount, currency, payment_method, payment_provider, status, description, metadata)
         VALUES ($1, $2, 'USD', 'wallet_debit', 'internal', 'completed', $3, $4)`,
        [
          sub.organization_id,
          -amount,
          `Hosting billing: ${plan.name}`,
          JSON.stringify({ hosting_subscription_id: sub.id, domain: sub.domain }),
        ]
      );

      // Update subscription billing dates
      await client.query(
        `UPDATE hosting_subscriptions
         SET last_billed_at = now(),
             next_billing_at = now() + interval '1 month',
             updated_at = now()
         WHERE id = $1`,
        [sub.id]
      );
    });

    await logActivity({
      userId: sub.created_by,
      organizationId: sub.organization_id,
      eventType: 'hosting.billing.completed',
      entityType: 'hosting_subscription',
      entityId: sub.id,
      message: `Monthly hosting billing completed for ${sub.domain}`,
      status: 'success',
    });
  }

  private static async handleBillingFailure(sub: any, reason: string): Promise<void> {
    try {
      // Suspend remote website
      if (sub.enhance_website_id) {
        await EnhanceService.updateWebsite(getEnhanceWebsiteOrgId(sub), sub.enhance_website_id, {
          status: 'disabled',
          isSuspended: true,
        });
      }

      // Mark local subscription as suspended
      await query(
        `UPDATE hosting_subscriptions SET status = 'suspended', updated_at = now() WHERE id = $1`,
        [sub.id]
      );

      await logActivity({
        userId: sub.created_by,
        organizationId: sub.organization_id,
        eventType: 'hosting.billing.suspended',
        entityType: 'hosting_subscription',
        entityId: sub.id,
        message: `Hosting subscription suspended due to insufficient balance: ${reason}`,
        status: 'warning',
      });
    } catch (error) {
      console.error(`Failed to suspend hosting subscription ${sub.id}:`, error);
    }
  }
}
