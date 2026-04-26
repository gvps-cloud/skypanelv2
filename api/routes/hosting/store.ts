import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { query, transaction } from "../../lib/database.js";
import { EnhanceService } from "../../services/enhanceService.js";
import { logActivity } from "../../services/activityLogger.js";
import { config } from "../../config/index.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

/**
 * GET /api/hosting/plans
 * List active hosting plans
 */
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, enhance_plan_id, name, description, features, service_type, price_monthly
       FROM hosting_plans WHERE is_active = true ORDER BY price_monthly ASC`
    );
    res.json({ plans: result.rows });
  } catch (error) {
    console.error("Failed to get hosting plans:", error);
    res.status(500).json({ error: "Failed to get hosting plans" });
  }
});

/**
 * GET /api/hosting/regions
 * Return server groups from Enhance as regions
 */
router.get("/regions", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  try {
    const groups = await EnhanceService.getServerGroups(config.ENHANCE_MASTER_ORG_ID);
    res.json({ regions: groups });
  } catch (error: any) {
    console.error("Failed to get hosting regions:", error);
    res.status(500).json({ error: "Failed to get hosting regions" });
  }
});

/**
 * GET /api/hosting/services
 * List organization's hosting subscriptions
 */
router.get("/services", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const result = await query(
      `SELECT hs.id, hs.domain, hs.status, hs.primary_ip, hs.next_billing_at, hs.created_at,
              hp.id as plan_id, hp.name as plan_name, hp.service_type
       FROM hosting_subscriptions hs
       JOIN hosting_plans hp ON hp.id = hs.plan_id
       WHERE hs.organization_id = $1
       ORDER BY hs.created_at DESC`,
      [organizationId]
    );
    res.json({ services: result.rows });
  } catch (error) {
    console.error("Failed to get hosting services:", error);
    res.status(500).json({ error: "Failed to get hosting services" });
  }
});

/**
 * GET /api/hosting/services/:id
 * Get a single hosting subscription detail
 */
router.get("/services/:id", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT hs.*, hp.name as plan_name, hp.service_type
       FROM hosting_subscriptions hs
       JOIN hosting_plans hp ON hp.id = hs.plan_id
       WHERE hs.id = $1 AND hs.organization_id = $2`,
      [id, organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.json({ service: result.rows[0] });
  } catch (error) {
    console.error("Failed to get hosting service:", error);
    res.status(500).json({ error: "Failed to get hosting service" });
  }
});

/**
 * POST /api/hosting/purchase
 * Purchase a hosting subscription
 */
