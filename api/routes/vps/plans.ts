import express from 'express';
import type { Request, Response } from 'express';
import { query } from '../../lib/database.js';
import { sendSafeErrorResponse } from '../../lib/errorHandling.js';

const router = express.Router();

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
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
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications
       FROM vps_plans
       WHERE active = true
       ORDER BY created_at DESC`,
    );

    const plans = (result.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      provider_id: row.provider_id,
      provider_plan_id: row.provider_plan_id,
      base_price: row.base_price,
      markup_price: row.markup_price,
      backup_price_monthly: row.backup_price_monthly || 0,
      backup_price_hourly: row.backup_price_hourly || 0,
      backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
      backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
      daily_backups_enabled: row.daily_backups_enabled || false,
      weekly_backups_enabled: row.weekly_backups_enabled !== false,
      region_id: row.region_id,
      specifications: row.specifications,
    }));

    res.json({ plans });
  } catch (err) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch plans" });
  }
});

export default router;
