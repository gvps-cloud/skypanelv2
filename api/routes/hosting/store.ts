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
import { HostingBillingService } from "../../services/hostingBillingService.js";
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

function readBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === "string") {
    if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  }
  return undefined;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBandwidthBytes(value: unknown): number | null {
  const scalar = readNumber(value);
  if (scalar !== null) {
    return scalar;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readNumber(record.bandwidth ?? record.usage ?? record.used ?? record.bytes);
  }

  return null;
}

function getCurrentMonthUtcRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

function aggregateMetricsResponse(response: any, range: { start: string; end: string }, granularity: "hour" | "day") {
  const items = extractCollection<any>(response);
  const totals = items.reduce(
    (acc, item) => {
      acc.bytesReceived += readNumber(item?.bytesReceived) ?? 0;
      acc.bytesSent += readNumber(item?.bytesSent) ?? 0;
      acc.uniqueHits += readNumber(item?.uniqueHits) ?? 0;
      acc.botHits += readNumber(item?.botHits) ?? 0;
      acc.totalHits += readNumber(item?.totalHits) ?? 0;
      return acc;
    },
    {
      bytesReceived: 0,
      bytesSent: 0,
      uniqueHits: 0,
      botHits: 0,
      totalHits: 0,
    },
  );

  return {
    ...range,
    granularity,
    items,
    ...totals,
    totalBytes: totals.bytesReceived + totals.bytesSent,
  };
}

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
              hs.enhance_website_id, org.enhance_customer_id AS enhance_customer_org_id,
              hp.id as plan_id, hp.name as plan_name, hp.service_type, hp.price_monthly, hp.enhance_plan_id
       FROM hosting_subscriptions hs
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
       LEFT JOIN organizations org ON org.id = hs.organization_id
       WHERE hs.organization_id = $1
       ORDER BY hs.created_at DESC`,
      [organizationId]
    );

    // Retroactively sync primary IP from Enhance for subscriptions missing it
    const rowsNeedingSync = result.rows.filter(
      (row: any) => !row.primary_ip && row.enhance_website_id
    );
    if (rowsNeedingSync.length > 0) {
      const syncResults = await Promise.allSettled(
        rowsNeedingSync.map(async (row: any) => {
          const orgId = row.enhance_customer_org_id || config.ENHANCE_MASTER_ORG_ID;
          const website = await EnhanceService.getWebsite(orgId, String(row.enhance_website_id));
          const serverIps = Array.isArray(website?.serverIps) ? website.serverIps : [];
          const ip = serverIps.find((ip: any) => ip.isPrimary)?.ip || serverIps[0]?.ip || null;
          if (ip) {
            await query(
              `UPDATE hosting_subscriptions SET primary_ip = $1, updated_at = NOW() WHERE id = $2`,
              [ip, row.id]
            );
            row.primary_ip = ip;
          }
        })
      );
      for (const r of syncResults) {
        if (r.status === 'rejected') {
          console.error('[Hosting] Failed to sync primary IP from Enhance (non-fatal):', r.reason?.message || r.reason);
        }
      }
    }

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
       WHERE hs.id = $1 AND hs.organization_id = $2 AND hs.status <> 'cancelled'`,
      [id, organizationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    const service = result.rows[0];

    // Retroactively sync primary IP from Enhance if missing
    if (!service.primary_ip && service.enhance_website_id) {
      try {
        const enhanceOrgId = getEnhanceWebsiteOrgId(service);
        const website = await EnhanceService.getWebsite(enhanceOrgId, String(service.enhance_website_id));
        const serverIps = Array.isArray(website?.serverIps) ? website.serverIps : [];
        const syncedIp = serverIps.find((ip: any) => ip.isPrimary)?.ip || serverIps[0]?.ip || null;
        if (syncedIp) {
          await query(
            `UPDATE hosting_subscriptions SET primary_ip = $1, updated_at = NOW() WHERE id = $2`,
            [syncedIp, service.id]
          );
          service.primary_ip = syncedIp;
        }
      } catch (syncError: any) {
        console.error(`[Hosting] Failed to retroactively sync primary IP for subscription ${id}:`, syncError.message);
      }
    }

    res.json({ service });
  } catch (error) {
    console.error("Failed to get hosting service:", error);
    res.status(500).json({ error: "Failed to get hosting service" });
  }
});