router.post("/purchase", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const { id: userId, organizationId } = (req as AuthenticatedRequest).user;
  const { planId, domain, regionId } = req.body;

  if (!planId || !domain) {
    return res.status(400).json({ error: "planId and domain are required" });
  }

  let subscriptionId: string | undefined;

  try {
    const result = await transaction(async (client) => {
      // 1. Lock org wallet and verify balance
      const walletResult = await client.query(
        `SELECT id, balance FROM wallets WHERE organization_id = $1 FOR UPDATE`,
        [organizationId]
      );
      if (walletResult.rows.length === 0) {
        throw new Error("Wallet not found");
      }
      const wallet = walletResult.rows[0];

      // 2. Get plan pricing
      const planResult = await client.query(
        `SELECT price_monthly, enhance_plan_id, name FROM hosting_plans WHERE id = $1 AND is_active = true`,
        [planId]
      );
      if (planResult.rows.length === 0) {
        throw new Error("Plan not found or inactive");
      }
      const plan = planResult.rows[0];
      const amount = parseFloat(plan.price_monthly);

      if (wallet.balance < amount) {
        throw new Error("Insufficient wallet balance");
      }

      // 3. Deduct wallet
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [amount, wallet.id]
      );

      // 4. Insert wallet debit transaction
      const debitResult = await client.query(
        `INSERT INTO payment_transactions (organization_id, amount, payment_method, payment_provider, status, description, metadata)
         VALUES ($1, $2, 'wallet_debit', 'internal', 'completed', $3, $4)
         RETURNING id`,
        [organizationId, -amount, `Hosting purchase: ${plan.name}`, JSON.stringify({ plan_id: planId, domain })]
      );
      const debitTransactionId = debitResult.rows[0].id;

      // 5. Insert provisional hosting subscription
      const subResult = await client.query(
        `INSERT INTO hosting_subscriptions (organization_id, created_by, plan_id, domain, status, next_billing_at, settings)
         VALUES ($1, $2, $3, $4, 'provisioning', now() + interval '1 month', $5)
         RETURNING *`,
        [organizationId, userId, planId, domain, JSON.stringify({ debit_transaction_id: debitTransactionId })]
      );
      const subscription = subResult.rows[0];

      return { subscription, plan, debitTransactionId, wallet };
    });

    // Remote Enhance calls (outside the initial DB transaction)
    const { subscription, plan } = result;
    subscriptionId = subscription.id;

    // Ensure org has Enhance customer id
    const orgResult = await query(
      `SELECT enhance_customer_id FROM organizations WHERE id = $1`,
      [organizationId]
    );
    let enhanceCustomerId = orgResult.rows[0]?.enhance_customer_id;

    if (!enhanceCustomerId) {
      const customer = await EnhanceService.createCustomer(config.ENHANCE_MASTER_ORG_ID, {
        name: domain,
        org: { name: domain },
      });
      enhanceCustomerId = customer.id;
      await query(
        `UPDATE organizations SET enhance_customer_id = $1 WHERE id = $2`,
        [enhanceCustomerId, organizationId]
      );
    }

    // Create subscription
    const enhanceSubscription = await EnhanceService.createCustomerSubscription(
      config.ENHANCE_MASTER_ORG_ID,
      enhanceCustomerId,
      { plan_id: plan.enhance_plan_id }
    );

    // Create website
    const enhanceWebsite = await EnhanceService.createWebsite(config.ENHANCE_MASTER_ORG_ID, {
      subscription_id: enhanceSubscription.id,
      domain,
      server_group_id: regionId || config.ENHANCE_DEFAULT_SERVER_GROUP_ID,
    });

    // Success: update local row
    await query(
      `UPDATE hosting_subscriptions
       SET enhance_subscription_id = $1,
           enhance_website_id = $2,
           primary_ip = $3,
           status = 'active',
           last_billed_at = now(),
           next_billing_at = now() + interval '1 month',
           settings = settings || $4
       WHERE id = $5`,
      [
        enhanceSubscription.id,
        enhanceWebsite.id,
        enhanceWebsite.primary_ip || null,
        JSON.stringify({ primary_ip: enhanceWebsite.primary_ip }),
        subscription.id,
      ]
    );

    await logActivity({
      userId,
      organizationId,
      eventType: "hosting.purchase.completed",
      entityType: "hosting_subscription",
      entityId: subscription.id,
      message: `Purchased hosting plan ${plan.name} for ${domain}`,
      status: "success",
      metadata: { plan_id: planId, domain, enhance_subscription_id: enhanceSubscription.id },
    });

    res.status(201).json({ subscription: { ...subscription, status: "active" } });
  } catch (error: any) {
    console.error("Hosting purchase failed:", error);

    // Mark subscription as error if it was created
    if (subscriptionId) {
      try {
        await query(
          `UPDATE hosting_subscriptions SET status = 'error', updated_at = now() WHERE id = $1`,
          [subscriptionId]
        );
      } catch (subUpdateError) {
        console.error("Failed to update subscription status to error:", subUpdateError);
      }
    }

    // Compensating credit on failure
    try {
      const planResult = await query(`SELECT price_monthly FROM hosting_plans WHERE id = $1`, [planId]);
      if (planResult.rows.length > 0) {
        const amount = parseFloat(planResult.rows[0].price_monthly);
        await query(
          `UPDATE wallets SET balance = balance + $1 WHERE organization_id = $2`,
          [amount, organizationId]
        );
        await query(
          `INSERT INTO payment_transactions (organization_id, amount, payment_method, payment_provider, status, description, metadata)
           VALUES ($1, $2, 'wallet_credit', 'internal', 'completed', $3, $4)`,
          [organizationId, amount, "Hosting purchase rollback", JSON.stringify({ reason: error.message })]
        );
      }
    } catch (rollbackError) {
      console.error("Failed to rollback hosting purchase:", rollbackError);
    }

    res.status(500).json({ error: error?.message || "Hosting purchase failed" });
  }
});

/**
 * POST /api/hosting/services/:id/cancel
 * Cancel a hosting subscription
 */
router.post("/services/:id/cancel", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const { id: userId, organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT * FROM hosting_subscriptions WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    const sub = result.rows[0];

    if (sub.enhance_website_id) {
      await EnhanceService.deleteWebsite(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    }
    if (sub.enhance_subscription_id) {
      await EnhanceService.deleteSubscription(config.ENHANCE_MASTER_ORG_ID, sub.enhance_subscription_id);
    }

    await query(
      `UPDATE hosting_subscriptions SET status = 'cancelled', updated_at = now() WHERE id = $1`,
      [id]
    );

    await logActivity({
      userId,
      organizationId,
      eventType: "hosting.cancel.completed",
      entityType: "hosting_subscription",
      entityId: id,
      message: `Cancelled hosting subscription`,
      status: "success",
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to cancel hosting service:", error);
    res.status(500).json({ error: error?.message || "Failed to cancel hosting service" });
  }
});

export default router;
