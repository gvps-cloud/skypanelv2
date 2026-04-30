import express, { type Request, type Response } from "express";
import { EnhanceToggleService } from "../../services/enhanceToggle.js";

const router = express.Router();

/**
 * GET /api/hosting/status
 * Public endpoint returning effective enablement only
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const enabled = await EnhanceToggleService.isEffectivelyEnabled();
    res.json({ enabled });
  } catch (error) {
    console.error("Failed to get hosting status:", error);
    res.status(500).json({ error: "Failed to get hosting status" });
  }
});

export default router;
