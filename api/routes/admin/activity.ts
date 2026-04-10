import express, { Request, Response } from "express";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { ensureActivityLogsTable } from "../../services/activityLogger.js";

const router = express.Router();

// All admin activity endpoints require auth + admin role
router.use(authenticateToken, requireAdmin);

/**
 * List all activity logs globally (admin-only, no org scoping)
 * GET /api/admin/activity
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      organization_id,
      user_id,
      event_type,
      entity_type,
      status,
      from,
      to,
      limit = "10",
      offset = "0",
    } = req.query as any;

    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    let paramIdx = 1;

    if (organization_id && typeof organization_id === "string") {
      clauses.push(`organization_id = $${paramIdx}`);
      params.push(organization_id);
      paramIdx++;
    }
    if (user_id && typeof user_id === "string") {
      clauses.push(`user_id = $${paramIdx}`);
      params.push(user_id);
      paramIdx++;
    }
    if (event_type && typeof event_type === "string") {
      clauses.push(`event_type = $${paramIdx}`);
      params.push(event_type);
      paramIdx++;
    }
    if (entity_type && typeof entity_type === "string") {
      clauses.push(`entity_type = $${paramIdx}`);
      params.push(entity_type);
      paramIdx++;
    }
    if (status && typeof status === "string") {
      clauses.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (from && typeof from === "string") {
      clauses.push(`created_at >= $${paramIdx}`);
      params.push(new Date(from));
      paramIdx++;
    }
    if (to && typeof to === "string") {
      clauses.push(`created_at <= $${paramIdx}`);
      params.push(new Date(to));
      paramIdx++;
    }

    const lim = Math.min(Number(limit) || 10, 200);
    const off = Math.max(Number(offset) || 0, 0);

    await ensureActivityLogsTable();

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) as total FROM activity_logs WHERE ${clauses.join(" AND ")}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    // Get paginated results with JOINs for org name and user role
    const sql = `
      SELECT a.id, a.user_id, a.organization_id, a.event_type, a.entity_type,
             a.entity_id, a.message, a.status, a.metadata, a.ip_address,
             a.user_agent, a.created_at,
             u.role as user_role,
             o.name as organization_name
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN organizations o ON a.organization_id = o.id
      WHERE ${clauses.join(" AND ")}
      ORDER BY a.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(lim, off);

    const result = await query(sql, params);

    res.json({
      activities: result.rows || [],
      pagination: {
        total,
        limit: lim,
        offset: off,
        page: Math.floor(off / lim) + 1,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (err: any) {
    console.error("Admin activity list error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch activity" });
  }
});

/**
 * CSV export of all activity logs (admin-only)
 * GET /api/admin/activity/export
 */
router.get("/export", async (req: Request, res: Response) => {
  try {
    const {
      organization_id,
      user_id,
      event_type,
      entity_type,
      status,
      from,
      to,
    } = req.query as any;

    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    let paramIdx = 1;

    if (organization_id && typeof organization_id === "string") {
      clauses.push(`organization_id = $${paramIdx}`);
      params.push(organization_id);
      paramIdx++;
    }
    if (user_id && typeof user_id === "string") {
      clauses.push(`user_id = $${paramIdx}`);
      params.push(user_id);
      paramIdx++;
    }
    if (event_type && typeof event_type === "string") {
      clauses.push(`event_type = $${paramIdx}`);
      params.push(event_type);
      paramIdx++;
    }
    if (entity_type && typeof entity_type === "string") {
      clauses.push(`entity_type = $${paramIdx}`);
      params.push(entity_type);
      paramIdx++;
    }
    if (status && typeof status === "string") {
      clauses.push(`status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (from && typeof from === "string") {
      clauses.push(`created_at >= $${paramIdx}`);
      params.push(new Date(from));
      paramIdx++;
    }
    if (to && typeof to === "string") {
      clauses.push(`created_at <= $${paramIdx}`);
      params.push(new Date(to));
      paramIdx++;
    }

    const sql = `
      SELECT a.created_at, a.user_id, a.organization_id, a.event_type,
             a.entity_type, a.entity_id, a.status, a.message, a.ip_address,
             o.name as organization_name
      FROM activity_logs a
      LEFT JOIN organizations o ON a.organization_id = o.id
      WHERE ${clauses.join(" AND ")}
      ORDER BY a.created_at DESC
    `;

    await ensureActivityLogsTable();
    const result = await query(sql, params);

    const header =
      "created_at,user_id,organization_id,organization_name,event_type,entity_type,entity_id,status,ip_address,message\n";
    const rows = (result.rows || [])
      .map((r: any) => {
        const fields = [
          r.created_at,
          r.user_id,
          r.organization_id || "",
          r.organization_name || "",
          r.event_type,
          r.entity_type,
          r.entity_id || "",
          r.status,
          r.ip_address || "",
          (r.message || "").replace(/\n/g, " "),
        ];
        return fields
          .map((f) => '"' + String(f).replace(/"/g, '""') + '"')
          .join(",");
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="admin_activity_export.csv"',
    );
    res.send(header + rows + "\n");
  } catch (err: any) {
    console.error("Admin activity export error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to export activity" });
  }
});

/**
 * Get summary counts by entity_type and status (admin-only)
 * GET /api/admin/activity/summary
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as any;
    const clauses: string[] = ["1=1"];
    const params: any[] = [];
    let paramIdx = 1;

    if (from && typeof from === "string") {
      clauses.push(`created_at >= $${paramIdx}`);
      params.push(new Date(from));
      paramIdx++;
    }
    if (to && typeof to === "string") {
      clauses.push(`created_at <= $${paramIdx}`);
      params.push(new Date(to));
      paramIdx++;
    }

    const sql = `
      SELECT entity_type AS type, status, COUNT(*) AS count
      FROM activity_logs
      WHERE ${clauses.join(" AND ")}
      GROUP BY entity_type, status
      ORDER BY type, status
    `;

    await ensureActivityLogsTable();
    const result = await query(sql, params);
    res.json({ summary: result.rows || [] });
  } catch (err: any) {
    console.error("Admin activity summary error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch activity summary" });
  }
});

export default router;
