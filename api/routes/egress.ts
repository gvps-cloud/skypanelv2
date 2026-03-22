/**
 * Egress Credit Routes for SkyPanelV2
 * Handles pre-paid egress credits for hourly billing enforcement
 */

import express, { Request, Response } from "express";
import {
  body,
  param,
  validationResult,
} from "express-validator";
import { PayPalService } from "../services/paypalService.js";
import { authenticateToken, requireOrganization, requireAdmin } from "../middleware/auth.js";
import {
  getEgressCreditBalanceDetails,
  getEgressCreditPurchaseHistory,
  getAvailableCreditPacks,
  purchaseEgressCredits,
  addEgressCredits,
  removeEgressCredits,
  getVPSHourlyUsage,
  getVPSMonthlyCreditsUsed,
} from "../services/egressCreditService.js";
import { EgressHourlyBillingService } from "../services/egressHourlyBillingService.js";
import { logActivity } from "../services/activityLogger.js";
import { query as dbQuery, transaction } from "../lib/database.js";

const router = express.Router();

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
    role: string;
    email?: string;
    [key: string]: unknown;
  };
};

// Helper to safely parse numbers
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

const parsePackSettingsValue = (value: unknown): unknown[] => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  return Array.isArray(parsed) ? parsed : [];
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/egress/credits
 * Get current egress credit balance for the organization
 */
router.get("/credits", requireOrganization, async (req: Request, res: Response) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const balanceDetails = await getEgressCreditBalanceDetails(organizationId);

    res.json({
      success: true,
      data: balanceDetails,
    });
  } catch (error) {
    console.error("Error getting egress credit balance:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get credit balance",
    });
  }
});

/**
 * GET /api/egress/credits/packs
 * Get available credit packs for purchase
 */
router.get("/credits/packs", async (req: Request, res: Response) => {
  try {
    const packs = await getAvailableCreditPacks();

    res.json({
      success: true,
      data: packs,
    });
  } catch (error) {
    console.error("Error getting available credit packs:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get credit packs",
    });
  }
});

/**
 * POST /api/egress/credits/purchase
 * Initialize purchase of egress credit pack
 * Pack IDs are validated against database configuration, not hardcoded
 */
router.post(
  "/credits/purchase",
  requireOrganization,
  [
    body("packId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Pack ID is required"),
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

      const { packId } = req.body;
      const { id: userId, organizationId } = (req as AuthenticatedRequest).user;

      // Get available packs from database configuration
      const packs = await getAvailableCreditPacks();
      const pack = packs.find((p) => p.id === packId);

      if (!pack) {
        return res.status(404).json({
          success: false,
          error: "Credit pack not found",
        });
      }

      // Determine client base URL for return URLs
      const originHeader =
        typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      const forwardedProto =
        typeof req.headers["x-forwarded-proto"] === "string"
          ? req.headers["x-forwarded-proto"]
          : undefined;
      const forwardedHost =
        typeof req.headers["x-forwarded-host"] === "string"
          ? req.headers["x-forwarded-host"]
          : undefined;
      const host = req.get("host");

      let clientBaseUrl = process.env.CLIENT_URL;
      if (!clientBaseUrl) {
        if (originHeader) {
          clientBaseUrl = originHeader;
        } else if (forwardedHost) {
          const proto = forwardedProto || req.protocol;
          clientBaseUrl = `${proto}://${forwardedHost}`;
        } else if (host) {
          clientBaseUrl = `${req.protocol}://${host}`;
        } else {
          clientBaseUrl = "http://localhost:5173";
        }
      }

      // Create PayPal payment
      const result = await PayPalService.createPayment({
        amount: pack.price,
        currency: "USD",
        description: `Egress Credit Pack: ${pack.id} (${pack.gb}GB)`,
        organizationId,
        userId,
        clientBaseUrl,
      });

      if (result.success) {
        // Store pending purchase info in session/temp storage for completion
        // We'll use a simple approach: store in metadata with expiration
        res.json({
          success: true,
          paymentId: result.paymentId,
          approvalUrl: result.approvalUrl,
          packId,
          amount: pack.price,
          creditsGb: pack.gb,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to create payment",
        });
      }
    } catch (error) {
      console.error("Error creating egress credit purchase:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create purchase",
      });
    }
  }
);

/**
 * POST /api/egress/credits/purchase/complete
 * Complete purchase after PayPal approval
 * This is called from the success return page
 */
