import express, { type Request, type Response } from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import {
  themeService,
  type StoredThemePreset,
} from "../../services/themeService.js";

const router = express.Router();

const allowedThemePresetIds = new Set([
  "teal",
  "mono",
  "red",
  "violet",
  "emerald",
  "amber",
  "rose",
  "blue",
  "slate",
  "orange",
  "zinc",
  "stone",
  "aurora",
  "midnight",
  "sage",
  "custom",
]);

const mergeCustomPreset = (
  incoming: unknown,
  existing: StoredThemePreset | null | undefined,
): StoredThemePreset | null => {
  if (incoming && typeof incoming === "object") {
    return incoming as StoredThemePreset;
  }
  return existing ?? null;
};

router.get("/theme", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const theme = await themeService.getThemeConfig();
    res.json({ theme });
  } catch (err: unknown) {
    console.error("Admin theme fetch error:", err);
    res.status(500).json({ error: "Failed to load theme configuration" });
  }
});

router.put(
  "/theme",
  authenticateToken,
  requireAdmin,
  [
    body("presetId").isString().trim().notEmpty(),
    body("customPreset").optional().isObject(),
  ],
  async (req: any, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { presetId: presetIdRaw, customPreset } = req.body as {
        presetId: string;
        customPreset?: unknown;
      };
      const presetId = presetIdRaw.trim();

      if (!allowedThemePresetIds.has(presetId)) {
        res.status(400).json({ error: "Invalid theme preset id" });
        return;
      }

      const currentConfig = await themeService.getThemeConfig();
      const mergedCustomPreset = mergeCustomPreset(
        customPreset,
        currentConfig.customPreset,
      );

      const theme = await themeService.updateThemeConfig({
        presetId,
        customPreset: mergedCustomPreset,
        updatedBy: req.user?.id ?? null,
      });

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "theme_update",
            entityType: "theme",
            entityId: theme.presetId,
            message: `Theme updated to ${theme.presetId}`,
            status: "success",
            metadata: {
              presetId: theme.presetId,
              hasCustomPreset: Boolean(theme.customPreset),
            },
          },
          req,
        );
      }

      res.json({ theme });
    } catch (err: unknown) {
      console.error("Admin theme update error:", err);
      res.status(500).json({ error: "Failed to update theme" });
    }
  },
);

export default router;