/**
 * GET /api/hosting/services/:id/billing
 * Return subscription-scoped hosting billing status, cycles, invoices, and refunds.
 */
router.get("/services/:id/billing", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;

  try {
    const serviceResult = await query(
      `SELECT hs.id, hs.organization_id, hs.status, hs.domain, hs.next_billing_at, hs.last_billed_at,
              hp.name as plan_name, hp.price_monthly,
              COALESCE(hw.balance, 0) as hosting_wallet_balance
       FROM hosting_subscriptions hs
       LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
       LEFT JOIN hosting_wallets hw ON hw.organization_id = hs.organization_id
       WHERE hs.id = $1 AND hs.organization_id = $2`,
      [id, organizationId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }

    const service = serviceResult.rows[0];
    const [cyclesResult, refundsResult] = await Promise.all([
      query(
        `SELECT hbc.id, hbc.cycle_type, hbc.period_start, hbc.period_end, hbc.amount,
                hbc.currency, hbc.status, hbc.failure_reason, hbc.payment_transaction_id,
                hbc.invoice_id, hbc.refunded_amount, hbc.created_at,
                bi.invoice_number
         FROM hosting_billing_cycles hbc
         LEFT JOIN billing_invoices bi ON bi.id = hbc.invoice_id
         WHERE hbc.organization_id = $1
           AND hbc.hosting_subscription_id = $2
         ORDER BY hbc.period_start DESC
         LIMIT 24`,
        [organizationId, id]
      ),
      query(
        `SELECT id, amount, currency, reason, status, original_transaction_id,
                original_hosting_billing_cycle_id, created_at, updated_at
         FROM refunds
         WHERE organization_id = $1
           AND original_hosting_subscription_id = $2
         ORDER BY created_at DESC
         LIMIT 24`,
        [organizationId, id]
      ),
    ]);

    const latestFailedCycle = cyclesResult.rows.find((cycle: any) => cycle.status === 'failed');
    const nextBillingAt = service.next_billing_at ? new Date(service.next_billing_at) : null;
    const paymentStatus =
      service.status === 'suspended' && latestFailedCycle
        ? 'past_due'
        : nextBillingAt && nextBillingAt.getTime() <= Date.now()
          ? 'due'
          : 'current';

    res.json({
      billing: {
        subscriptionId: service.id,
        domain: service.domain,
        planName: service.plan_name,
        renewalAmount: service.price_monthly ? parseFloat(service.price_monthly) : 0,
        currency: 'USD',
        status: service.status,
        paymentStatus,
        nextBillingAt: service.next_billing_at,
        lastBilledAt: service.last_billed_at,
        hostingWalletBalance: parseFloat(service.hosting_wallet_balance ?? 0),
        latestFailureReason: latestFailedCycle?.failure_reason ?? null,
        cycles: cyclesResult.rows.map((cycle: any) => ({
          ...cycle,
          amount: parseFloat(cycle.amount),
          refunded_amount: parseFloat(cycle.refunded_amount ?? 0),
        })),
        refunds: refundsResult.rows.map((refund: any) => ({
          ...refund,
          amount: parseFloat(refund.amount),
        })),
      },
    });
  } catch (error: any) {
    console.error("Failed to get hosting billing:", error);
    res.status(500).json({ error: error?.message || "Failed to get hosting billing" });
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
        return res.json({ bandwidth: null });
      }

      const enhanceOrgId = getEnhanceWebsiteOrgId(subscription as any);
      const subId = String(subscription.enhance_subscription_id);
      const refreshCache = readBooleanQuery(req.query.refreshCache);
      const metricsRange = getCurrentMonthUtcRange();

      // Fetch subscription-level current-month bandwidth, quota, and website metrics in parallel.
      const [rawBandwidth, subscriptionDetails, metricsResult] = await Promise.all([
        EnhanceService.getSubscriptionBandwidth(enhanceOrgId, subId, { refreshCache }),
        EnhanceService.getSubscription(enhanceOrgId, subId).catch(() => null),
        subscription.enhance_website_id
          ? EnhanceService.getWebsiteMetrics(enhanceOrgId, String(subscription.enhance_website_id), {
              ...metricsRange,
              granularity: "day",
            }).catch((error) => ({ __error: error?.message || "Failed to load website metrics" }))
          : Promise.resolve(null),
      ]);

      const used = normalizeBandwidthBytes(rawBandwidth);

      // Extract transfer quota and tracked usage from the subscription resources.
      let limit: number | null = null;
      let transferTrackedUsageBytes: number | null = null;
      if (subscriptionDetails?.resources && Array.isArray(subscriptionDetails.resources)) {
        const transferResource = subscriptionDetails.resources.find(
          (r: any) => String(r?.name ?? "").toLowerCase() === "transfer"
        );
        if (transferResource) {
          // total is null/undefined when the plan has unlimited transfer
          limit = readNumber(transferResource.total);
          transferTrackedUsageBytes = readNumber(transferResource.usage);
        }
      }

      const metricsMonthToDate = metricsResult && !(metricsResult as any).__error
        ? aggregateMetricsResponse(metricsResult, metricsRange, "day")
        : null;

      const percentage = used !== null && limit !== null && limit > 0
        ? Math.round((used / limit) * 10000) / 100
        : null;

      res.json({
        bandwidth: used !== null || limit !== null || transferTrackedUsageBytes !== null || metricsMonthToDate
          ? {
              // Backward-compatible names used by the existing card.
              used,
              limit,
              percentage,

              // Explicit Enhance/OpenAPI names for the richer Overview UI.
              monthlyTransferBytes: used,
              transferQuotaBytes: limit,
              transferUnlimited: limit === null,
              transferTrackedUsageBytes,
              refreshRequested: refreshCache === true,
              cacheNote: "Enhance caches current-month subscription bandwidth for up to 12 hours unless refreshCache=true.",
              billingPeriod: {
                label: "Current calendar month",
                source: "Enhance subscription bandwidth endpoint",
              },
              resellerNote: "For reseller subscriptions, Enhance may include all customer subscriptions.",
              metricsMonthToDate,
              metricsError: metricsResult && (metricsResult as any).__error ? (metricsResult as any).__error : null,
            }
          : null,
      });
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
  let billingCycleId: string | undefined;

  try {
    const result = await transaction(async (client) => {
      return HostingBillingService.createInitialPurchaseCharge(client, {
        organizationId,
        userId,
        planId,
        domain: requestedDomain,
      });
    });

    // Remote Enhance calls (outside the initial DB transaction)
    const { subscription, plan } = result;
    subscriptionId = subscription.id;
    billingCycleId = result.billingCycleId;

    let onboardingResult;
    try {
      onboardingResult = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
        organizationId,
        purchaserUserId: userId,
      });
      enhanceCustomerOrgId = onboardingResult.enhanceCustomerId;

      // Belt-and-suspenders: also persist member id from purchase flow
      if (onboardingResult.purchaserMemberId) {
        await query(
          `UPDATE organizations SET enhance_member_id = $1 WHERE id = $2`,
          [onboardingResult.purchaserMemberId, organizationId]
        );
      }
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
      enhanceWebsite = { id: websiteId, serverIps: [] };
    }

    const serverIps = Array.isArray(enhanceWebsite?.serverIps) ? enhanceWebsite.serverIps : [];
    const primaryIp = serverIps.find((ip: any) => ip.isPrimary)?.ip
      || serverIps[0]?.ip
      || null;

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
           settings = COALESCE(settings, '{}'::jsonb) || $4::jsonb,
           updated_at = now()
       WHERE id = $5`,
      [
        enhanceSubscription.id,
        enhanceWebsite.id,
        primaryIp,
        JSON.stringify({ primary_ip: primaryIp }),
        subscription.id,
      ]
    );

    let invoiceId: string | null = null;
    try {
      invoiceId = await HostingBillingService.ensureInvoiceForCycle(result.billingCycleId, userId);
    } catch (invoiceError) {
      console.error("Failed to create hosting purchase invoice (non-fatal):", invoiceError);
    }

    await logActivity({
      userId,
      organizationId,
      eventType: "hosting.purchase.completed",
      entityType: "hosting_subscription",
      entityId: subscription.id,
      message: `Purchased hosting plan ${plan.name} for ${resolvedDomain}`,
      status: "success",
      metadata: {
        plan_id: planId,
        domain: resolvedDomain,
        enhance_subscription_id: enhanceSubscription.id,
        hosting_billing_cycle_id: result.billingCycleId,
        invoice_id: invoiceId,
      },
    });

    res.status(201).json({
      subscription: { ...subscription, status: "active", domain: resolvedDomain },
      invoiceId,
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

    if (enhanceCustomerOrgId && remoteEnhanceSubscriptionId && createdRemoteSubscription) {
      try {
        await EnhanceService.deleteSubscription(enhanceCustomerOrgId, remoteEnhanceSubscriptionId, { force: true });
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

    if (billingCycleId) {
      try {
        await query(
          `UPDATE hosting_billing_cycles
           SET status = 'cancelled',
               failure_reason = $2,
               updated_at = now()
           WHERE id = $1`,
          [billingCycleId, error?.message || "Hosting purchase failed"]
        );
      } catch (cycleUpdateError) {
        console.error("Failed to cancel hosting billing cycle after purchase error:", cycleUpdateError);
      }
    }

    // Compensating credit on failure
    if (subscriptionId) {
      try {
        const planResult = await query(`SELECT price_monthly FROM hosting_plans WHERE id = $1`, [planId]);
        if (planResult.rows.length > 0) {
          const amount = parseFloat(planResult.rows[0].price_monthly);
          await transaction(async (rollbackClient) => {
            await rollbackClient.query(
              `INSERT INTO hosting_wallets (organization_id, balance, currency)
               VALUES ($1, 0, 'USD')
               ON CONFLICT (organization_id) DO NOTHING`,
              [organizationId]
            );
            await rollbackClient.query(
              `UPDATE hosting_wallets SET balance = balance + $1 WHERE organization_id = $2`,
              [amount, organizationId]
            );
            await rollbackClient.query(
              `INSERT INTO payment_transactions (organization_id, amount, payment_method, payment_provider, status, description, metadata)
               VALUES ($1, $2, 'wallet_credit', 'internal', 'completed', $3, $4)`,
              [
                organizationId,
                amount,
                "Hosting purchase rollback",
                JSON.stringify({
                  reason: error.message,
                  wallet_type: 'hosting',
                  hosting_subscription_id: subscriptionId,
                  hosting_billing_cycle_id: billingCycleId || null,
                }),
              ]
            );
          });
        }
      } catch (rollbackError) {
        console.error("Failed to rollback hosting purchase:", rollbackError);
      }
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
    const enhanceCustomerOrgId = sub.enhance_customer_org_id;

    if (!enhanceCustomerOrgId && (sub.enhance_website_id || sub.enhance_subscription_id)) {
      return res.status(500).json({
        error: "Cannot cancel: organization is missing Enhance customer ID. Contact support.",
      });
    }

    if (sub.status === 'cancelled') {
      return res.status(400).json({ error: "Subscription is already cancelled" });
    }

    if (sub.enhance_website_id) {
      try {
        await EnhanceService.deleteWebsite(enhanceCustomerOrgId, sub.enhance_website_id);
      } catch (enhanceErr) {
        const statusCode = enhanceErr instanceof EnhanceApiError
          ? (enhanceErr.statusCode || 502)
          : 502;
        const errorMessage = enhanceErr instanceof Error ? enhanceErr.message : "unknown error";

        await logActivity({
          userId,
          organizationId,
          eventType: "hosting.cancel.failed",
          entityType: "hosting_subscription",
          entityId: id,
          message: "Failed to delete Enhance website during cancellation",
          status: "error",
          metadata: {
            failed_step: "delete_website",
            enhance_org_id: enhanceCustomerOrgId,
            enhance_website_id: sub.enhance_website_id,
            enhance_subscription_id: sub.enhance_subscription_id ?? null,
            error: errorMessage,
          },
        });

        return res.status(statusCode).json({
          error: `Failed to delete Enhance website: ${errorMessage}`,
          failed_step: "delete_website",
        });
      }
    }

    if (sub.enhance_subscription_id) {
      try {
        await EnhanceService.deleteSubscription(enhanceCustomerOrgId, sub.enhance_subscription_id);
      } catch (enhanceErr) {
        const statusCode = enhanceErr instanceof EnhanceApiError
          ? (enhanceErr.statusCode || 502)
          : 502;
        const errorMessage = enhanceErr instanceof Error ? enhanceErr.message : "unknown error";

        await logActivity({
          userId,
          organizationId,
          eventType: "hosting.cancel.failed",
          entityType: "hosting_subscription",
          entityId: id,
          message: "Failed to delete Enhance subscription during cancellation",
          status: "error",
          metadata: {
            failed_step: "delete_subscription",
            enhance_org_id: enhanceCustomerOrgId,
            enhance_website_id: sub.enhance_website_id ?? null,
            enhance_subscription_id: sub.enhance_subscription_id,
            error: errorMessage,
          },
        });

        return res.status(statusCode).json({
          error: `Failed to delete Enhance subscription: ${errorMessage}`,
          failed_step: "delete_subscription",
        });
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
    let memberIdWasStale = false;

    async function resolveMemberId(): Promise<boolean> {
      if (memberId) return true;
      try {
        const members = await EnhanceService.getOrgMembers(enhanceCustomerOrgId);
        const items = Array.isArray(members) ? members : (members?.items || []);
        const preferred = items.find((m: any) => Array.isArray(m.roles) && (m.roles.includes('Owner') || m.roles.includes('SuperAdmin')));
        memberId = preferred?.id || items?.[0]?.id;

        if (memberId) {
          await query(
            `UPDATE organizations SET enhance_member_id = $1 WHERE id = $2`,
            [memberId, organizationId]
          );
          return true;
        }
        return false;
      } catch (memberError: any) {
        if (memberError instanceof EnhanceApiError) {
          const status = memberError.statusCode || 502;
          const message = memberError.statusCode === 403
            ? "Unable to access Enhance organization members. The API key may not have permission for this customer org."
            : `Unable to list Enhance organization members: ${memberError.message}`;
          res.status(status).json({ error: message });
          return false;
        }
        throw memberError;
      }
    }

    if (!await resolveMemberId()) {
      return res.status(400).json({ error: "No Enhance member found for this organization" });
    }

    async function tryGetSsoUrl(): Promise<string | null> {
      try {
        const ssoResponse = await EnhanceService.getMemberSsoLink(enhanceCustomerOrgId, memberId) as string | { url?: string };
        const url = typeof ssoResponse === "string" ? ssoResponse : ssoResponse?.url;
        return url || null;
      } catch (ssoError: any) {
        // If member not found (404), clear stale member id and allow one retry
        if (ssoError instanceof EnhanceApiError && ssoError.statusCode === 404 && !memberIdWasStale) {
          console.log(`[SSO] Member ${memberId} not found in Enhance (404). Clearing stale member id and retrying...`);
          await query(
            `UPDATE organizations SET enhance_member_id = NULL WHERE id = $1`,
            [organizationId]
          );
          memberId = null;
          memberIdWasStale = true;
          return null;
        }

        if (ssoError instanceof EnhanceApiError) {
          const status = ssoError.statusCode || 502;
          const message = ssoError.statusCode === 403
            ? "Unable to generate SSO link for this member. The API key may not have permission."
            : `Unable to generate SSO link: ${ssoError.message}`;
          res.status(status).json({ error: message });
          return null;
        }
        throw ssoError;
      }
    }

    let url = await tryGetSsoUrl();

    // Retry once if the first attempt discovered a stale member id
    if (!url && memberIdWasStale) {
      if (!await resolveMemberId()) {
        return res.status(400).json({ error: "No Enhance member found for this organization" });
      }
      url = await tryGetSsoUrl();
    }

    if (!url) {
      return res.status(502).json({ error: "Enhance did not return an SSO link" });
    }

    res.json({ url });
  } catch (error: any) {
    console.error("Failed to get Enhance SSO link:", error);
    res.status(500).json({ error: error?.message || "Failed to get SSO link" });
  }
});

export default router;
