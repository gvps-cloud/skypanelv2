import express, { type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import {
  listActiveRateLimitOverrides,
  upsertRateLimitOverride,
  deleteRateLimitOverride,
} from "../../services/rateLimitOverrideService.js";

const router = express.Router();

router.get(
  "/rate-limits/overrides",
  authenticateToken,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const overrides = await listActiveRateLimitOverrides();
      res.json({
        success: true,
        overrides,
      });
    } catch (error) {
      console.error("Failed to list rate limit overrides:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to load overrides" });
    }
  },
);

router.post(
  "/rate-limits/overrides",
  authenticateToken,
  requireAdmin,
  [
    body("userId").optional().isUUID(),
    body("email")
      .optional()
      .isEmail()
      .withMessage("A valid email is required when userId is not provided"),
    body("maxRequests")
      .isInt({ min: 1 })
      .withMessage("maxRequests must be a positive integer"),
    body("windowMinutes")
      .isInt({ min: 1 })
      .withMessage("windowMinutes must be a positive integer"),
    body("reason").optional().isString().isLength({ max: 500 }),
    body("expiresAt").optional().isISO8601(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        userId: rawUserId,
        email,
        maxRequests,
        windowMinutes,
        reason,
        expiresAt,
      } = req.body;

      if (!rawUserId && !email) {
        return res.status(400).json({
          success: false,
          error:
            "Either userId or email must be provided to create an override.",
        });
      }

      let userId = rawUserId as string | undefined;

      if (!userId && email) {
        if (typeof email !== "string") {
          return res.status(400).json({
            success: false,
            error: "Email must be a string.",
          });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const { rows } = await query(
          "SELECT id FROM users WHERE LOWER(email) = $1",
          [normalizedEmail],
        );
        if (!rows[0]) {
          return res
            .status(404)
            .json({ success: false, error: "User not found" });
        }
        userId = rows[0].id;
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "Unable to resolve user for override.",
        });
      }

      const expiresDate = expiresAt ? new Date(expiresAt) : null;

      const override = await upsertRateLimitOverride({
        userId,
        maxRequests: Number(maxRequests),
        windowMs: Number(windowMinutes) * 60 * 1000,
        reason: reason ?? null,
        createdBy: req.user?.id ?? null,
        expiresAt: expiresDate,
      });

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "rate_limit_override_upsert",
            entityType: "user",
            entityId: userId,
            message: `Updated rate limit override for user ${userId}`,
            status: "success",
            metadata: {
              maxRequests: Number(maxRequests),
              windowMinutes: Number(windowMinutes),
              reason: reason ?? null,
              expiresAt: expiresDate ? expiresDate.toISOString() : null,
            },
          },
          req,
        );
      }

      const overrides = await listActiveRateLimitOverrides();
      const enriched = overrides.find((entry) => entry.id === override.id);

      res.json({
        success: true,
        override: enriched ?? override,
      });
    } catch (error) {
      console.error("Failed to upsert rate limit override:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to save override" });
    }
  },
);

router.delete(
  "/rate-limits/overrides/:userId",
  authenticateToken,
  requireAdmin,
  [param("userId").isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const targetUserId = req.params.userId;
      const removed = await deleteRateLimitOverride(targetUserId);

      if (!removed) {
        return res
          .status(404)
          .json({ success: false, error: "Override not found" });
      }

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "rate_limit_override_delete",
            entityType: "user",
            entityId: targetUserId,
            message: `Deleted rate limit override for user ${targetUserId}`,
            status: "success",
          },
          req,
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rate limit override:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete override" });
    }
  },
);

export default router;
