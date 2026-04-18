import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";

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
  "/stackscripts/configs",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        "SELECT * FROM vps_stackscript_configs ORDER BY display_order ASC, label ASC",
      );
      res.json({ configs: result.rows || [] });
    } catch (err: any) {
      console.error("Error fetching StackScript configs:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch StackScript configs" });
    }
  },
);

router.post(
  "/stackscripts/configs",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        stackscript_id,
        label,
        description,
        is_enabled,
        display_order,
        metadata,
      } = req.body;
      const now = new Date().toISOString();

      let metadataValue = {};
      if (metadata !== undefined && metadata !== null) {
        metadataValue =
          typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      }

      const result = await query(
        `INSERT INTO vps_stackscript_configs
        (stackscript_id, label, description, is_enabled, display_order, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, TRUE), COALESCE($5, 0), $6, $7, $7)
       ON CONFLICT (stackscript_id) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         is_enabled = EXCLUDED.is_enabled,
         display_order = EXCLUDED.display_order,
         metadata = EXCLUDED.metadata,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
        [
          stackscript_id,
          label,
          description,
          is_enabled,
          display_order,
          metadataValue,
          now,
        ],
      );
      res.status(201).json({ config: result.rows[0] });
    } catch (err: any) {
      console.error("Error upserting StackScript config:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to upsert StackScript config" });
    }
  },
);

router.put(
  "/stackscripts/configs/:id",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { label, description, is_enabled, display_order, metadata } =
        req.body;
      const now = new Date().toISOString();

      let metadataValue = {};
      if (metadata !== undefined && metadata !== null) {
        metadataValue =
          typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      }

      const result = await query(
        `UPDATE vps_stackscript_configs SET
        label = COALESCE($1, label),
        description = COALESCE($2, description),
        is_enabled = COALESCE($3, is_enabled),
        display_order = COALESCE($4, display_order),
        metadata = COALESCE($5, metadata),
        updated_at = $6
      WHERE stackscript_id = $7 RETURNING *`,
        [label, description, is_enabled, display_order, metadataValue, now, id],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Config not found" });
      }
      res.json({ config: result.rows[0] });
    } catch (err: any) {
      console.error("Error updating StackScript config:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to update StackScript config" });
    }
  },
);

router.delete(
  "/stackscripts/configs/:id",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await query(
        "DELETE FROM vps_stackscript_configs WHERE stackscript_id = $1",
        [id],
      );
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting StackScript config:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to delete StackScript config" });
    }
  },
);

export default router;
