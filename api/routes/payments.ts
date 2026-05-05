/**
 * Payment Routes for SkyPanelV2
 * Handles PayPal payments, wallet management, and billing
 */

import express, { Request, Response } from "express";
import {
  body,
  param,
  query as queryValidator,
  validationResult,
} from "express-validator";
import { PayPalService } from "../services/paypalService.js";
import { BillingService } from "../services/billingService.js";
import { authenticateToken, requireOrganization } from "../middleware/auth.js";
import { billingMutationRateLimiter } from "../middleware/rateLimiting.js";
import { query as dbQuery } from "../lib/database.js";
import { resolveClientBaseUrl } from "../lib/clientBaseUrl.js";
import { config } from "../config/index.js";
import { logActivity } from "../services/activityLogger.js";
import { RoleService } from "../services/roles.js";
import { FraudLabsProService } from "../services/fraudLabsProService.js";
import { HostingBillingService } from "../services/hostingBillingService.js";
import { getClientIP } from "../lib/ipDetection.js";

const router = express.Router();

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
    [key: string]: unknown;
  };
};

const safeParseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseMetadata = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Note: If a PayPal webhook route is added in the future, it must be declared
// BEFORE the requireOrganization guard to allow unauthenticated PayPal callbacks.

// Apply organization guard to all authenticated routes
router.use(requireOrganization);

router.get("/config", (req: Request, res: Response) => {
  if (!config.PAYPAL_CLIENT_ID) {
    return res.status(503).json({
      success: false,
      error: "PayPal configuration is unavailable. Please contact support.",
    });
  }

  const disableFunding = ["paylater", "credit"];

  res.json({
    success: true,
    config: {
      clientId: config.PAYPAL_CLIENT_ID,
      currency: "USD",
      intent: "capture",
      mode:
        config.PAYPAL_MODE === "production" || config.PAYPAL_MODE === "live"
          ? "live"
          : "sandbox",
      disableFunding,
      brandName: config.COMPANY_BRAND_NAME,
    },
  });
});

/**
 * Create a payment intent for adding funds to wallet
 */
