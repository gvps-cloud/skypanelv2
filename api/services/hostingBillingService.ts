import type { PoolClient } from 'pg';
import { query, transaction } from '../lib/database.js';
import { getEnhanceWebsiteOrgId } from '../lib/hostingEnhanceOrg.js';
import { EnhanceService } from './enhanceService.js';
import { EnhanceToggleService } from './enhanceToggle.js';
import { InvoiceService } from './invoiceService.js';
import { logActivity } from './activityLogger.js';
import { themeService, resolveThemePalette } from './themeService.js';
import {
  sendHostingSuspendedEmail,
  sendHostingRecoveryEmail,
  sendHostingRenewalEmail,
  sendHostingSuspensionWarningEmail,
  resolveUserEmailAndName,
} from './emailService.js';

class HostingBillingPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostingBillingPaymentError';
  }
}

class HostingBillingDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostingBillingDataError';
  }
}

type HostingBillingCycleType = 'initial' | 'renewal' | 'manual';

type HostingSubscriptionForBilling = {
  id: string;
  organization_id: string;
  plan_id: string | null;
  enhance_subscription_id?: string | null;
  enhance_website_id?: string | null;
  domain: string;
  next_billing_at?: string | Date | null;
  last_billed_at?: string | Date | null;
  created_at?: string | Date | null;
  created_by: string;
  status?: string;
  enhance_customer_org_id?: string | null;
};

type InitialPurchaseChargeInput = {
  organizationId: string;
  userId: string;
  planId: string;
  domain: string;
  settings?: Record<string, unknown>;
};

const toCurrencyNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : 0;
};

const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate();
  next.setUTCDate(Math.min(day, daysInTargetMonth));
  return next;
};