router.post(
  "/credits/purchase/complete",
  requireOrganization,
  [
    body("paymentId")
      .isString()
      .withMessage("Payment ID is required"),
    body("packId")
      .isString()
      .withMessage("Pack ID is required"),
    body("organizationId")
      .isUUID()
      .withMessage("Organization ID is required"),
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

      const { paymentId, packId, organizationId } = req.body;
      const { id: userId } = (req as AuthenticatedRequest).user;

      // Verify user is a member of this organization
      const memberCheck = await dbQuery(
        `SELECT 1 FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [userId, organizationId],
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: "You are not a member of this organization",
        });
      }

      // Verify the payment was captured
      const transactionResult = await dbQuery(
        `SELECT id, amount, currency, status
         FROM payment_transactions
         WHERE paypal_order_id = $1 AND organization_id = $2`,
        [paymentId, organizationId],
      );

      if (transactionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      const transaction = transactionResult.rows[0];

      if (transaction.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Payment not completed",
        });
      }

      // Check if credits were already applied for this transaction
      const existingPurchaseResult = await dbQuery(
        `SELECT id FROM egress_credit_packs WHERE payment_transaction_id = $1`,
        [transaction.id],
      );

      if (existingPurchaseResult.rows.length > 0) {
        return res.json({
          success: true,
          message: "Credits already applied",
          data: { purchaseId: existingPurchaseResult.rows[0].id },
        });
      }

      // Apply the credits
      await purchaseEgressCredits(organizationId, packId, transaction.id, userId);

      const balanceDetails = await getEgressCreditBalanceDetails(organizationId);

      res.json({
        success: true,
        message: "Egress credits purchased successfully",
        data: {
          newBalance: balanceDetails.creditsGb,
          warning: balanceDetails.warning,
        },
      });
    } catch (error) {
      console.error("Error completing egress credit purchase:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete purchase",
      });
    }
  }
);

/**
 * GET /api/egress/credits/wallet-balance
 * Get current wallet balance for the organization (for purchase dialog)
 */
router.get("/credits/wallet-balance", requireOrganization, async (req: Request, res: Response) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;

    const walletResult = await dbQuery(
      'SELECT balance FROM wallets WHERE organization_id = $1',
      [organizationId],
    );

    if (walletResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { balance: 0 },
      });
    }

    res.json({
      success: true,
      data: { balance: Number(walletResult.rows[0].balance) },
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get wallet balance",
    });
  }
});

/**
 * POST /api/egress/credits/purchase/wallet
 * Purchase egress credits using existing wallet balance
 */
router.post(
  "/credits/purchase/wallet",
  requireOrganization,
  [
    body("organizationId").isUUID().withMessage("Organization ID is required"),
    body("packId").isString().trim().notEmpty().withMessage("Pack ID is required"),
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

      const { organizationId, packId } = req.body;
      const { id: userId } = (req as AuthenticatedRequest).user;

      // Verify the user belongs to this organization
      const { organizationId: userOrgId } = (req as AuthenticatedRequest).user;
      if (userOrgId !== organizationId) {
        return res.status(403).json({
          success: false,
          error: "You do not have permission to purchase credits for this organization",
        });
      }

      // Get credit pack configuration
      const packs = await getAvailableCreditPacks();
      const pack = packs.find((p) => p.id === packId);

      if (!pack) {
        return res.status(404).json({
          success: false,
          error: "Credit pack not found",
        });
      }

      // Check wallet balance
      const walletResult = await dbQuery(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [organizationId],
      );

      if (walletResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Wallet not found for organization",
        });
      }

      const currentBalance = Number(walletResult.rows[0].balance);

      if (currentBalance < pack.price) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. Required: $${pack.price.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`,
        });
      }

      // Perform wallet deduction + egress credit addition in a transaction
      await transaction(async (client) => {
        // Deduct from wallet
        await client.query(
          'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE organization_id = $2',
          [pack.price, organizationId],
        );

        // Record wallet deduction as a transaction
        await client.query(
          `INSERT INTO payment_transactions (organization_id, amount, currency, payment_method, payment_provider, status, description, metadata)
           VALUES ($1, $2, 'USD', 'wallet_debit', 'internal', 'completed', $3, $4)`,
          [organizationId, -pack.price, `Egress credit pack purchase: ${pack.id} (${pack.gb}GB)`, JSON.stringify({ packId: pack.id, creditsGb: pack.gb })],
        );

        // Add egress credits
        await client.query(
          `INSERT INTO organization_egress_credits (organization_id, credits_gb)
           VALUES ($1, $2)
           ON CONFLICT (organization_id)
           DO UPDATE SET credits_gb = organization_egress_credits.credits_gb + EXCLUDED.credits_gb,
                        updated_at = NOW()`,
          [organizationId, pack.gb],
        );

        // Record the purchase
        await client.query(
          `INSERT INTO egress_credit_packs (organization_id, pack_id, credits_gb, amount_paid, adjustment_type)
           VALUES ($1, $2, $3, $4, 'purchase')`,
          [organizationId, packId, pack.gb, pack.price],
        );
      });

      // Log activity
      await logActivity({
        userId,
        organizationId,
        eventType: "egress.credits.wallet_purchased",
        entityType: "egress_credits",
        message: `Purchased ${pack.gb}GB egress credit pack via wallet`,
        status: "success",
        metadata: {
          packId,
          creditsGb: pack.gb,
          amountPaid: pack.price,
        },
      });

      const balanceDetails = await getEgressCreditBalanceDetails(organizationId);

      res.json({
        success: true,
        message: "Egress credits purchased successfully",
        data: {
          newBalance: balanceDetails.creditsGb,
          walletDeducted: pack.price,
        },
      });
    } catch (error) {
      console.error("Error purchasing egress credits via wallet:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to purchase credits",
      });
    }
  }
);

