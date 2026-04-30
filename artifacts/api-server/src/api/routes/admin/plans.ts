import express, { type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";

const router = express.Router();

router.get(
  "/plans",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT
          p.id, p.name, p.provider_id, p.provider_plan_id,
          p.base_price, p.markup_price,
          p.backup_price_monthly, p.backup_price_hourly,
          p.backup_upcharge_monthly, p.backup_upcharge_hourly,
          p.daily_backups_enabled, p.weekly_backups_enabled,
          p.specifications, p.active, p.type_class,
          p.created_at, p.updated_at,
          sp.name as provider_name,
          sp.type as provider_type,
          COALESCE(
            json_agg(
              json_build_object(
                'region_id', vpr.region_id
              ) ORDER BY vpr.region_id
            ) FILTER (WHERE vpr.region_id IS NOT NULL),
            '[]'::json
          ) as regions
         FROM vps_plans p
         LEFT JOIN service_providers sp ON p.provider_id = sp.id
         LEFT JOIN vps_plan_regions vpr ON p.id = vpr.vps_plan_id
         WHERE p.active = true
         GROUP BY p.id, sp.id
         ORDER BY p.created_at DESC`,
      );

      res.json({ plans: result.rows || [] });
    } catch (err: any) {
      console.error("Admin plans list error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch plans" });
    }
  },
);

router.put(
  "/plans/:id",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID().withMessage("Invalid plan id"),
    body("name").optional().isString().trim().notEmpty(),
    body("provider_id").optional().isUUID().withMessage("Invalid provider_id"),
    body("base_price").optional().isFloat({ min: 0 }),
    body("markup_price").optional().isFloat({ min: 0 }),
    body("active").optional().isBoolean(),
    body("backup_price_monthly").optional().isFloat({ min: 0 }),
    body("backup_price_hourly").optional().isFloat({ min: 0 }),
    body("backup_upcharge_monthly").optional().isFloat({ min: 0 }),
    body("backup_upcharge_hourly").optional().isFloat({ min: 0 }),
    body("daily_backups_enabled").optional().isBoolean(),
    body("weekly_backups_enabled").optional().isBoolean(),
    body("type_class")
      .optional()
      .isIn([
        "standard",
        "dedicated",
        "premium",
        "gpu",
        "accelerated",
        "highmem",
        "nanode",
      ]),
    body("regions").optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const updateFields: any = {};

      const {
        name,
        provider_id,
        base_price,
        markup_price,
        active,
        backup_price_monthly,
        backup_price_hourly,
        backup_upcharge_monthly,
        backup_upcharge_hourly,
        daily_backups_enabled,
        weekly_backups_enabled,
        type_class,
        regions,
      } = req.body as any;

      if (typeof provider_id !== "undefined") {
        const providerCheck = await query(
          "SELECT id FROM service_providers WHERE id = $1 LIMIT 1",
          [provider_id],
        );

        if (providerCheck.rows.length === 0) {
          res.status(400).json({ error: "Provider not found" });
          return;
        }
        updateFields.provider_id = provider_id;
      }

      if (
        typeof daily_backups_enabled !== "undefined" &&
        typeof weekly_backups_enabled !== "undefined"
      ) {
        if (!daily_backups_enabled && !weekly_backups_enabled) {
          res
            .status(400)
            .json({ error: "At least one backup frequency must be enabled" });
          return;
        }
      } else if (
        typeof daily_backups_enabled !== "undefined" ||
        typeof weekly_backups_enabled !== "undefined"
      ) {
        const currentPlanResult = await query(
          "SELECT daily_backups_enabled, weekly_backups_enabled FROM vps_plans WHERE id = $1",
          [id],
        );

        if (currentPlanResult.rows.length === 0) {
          res.status(404).json({ error: "Plan not found" });
          return;
        }

        const currentPlan = currentPlanResult.rows[0];
        const newDailyEnabled =
          typeof daily_backups_enabled !== "undefined"
            ? daily_backups_enabled
            : currentPlan.daily_backups_enabled;
        const newWeeklyEnabled =
          typeof weekly_backups_enabled !== "undefined"
            ? weekly_backups_enabled
            : currentPlan.weekly_backups_enabled;

        if (!newDailyEnabled && !newWeeklyEnabled) {
          res
            .status(400)
            .json({ error: "At least one backup frequency must be enabled" });
          return;
        }
      }

      if (typeof name !== "undefined") updateFields.name = name;
      if (typeof base_price !== "undefined")
        updateFields.base_price = base_price;
      if (typeof markup_price !== "undefined")
        updateFields.markup_price = markup_price;
      if (typeof active !== "undefined") updateFields.active = active;
      if (typeof backup_price_monthly !== "undefined")
        updateFields.backup_price_monthly = backup_price_monthly;
      if (typeof backup_price_hourly !== "undefined")
        updateFields.backup_price_hourly = backup_price_hourly;
      if (typeof backup_upcharge_monthly !== "undefined")
        updateFields.backup_upcharge_monthly = backup_upcharge_monthly;
      if (typeof backup_upcharge_hourly !== "undefined")
        updateFields.backup_upcharge_hourly = backup_upcharge_hourly;
      if (typeof daily_backups_enabled !== "undefined")
        updateFields.daily_backups_enabled = daily_backups_enabled;
      if (typeof weekly_backups_enabled !== "undefined")
        updateFields.weekly_backups_enabled = weekly_backups_enabled;
      if (typeof type_class !== "undefined")
        updateFields.type_class = type_class;
      updateFields.updated_at = new Date().toISOString();

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const [key, val] of Object.entries(updateFields)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
      values.push(id);

      const result = await query(
        `UPDATE vps_plans SET ${setClauses.join(
          ", ",
        )} WHERE id = $${idx} RETURNING *`,
        values,
      );

      if (result.rows.length === 0) {
        throw new Error("Plan not found");
      }

      const updatedPlan = result.rows[0];

      if (typeof regions !== "undefined") {
        await query("DELETE FROM vps_plan_regions WHERE vps_plan_id = $1", [
          id,
        ]);

        if (regions.length > 0) {
          for (const regionId of regions) {
            await query(
              `INSERT INTO vps_plan_regions (vps_plan_id, region_id)
               VALUES ($1, $2)
               ON CONFLICT (vps_plan_id, region_id) DO NOTHING`,
              [id, regionId],
            );
          }
        }
      }

      res.json({ plan: updatedPlan });
    } catch (err: any) {
      console.error("Admin plan update error:", err);
      res.status(500).json({ error: err.message || "Failed to update plan" });
    }
  },
);

router.delete(
  "/plans/:id",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      await query("DELETE FROM vps_plans WHERE id = $1", [id]);
      res.status(204).send();
    } catch (err: any) {
      console.error("Admin VPS plan delete error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to delete VPS plan" });
    }
  },
);

router.post(
  "/plans",
  authenticateToken,
  requireAdmin,
  [
    body("name").isString().trim().notEmpty(),
    body("provider_id").isUUID(),
    body("provider_plan_id").isString().trim().notEmpty(),
    body("base_price").isFloat({ min: 0 }),
    body("markup_price").isFloat({ min: 0 }),
    body("active").optional().isBoolean(),
    body("specifications").optional().isObject(),
    body("type_class")
      .optional()
      .isIn([
        "standard",
        "dedicated",
        "premium",
        "gpu",
        "accelerated",
        "highmem",
        "nanode",
      ]),
    body("regions").optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        name,
        provider_id,
        provider_plan_id,
        base_price,
        markup_price,
        active = true,
        specifications = {},
        backup_price_monthly = 0,
        backup_price_hourly = 0,
        backup_upcharge_monthly = 0,
        backup_upcharge_hourly = 0,
        daily_backups_enabled = false,
        weekly_backups_enabled = true,
        type_class = "standard",
        regions = [],
      } = req.body as any;

      const providerCheck = await query(
        "SELECT id FROM service_providers WHERE id = $1 LIMIT 1",
        [provider_id],
      );

      if (providerCheck.rows.length === 0) {
        res.status(400).json({ error: "Provider not found" });
        return;
      }

      if (!daily_backups_enabled && !weekly_backups_enabled) {
        res
          .status(400)
          .json({ error: "At least one backup frequency must be enabled" });
        return;
      }

      const now = new Date().toISOString();
      const insertResult = await query(
        `INSERT INTO vps_plans (
          name, provider_id, provider_plan_id, base_price, markup_price,
          backup_price_monthly, backup_price_hourly,
          backup_upcharge_monthly, backup_upcharge_hourly,
          daily_backups_enabled, weekly_backups_enabled,
          specifications, active, type_class, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          name,
          provider_id,
          provider_plan_id,
          base_price,
          markup_price,
          backup_price_monthly,
          backup_price_hourly,
          backup_upcharge_monthly,
          backup_upcharge_hourly,
          daily_backups_enabled,
          weekly_backups_enabled,
          specifications,
          active,
          type_class,
          now,
          now,
        ],
      );

      const newPlan = insertResult.rows[0];

      if (regions && regions.length > 0) {
        for (const regionId of regions) {
          await query(
            `INSERT INTO vps_plan_regions (vps_plan_id, region_id)
             VALUES ($1, $2)
             ON CONFLICT (vps_plan_id, region_id) DO NOTHING`,
            [newPlan.id, regionId],
          );
        }
      }

      res.status(201).json({ plan: newPlan });
    } catch (err: any) {
      console.error("Admin plan create error:", err);
      res.status(500).json({ error: err.message || "Failed to create plan" });
    }
  },
);

export default router;
