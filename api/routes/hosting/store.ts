import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { query, transaction } from "../../lib/database.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import { logActivity } from "../../services/activityLogger.js";
import { config } from "../../config/index.js";
import { sendEnhanceCredentialsEmail } from "../../services/emailService.js";
import { EnhanceOnboardingService } from "../../services/enhanceOnboardingService.js";
import { RefundService } from "../../services/refundService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";

const router = express.Router();

const extractCollection = <T,>(value: any): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  return [];
};

const createHttpError = (message: string, statusCode: number, responseBody?: any) =>
  Object.assign(new Error(message), { statusCode, responseBody });

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
    const regions = await EnhanceService.getServerGroups();
    res.json({ regions: Array.isArray(regions) ? regions : [] });
  } catch (error: any) {
    console.error("Failed to get hosting regions (non-fatal):", error?.message || error);
    res.json({ regions: [] });
  }
});

/**
 * GET /api/hosting/staging-domain
 * Return the platform staging domain suffix for free subdomains
 */
router.get("/staging-domain", requireOrgPermission("hosting_view"), async (_req: Request, res: Response) => {
  try {
    const stagingDomain = await EnhanceService.getStagingDomain(config.ENHANCE_MASTER_ORG_ID);
    res.json({ stagingDomain: stagingDomain || null });
  } catch (error: any) {
    console.error("Failed to get staging domain (non-fatal):", error?.message || error);
    res.json({ stagingDomain: null });
  }
});

/**
 * GET /api/hosting/nameservers
 * Return DNS nameserver IPs and server hostnames for domain configuration
 */
