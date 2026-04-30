/**
 * Admin Volume Pricing Routes
 * Manage volume types and view volume billing
 */

import { Router, type Request, type Response } from "express";
import { body, param, query as queryValidator, validationResult } from "express-validator";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";
import { query, transaction } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import { linodeService } from "../../services/linodeService.js";

const router = Router();

router.use(authenticateToken, requireAdmin);

/**
 * Get all volume types
 * GET /api/admin/billing/volume-types
 */
router.get("/volume-types", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, label, storage_type, size_min_gb, size_max_gb,
              price_per_gb_month, price_per_gb_hour, region_pricing,
              is_active, display_order, description, created_at, updated_at
       FROM volume_types
       ORDER BY display_order ASC`
    );
    res.json({ volume_types: result.rows || [] });
  } catch (err: any) {
    console.error("Error fetching volume types:", err);
    res.status(500).json({ error: "Failed to fetch volume types" });
  }
});

/**
 * Create a new volume type
 * POST /api/admin/billing/volume-types
 */
router.post(
  "/volume-types",
  [
    body("label").isString().trim().isLength({ min: 1, max: 100 }),
    body("storage_type").isIn(["ssd", "nvme"]),
    body("size_min_gb").isInt({ min: 1 }),
    body("size_max_gb").isInt({ min: 1 }),
    body("price_per_gb_month").isNumeric(),
    body("price_per_gb_hour").isNumeric(),
    body("region_pricing").optional().isObject(),
    body("is_active").optional().isBoolean(),
    body("display_order").optional().isInt({ min: 0 }),
    body("description").optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const {
        label,
        storage_type,
        size_min_gb,
        size_max_gb,
        price_per_gb_month,
        price_per_gb_hour,
        region_pricing = {},
        is_active = true,
        display_order = 0,
        description,
      } = req.body;

      const result = await query(
        `INSERT INTO volume_types (label, storage_type, size_min_gb, size_max_gb,
                                  price_per_gb_month, price_per_gb_hour, region_pricing,
                                  is_active, display_order, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          label,
          storage_type,
          size_min_gb,
          size_max_gb,
          price_per_gb_month,
          price_per_gb_hour,
          JSON.stringify(region_pricing),
          is_active,
          display_order,
          description || null,
        ]
      );

      await logActivity({
        userId: (req as any).user?.id,
        eventType: "volume_type.created",
        entityType: "volume_types",
        entityId: result.rows[0].id,
        message: `Volume type '${label}' created`,
      });

      res.status(201).json({ volume_type: result.rows[0] });
    } catch (err: any) {
      console.error("Error creating volume type:", err);
      res.status(500).json({ error: "Failed to create volume type" });
    }
  }
);

/**
 * Update a volume type
 * PUT /api/admin/billing/volume-types/:id
 */
router.put(
  "/volume-types/:id",
  [
    param("id").isUUID(),
    body("label").optional().isString().trim().isLength({ min: 1, max: 100 }),
    body("storage_type").optional().isIn(["ssd", "nvme"]),
    body("size_min_gb").optional().isInt({ min: 1 }),
    body("size_max_gb").optional().isInt({ min: 1 }),
    body("price_per_gb_month").optional().isNumeric(),
    body("price_per_gb_hour").optional().isNumeric(),
    body("region_pricing").optional().isObject(),
    body("is_active").optional().isBoolean(),
    body("display_order").optional().isInt({ min: 0 }),
    body("description").optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { id } = req.params;
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      const allowedFields = [
        "label", "storage_type", "size_min_gb", "size_max_gb",
        "price_per_gb_month", "price_per_gb_hour", "region_pricing",
        "is_active", "display_order", "description",
      ];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${idx}`);
          values.push(
            field === "region_pricing"
              ? JSON.stringify(req.body[field])
              : req.body[field]
          );
          idx++;
        }
      }

      if (updates.length === 0) {
        res.status(400).json({ error: "No valid fields to update" });
        return;
      }

      values.push(id);
      const result = await query(
        `UPDATE volume_types SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${idx} RETURNING *`,
        values
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: "Volume type not found" });
        return;
      }

      await logActivity({
        userId: (req as any).user?.id,
        eventType: "volume_type.updated",
        entityType: "volume_types",
        entityId: id,
        message: `Volume type updated`,
      });

      res.json({ volume_type: result.rows[0] });
    } catch (err: any) {
      console.error("Error updating volume type:", err);
      res.status(500).json({ error: "Failed to update volume type" });
    }
  }
);

/**
 * Delete a volume type
 * DELETE /api/admin/billing/volume-types/:id
 */
router.delete("/volume-types/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      "DELETE FROM volume_types WHERE id = $1 RETURNING id, label",
      [id]
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: "Volume type not found" });
      return;
    }

      await logActivity({
        userId: (req as any).user?.id,
        eventType: "volume_type.deleted",
        entityType: "volume_types",
        entityId: id,
        message: `Volume type '${result.rows[0].label}' deleted`,
      });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting volume type:", err);
    res.status(500).json({ error: "Failed to delete volume type" });
  }
});

/**
 * Get all volumes across organizations
 * GET /api/admin/billing/volumes
 */
router.get("/volumes", async (req: Request, res: Response) => {
  try {
    const { region, status, org_id } = req.query;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (region) {
      conditions.push(`v.region = $${idx++}`);
      values.push(region);
    }
    if (status) {
      conditions.push(`v.status = $${idx++}`);
      values.push(status);
    }
    if (org_id) {
      conditions.push(`v.organization_id = $${idx++}`);
      values.push(org_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT v.id, v.organization_id, v.vps_id, v.provider, v.provider_volume_id,
              v.label, v.region, v.size_gb, v.storage_type, v.status,
              v.filesystem_path, v.encryption, v.hourly_price,
              v.created_at, v.updated_at,
              o.name as organization_name,
              vi.label as vps_label
       FROM volumes v
       JOIN organizations o ON o.id = v.organization_id
       LEFT JOIN vps_instances vi ON vi.id = v.vps_id
       ${where}
       ORDER BY v.created_at DESC`,
      values
    );

    res.json({ volumes: result.rows || [] });
  } catch (err: any) {
    console.error("Error fetching volumes:", err);
    res.status(500).json({ error: "Failed to fetch volumes" });
  }
});

