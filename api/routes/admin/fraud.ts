import express, { type Request, type Response } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/fraud-checks/stats/summary
 * Fraud check summary statistics
 * NOTE: Must be defined before /:id to avoid matching "stats" as an id
 */
router.get("/stats/summary", async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE action_taken = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE action_taken = 'flagged') as flagged,
        COUNT(*) FILTER (WHERE action_taken = 'allowed') as allowed,
        COUNT(*) FILTER (WHERE status = 'reject') as rejected,
        COUNT(*) FILTER (WHERE status = 'review') as review,
        COUNT(*) FILTER (WHERE status = 'approve') as approved,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_checks,
        COUNT(*) FILTER (WHERE action_taken = 'blocked' AND created_at >= CURRENT_DATE) as today_blocked,
        COALESCE(ROUND(AVG(score), 1), 0) as avg_score
      FROM fraud_checks
    `);

    const byTypeResult = await query(`
      SELECT
        check_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE action_taken = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE action_taken = 'flagged') as flagged
      FROM fraud_checks
      GROUP BY check_type
      ORDER BY count DESC
    `);

    res.json({
      stats: result.rows[0],
      by_type: byTypeResult.rows,
    });
  } catch (error) {
    console.error("Failed to get fraud stats:", error);
    res.status(500).json({ error: "Failed to get fraud stats" });
  }
});

/**
 * GET /api/admin/fraud-checks
 * List fraud checks with filters
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      status,
      check_type,
      user_id,
      organization_id,
      search,
      score_min,
      score_max,
      date_from,
      date_to,
      limit = "50",
      offset = "0",
    } = req.query;

    let sql = `SELECT fc.*, u.email as user_email, u.name as user_name,
                      org.name as organization_name,
                      COUNT(*) OVER() as total_count
               FROM fraud_checks fc
               LEFT JOIN users u ON u.id = fc.user_id
               LEFT JOIN organizations org ON org.id = fc.organization_id
               WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND fc.status = $${paramIndex++}`;
      params.push(status);
    }
    if (check_type) {
      sql += ` AND fc.check_type = $${paramIndex++}`;
      params.push(check_type);
    }
    if (user_id) {
      sql += ` AND fc.user_id = $${paramIndex++}`;
      params.push(user_id);
    }
    if (organization_id) {
      sql += ` AND fc.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (search) {
      sql += ` AND (fc.email ILIKE $${paramIndex} OR fc.ip_address::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (score_min) {
      sql += ` AND fc.score >= $${paramIndex++}`;
      params.push(parseInt(score_min as string, 10));
    }
    if (score_max) {
      sql += ` AND fc.score <= $${paramIndex++}`;
      params.push(parseInt(score_max as string, 10));
    }
    if (date_from) {
      sql += ` AND fc.created_at >= $${paramIndex++}`;
      params.push(date_from);
    }
    if (date_to) {
      sql += ` AND fc.created_at <= $${paramIndex++}`;
      params.push(date_to);
    }

    sql += ` ORDER BY fc.created_at DESC`;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const result = await query(sql, params);
    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

    // Remove total_count from each row
    const checks = result.rows.map(({ total_count, ...row }) => row);

    res.json({ checks, total });
  } catch (error) {
    console.error("Failed to get fraud checks:", error);
    res.status(500).json({ error: "Failed to get fraud checks" });
  }
});

/**
 * GET /api/admin/fraud-checks/:id
 * Get a single fraud check detail
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT fc.*, u.email as user_email, u.name as user_name,
              org.name as organization_name
       FROM fraud_checks fc
       LEFT JOIN users u ON u.id = fc.user_id
       LEFT JOIN organizations org ON org.id = fc.organization_id
       WHERE fc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Fraud check not found" });
    }
    res.json({ check: result.rows[0] });
  } catch (error) {
    console.error("Failed to get fraud check:", error);
    res.status(500).json({ error: "Failed to get fraud check" });
  }
});

/**
 * POST /api/admin/fraud-checks/:id/override
 * Admin override a fraud check decision
 */
router.post("/:id/override", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!action || !['allowed', 'blocked'].includes(action)) {
      return res.status(400).json({ error: "action must be 'allowed' or 'blocked'" });
    }
    if (!reason) {
      return res.status(400).json({ error: "reason is required for override" });
    }

    const result = await query(
      `UPDATE fraud_checks SET action_taken = $1, raw_response = raw_response || $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [action, JSON.stringify({ admin_override: { by: userId, reason, at: new Date().toISOString() } }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Fraud check not found" });
    }

    await logActivity({
      userId,
      eventType: "fraud_check.override",
      entityType: "fraud_check",
      entityId: id,
      message: `Admin overridden fraud check to ${action}: ${reason}`,
      status: "success",
      metadata: { action, reason },
    });

    res.json({ check: result.rows[0] });
  } catch (error: any) {
    console.error("Failed to override fraud check:", error);
    res.status(500).json({ error: error?.message || "Failed to override fraud check" });
  }
});

export default router;