router.post(
  "/create-payment",
  billingMutationRateLimiter,
  [
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be at least 0.01"),
    body("currency")
      .isIn(["USD", "EUR", "GBP"])
      .withMessage("Currency must be USD, EUR, or GBP"),
    body("description")
      .isLength({ min: 1, max: 255 })
      .withMessage(
        "Description is required and must be less than 255 characters",
      ),
    body("walletType")
      .optional()
      .isIn(["main", "hosting"])
      .withMessage("Wallet type must be main or hosting"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { amount, currency, description } = req.body;
      const walletType = req.body.walletType === "hosting" ? "hosting" : "main";
      const amountValue = safeParseNumber(amount);
      if (amountValue === null) {
        return res.status(400).json({
          success: false,
          error: "Invalid payment amount",
        });
      }
      const { id: userId, organizationId } = (req as AuthenticatedRequest).user;

      // FraudLabsPro screening on wallet top-up
      const fraudResult = await FraudLabsProService.screen({
        ip: getClientIP(req).ip,
        email: (req as any).user?.email,
        amount: amountValue,
        currency,
        checkType: 'wallet_topup',
        userId,
        organizationId,
      });
      if (fraudResult.action === 'blocked') {
        return res.status(403).json({
          success: false,
          error: 'Payment blocked',
          message: fraudResult.reason || 'This payment was blocked due to security concerns.',
        });
      }

      const clientBaseUrl = resolveClientBaseUrl(req);

      const result = await PayPalService.createPayment({
        amount: amountValue,
        currency,
        description,
        organizationId,
        userId,
        clientBaseUrl,
        walletType,
      });

      if (result.success) {
        res.json({
          success: true,
          paymentId: result.paymentId,
          approvalUrl: result.approvalUrl,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Create payment error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Capture a PayPal payment after user approval
 */
router.post(
  "/capture-payment/:orderId",
  billingMutationRateLimiter,
  [param("orderId").isLength({ min: 1 }).withMessage("Order ID is required")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { orderId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      const organizationId = authReq.user?.organizationId ?? null;

      const orderCheck = await dbQuery(
        "SELECT organization_id, status, metadata FROM payment_transactions WHERE provider_transaction_id = $1 OR id::text = $1 ORDER BY created_at DESC LIMIT 1",
        [orderId]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Payment record not found",
        });
      }

      const order = orderCheck.rows[0];
      if (order.organization_id !== organizationId) {
        console.warn(`[Security] Unauthorized payment capture attempt: User ${userId} tried to capture order ${orderId} belonging to org ${order.organization_id}`);
        return res.status(403).json({
          success: false,
          error: "Unauthorized: This payment does not belong to your organization",
        });
      }

      if (order.status === 'completed') {
        return res.status(400).json({
          success: false,
          error: "Payment has already been captured",
        });
      }

      const result = await PayPalService.capturePayment(orderId, organizationId ?? undefined);

      if (result.success) {
        const metadata = parseMetadata(order.metadata);
        let hostingRecovery: Awaited<ReturnType<typeof HostingBillingService.retryOverdueForOrganization>> | null = null;
        if (metadata.wallet_type === "hosting" && organizationId) {
          try {
            hostingRecovery = await HostingBillingService.retryOverdueForOrganization(organizationId, userId);
          } catch (recoveryError) {
            console.error("Failed to retry overdue hosting billing after PayPal capture:", recoveryError);
          }
        }

        if (userId) {
          try {
            await logActivity(
              {
                userId,
                organizationId,
                eventType: "billing.payment.completed",
                entityType: "payment_transaction",
                entityId: orderId,
                message: `Payment ${orderId} was captured and your wallet was credited.`,
                status: "success",
                metadata: {
                  order_id: orderId,
                  provider: "paypal",
                  wallet_type: metadata.wallet_type ?? "main",
                  hosting_recovery: hostingRecovery,
                },
              },
              req,
            );
          } catch {}
        }
        res.json({
          success: true,
          paymentId: result.paymentId,
          hostingRecovery,
        });
      } else {
        if (userId) {
          try {
            await logActivity(
              {
                userId,
                organizationId,
                eventType: "billing.payment.failed",
                entityType: "payment_transaction",
                entityId: orderId,
                message: `Payment ${orderId} failed to capture.`,
                status: "error",
                metadata: {
                  order_id: orderId,
                  provider: "paypal",
                  error: result.error || null,
                },
              },
              req,
            );
          } catch {}
        }
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Capture payment error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Get wallet balance for the organization
 */
router.get(
  "/wallet/balance",
  async (req: Request, res: Response) => {
    try {
      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;

      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_view'
      );

      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const balance = await PayPalService.getWalletBalance(organizationId);

      // Return 0 balance if wallet doesn't exist yet (instead of 404)
      res.json({
        success: true,
        balance: balance ?? 0,
      });
    } catch (error) {
      console.error("Get wallet balance error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

router.get(
  "/wallet/hosting/balance",
  async (req: Request, res: Response) => {
    try {
      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;
      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_view'
      );

      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const balance = await PayPalService.getHostingWalletBalance(organizationId);

      res.json({
        success: true,
        balance: balance ?? 0,
      });
    } catch (error) {
      console.error("Get hosting wallet balance error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

router.post(
  "/wallet/hosting/fund",
  billingMutationRateLimiter,
  [
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;
      const amount = safeParseNumber(req.body.amount);
      if (amount === null || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid transfer amount" });
      }

      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_manage'
      );

      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const success = await PayPalService.transferToHostingWallet(
        organizationId,
        amount,
        userId
      );

      if (!success) {
        return res.status(400).json({
          success: false,
          error: "Failed to fund hosting wallet. Check your main wallet balance.",
        });
      }

      try {
        const hostingRecovery = await HostingBillingService.retryOverdueForOrganization(
          organizationId,
          userId
        );

        await logActivity(
          {
            userId,
            organizationId,
            eventType: "billing.hosting_wallet.funded",
            entityType: "hosting_wallet",
            entityId: organizationId,
            message: "Hosting wallet was funded from the main wallet.",
            status: "success",
            metadata: { amount, hosting_recovery: hostingRecovery },
          },
          req,
        );
      } catch (activityError) {
        console.warn("Failed to log hosting wallet funding activity:", activityError);
      }

      res.json({
        success: true,
        message: "Hosting wallet funded successfully",
      });
    } catch (error) {
      console.error("Fund hosting wallet error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

router.post(
  "/wallet/hosting/withdraw",
  billingMutationRateLimiter,
  [
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;
      const amount = safeParseNumber(req.body.amount);
      if (amount === null || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid transfer amount" });
      }

      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_manage'
      );

      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const success = await PayPalService.transferFromHostingToMainWallet(
        organizationId,
        amount,
        userId
      );

      if (!success) {
        return res.status(400).json({
          success: false,
          error: "Failed to withdraw from hosting wallet. Check your hosting wallet balance.",
        });
      }

      try {
        await logActivity(
          {
            userId,
            organizationId,
            eventType: "billing.hosting_wallet.withdrawn",
            entityType: "hosting_wallet",
            entityId: organizationId,
            message: "Funds were moved from the hosting wallet to the main wallet.",
            status: "success",
            metadata: { amount },
          },
          req,
        );
      } catch (activityError) {
        console.warn("Failed to log hosting wallet withdrawal activity:", activityError);
      }

      res.json({
        success: true,
        message: "Hosting wallet funds transferred to main wallet successfully",
      });
    } catch (error) {
      console.error("Withdraw hosting wallet error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Deduct funds from wallet for VPS creation
 */
router.post(
  "/wallet/deduct",
  billingMutationRateLimiter,
  [
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
    body("description")
      .isLength({ min: 1, max: 255 })
      .withMessage(
        "Description is required and must be less than 255 characters",
      ),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { amount, description } = req.body;
      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;

      // Security: Check for billing_manage or vps_create permission
      const hasPermission = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_manage'
      ) || await RoleService.checkPermission(
        userId,
        organizationId,
        'vps_create'
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: "Insufficient permissions to deduct from wallet",
        });
      }

      const success = await PayPalService.deductFundsFromWallet(
        organizationId,
        amount,
        description,
      );

      if (success) {
        res.json({
          success: true,
          message: "Funds deducted successfully",
        });
      } else {
        res.status(400).json({
          success: false,
          error:
            "Failed to deduct funds. Insufficient balance or wallet not found.",
        });
      }
    } catch (error) {
      console.error("Deduct funds error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Get wallet transactions for the organization
 */
router.get(
  "/wallet/transactions",
  [
    queryValidator("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    queryValidator("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be a non-negative integer"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // only members with the billing_view permission may access the
      // organization wallet.  others receive a 403 to prevent viewing
      // other users' transactions.
      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_view'
      );
      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const transactions = await PayPalService.getWalletTransactions(
        organizationId,
        limit,
        offset,
      );

      res.json({
        success: true,
        transactions,
        pagination: {
          limit,
          offset,
          hasMore: transactions.length === limit,
        },
      });
    } catch (error) {
      console.error("Get wallet transactions error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Get payment history for the organization
 */
router.get(
  "/history",
  [
    queryValidator("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    queryValidator("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be a non-negative integer"),
    queryValidator("status")
      .optional()
      .isIn(["completed", "failed", "cancelled", "refunded"])
      .withMessage(
        "Status must be completed, failed, cancelled, or refunded",
      ),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { organizationId } = (req as AuthenticatedRequest).user;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      const whereClauses: string[] = ["organization_id = $1"];
      const params: Array<string | number> = [organizationId];

      if (status) {
        params.push(status);
        whereClauses.push(`status = $${params.length}`);
      }

      params.push(limit);
      const limitParamIndex = params.length;
      params.push(offset);
      const offsetParamIndex = params.length;

      const sql = `SELECT id, organization_id, amount, currency, description, status, payment_provider AS provider, provider_transaction_id AS provider_payment_id, created_at, updated_at
                   FROM payment_transactions
                   WHERE ${whereClauses.join(" AND ")}
                   ORDER BY created_at DESC
                   LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

      const result = await dbQuery(sql, params);

      res.json({
        success: true,
        payments: result.rows || [],
        pagination: {
          limit,
          offset,
          hasMore: (result.rows || []).length === limit,
        },
      });
    } catch (error) {
      console.error("Get payment history error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Get details for a specific payment transaction
 */
router.get(
  "/transactions/:id",
  [param("id").isUUID().withMessage("Transaction ID must be a valid UUID")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const transactionId = req.params.id;
      const { organizationId } = (req as AuthenticatedRequest).user;

      const result = await dbQuery(
        `SELECT id, organization_id, amount, currency, payment_method, payment_provider, provider_transaction_id, status, description, metadata, created_at, updated_at
         FROM payment_transactions
         WHERE id = $1 AND organization_id = $2`,
        [transactionId, organizationId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Transaction not found",
        });
      }

      const row = result.rows[0];
      const amount = safeParseNumber(row.amount) ?? 0;
      const metadataRaw =
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata;
      const metadata =
        metadataRaw && typeof metadataRaw === "object" ? metadataRaw : null;
      const metadataBalance =
        metadata?.balance_after ??
        metadata?.balanceAfter ??
        metadata?.balance ??
        null;
      const balanceAfter = safeParseNumber(metadataBalance);
      const metadataBalanceBefore =
        metadata?.balance_before ?? metadata?.balanceBefore ?? null;
      const balanceBefore =
        safeParseNumber(metadataBalanceBefore) ??
        (balanceAfter !== null
          ? parseFloat((balanceAfter - amount).toFixed(6))
          : null);

      res.json({
        success: true,
        transaction: {
          id: row.id,
          organizationId: row.organization_id,
          amount,
          currency: row.currency,
          paymentMethod: row.payment_method,
          provider: row.payment_provider,
          providerPaymentId: row.provider_transaction_id,
          status: row.status,
          description: row.description || "Wallet transaction",
          type: amount >= 0 ? "credit" : "debit",
          balanceBefore,
          balanceAfter,
          metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      console.error("Get transaction details error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Create a refund/payout
 */
router.post(
  "/refund",
  billingMutationRateLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Amount must be a positive number"),
    body("currency")
      .isIn(["USD", "EUR", "GBP"])
      .withMessage("Currency must be USD, EUR, or GBP"),
    body("reason")
      .isLength({ min: 1, max: 255 })
      .withMessage("Reason is required and must be less than 255 characters"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { email, amount, currency, reason } = req.body;
      const { id: userId, organizationId } = (req as AuthenticatedRequest).user;

      // Check if organization has sufficient funds
      const balance = await PayPalService.getWalletBalance(organizationId);
      if (balance === null || balance < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          error: "Insufficient funds for refund",
        });
      }

      // Create payout
      const result = await PayPalService.createPayout(
        email,
        parseFloat(amount),
        currency,
        reason,
      );

      if (result.success) {
        // Deduct funds from wallet
        await PayPalService.deductFundsFromWallet(
          organizationId,
          parseFloat(amount),
          `Refund: ${reason}`,
        );

        try {
          await logActivity(
            {
              userId,
              organizationId,
              eventType: "billing.refund.completed",
              entityType: "payment_transaction",
              entityId: result.paymentId || null,
              message: `Refund of ${amount} ${currency} was sent to ${email}.`,
              status: "success",
              metadata: {
                recipient_email: email,
                amount: parseFloat(amount),
                currency,
                reason,
                payout_id: result.paymentId || null,
              },
            },
            req,
          );
        } catch {}

        res.json({
          success: true,
          payoutId: result.paymentId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Create refund error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  },
);

/**
 * Get billing summary for the organization
 * Returns monthly spending totals and statistics
 */
router.get(
  "/billing/summary",
  async (req: Request, res: Response) => {
    try {
      const { organizationId, id: userId } = (req as AuthenticatedRequest).user;

      const hasBilling = await RoleService.checkPermission(
        userId,
        organizationId,
        'billing_view'
      );
      if (!hasBilling) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }

      const summary = await BillingService.getBillingSummary(organizationId);

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error("Get billing summary error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load billing summary",
      });
    }
  },
);

export default router;