/**
 * GET /api/egress/credits/history
 * Get purchase history for the organization with pagination
 */
router.get("/credits/history", requireOrganization, async (req: Request, res: Response) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 5;

    const historyResult = await getEgressCreditPurchaseHistory(organizationId, page, limit);

    res.json({
      success: true,
      data: historyResult.purchases,
      pagination: {
        total: historyResult.total,
        page: historyResult.page,
        limit: historyResult.limit,
        totalPages: historyResult.totalPages,
      },
    });
  } catch (error) {
    console.error("Error getting egress credit purchase history:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get purchase history",
    });
  }
});

/**
 * GET /api/egress/usage/:vpsId
 * Get hourly usage for a specific VPS
 */
router.get(
  "/usage/:vpsId",
  requireOrganization,
  [param("vpsId").isUUID().withMessage("Invalid VPS ID")],
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

      const { vpsId } = req.params;
      const { organizationId } = (req as AuthenticatedRequest).user;

      // Verify VPS belongs to user's organization
      const vpsResult = await dbQuery(
        "SELECT id, label FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [vpsId, organizationId],
      );

      if (vpsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "VPS not found",
        });
      }

      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
      const usage = await getVPSHourlyUsage(vpsId, organizationId, limit);

      res.json({
        success: true,
        data: {
          vpsId,
          label: vpsResult.rows[0].label,
          usage,
        },
      });
    } catch (error) {
      console.error("Error getting VPS egress usage:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get VPS usage",
      });
    }
  }
);

/**
 * GET /api/egress/usage/:vpsId/summary
 * Get usage summary for a VPS (current month)
 */
router.get(
  "/usage/:vpsId/summary",
  requireOrganization,
  [param("vpsId").isUUID().withMessage("Invalid VPS ID")],
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

      const { vpsId } = req.params;
      const { organizationId } = (req as AuthenticatedRequest).user;

      // Verify VPS belongs to user's organization
      const vpsResult = await dbQuery(
        "SELECT id, label FROM vps_instances WHERE id = $1 AND organization_id = $2",
        [vpsId, organizationId],
      );

      if (vpsResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "VPS not found",
        });
      }

      const monthlyCreditsUsed = await getVPSMonthlyCreditsUsed(vpsId, organizationId);
      const currentBalance = await getEgressCreditBalanceDetails(organizationId);

      res.json({
        success: true,
        data: {
          vpsId,
          label: vpsResult.rows[0].label,
          monthlyCreditsUsed,
          organizationBalance: currentBalance.creditsGb,
          organizationWarning: currentBalance.warning,
        },
      });
    } catch (error) {
      console.error("Error getting VPS usage summary:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get usage summary",
      });
    }
  }
);

// ========== ADMIN ROUTES ==========

/**
 * POST /api/egress/admin/credits/:orgId
 * Admin: Add credits to an organization
 */