router.get("/nameservers", requireOrgPermission("hosting_view"), async (_req: Request, res: Response) => {
  try {
    const nameservers = await EnhanceService.getDnsNameservers();
    res.json(nameservers);
  } catch (error: any) {
    console.error("Failed to get DNS nameservers (non-fatal):", error?.message || error);
    res.json({ ips: [], servers: [] });
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
      `SELECT hs.id, hs.domain, hs.status, hs.primary_ip, hs.next_billing_at, hs.created_at, hs.cancelled_at,
              hp.id as plan_id, hp.name as plan_name, hp.service_type, hp.price_monthly, hp.enhance_plan_id
       FROM hosting_subscriptions hs
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
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
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
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
 * GET /api/hosting/services/:id/bandwidth
 * Get bandwidth usage for a hosting subscription (proxy to Enhance)
 */
router.get(
  "/services/:id/bandwidth",
  requireOrgPermission("hosting_view"),
  async (req: Request, res: Response) => {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const { id } = req.params;

    try {
      const subscription = await getHostingSubscriptionForOrganization(id, organizationId);
      if (!subscription) {
        return res.status(404).json({ error: "Service not found" });
      }

      if (!subscription.enhance_subscription_id) {
        // No upstream subscription associated
        return res.json({ bandwidth: null });
      }

      const enhanceOrgId = getEnhanceWebsiteOrgId(subscription as any);
      const result = await EnhanceService.getSubscriptionBandwidth(enhanceOrgId, subscription.enhance_subscription_id);
      res.json({ bandwidth: result ?? null });
    } catch (error: any) {
      console.error("Failed to get hosting bandwidth:", error);
      res.status(500).json({ error: error?.message || "Failed to get hosting bandwidth" });
    }
  }
);

/**
 * POST /api/hosting/purchase
 * Purchase a hosting subscription
 */
router.post("/purchase", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const { id: userId, organizationId } = (req as AuthenticatedRequest).user;
  const { planId, domain, regionId, useStagingDomain } = req.body;

  if (useStagingDomain) {
    return res.status(400).json({
      error: "Free staging domains are not available for initial hosting purchases. Please enter your own domain.",
    });
  }

  if (!planId || !domain) {
    return res.status(400).json({ error: "planId and domain are required" });
  }

  const requestedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';

  let subscriptionId: string | undefined;
  let enhanceCustomerOrgId: string | undefined;
  let remoteEnhanceSubscriptionId: string | undefined;
  let remoteEnhanceWebsiteId: string | undefined;
  let createdRemoteSubscription = false;

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

      // 2. Get plan pricing and features
      const planResult = await client.query(
        `SELECT price_monthly, enhance_plan_id, name, features FROM hosting_plans WHERE id = $1 AND is_active = true`,
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
        [organizationId, -amount, `Hosting purchase: ${plan.name}`, JSON.stringify({ plan_id: planId, domain: requestedDomain })]
      );
      const debitTransactionId = debitResult.rows[0].id;

      // 5. Insert provisional hosting subscription
      const subResult = await client.query(
        `INSERT INTO hosting_subscriptions (organization_id, created_by, plan_id, domain, status, next_billing_at, settings)
         VALUES ($1, $2, $3, $4, 'provisioning', now() + interval '1 month', $5)
         RETURNING *`,
        [organizationId, userId, planId, requestedDomain, JSON.stringify({ debit_transaction_id: debitTransactionId })]
      );
      const subscription = subResult.rows[0];

      return { subscription, plan, debitTransactionId, wallet };
    });

    // Remote Enhance calls (outside the initial DB transaction)
    const { subscription, plan } = result;
    subscriptionId = subscription.id;

    let onboardingResult;
    try {
      onboardingResult = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
        organizationId,
        purchaserUserId: userId,
      });
      enhanceCustomerOrgId = onboardingResult.enhanceCustomerId;
    } catch (onboardingError: any) {
      throw new Error(`Failed to prepare hosting account: ${onboardingError?.message || 'unknown error'}`);
    }

    const enhancePlanId = Number(plan.enhance_plan_id);
    if (!Number.isInteger(enhancePlanId) || enhancePlanId <= 0) {
      throw new Error("Hosting plan is not synced to a valid Enhance plan");
    }

    // Resolve plan features for server group handling
    const planFeatures = plan.features
      ? (typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features)
      : {};
    const allowServerGroupSelection = planFeatures.allowServerGroupSelection === true;

    const resolvedDomain = requestedDomain;

    // Only include serverGroupId when the plan explicitly allows selection
    const serverGroupId = regionId || config.ENHANCE_DEFAULT_SERVER_GROUP_ID;
    if (allowServerGroupSelection && !serverGroupId) {
      throw new Error("A hosting region is required because no default Enhance server group is configured");
    }

    // Create subscription
    let enhanceSubscription;
    try {
      enhanceSubscription = await EnhanceService.createCustomerSubscription(
        config.ENHANCE_MASTER_ORG_ID,
        onboardingResult.enhanceCustomerId,
        { planId: enhancePlanId }
      );
      createdRemoteSubscription = true;
    } catch (subError: any) {
      const subscriptionAlreadyExists =
        subError instanceof EnhanceApiError &&
        subError.statusCode === 409 &&
        subError.responseBody?.detail === 'subscription';

      if (!subscriptionAlreadyExists) {
        throw new Error(`Failed to create hosting subscription: ${subError?.message || 'unknown error'}`);
      }

      const existingSubscriptions = extractCollection<any>(
        await EnhanceService.getCustomerSubscriptions(
          config.ENHANCE_MASTER_ORG_ID,
          onboardingResult.enhanceCustomerId,
        )
      );
      const matchedSubscription = existingSubscriptions.find(
        (item) => Number(item?.planId) === enhancePlanId,
      );

      if (!matchedSubscription?.id) {
        throw new Error(
          "Failed to create hosting subscription: Enhance reported an existing subscription, but no matching plan subscription could be found",
        );
      }

      const existingWebsites = extractCollection<any>(
        await EnhanceService.getWebsites(onboardingResult.enhanceCustomerId)
      );
      if (existingWebsites.length > 0) {
        throw createHttpError(
          "This hosting account already has an existing Enhance subscription with website data. Please cancel the existing service or contact support before purchasing again.",
          409,
          subError.responseBody,
        );
      }

      enhanceSubscription = matchedSubscription;
    }
    const enhanceSubscriptionId = Number(enhanceSubscription.id);
    if (!Number.isInteger(enhanceSubscriptionId) || enhanceSubscriptionId <= 0) {
      throw new Error("Enhance subscription creation returned an invalid subscription id");
    }
    remoteEnhanceSubscriptionId = String(enhanceSubscription.id);

    // Create website — conditionally include serverGroupId only when the plan allows selection
    const websitePayload: Record<string, any> = {
      subscriptionId: enhanceSubscriptionId,
      domain: resolvedDomain,
    };
    if (allowServerGroupSelection && serverGroupId) {
      websitePayload.serverGroupId = serverGroupId;
    }

    let websiteResult;
    try {
      websiteResult = await EnhanceService.createWebsite(
        onboardingResult.enhanceCustomerId,
        websitePayload,
      );
    } catch (websiteError: any) {
      const invalidDomainError =
        websiteError instanceof EnhanceApiError &&
        websiteError.statusCode === 403 &&
        websiteError.responseBody?.detail === 'domain';

      if (invalidDomainError) {
        throw createHttpError(
          websiteError.responseBody?.message || "Unable to create website for the requested domain",
          400,
          websiteError.responseBody,
        );
      }

      throw new Error(`Failed to create website: ${websiteError?.message || 'unknown error'}`);
    }
    const websiteId = websiteResult.id;
    remoteEnhanceWebsiteId = websiteId;

    let enhanceWebsite;
    try {
      enhanceWebsite = await EnhanceService.getWebsite(
        onboardingResult.enhanceCustomerId,
        websiteId,
      );
    } catch (websiteError: any) {
      console.error("Failed to fetch website details (non-fatal):", websiteError);
      enhanceWebsite = { id: websiteId, primary_ip: null };
    }

    let credentialsEmailed = false;
    if (onboardingResult.credentialsEmail) {
      try {
        await sendEnhanceCredentialsEmail({
          to: onboardingResult.credentialsEmail.recipient,
          displayName: onboardingResult.credentialsEmail.displayName,
          firstName: onboardingResult.credentialsEmail.firstName,
          organizationName: onboardingResult.credentialsEmail.organizationName,
          password: onboardingResult.credentialsEmail.password,
        });
        credentialsEmailed = true;
      } catch (emailError) {
        console.error("Failed to send Enhance credentials email:", emailError);
      }
    }

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
      message: `Purchased hosting plan ${plan.name} for ${resolvedDomain}`,
      status: "success",
      metadata: { plan_id: planId, domain: resolvedDomain, enhance_subscription_id: enhanceSubscription.id },
    });

    res.status(201).json({
      subscription: { ...subscription, status: "active", domain: resolvedDomain },
      credentialsCreated: onboardingResult.credentialsCreated,
      credentialsEmailed,
    });
  } catch (error: any) {
    console.error("Hosting purchase failed:", error);

    if (enhanceCustomerOrgId && remoteEnhanceWebsiteId) {
      try {
        await EnhanceService.deleteWebsite(enhanceCustomerOrgId, remoteEnhanceWebsiteId);
      } catch (cleanupError) {
        console.error("Failed to cleanup Enhance website after purchase error:", cleanupError);
      }
    }

    if (remoteEnhanceSubscriptionId && createdRemoteSubscription) {
      try {
        await EnhanceService.deleteSubscription(config.ENHANCE_MASTER_ORG_ID, remoteEnhanceSubscriptionId);
      } catch (cleanupError) {
        console.error("Failed to cleanup Enhance subscription after purchase error:", cleanupError);
      }
    }

    // Mark subscription as error if it was created
    if (subscriptionId) {
      try {
        await query(
          `UPDATE hosting_subscriptions
           SET status = 'error',
               updated_at = now(),
               settings = settings || $2::jsonb
           WHERE id = $1`,
          [
            subscriptionId,
            JSON.stringify({
              enhance_customer_id: enhanceCustomerOrgId || null,
              enhance_subscription_id: remoteEnhanceSubscriptionId || null,
              enhance_website_id: remoteEnhanceWebsiteId || null,
              provisioning_error: error?.message || "Hosting purchase failed",
              enhance_error_status: error?.statusCode || null,
              enhance_error_body: error?.responseBody || null,
            }),
          ]
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

    res.status(error?.statusCode || 500).json({ error: error?.message || "Hosting purchase failed" });
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
      `SELECT hs.*, org.enhance_customer_id AS enhance_customer_org_id
       FROM hosting_subscriptions hs
       JOIN organizations org ON org.id = hs.organization_id
       WHERE hs.id = $1 AND hs.organization_id = $2`,
      [id, organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    const sub = result.rows[0];
    const enhanceWebsiteOrgId = sub.enhance_customer_org_id || config.ENHANCE_MASTER_ORG_ID;

    if (sub.status === 'cancelled') {
      return res.status(400).json({ error: "Subscription is already cancelled" });
    }

    if (sub.enhance_website_id) {
      try {
        await EnhanceService.deleteWebsite(enhanceWebsiteOrgId, sub.enhance_website_id);
      } catch (enhanceErr) {
        console.error("Failed to delete Enhance website (non-fatal):", enhanceErr);
      }
    }
    if (sub.enhance_subscription_id) {
      try {
        await EnhanceService.deleteSubscription(config.ENHANCE_MASTER_ORG_ID, sub.enhance_subscription_id);
      } catch (enhanceErr) {
        console.error("Failed to delete Enhance subscription (non-fatal):", enhanceErr);
      }
    }

    await query(
      `UPDATE hosting_subscriptions SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1`,
      [id]
    );

    let refundId: string | null = null;
    try {
      refundId = await RefundService.createProratedHostingRefund(id, userId);
    } catch (refundError) {
      console.error("Failed to create prorated hosting refund (non-fatal):", refundError);
    }

    await logActivity({
      userId,
      organizationId,
      eventType: "hosting.cancel.completed",
      entityType: "hosting_subscription",
      entityId: id,
      message: `Cancelled hosting subscription${refundId ? ` with prorated refund` : ''}`,
      status: "success",
      metadata: { refund_id: refundId },
    });

    res.json({ success: true, refund_id: refundId });
  } catch (error: any) {
    console.error("Failed to cancel hosting service:", error);
    res.status(500).json({ error: error?.message || "Failed to cancel hosting service" });
  }
});

/**
 * POST /api/hosting/sso
 * Get an Enhance panel SSO link for the current organization
 */
router.post("/sso", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const { organizationId } = (req as AuthenticatedRequest).user;

  try {
    const orgResult = await query(
      `SELECT enhance_customer_id, enhance_member_id FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const enhanceCustomerOrgId = orgResult.rows[0].enhance_customer_id;
    if (!enhanceCustomerOrgId) {
      return res.status(400).json({ error: "Enhance customer not set up for this organization" });
    }

    let memberId = orgResult.rows[0].enhance_member_id;

    if (!memberId) {
      const members = await EnhanceService.getOrgMembers(enhanceCustomerOrgId);
      const items = Array.isArray(members) ? members : (members?.items || []);
      const owner = items.find((m: any) => m.roles?.includes('Owner') || m.roles?.includes('SuperAdmin'));
      memberId = owner?.id || items?.[0]?.id;

      if (memberId) {
        await query(
          `UPDATE organizations SET enhance_member_id = $1 WHERE id = $2`,
          [memberId, organizationId]
        );
      }
    }

    if (!memberId) {
      return res.status(400).json({ error: "No Enhance member found for this organization" });
    }

    const ssoUrl = await EnhanceService.getMemberSsoLink(enhanceCustomerOrgId, memberId);
    res.json({ url: ssoUrl });
  } catch (error: any) {
    console.error("Failed to get Enhance SSO link:", error);
    res.status(500).json({ error: error?.message || "Failed to get SSO link" });
  }
});

export default router;
