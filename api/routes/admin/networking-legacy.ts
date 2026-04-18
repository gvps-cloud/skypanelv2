import express, { type Request, type Response } from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { config } from "../../config/index.js";

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
  "/networking/rdns",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        "SELECT * FROM networking_config ORDER BY updated_at DESC LIMIT 1",
      );
      const networkingConfig = result.rows?.[0] || null;
      if (networkingConfig) {
        return res.json({ config: networkingConfig });
      }
      return res.json({ config: { rdns_base_domain: config.RDNS_BASE_DOMAIN } });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.json({
          config: { rdns_base_domain: config.RDNS_BASE_DOMAIN },
          warning: "networking_config table not found. Apply migrations.",
        });
      }
      console.error("Admin networking rDNS get error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch rDNS configuration" });
    }
  },
);

router.put(
  "/networking/rdns",
  authenticateToken,
  requireAdmin,
  [
    body("rdns_base_domain")
      .isString()
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage("Invalid rDNS base domain"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const now = new Date().toISOString();
      const baseDomainRaw: string = String(
        req.body.rdns_base_domain || "",
      ).trim();
      const baseDomain = baseDomainRaw.replace(/^\.+|\.+$/g, "");

      try {
        const latest = await query(
          "SELECT id FROM networking_config ORDER BY updated_at DESC LIMIT 1",
        );
        if (latest.rows?.length) {
          const id = latest.rows[0].id;
          const upd = await query(
            "UPDATE networking_config SET rdns_base_domain = $1, updated_at = $2 WHERE id = $3 RETURNING *",
            [baseDomain, now, id],
          );
          return res.json({ config: upd.rows[0] });
        } else {
          const ins = await query(
            "INSERT INTO networking_config (rdns_base_domain, created_at, updated_at) VALUES ($1, $2, $2) RETURNING *",
            [baseDomain, now],
          );
          return res.json({ config: ins.rows[0] });
        }
      } catch (err: any) {
        if (isMissingTableError(err)) {
          return res.status(400).json({
            error:
              "networking_config table not found. Apply migrations before updating.",
          });
        }
        throw err;
      }
    } catch (err: any) {
      console.error("Admin networking rDNS upsert error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to save rDNS configuration" });
    }
  },
);

export default router;
