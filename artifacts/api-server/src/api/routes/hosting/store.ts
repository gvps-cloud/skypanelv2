import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { query, transaction } from "../../lib/database.js";
import { EnhanceService } from "../../services/enhanceService.js";
import { logActivity } from "../../services/activityLogger.js";
import { config } from "../../config/index.js";
import { sendEnhanceCredentialsEmail } from "../../services/emailService.js";
import { EnhanceOnboardingService } from "../../services/enhanceOnboardingService.js";
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
    const groups = await EnhanceService.getServerGroups();
    res.json({ regions: groups });
  } catch (error: any) {
    console.error("Failed to get hosting regions:", error);
    res.status(500).json({ error: "Failed to get hosting regions" });
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
    console.error("Failed to get staging domain:", error);
    res.status(500).json({ error: "Failed to get staging domain" });
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
  const { planId, domain, regionId, useStagingDomain } = req.body;

  if (!planId || (!domain && !useStagingDomain)) {
    return res.status(400).json({ error: "planId and domain are required (or set useStagingDomain)" });
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
    const onboardingResult = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId,
      purchaserUserId: userId,
    });

    const enhancePlanId = Number(plan.enhance_plan_id);
    if (!Number.isInteger(enhancePlanId) || enhancePlanId <= 0) {
      throw new Error("Hosting plan is not synced to a valid Enhance plan");
    }

    // Resolve plan features for server group handling
    const planFeatures = plan.features
      ? (typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features)
      : {};
    const allowServerGroupSelection = planFeatures.allowServerGroupSelection === true;

    // Only include serverGroupId when the plan explicitly allows selection
    const serverGroupId = regionId || config.ENHANCE_DEFAULT_SERVER_GROUP_ID;
    if (allowServerGroupSelection && !serverGroupId) {
      throw new Error("A hosting region is required because no default Enhance server group is configured");
    }

    // Create subscription — if one already exists for this customer (409),
    // fetch and reuse the existing subscription instead of failing.
    let enhanceSubscription: any;
    try {
      enhanceSubscription = await EnhanceService.createCustomerSubscription(
        config.ENHANCE_MASTER_ORG_ID,
        onboardingResult.enhanceCustomerId,
        { planId: enhancePlanId }
      );
    } catch (subError: any) {
      const subscriptionAlreadyExists =
        subError?.statusCode === 409 &&
        subError?.responseBody?.detail === 'subscription';

      if (!subscriptionAlreadyExists) {
        throw subError;
      }

      // Customer already has a subscription — find the matching one.
      const existingSubs = await EnhanceService.getCustomerSubscriptions(
        config.ENHANCE_MASTER_ORG_ID,
        onboardingResult.enhanceCustomerId
      );
      const subItems: any[] = Array.isArray(existingSubs)
        ? existingSubs
        : existingSubs?.items || existingSubs?.subscriptions || [];

      // Prefer the subscription for the requested plan; fall back to the first available.
      const matchedSub =
        subItems.find((s: any) => Number(s.planId) === enhancePlanId || Number(s.plan?.id) === enhancePlanId)
        ?? subItems[0];

      if (!matchedSub?.id) {
        throw new Error("Customer already has a subscription in Enhance but it could not be retrieved");
      }

      enhanceSubscription = matchedSub;
    }

    const enhanceSubscriptionId = Number(enhanceSubscription.id);
    if (!Number.isInteger(enhanceSubscriptionId) || enhanceSubscriptionId <= 0) {
      throw new Error("Enhance subscription creation returned an invalid subscription id");
    }

    // Helper to generate a random staging subdomain slug (8 lowercase alphanumeric chars).
    const generateSlug = () =>
      crypto.getRandomValues(new Uint8Array(6))
        .reduce((acc: string, b: number) => acc + b.toString(36).padStart(2, '0').slice(-2), '')
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 8)
        .padEnd(8, '0');

    // Resolve the staging domain suffix once (if needed).
    let stagingSuffix: string | null = null;
    if (!domain && useStagingDomain) {
      stagingSuffix = await EnhanceService.getStagingDomain(config.ENHANCE_MASTER_ORG_ID);
      if (!stagingSuffix) {
        throw new Error("Staging domain is not configured on the hosting platform");
      }
    }

    // Create the website under the customer's own Enhance org.
    // When using an auto-generated staging subdomain, retry with a fresh slug
    // if the randomly chosen name collides with a stale website left from a
    // previous failed purchase attempt.
    const MAX_DOMAIN_RETRIES = 5;
    let enhanceWebsite: any;
    let resolvedDomain = domain ?? '';

    for (let attempt = 1; attempt <= MAX_DOMAIN_RETRIES; attempt++) {
      // Generate a new slug on every attempt when in staging-subdomain mode.
      if (!domain && useStagingDomain && stagingSuffix) {
        resolvedDomain = `${generateSlug()}.${stagingSuffix}`;
      }

      if (!resolvedDomain) {
        throw new Error("No domain provided and staging domain mode is not enabled");
      }

      const websitePayload: Record<string, any> = {
        domain: resolvedDomain,
        subscriptionId: enhanceSubscriptionId,
      };
      if (allowServerGroupSelection && serverGroupId) {
        websitePayload.serverGroupId = serverGroupId;
      }

      // Staging subdomains require kind=staging so Enhance validates the
      // subscription's stagingWebsites resource instead of websites resource.
      const websiteKind = (!domain && useStagingDomain) ? 'staging' : undefined;

      try {
        enhanceWebsite = await EnhanceService.createWebsite(
          onboardingResult.enhanceCustomerId,
          websitePayload,
          websiteKind,
        );
        break; // success — exit retry loop
      } catch (websiteError: any) {
        console.error(
          `[Hosting purchase] createWebsite attempt ${attempt}/${MAX_DOMAIN_RETRIES} failed:`,
          `status=${websiteError?.statusCode}`,
          `body=${JSON.stringify(websiteError?.responseBody)}`,
          `org=${onboardingResult.enhanceCustomerId}`,
          `domain=${resolvedDomain}`,
          `subscriptionId=${enhanceSubscriptionId}`
        );

        const domainTaken =
          websiteError?.statusCode === 403 &&
          websiteError?.responseBody?.detail === 'domain';

        if (domainTaken) {
          // If this was a user-supplied domain, surface a clear error immediately.
          if (domain) {
            throw new Error(
              `The domain "${resolvedDomain}" is already in use on the hosting platform. ` +
              `Please choose a different domain.`
            );
          }
          // For auto-generated staging subdomains, the slug collided with a
          // stale website.  Log and try a fresh one on the next iteration.
          if (attempt === MAX_DOMAIN_RETRIES) {
            throw new Error(
              "Could not allocate a free staging subdomain after several attempts. Please try again."
            );
          }
          continue;
        }

        throw websiteError;
      }
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
      stagingDomain: useStagingDomain ? resolvedDomain : undefined,
    });
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
    // Websites live under the customer's own Enhance org. Subscriptions are
    // managed at the master org level.
    const customerEnhanceOrgId = sub.enhance_customer_org_id;

    if (sub.enhance_website_id) {
      if (!customerEnhanceOrgId) {
        console.warn(`[Hosting cancel] No enhance_customer_org_id for subscription ${sub.id}; skipping website deletion`);
      } else {
        try {
          await EnhanceService.deleteWebsite(customerEnhanceOrgId, sub.enhance_website_id);
        } catch (deleteWebsiteError: any) {
          if (deleteWebsiteError?.statusCode === 404 || deleteWebsiteError?.statusCode === 410) {
            // Website was already deleted directly in the Enhance panel — treat as gone.
            console.warn(`[Hosting cancel] Website ${sub.enhance_website_id} not found on Enhance (already removed); continuing cancellation`);
          } else {
            throw deleteWebsiteError;
          }
        }
      }
    }

    if (sub.enhance_subscription_id) {
      try {
        await EnhanceService.deleteSubscription(config.ENHANCE_MASTER_ORG_ID, sub.enhance_subscription_id);
      } catch (deleteSubError: any) {
        if (deleteSubError?.statusCode === 404 || deleteSubError?.statusCode === 410) {
          console.warn(`[Hosting cancel] Subscription ${sub.enhance_subscription_id} not found on Enhance (already removed); continuing cancellation`);
        } else {
          throw deleteSubError;
        }
      }
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