const parseDateOrNow = (value: string | Date | null | undefined): Date => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export class HostingBillingService {
  private static hostingBillingTablesEnsured = false;

  private static async ensureHostingBillingTables(client?: PoolClient): Promise<void> {
    if (this.hostingBillingTablesEnsured) {
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
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(organization_id)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON billing_invoices(created_at)`);
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
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_org ON hosting_billing_cycles(organization_id)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_subscription ON hosting_billing_cycles(hosting_subscription_id)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_status ON hosting_billing_cycles(status)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_period ON hosting_billing_cycles(period_start, period_end)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_transaction ON hosting_billing_cycles(payment_transaction_id)`);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_invoice ON hosting_billing_cycles(invoice_id)`);
    await queryFn(`
      ALTER TABLE refunds
        ADD COLUMN IF NOT EXISTS original_hosting_billing_cycle_id uuid REFERENCES hosting_billing_cycles(id) ON DELETE SET NULL
    `);
    await queryFn(`CREATE INDEX IF NOT EXISTS idx_refunds_original_hosting_cycle ON refunds(original_hosting_billing_cycle_id)`);

    this.hostingBillingTablesEnsured = true;
  }

  static async runMonthlyHostingBilling(runType: string = 'scheduled'): Promise<void> {
    const enabled = await EnhanceToggleService.isEffectivelyEnabled();
    if (!enabled) {
      console.log('⏭️ Hosting billing skipped: Enhance is not effectively enabled');
      return;
    }

    console.log('🔄 Starting monthly hosting billing process', { runType });

    try {
      await this.ensureHostingBillingTables();
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
          await this.billSubscription(sub, { cycleType: 'renewal' });
        } catch (error: any) {
          console.error(`Failed to bill hosting subscription ${sub.id}:`, error);
          if (error instanceof HostingBillingPaymentError) {
            await this.handleBillingFailure(sub, error.message);
          } else if (error instanceof HostingBillingDataError) {
            await logActivity({
              userId: sub.created_by,
              organizationId: sub.organization_id,
              eventType: 'hosting.billing.skipped',
              entityType: 'hosting_subscription',
              entityId: sub.id,
              message: `Hosting billing skipped: ${error.message}`,
              status: 'warning',
            });
          }
        }
      }

      console.log('✅ Monthly hosting billing process completed');
    } catch (error) {
      console.error('❌ Monthly hosting billing process failed:', error);
    }
  }

  static async createInitialPurchaseCharge(
    client: PoolClient,
    input: InitialPurchaseChargeInput
  ): Promise<{
    subscription: any;
    plan: any;
    debitTransactionId: string;
    billingCycleId: string;
  }> {
    await this.ensureHostingBillingTables(client);

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

    const planResult = await client.query(
      `SELECT id, price_monthly, name, service_type, enhance_plan_id, features
       FROM hosting_plans
       WHERE id = $1 AND is_active = true`,
      [input.planId]
    );
    if (planResult.rows.length === 0) {
      throw new Error('Hosting plan not found');
    }

    const plan = planResult.rows[0];
    const amount = toCurrencyNumber(plan.price_monthly);
    const balanceBefore = toCurrencyNumber(wallet.balance);
    if (balanceBefore < amount) {
      throw new HostingBillingPaymentError('Insufficient hosting wallet balance');
    }

    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, 1);

    const subResult = await client.query(
      `INSERT INTO hosting_subscriptions (
         organization_id, created_by, plan_id, domain, status,
         last_billed_at, next_billing_at, settings
       )
       VALUES ($1, $2, $3, $4, 'provisioning', $5, $6, $7)
       RETURNING *`,
      [
        input.organizationId,
        input.userId,
        input.planId,
        input.domain,
        periodStart,
        periodEnd,
        JSON.stringify(input.settings ?? {}),
      ]
    );
    const subscription = subResult.rows[0];

    const cycleResult = await client.query(
      `INSERT INTO hosting_billing_cycles (
         organization_id, hosting_subscription_id, plan_id, plan_name, domain,
         cycle_type, period_start, period_end, amount, currency, status
       )
       VALUES ($1, $2, $3, $4, $5, 'initial', $6, $7, $8, 'USD', 'pending')
       RETURNING id`,
      [
        input.organizationId,
        subscription.id,
        input.planId,
        plan.name,
        input.domain,
        periodStart,
        periodEnd,
        amount,
      ]
    );
    const billingCycleId = cycleResult.rows[0].id;

    const balanceAfter = Number((balanceBefore - amount).toFixed(6));
    await client.query(
      `UPDATE hosting_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    const debitResult = await client.query(
      `INSERT INTO payment_transactions (
         organization_id, amount, currency, payment_method, payment_provider,
         status, description, metadata
       )
       VALUES ($1, $2, 'USD', 'wallet_debit', 'internal', 'completed', $3, $4)
       RETURNING id`,
      [
        input.organizationId,
        -amount,
        `Hosting purchase: ${plan.name}`,
        JSON.stringify({
          plan_id: input.planId,
          domain: input.domain,
          wallet_type: 'hosting',
          hosting_subscription_id: subscription.id,
          hosting_billing_cycle_id: billingCycleId,
          billing_period_start: periodStart.toISOString(),
          billing_period_end: periodEnd.toISOString(),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        }),
      ]
    );
    const debitTransactionId = debitResult.rows[0].id;

    await client.query(
      `UPDATE hosting_billing_cycles
       SET status = 'paid',
           payment_transaction_id = $1,
           updated_at = now()
       WHERE id = $2`,
      [debitTransactionId, billingCycleId]
    );

    await client.query(
      `UPDATE hosting_subscriptions
       SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1`,
      [
        subscription.id,
        JSON.stringify({
          debit_transaction_id: debitTransactionId,
          initial_billing_cycle_id: billingCycleId,
        }),
      ]
    );

    return { subscription, plan, debitTransactionId, billingCycleId };
  }

  static async ensureInvoiceForCycle(
    billingCycleId: string,
    actorUserId?: string | null
  ): Promise<string | null> {
    await this.ensureHostingBillingTables();

    const result = await query(
      `SELECT
         hbc.*,
         hs.created_by,
         u.name as user_name,
         u.email as user_email,
         org.name as organization_name,
         pt.metadata as transaction_metadata
       FROM hosting_billing_cycles hbc
       JOIN hosting_subscriptions hs ON hs.id = hbc.hosting_subscription_id
       JOIN organizations org ON org.id = hbc.organization_id
       LEFT JOIN users u ON u.id = COALESCE($2::uuid, hs.created_by)
       LEFT JOIN payment_transactions pt ON pt.id = hbc.payment_transaction_id
       WHERE hbc.id = $1`,
      [billingCycleId, actorUserId ?? null]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const cycle = result.rows[0];
    if (cycle.status !== 'paid') {
      return null;
    }
    if (cycle.invoice_id) {
      return cycle.invoice_id;
    }

    const invoiceNumber = `INV-HOST-${Date.now()}`;
    const invoiceData = InvoiceService.generateInvoiceFromHostingCycles(
      cycle.organization_id,
      [
        {
          domain: cycle.domain,
          planName: cycle.plan_name,
          cycleType: cycle.cycle_type,
          periodStart: new Date(cycle.period_start),
          periodEnd: new Date(cycle.period_end),
          amount: toCurrencyNumber(cycle.amount),
        },
      ],
      invoiceNumber,
      cycle.currency || 'USD',
      actorUserId || cycle.created_by,
      cycle.user_name || undefined,
      cycle.user_email || undefined,
      cycle.organization_name || undefined
    );

    const metadata = typeof cycle.transaction_metadata === 'string'
      ? JSON.parse(cycle.transaction_metadata)
      : cycle.transaction_metadata;
    invoiceData.walletBalanceBefore = metadata?.balance_before ?? metadata?.balanceBefore ?? null;
    invoiceData.walletBalanceAfter = metadata?.balance_after ?? metadata?.balanceAfter ?? null;

    const themeConfig = await themeService.getThemeConfig();
    const themePalette = resolveThemePalette(themeConfig);

    const htmlContent = InvoiceService.generateInvoiceHTML(invoiceData, undefined, undefined, themePalette);
    const invoiceId = await InvoiceService.createInvoice(
      cycle.organization_id,
      invoiceNumber,
      htmlContent,
      {
        ...invoiceData,
        sourceType: 'hosting_billing_cycle',
        hostingBillingCycleIds: [billingCycleId],
        hostingSubscriptionId: cycle.hosting_subscription_id,
      } as Record<string, unknown>,
      invoiceData.total,
      invoiceData.currency || 'USD'
    );

    await query(
      `UPDATE hosting_billing_cycles
       SET invoice_id = $1, updated_at = now()
       WHERE id = $2`,
      [invoiceId, billingCycleId]
    );

    return invoiceId;
  }

  private static async billSubscription(
    sub: HostingSubscriptionForBilling,
    options: { cycleType: HostingBillingCycleType }
  ): Promise<{ billingCycleId: string; paymentTransactionId: string; invoiceId: string | null; amount: number; planName: string; periodEnd: string }> {
    const billingResult = await transaction(async (client) => {
      await client.query(
        `INSERT INTO hosting_wallets (organization_id, balance, currency)
          VALUES ($1, 0, 'USD')
          ON CONFLICT (organization_id) DO NOTHING`,
        [sub.organization_id]
      );

      const walletResult = await client.query(
        `SELECT id, balance FROM hosting_wallets WHERE organization_id = $1 FOR UPDATE`,
        [sub.organization_id]
      );
      if (walletResult.rows.length === 0) {
        throw new Error('Hosting wallet not found');
      }
      const wallet = walletResult.rows[0];

      if (!sub.plan_id) {
        throw new HostingBillingDataError('Hosting subscription has no plan');
      }

      const planResult = await client.query(
        `SELECT price_monthly, name FROM hosting_plans WHERE id = $1`,
        [sub.plan_id]
      );
      if (planResult.rows.length === 0) {
        throw new HostingBillingDataError('Plan not found');
      }
      const plan = planResult.rows[0];
      const amount = toCurrencyNumber(plan.price_monthly);
      const balanceBefore = toCurrencyNumber(wallet.balance);
      const periodStart = parseDateOrNow(sub.next_billing_at ?? sub.last_billed_at ?? sub.created_at);
      const periodEnd = addMonths(periodStart, 1);

      const cycleResult = await client.query(
        `INSERT INTO hosting_billing_cycles (
            organization_id, hosting_subscription_id, plan_id, plan_name, domain,
            cycle_type, period_start, period_end, amount, currency, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'USD', 'pending')
          RETURNING id`,
        [
          sub.organization_id,
          sub.id,
          sub.plan_id,
          plan.name,
          sub.domain,
          options.cycleType,
          periodStart,
          periodEnd,
          amount,
        ]
      );
      const billingCycleId = cycleResult.rows[0].id;

      if (balanceBefore < amount) {
        await client.query(
          `UPDATE hosting_billing_cycles
            SET status = 'failed',
                failure_reason = $1,
                updated_at = now()
            WHERE id = $2`,
          ['Insufficient hosting wallet balance', billingCycleId]
        );
        throw new HostingBillingPaymentError('Insufficient hosting wallet balance');
      }

      const balanceAfter = Number((balanceBefore - amount).toFixed(6));
      await client.query(
        `UPDATE hosting_wallets SET balance = $1, updated_at = now() WHERE id = $2`,
        [balanceAfter, wallet.id]
      );

      const transactionResult = await client.query(
        `INSERT INTO payment_transactions (
            organization_id, amount, currency, payment_method, payment_provider,
            status, description, metadata
          )
          VALUES ($1, $2, 'USD', 'wallet_debit', 'internal', 'completed', $3, $4)
          RETURNING id`,
        [
          sub.organization_id,
          -amount,
          `Hosting billing: ${plan.name}`,
          JSON.stringify({
            hosting_subscription_id: sub.id,
            hosting_billing_cycle_id: billingCycleId,
            domain: sub.domain,
            wallet_type: 'hosting',
            billing_period_start: periodStart.toISOString(),
            billing_period_end: periodEnd.toISOString(),
            balance_before: balanceBefore,
            balance_after: balanceAfter,
          }),
        ]
      );
      const paymentTransactionId = transactionResult.rows[0].id;

      await client.query(
        `UPDATE hosting_billing_cycles
          SET status = 'paid',
              payment_transaction_id = $1,
              updated_at = now()
          WHERE id = $2`,
        [paymentTransactionId, billingCycleId]
      );

      await client.query(
        `UPDATE hosting_subscriptions
          SET last_billed_at = $2,
              next_billing_at = $3,
              status = 'active',
              updated_at = now()
          WHERE id = $1`,
        [sub.id, periodStart, periodEnd]
      );

      return { billingCycleId, paymentTransactionId, amount, planName: plan.name, periodEnd: periodEnd.toISOString() };
    });

    let invoiceId: string | null = null;
    try {
      invoiceId = await this.ensureInvoiceForCycle(billingResult.billingCycleId, sub.created_by);
    } catch (invoiceError) {
      console.error(`Failed to create invoice for hosting cycle ${billingResult.billingCycleId}:`, invoiceError);
    }

    await logActivity({
      userId: sub.created_by,
      organizationId: sub.organization_id,
      eventType: 'hosting.billing.completed',
      entityType: 'hosting_subscription',
      entityId: sub.id,
      message: `Monthly hosting billing completed for ${sub.domain}`,
      status: 'success',
      metadata: {
        hosting_billing_cycle_id: billingResult.billingCycleId,
        payment_transaction_id: billingResult.paymentTransactionId,
        invoice_id: invoiceId,
      },
    });

    try {
      const userInfo = await resolveUserEmailAndName(sub.created_by);
      if (userInfo) {
        await sendHostingRenewalEmail({
          to: userInfo.email,
          displayName: userInfo.displayName,
          domain: sub.domain,
          amount: billingResult.amount,
          currency: 'USD',
          nextBillingDate: billingResult.periodEnd,
          invoiceId,
        });
      }
    } catch (emailError) {
      console.error(`Failed to send hosting renewal email for ${sub.domain}:`, emailError);
    }

    return { ...billingResult, invoiceId };
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

      try {
        let planName: string | undefined;
        if (sub.plan_id) {
          const planResult = await query(`SELECT name FROM hosting_plans WHERE id = $1`, [sub.plan_id]);
          if (planResult.rows.length > 0) {
            planName = planResult.rows[0].name;
          }
        }
        const userInfo = await resolveUserEmailAndName(sub.created_by);
        if (userInfo) {
          await sendHostingSuspendedEmail({
            to: userInfo.email,
            displayName: userInfo.displayName,
            domain: sub.domain,
            planName,
            reason: `Insufficient hosting wallet balance`,
          });
        }
      } catch (emailError) {
        console.error(`Failed to send hosting suspension email for ${sub.domain}:`, emailError);
      }
    } catch (error) {
      console.error(`Failed to suspend hosting subscription ${sub.id}:`, error);
    }
  }

  static async retryOverdueForOrganization(
    organizationId: string,
    actorUserId?: string | null
  ): Promise<{ attempted: number; recovered: number; errors: Array<{ subscriptionId: string; message: string }> }> {
    await this.ensureHostingBillingTables();

    const result = await query(
      `SELECT hs.id, hs.organization_id, hs.plan_id, hs.enhance_subscription_id, hs.enhance_website_id,
              hs.domain, hs.next_billing_at, hs.last_billed_at, hs.created_by, hs.status,
              org.enhance_customer_id AS enhance_customer_org_id
       FROM hosting_subscriptions hs
       JOIN organizations org ON org.id = hs.organization_id
       WHERE hs.organization_id = $1
         AND hs.status IN ('active', 'suspended')
         AND hs.next_billing_at <= now()
       ORDER BY hs.next_billing_at ASC`,
      [organizationId]
    );

    let recovered = 0;
    const errors: Array<{ subscriptionId: string; message: string }> = [];

    for (const sub of result.rows) {
      try {
        await this.billSubscription(sub, { cycleType: 'renewal' });
        if (sub.status === 'suspended') {
          await this.unsuspendAfterRecovery(sub, actorUserId);
        }
        recovered += 1;
      } catch (error: any) {
        errors.push({ subscriptionId: sub.id, message: error?.message || 'Retry failed' });
      }
    }

    return { attempted: result.rows.length, recovered, errors };
  }

  static async retrySubscriptionBilling(
    subscriptionId: string,
    actorUserId?: string | null
  ): Promise<{ recovered: boolean; invoiceId?: string | null; error?: string }> {
    await this.ensureHostingBillingTables();

    const result = await query(
      `SELECT hs.id, hs.organization_id, hs.plan_id, hs.enhance_subscription_id, hs.enhance_website_id,
              hs.domain, hs.next_billing_at, hs.last_billed_at, hs.created_by, hs.status,
              org.enhance_customer_id AS enhance_customer_org_id
       FROM hosting_subscriptions hs
       JOIN organizations org ON org.id = hs.organization_id
       WHERE hs.id = $1
         AND hs.status IN ('active', 'suspended')
         AND hs.next_billing_at <= now()`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return { recovered: false, error: 'No overdue active or suspended hosting subscription found' };
    }

    const sub = result.rows[0];
    try {
      const billingResult = await this.billSubscription(sub, { cycleType: 'manual' });
      if (sub.status === 'suspended') {
        await this.unsuspendAfterRecovery(sub, actorUserId);
      }
      return { recovered: true, invoiceId: billingResult.invoiceId };
    } catch (error: any) {
      return { recovered: false, error: error?.message || 'Retry failed' };
    }
  }

  static async hasUnpaidOverdueCycles(subscriptionId: string): Promise<boolean> {
    await this.ensureHostingBillingTables();

    const result = await query(
      `SELECT 1
       FROM hosting_billing_cycles
       WHERE hosting_subscription_id = $1
         AND status = 'failed'
         AND period_start <= now()
       LIMIT 1`,
      [subscriptionId]
    );
    return result.rows.length > 0;
  }

  static async checkHostingBalanceWarnings(): Promise<void> {
    const enabled = await EnhanceToggleService.isEffectivelyEnabled();
    if (!enabled) {
      return;
    }

    try {
      await this.ensureHostingBillingTables();

      const result = await query(
        `SELECT hs.id, hs.organization_id, hs.plan_id, hs.domain, hs.next_billing_at, hs.created_by,
                hw.balance, hw.currency, hp.price_monthly, hp.name as plan_name,
                u.email, u.name as user_name
         FROM hosting_subscriptions hs
         JOIN hosting_wallets hw ON hw.organization_id = hs.organization_id
         LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
         LEFT JOIN users u ON u.id = hs.created_by
         WHERE hs.status = 'active'
           AND hs.next_billing_at <= now() + interval '3 days'
           AND (hs.last_warning_sent_at IS NULL OR hs.last_warning_sent_at < now() - interval '24 hours')`
      );

      for (const sub of result.rows) {
        const requiredAmount = toCurrencyNumber(sub.price_monthly);
        const currentBalance = toCurrencyNumber(sub.balance);

        if (currentBalance < requiredAmount) {
          const email = typeof sub.email === 'string' ? sub.email.trim() : '';
          if (!email) continue;

          const displayName =
            typeof sub.user_name === 'string' && sub.user_name.trim().length > 0
              ? sub.user_name.trim()
              : 'there';

          try {
            await sendHostingSuspensionWarningEmail({
              to: email,
              displayName,
              domain: sub.domain,
              currentBalance,
              requiredAmount,
              currency: sub.currency || 'USD',
              nextBillingDate: new Date(sub.next_billing_at).toLocaleDateString(),
            });

            await query(
              `UPDATE hosting_subscriptions SET last_warning_sent_at = now() WHERE id = $1`,
              [sub.id]
            );
          } catch (emailError) {
            console.error(`Failed to send hosting warning email for ${sub.domain}:`, emailError);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error checking hosting balance warnings:', error);
    }
  }

  private static async unsuspendAfterRecovery(
    sub: HostingSubscriptionForBilling,
    actorUserId?: string | null
  ): Promise<void> {
    if (sub.enhance_website_id) {
      await EnhanceService.updateWebsite(getEnhanceWebsiteOrgId(sub), sub.enhance_website_id, {
        status: 'active',
        isSuspended: false,
      });
    }

    await query(
      `UPDATE hosting_subscriptions
       SET status = 'active', updated_at = now()
       WHERE id = $1`,
      [sub.id]
    );

    await logActivity({
      userId: actorUserId || sub.created_by,
      organizationId: sub.organization_id,
      eventType: 'hosting.billing.recovered',
      entityType: 'hosting_subscription',
      entityId: sub.id,
      message: `Hosting subscription recovered after overdue billing payment for ${sub.domain}`,
      status: 'success',
    });

    try {
      let planName: string | undefined;
      if (sub.plan_id) {
        const planResult = await query(`SELECT name FROM hosting_plans WHERE id = $1`, [sub.plan_id]);
        if (planResult.rows.length > 0) {
          planName = planResult.rows[0].name;
        }
      }
      const userInfo = await resolveUserEmailAndName(sub.created_by);
      if (userInfo) {
        await sendHostingRecoveryEmail({
          to: userInfo.email,
          displayName: userInfo.displayName,
          domain: sub.domain,
          planName,
        });
      }
    } catch (emailError) {
      console.error(`Failed to send hosting recovery email for ${sub.domain}:`, emailError);
    }
  }
}
