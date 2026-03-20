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
  getVPSHourlyUsage,
  getVPSMonthlyCreditsUsed,
} from "../services/egressCreditService.js";
import { EgressHourlyBillingService } from "../services/egressHourlyBillingService.js";
import { logActivity } from "../services/activityLogger.js";
import { query as dbQuery } from "../lib/database.js";

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

      const { paymentId, packId } = req.body;
      const { id: userId, organizationId } = (req as AuthenticatedRequest).user;

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
 * GET /api/egress/credits/history
 * Get purchase history for the organization
 */
router.get("/credits/history", requireOrganization, async (req: Request, res: Response) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;

    const history = await getEgressCreditPurchaseHistory(organizationId, limit);

    res.json({
      success: true,
      data: history,
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
 * GET /api/egress/admin/credits/:orgId/balance
 * Admin: View organization credit balance
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
      const history = await getEgressCreditPurchaseHistory(orgId, 20);

      res.json({
        success: true,
        data: {
          organizationId: orgResult.rows[0].id,
          organizationName: orgResult.rows[0].name,
          ownerId: orgResult.rows[0].owner_id,
          creditsGb: balanceDetails.creditsGb,
          warning: balanceDetails.warning,
          purchaseHistory: history,
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
    const result = await dbQuery(
      "SELECT value FROM platform_settings WHERE key = 'egress_credit_packs'",
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { packs: [] },
      });
    }

    res.json({
      success: true,
      data: {
        packs: result.rows[0].value,
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

      const { packs } = req.body;
      const { id: adminUserId } = (req as AuthenticatedRequest).user;

      await dbQuery(
        `UPDATE platform_settings
         SET value = $1, updated_at = NOW()
         WHERE key = 'egress_credit_packs'`,
        [JSON.stringify(packs)],
      );

      // Log admin action
      await logActivity({
        userId: adminUserId,
        organizationId: null,
        eventType: "egress.settings.packs_updated",
        entityType: "egress_settings",
        message: "Admin updated egress credit pack configuration",
        status: "success",
        metadata: { packs },
      });

      res.json({
        success: true,
        message: "Credit pack configuration updated",
        data: { packs },
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
