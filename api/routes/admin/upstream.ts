import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { linodeService } from "../../services/linodeService.js";

const router = express.Router();

router.get(
  "/upstream/plans",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const provider = await query(
        "SELECT id FROM service_providers WHERE type = 'linode' AND active = true LIMIT 1",
      );
      if (provider.rows.length === 0) {
        return res.json({ plans: [] });
      }
      const plans = await linodeService.getLinodeTypes();

      const plansWithBackupPricing = plans.map((plan: any) => ({
        ...plan,
        backup_price_monthly: plan.addons?.backups?.price?.monthly || 0,
        backup_price_hourly: plan.addons?.backups?.price?.hourly || 0,
      }));

      res.json({ plans: plansWithBackupPricing });
    } catch (err: any) {
      console.error("Admin upstream plans error:", err);
      res.json({ plans: [], error: err.message });
    }
  },
);

router.get(
  "/upstream/regions",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const regions = await linodeService.getLinodeRegions();
      res.json({ regions });
    } catch (err: any) {
      console.error("Error fetching upstream provider regions:", err);
      res.status(500).json({
        error: err.message || "Failed to fetch upstream provider regions",
        details:
          "Make sure upstream provider API token is configured in environment variables",
      });
    }
  },
);

router.get(
  "/upstream/stackscripts",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const mine = String(req.query.mine || "").toLowerCase() === "true";
      const stackscripts = await linodeService.getLinodeStackScripts({
        mineOnly: mine,
      });
      res.json({ stackscripts });
    } catch (err: any) {
      console.error("Error fetching upstream provider StackScripts:", err);
      res.status(500).json({
        error: err.message || "Failed to fetch StackScripts",
        details:
          "Make sure upstream provider API token is configured in environment variables",
      });
    }
  },
);

export default router;