/**
 * Get volume billing history
 * GET /api/admin/billing/volumes/:id/billing
 */
router.get("/volumes/:id/billing", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    let dateFilter = "";
    const values: any[] = [id];

    if (start_date && end_date) {
      dateFilter = " AND billing_period_start >= $2 AND billing_period_end <= $3";
      values.push(start_date, end_date);
    }

    const result = await query(
      `SELECT vb.id, vb.volume_id, vb.organization_id, vb.size_gb,
              vb.price_per_gb_hour, vb.hours_billed, vb.total_amount,
              vb.billing_period_start, vb.billing_period_end, vb.created_at,
              v.label as volume_label, v.provider, v.provider_volume_id
       FROM volume_billing vb
       JOIN volumes v ON v.id = vb.volume_id
       WHERE vb.volume_id = $1 ${dateFilter}
       ORDER BY vb.billing_period_start DESC`,
      values
    );

    const summary = await query(
      `SELECT SUM(vb.total_amount) as total_charges,
              SUM(vb.hours_billed * vb.size_gb) as total_gb_hours,
              COUNT(DISTINCT vb.volume_id) as volume_count
       FROM volume_billing vb
       WHERE vb.volume_id = $1 ${dateFilter}`,
      values
    );

    res.json({
      billing_records: result.rows || [],
      summary: summary.rows[0] || {},
    });
  } catch (err: any) {
    console.error("Error fetching volume billing:", err);
    res.status(500).json({ error: "Failed to fetch volume billing" });
  }
});

/**
 * Get volume pricing overview (all orgs)
 * GET /api/admin/billing/volumes/overview
 */
router.get("/volumes/overview", async (_req: Request, res: Response) => {
  try {
    const volumeCount = await query("SELECT COUNT(*) as total FROM volumes");
    const activeVolumes = await query(
      "SELECT COUNT(*) as active FROM volumes WHERE status = 'active'"
    );
    const totalCapacity = await query(
      "SELECT COALESCE(SUM(size_gb), 0) as total_gb FROM volumes"
    );
    const byStatus = await query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(size_gb), 0) as total_gb
       FROM volumes GROUP BY status`
    );
    const byOrg = await query(
      `SELECT o.id, o.name, COUNT(v.id) as volume_count,
              COALESCE(SUM(v.size_gb), 0) as total_gb
       FROM organizations o
       LEFT JOIN volumes v ON v.organization_id = o.id
       GROUP BY o.id, o.name
       ORDER BY total_gb DESC`
    );
    const recentBilling = await query(
      `SELECT vb.id, vb.volume_id, vb.total_amount, vb.size_gb,
              vb.billing_period_start, vb.billing_period_end,
              v.label as volume_label, v.provider, v.provider_volume_id,
              o.name as organization_name
       FROM volume_billing vb
       JOIN volumes v ON v.id = vb.volume_id
       JOIN organizations o ON o.id = vb.organization_id
       ORDER BY vb.created_at DESC
       LIMIT 20`
    );

    res.json({
      stats: {
        total_volumes: parseInt(volumeCount.rows[0]?.total || "0"),
        active_volumes: parseInt(activeVolumes.rows[0]?.active || "0"),
        total_capacity_gb: parseInt(totalCapacity.rows[0]?.total_gb || "0"),
      },
      by_status: byStatus.rows || [],
      by_organization: byOrg.rows || [],
      recent_billing: recentBilling.rows || [],
    });
  } catch (err: any) {
    console.error("Error fetching volume overview:", err);
    res.status(500).json({ error: "Failed to fetch volume overview" });
  }
});

export default router;
