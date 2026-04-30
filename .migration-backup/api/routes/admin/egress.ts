import express, { type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { EgressBillingService } from "../../services/egressBillingService.js";

const router = express.Router();

const isMissingTableError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
};

router.get(
  "/egress/pricing",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const pricing = await EgressBillingService.listRegionPricing("linode");
      res.json({ pricing });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.json({ pricing: [] });
      }
      console.error("Admin egress pricing list error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch egress pricing" });
    }
  },
);

router.post(
  "/egress/pricing/sync",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const pricing = await EgressBillingService.syncRegionPricing("linode");
      res.json({ pricing });
    } catch (err: any) {
      console.error("Admin egress pricing sync error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to sync egress pricing" });
    }
  },
);

router.put(
  "/egress/pricing/:regionId",
  authenticateToken,
  requireAdmin,
  [
    param("regionId").isString().trim().notEmpty(),
    body("upcharge_price_per_gb").optional().isFloat({ min: 0 }),
    body("billing_enabled").optional().isBoolean(),
    body("region_label").optional().isString().trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const pricing = await EgressBillingService.updateRegionPricing({
        providerType: "linode",
        regionId: req.params.regionId,
        upchargePricePerGb:
          typeof req.body.upcharge_price_per_gb === "number"
            ? req.body.upcharge_price_per_gb
            : undefined,
        billingEnabled:
          typeof req.body.billing_enabled === "boolean"
            ? req.body.billing_enabled
            : undefined,
        regionLabel:
          typeof req.body.region_label === "string"
            ? req.body.region_label
            : undefined,
      });

      if (!pricing) {
        return res.status(404).json({ error: "Egress pricing region not found" });
      }

      res.json({ pricing });
    } catch (err: any) {
      console.error("Admin egress pricing update error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to update egress pricing" });
    }
  },
);

router.get(
  "/egress/live-usage",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const pools = await EgressBillingService.getLiveUsage(month);
      res.json({ pools });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.json({ pools: [] });
      }
      console.error("Admin egress live usage error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to build live egress usage" });
    }
  },
);

router.post(
  "/egress/execute",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const month =
        typeof req.body?.month === "string" ? req.body.month : undefined;
      const billingResult =
        await EgressBillingService.executeLiveBilling(month);
      res.json({ result: billingResult });
    } catch (err: any) {
      console.error("Admin egress execute billing error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to execute egress billing" });
    }
  },
);

router.get(
  "/egress/history",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const cycles = await EgressBillingService.listBillingHistory(month);
      res.json({ cycles });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.json({ cycles: [] });
      }
      console.error("Admin egress history error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to load egress history" });
    }
  },
);

export default router;