router.post(
  "/admin/credits/:orgId",
  requireAdmin,
  [
    param("orgId").isUUID().withMessage("Invalid organization ID"),
    body("creditsGb")
      .isFloat({ min: 0.01 })
      .withMessage("Credits must be greater than 0"),
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

      const { orgId } = req.params;
      const { creditsGb, reason } = req.body;
      const { id: adminUserId } = (req as AuthenticatedRequest).user;

      const parsedCredits = safeParseNumber(creditsGb);
      if (parsedCredits === null) {
        return res.status(400).json({
          success: false,
          error: "Invalid credits value",
        });
      }

      // Verify organization exists
      const orgResult = await dbQuery(
        "SELECT id, name FROM organizations WHERE id = $1",
        [orgId],
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Organization not found",
        });
      }

      const newBalance = await addEgressCredits(orgId, parsedCredits, adminUserId, reason);

      // Log admin action
      await logActivity({
        userId: adminUserId,
        organizationId: orgId,
        eventType: "egress.credits.admin_added",
        entityType: "egress_credits",
        message: `Admin added ${parsedCredits}GB egress credits to organization "${orgResult.rows[0].name}"`,
        status: "success",
        metadata: {
          addedCredits: parsedCredits,
          newBalance,
          reason,
        },
      });

      res.json({
        success: true,
        message: `Added ${parsedCredits}GB credits to organization`,
        data: {
          organizationId: orgId,
          organizationName: orgResult.rows[0].name,
          newBalance,
        },
      });
    } catch (error) {
      console.error("Error adding egress credits as admin:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to add credits",
      });
    }
  }
);

/**
 * DELETE /api/egress/admin/credits/:orgId
 * Admin: Remove credits from an organization
 */
router.delete(
  "/admin/credits/:orgId",
  requireAdmin,
  [
    param("orgId").isUUID().withMessage("Invalid organization ID"),
    body("creditsGb")
      .isFloat({ min: 0.01 })
      .withMessage("Credits must be greater than 0"),
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

      const { orgId } = req.params;
      const { creditsGb, reason } = req.body;
      const { id: adminUserId } = (req as AuthenticatedRequest).user;

      const parsedCredits = safeParseNumber(creditsGb);
      if (parsedCredits === null) {
        return res.status(400).json({
          success: false,
          error: "Invalid credits value",
        });
      }

      // Verify organization exists
      const orgResult = await dbQuery(
        "SELECT id, name FROM organizations WHERE id = $1",
        [orgId],
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Organization not found",
        });
      }

      const newBalance = await removeEgressCredits(orgId, parsedCredits, adminUserId, reason);

      // Log admin action
      await logActivity({
        userId: adminUserId,
        organizationId: orgId,
        eventType: "egress.credits.admin_removed",
        entityType: "egress_credits",
        message: `Admin removed ${parsedCredits}GB egress credits from organization "${orgResult.rows[0].name}"`,
        status: "success",
        metadata: {
          removedCredits: parsedCredits,
          newBalance,
          reason,
        },
      });

      res.json({
        success: true,
        message: `Removed ${parsedCredits}GB credits from organization`,
        data: {
          organizationId: orgId,
          organizationName: orgResult.rows[0].name,
          newBalance,
        },
      });
    } catch (error) {
      console.error("Error removing egress credits as admin:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove credits",
      });
    }
  }
);

/**
 * GET /api/egress/admin/credits/:orgId/balance
 * Admin: View organization credit balance with paginated history
 */
router.get(
  "/admin/credits/:orgId/balance",
  requireAdmin,
  [param("orgId").isUUID().withMessage("Invalid organization ID")],
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

      const { orgId } = req.params;
      const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 5;

      // Get organization info
      const orgResult = await dbQuery(
        "SELECT id, name, owner_id FROM organizations WHERE id = $1",
        [orgId],
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Organization not found",
        });
      }

      const balanceDetails = await getEgressCreditBalanceDetails(orgId);
      const historyResult = await getEgressCreditPurchaseHistory(orgId, page, limit);

      res.json({
        success: true,
        data: {
          organizationId: orgResult.rows[0].id,
          organizationName: orgResult.rows[0].name,
          ownerId: orgResult.rows[0].owner_id,
          creditsGb: balanceDetails.creditsGb,
          warning: balanceDetails.warning,
          purchaseHistory: historyResult.purchases,
          pagination: {
            total: historyResult.total,
            page: historyResult.page,
            limit: historyResult.limit,
            totalPages: historyResult.totalPages,
          },
        },
      });
    } catch (error) {
      console.error("Error getting organization egress balance:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get balance",
      });
    }
  }
);

/**
 * POST /api/egress/admin/billing/run
 * Admin: Manually trigger hourly egress billing
 */
