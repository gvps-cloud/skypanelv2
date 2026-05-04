import express, { type Request, type Response } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { RefundService } from "../../services/refundService.js";
import { logActivity } from "../../services/activityLogger.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/refunds
 * List all refunds with filters
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, organization_id, limit, offset } = req.query;
    const refunds = await RefundService.listRefunds({
      organizationId: organization_id as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ refunds });
  } catch (error) {
    console.error("Failed to get refunds:", error);
    res.status(500).json({ error: "Failed to get refunds" });
  }
});

/**
 * GET /api/admin/refunds/:id
 * Get a single refund detail
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT r.*, u.email as user_email, org.name as organization_name, ib.email as initiated_by_email
       FROM refunds r
       JOIN users u ON u.id = r.user_id
       JOIN organizations org ON org.id = r.organization_id
       LEFT JOIN users ib ON ib.id = r.initiated_by
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }
    res.json({ refund: result.rows[0] });
  } catch (error) {
    console.error("Failed to get refund:", error);
    res.status(500).json({ error: "Failed to get refund" });
  }
});

/**
 * POST /api/admin/refunds
 * Create a new refund (admin-initiated)
 */
router.post("/", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const {
      organization_id,
      user_id,
      original_transaction_id,
      original_billing_cycle_id,
      original_hosting_subscription_id,
      paypal_capture_id,
      amount,
      currency,
      reason,
    } = req.body;

    if (!organization_id || !user_id || !amount || !reason) {
      return res.status(400).json({ error: "organization_id, user_id, amount, and reason are required" });
    }

    const { refundId, status } = await RefundService.createRefund({
      organizationId: organization_id,
      userId: user_id,
      originalTransactionId: original_transaction_id,
      originalBillingCycleId: original_billing_cycle_id,
      originalHostingSubscriptionId: original_hosting_subscription_id,
      paypalCaptureId: paypal_capture_id,
      amount: parseFloat(amount),
      currency: currency || "USD",
      reason,
      initiatedBy: userId,
      initiatedByType: "admin",
    });

    await logActivity({
      userId,
      organizationId: organization_id,
      eventType: "billing.refund.created",
      entityType: "refund",
      entityId: refundId,
      message: `Admin created refund of ${amount} ${currency || "USD"}`,
      status: "success",
      metadata: { reason },
    });

    res.status(201).json({ refundId, status });
  } catch (error: any) {
    console.error("Failed to create refund:", error);
    res.status(500).json({ error: error?.message || "Failed to create refund" });
  }
});

/**
 * POST /api/admin/refunds/:id/process
 * Process a pending refund via PayPal
 */
router.post("/:id/process", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const { id } = req.params;
    const refundResult = await query(
      `SELECT original_hosting_subscription_id FROM refunds WHERE id = $1`,
      [id]
    );
    if (refundResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund not found" });
    }

    const result = refundResult.rows[0].original_hosting_subscription_id
      ? await RefundService.processHostingWalletRefund(id)
      : await RefundService.processPayPalRefund(id);

    if (result.success) {
      await logActivity({
        userId,
        eventType: "billing.refund.processed",
        entityType: "refund",
        entityId: id,
        message: `Admin processed PayPal refund: ${result.message}`,
        status: "success",
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Failed to process refund:", error);
    res.status(500).json({ error: error?.message || "Failed to process refund" });
  }
});

/**
 * POST /api/admin/refunds/:id/cancel
 * Cancel a pending refund
 */
router.post("/:id/cancel", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE refunds SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Refund not found or not in pending status" });
    }

    await logActivity({
      userId,
      organizationId: result.rows[0].organization_id,
      eventType: "billing.refund.cancelled",
      entityType: "refund",
      entityId: id,
      message: `Admin cancelled refund`,
      status: "success",
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to cancel refund:", error);
    res.status(500).json({ error: error?.message || "Failed to cancel refund" });
  }
});

export default router;