router.post("/admin/billing/run", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.body;

    let result;
    if (organizationId) {
      // Run for specific organization
      result = await EgressHourlyBillingService.runForOrg(organizationId);
    } else {
      // Run for all organizations
      result = await EgressHourlyBillingService.runHourlyBilling();
    }

    // Log admin action
    await logActivity({
      userId: (req as AuthenticatedRequest).user.id,
      organizationId: null,
      eventType: "egress.billing.admin_run",
      entityType: "egress_billing",
      message: `Admin manually triggered ${organizationId ? `org-specific` : `global`} egress billing`,
      status: "success",
      metadata: {
        organizationId,
        result,
      },
    });

    res.json({
      success: true,
      message: "Egress billing completed",
      data: result,
    });
  } catch (error) {
    console.error("Error running admin egress billing:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to run billing",
    });
  }
});

/**
 * GET /api/egress/admin/settings/packs
 * Admin: Get credit pack configuration
 */
router.get("/admin/settings/packs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const packsResult = await dbQuery(
      "SELECT value FROM platform_settings WHERE key = 'egress_credit_packs'",
    );

    const thresholdResult = await dbQuery(
      "SELECT value FROM platform_settings WHERE key = 'egress_warning_threshold_gb'",
    );

    const packsRaw = packsResult.rows.length > 0 ? packsResult.rows[0].value : [];
    const thresholdRaw = thresholdResult.rows.length > 0 ? thresholdResult.rows[0].value : 200;

    res.json({
      success: true,
      data: {
        packs: parsePackSettingsValue(packsRaw),
        warningThresholdGb: safeParseNumber(thresholdRaw) ?? 200,
      },
    });
  } catch (error) {
    console.error("Error getting credit pack settings:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
    });
  }
});

/**
 * PUT /api/egress/admin/settings/packs
 * Admin: Update credit pack configuration
 */
router.put(
  "/admin/settings/packs",
  requireAdmin,
  [
    body("packs")
      .isArray()
      .withMessage("Packs must be an array"),
    body("packs.*.id")
      .isString()
      .withMessage("Pack ID is required"),
    body("packs.*.gb")
      .isFloat({ min: 1 })
      .withMessage("Pack GB must be positive"),
    body("packs.*.price")
      .isFloat({ min: 0.01 })
      .withMessage("Pack price must be positive"),
    body("packs.*.isPopular")
      .optional()
      .isBoolean()
      .withMessage("isPopular must be a boolean"),
    body("packs.*.isRecommended")
      .optional()
      .isBoolean()
      .withMessage("isRecommended must be a boolean"),
    body("warningThresholdGb")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Warning threshold must be a positive integer"),
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

      const { packs, warningThresholdGb } = req.body as {
        packs: Array<{
          id: string;
          gb: number;
          price: number;
          isPopular?: boolean;
          isRecommended?: boolean;
        }>;
        warningThresholdGb?: number;
      };
      const { id: adminUserId } = (req as AuthenticatedRequest).user;
      const normalizedPacks = packs.map((pack) => ({
        id: pack.id.trim(),
        gb: Number(pack.gb),
        price: Number(pack.price),
        isPopular: Boolean(pack.isPopular),
        isRecommended: Boolean(pack.isRecommended),
      }));

      const packIds = new Set<string>();
      for (const pack of normalizedPacks) {
        if (!pack.id) {
          return res.status(400).json({
            success: false,
            error: "Pack ID is required",
          });
        }
        if (packIds.has(pack.id)) {
          return res.status(400).json({
            success: false,
            error: `Duplicate pack ID: ${pack.id}`,
          });
        }
        packIds.add(pack.id);
      }

      // Upsert packs so settings persist even if key is missing.
      await dbQuery(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify(normalizedPacks)],
      );

      // Upsert warning threshold if provided.
      if (warningThresholdGb !== undefined) {
        await dbQuery(
          `INSERT INTO platform_settings (key, value, updated_at)
           VALUES ('egress_warning_threshold_gb', $1::jsonb, NOW())
           ON CONFLICT (key)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [JSON.stringify(Math.floor(Number(warningThresholdGb)))],
        );
      }

      // Log admin action
      await logActivity({
        userId: adminUserId,
        organizationId: null,
        eventType: "egress.settings.packs_updated",
        entityType: "egress_settings",
        message: "Admin updated egress credit pack configuration",
        status: "success",
        metadata: { packs: normalizedPacks, warningThresholdGb },
      });

      res.json({
        success: true,
        message: "Credit pack configuration updated",
        data: { packs: normalizedPacks, warningThresholdGb },
      });
    } catch (error) {
      console.error("Error updating credit pack settings:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      });
    }
  }
);

export default router;
