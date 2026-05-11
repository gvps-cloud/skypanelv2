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
  type RateLimitOverrideSummary,
} from "../../services/rateLimitOverrideService.js";
import {
  deleteRateLimitIpRule,
  listActiveRateLimitIpRules,
  upsertRateLimitIpRule,
  type RateLimitIpRuleSummary,
} from "../../services/rateLimitIpRuleService.js";
import { isValidIP, sanitizeIP } from "../../lib/ipDetection.js";

const router = express.Router();

function serializeOverride(override: RateLimitOverrideSummary) {
  return {
    ...override,
    expiresAt: override.expiresAt ? override.expiresAt.toISOString() : null,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
}

function serializeIpRule(rule: RateLimitIpRuleSummary) {
  return {
    ...rule,
    expiresAt: rule.expiresAt ? rule.expiresAt.toISOString() : null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

async function getRecentIpsForUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, Array<{ ip: string; lastSeen: string; count: number; sources: string[] }>>();
  }

  const { rows } = await query(
    `SELECT user_id, ip_address, MAX(last_seen) AS last_seen, SUM(event_count)::int AS event_count,
            array_agg(DISTINCT source) AS sources
     FROM (
       SELECT user_id, ip_address::text AS ip_address, MAX(created_at) AS last_seen,
              COUNT(*)::int AS event_count, 'activity'::text AS source
       FROM activity_logs
       WHERE user_id = ANY($1::uuid[])
         AND ip_address IS NOT NULL
         AND ip_address <> ''
       GROUP BY user_id, ip_address
       UNION ALL
       SELECT user_id, ip_address::text AS ip_address, MAX(created_at) AS last_seen,
              COUNT(*)::int AS event_count, 'fraudlabspro'::text AS source
       FROM fraud_checks
       WHERE user_id = ANY($1::uuid[])
         AND ip_address IS NOT NULL
       GROUP BY user_id, ip_address
     ) source_ips
     GROUP BY user_id, ip_address
     ORDER BY user_id, MAX(last_seen) DESC`,
    [userIds],
  );

  const recentIpsByUser = new Map<string, Array<{ ip: string; lastSeen: string; count: number; sources: string[] }>>();
  for (const row of rows) {
    const entries = recentIpsByUser.get(row.user_id) ?? [];
    if (entries.length >= 5) {
      continue;
    }
    entries.push({
      ip: row.ip_address,
      lastSeen: new Date(row.last_seen).toISOString(),
      count: Number(row.event_count ?? 0),
      sources: Array.isArray(row.sources) ? row.sources : [],
    });
    recentIpsByUser.set(row.user_id, entries);
  }

  return recentIpsByUser;
}

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

router.get(
  "/rate-limits/accounts/search",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchQuery = String(req.query.q ?? "").trim();
      const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 25);

      if (searchQuery.length < 2) {
        return res.status(400).json({
          success: false,
          error: "Search must contain at least 2 characters",
        });
      }

      const { rows } = await query(
        `SELECT
           u.id,
           u.email,
           u.name,
           u.role,
           u.created_at,
           o.id AS override_id,
           o.max_requests,
           o.window_ms,
           o.reason,
           o.created_by,
           o.expires_at,
           o.created_at AS override_created_at,
           o.updated_at AS override_updated_at
         FROM users u
         LEFT JOIN user_rate_limit_overrides o
           ON o.user_id = u.id
          AND (o.expires_at IS NULL OR o.expires_at > NOW())
         WHERE LOWER(u.email) LIKE LOWER($1)
            OR LOWER(u.name) LIKE LOWER($1)
         ORDER BY u.created_at DESC
         LIMIT $2`,
        [`%${searchQuery}%`, limit],
      );

      const recentIpsByUser = await getRecentIpsForUsers(rows.map((row) => row.id));

      const accounts = rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        role: row.role,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        recentIps: recentIpsByUser.get(row.id) ?? [],
        activeOverride: row.override_id
          ? {
              id: row.override_id,
              userId: row.id,
              userEmail: row.email,
              userName: row.name ?? null,
              maxRequests: Number(row.max_requests),
              windowMs: Number(row.window_ms),
              reason: row.reason ?? null,
              createdBy: row.created_by ?? null,
              expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
              createdAt: row.override_created_at ? new Date(row.override_created_at).toISOString() : null,
              updatedAt: row.override_updated_at ? new Date(row.override_updated_at).toISOString() : null,
            }
          : null,
      }));

      res.json({ success: true, accounts });
    } catch (error) {
      console.error("Failed to search rate limit accounts:", error);
      res.status(500).json({ success: false, error: "Failed to search accounts" });
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
        override: enriched ? serializeOverride(enriched) : override,
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

router.get(
  "/rate-limits/ip-rules",
  authenticateToken,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rules = await listActiveRateLimitIpRules();
      res.json({
        success: true,
        rules: rules.map(serializeIpRule),
      });
    } catch (error) {
      console.error("Failed to list rate limit IP rules:", error);
      res.status(500).json({ success: false, error: "Failed to load IP rules" });
    }
  },
);

router.post(
  "/rate-limits/ip-rules",
  authenticateToken,
  requireAdmin,
  [
    body("ipAddress")
      .isString()
      .custom((value) => isValidIP(sanitizeIP(value)))
      .withMessage("A valid IPv4 or IPv6 address is required"),
    body("ruleType").isIn(["trusted", "blocked"]),
    body("maxRequests").optional({ nullable: true }).isInt({ min: 1 }),
    body("windowMinutes").optional({ nullable: true }).isInt({ min: 1 }),
    body("reason").optional({ nullable: true }).isString().isLength({ max: 500 }),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { ipAddress, ruleType, maxRequests, windowMinutes, reason, expiresAt } = req.body;
      if (ruleType === "trusted" && (!maxRequests || !windowMinutes)) {
        return res.status(400).json({
          success: false,
          error: "Trusted IP rules require maxRequests and windowMinutes",
        });
      }

      const expiresDate = expiresAt ? new Date(expiresAt) : null;
      const rule = await upsertRateLimitIpRule({
        ipAddress,
        ruleType,
        maxRequests: ruleType === "trusted" ? Number(maxRequests) : null,
        windowMs: ruleType === "trusted" ? Number(windowMinutes) * 60 * 1000 : null,
        reason: reason ?? null,
        createdBy: req.user?.id ?? null,
        expiresAt: expiresDate,
      });

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "rate_limit_ip_rule_upsert",
            entityType: "rate_limit_ip_rule",
            entityId: rule.id,
            message: `Updated ${ruleType} rate limit IP rule for ${rule.ipAddress}`,
            status: "success",
            metadata: {
              ipAddress: rule.ipAddress,
              ruleType,
              maxRequests: rule.maxRequests,
              windowMinutes: rule.windowMs ? Math.round(rule.windowMs / 60000) : null,
              reason: rule.reason,
              expiresAt: expiresDate ? expiresDate.toISOString() : null,
            },
          },
          req,
        );
      }

      const rules = await listActiveRateLimitIpRules();
      const enriched = rules.find((entry) => entry.id === rule.id);
      res.json({ success: true, rule: enriched ? serializeIpRule(enriched) : rule });
    } catch (error: any) {
      console.error("Failed to upsert rate limit IP rule:", error);
      res.status(500).json({ success: false, error: error?.message ?? "Failed to save IP rule" });
    }
  },
);

router.delete(
  "/rate-limits/ip-rules/:id",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID()],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const removed = await deleteRateLimitIpRule(req.params.id);
      if (!removed) {
        return res.status(404).json({ success: false, error: "IP rule not found" });
      }

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "rate_limit_ip_rule_delete",
            entityType: "rate_limit_ip_rule",
            entityId: req.params.id,
            message: `Deleted rate limit IP rule ${req.params.id}`,
            status: "success",
          },
          req,
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rate limit IP rule:", error);
      res.status(500).json({ success: false, error: "Failed to delete IP rule" });
    }
  },
);

router.get(
  "/rate-limits/ip-activity",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const hours = Math.min(Math.max(Number(req.query.hours ?? 24), 1), 168);
      const ipFilter = typeof req.query.q === "string" ? req.query.q.trim() : null;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      const intervalClause = `NOW() - '${hours} hours'::interval`;

      const filterClause = ipFilter
        ? `AND combined.ip_address LIKE '%' || $1 || '%'`
        : '';
      const params: any[] = [];
      if (ipFilter) params.push(ipFilter);

      const countResult = await query(
        `SELECT COUNT(DISTINCT combined.ip_address)::int AS total
         FROM (
           SELECT ip_address::text AS ip_address FROM activity_logs
           WHERE ip_address IS NOT NULL AND ip_address <> ''
             AND created_at >= ${intervalClause}
           UNION
           SELECT ip_address::text AS ip_address FROM fraud_checks
           WHERE ip_address IS NOT NULL
             AND created_at >= ${intervalClause}
         ) combined
         WHERE 1=1 ${filterClause}`,
        params,
      );
      const total = countResult.rows[0]?.total ?? 0;

      const mainParams = [...params, limit, offset];
      const mainResult = await query(
        `SELECT
           combined.ip_address::text AS ip,
           MIN(combined.first_seen)  AS first_seen,
           MAX(combined.last_seen)   AS last_seen,
           SUM(combined.event_count)::int AS total_events,
           array_agg(DISTINCT combined.user_id::text) FILTER (WHERE combined.user_id IS NOT NULL) AS user_ids,
           array_agg(DISTINCT combined.event_type) AS event_types,
           MAX(combined.user_agent) AS last_user_agent,
           SUM(combined.event_count) FILTER (WHERE combined.source = 'activity')    AS activity_count,
           SUM(combined.event_count) FILTER (WHERE combined.source = 'login')        AS login_count,
           SUM(CASE WHEN combined.login_failed THEN combined.event_count ELSE 0 END)::int AS failed_login_count,
           SUM(combined.event_count) FILTER (WHERE combined.source = 'fraud_check')  AS fraud_check_count,
           SUM(combined.event_count) FILTER (WHERE combined.source = 'rate_limit')   AS rate_limit_count
         FROM (
            SELECT ip_address::text AS ip_address, user_id, NULL::text AS email,
                   event_type, user_agent,
                   MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
                   COUNT(*)::int AS event_count, 'activity'::text AS source, FALSE AS login_failed
            FROM activity_logs
            WHERE ip_address IS NOT NULL AND ip_address <> ''
              AND created_at >= ${intervalClause}
              AND event_type NOT IN ('rate_limit_violation', 'auth.login', 'auth.password_change', 'auth.2fa.enabled', 'auth.2fa.disabled')
            GROUP BY ip_address::text, user_id, event_type, user_agent
            UNION ALL
            SELECT ip_address::text AS ip_address, user_id, NULL::text AS email,
                   event_type, user_agent,
                   MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
                   COUNT(*)::int AS event_count, 'login'::text AS source,
                   CASE WHEN event_type = 'auth.login' AND status = 'warning' THEN TRUE ELSE FALSE END AS login_failed
            FROM activity_logs
            WHERE ip_address IS NOT NULL AND ip_address <> ''
              AND created_at >= ${intervalClause}
              AND event_type IN ('auth.login', 'auth.password_change', 'auth.2fa.enabled', 'auth.2fa.disabled')
            GROUP BY ip_address::text, user_id, event_type, user_agent, status
            UNION ALL
           SELECT ip_address::text AS ip_address, user_id, NULL::text AS email,
                  'fraud_check'::text AS event_type, NULL::text AS user_agent,
                  MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
                  COUNT(*)::int AS event_count, 'fraud_check'::text AS source, FALSE AS login_failed
           FROM fraud_checks
           WHERE ip_address IS NOT NULL
             AND created_at >= ${intervalClause}
           GROUP BY ip_address::text, user_id
           UNION ALL
           SELECT ip_address::text AS ip_address, user_id, NULL::text AS email,
                  'rate_limit_violation'::text AS event_type, user_agent,
                  MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
                  COUNT(*)::int AS event_count, 'rate_limit'::text AS source, FALSE AS login_failed
           FROM activity_logs
           WHERE ip_address IS NOT NULL AND ip_address <> ''
             AND event_type = 'rate_limit_violation'
             AND created_at >= ${intervalClause}
           GROUP BY ip_address::text, user_id, user_agent
         ) combined
         WHERE 1=1 ${filterClause}
         GROUP BY combined.ip_address
         ORDER BY total_events DESC, last_seen DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        mainParams,
      );

      const ipRows = mainResult.rows;
      const allUserIds = [...new Set(
        ipRows.flatMap((r: any) => (r.user_ids ?? []) as string[]).filter(Boolean),
      )];

      let userLookup = new Map<string, { email: string; name: string }>();
      if (allUserIds.length > 0) {
        const userResult = await query(
          `SELECT id::text AS id, email, name FROM users WHERE id = ANY($1::uuid[])`,
          [allUserIds],
        );
        for (const row of userResult.rows) {
          userLookup.set(row.id, { email: row.email, name: row.name ?? "" });
        }
      }

      const ipRuleLookup = new Map<string, "blocked" | "trusted">();
      try {
        const activeRules = await listActiveRateLimitIpRules();
        for (const rule of activeRules) {
          ipRuleLookup.set(rule.ipAddress, rule.ruleType as "blocked" | "trusted");
        }
      } catch { /* non-critical */ }

      const ips = ipRows.map((row: any) => ({
        ip: row.ip,
        firstSeen: row.first_seen ? new Date(row.first_seen).toISOString() : null,
        lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
        totalEvents: Number(row.total_events ?? 0),
        activityCount: Number(row.activity_count ?? 0),
        loginCount: Number(row.login_count ?? 0),
        failedLoginCount: Number(row.failed_login_count ?? 0),
        fraudCheckCount: Number(row.fraud_check_count ?? 0),
        rateLimitCount: Number(row.rate_limit_count ?? 0),
        eventTypes: Array.isArray(row.event_types) ? row.event_types : [],
        lastUserAgent: row.last_user_agent ?? null,
        users: (row.user_ids ?? [])
          .filter((uid: string) => uid && userLookup.has(uid))
          .map((uid: string) => {
            const u = userLookup.get(uid)!;
            return { id: uid, email: u.email, name: u.name };
          }),
        ipRuleStatus: ipRuleLookup.has(row.ip)
          ? ipRuleLookup.get(row.ip)!
          : ("none" as const),
      }));

      res.json({
        success: true,
        ips,
        pagination: { total, limit, offset },
      });
    } catch (error) {
      console.error("Failed to load IP activity:", error);
      res.status(500).json({ success: false, error: "Failed to load IP activity" });
    }
  },
);

router.get(
  "/rate-limits/ip-activity/:ip/events",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetIp = req.params.ip;
      if (!targetIp) {
        return res.status(400).json({ success: false, error: "IP address is required" });
      }

      const hours = Math.min(Math.max(Number(req.query.hours ?? 24), 1), 168);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      const intervalClause = `NOW() - '${hours} hours'::interval`;

      const countResult = await query(
        `SELECT COUNT(*)::int AS total FROM activity_logs
         WHERE ip_address = $1 AND ip_address IS NOT NULL AND ip_address <> ''
           AND created_at >= ${intervalClause}`,
        [targetIp],
      );
      const total = countResult.rows[0]?.total ?? 0;

      const result = await query(
        `SELECT a.id, a.event_type, a.message, a.status, a.metadata,
                a.ip_address::text AS ip_address, a.user_agent, a.created_at,
                a.user_id,
                u.email AS user_email, u.name AS user_name
         FROM activity_logs a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.ip_address = $1 AND a.ip_address IS NOT NULL AND a.ip_address <> ''
           AND a.created_at >= ${intervalClause}
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [targetIp, limit, offset],
      );

      const events = result.rows.map((row: any) => ({
        id: row.id,
        eventType: row.event_type,
        message: row.message ?? null,
        status: row.status,
        userId: row.user_id ?? null,
        userEmail: row.user_email ?? null,
        userName: row.user_name ?? null,
        ipAddress: row.ip_address,
        userAgent: row.user_agent ?? null,
        metadata: row.metadata ?? {},
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      }));

      res.json({
        success: true,
        events,
        pagination: { total, limit, offset },
      });
    } catch (error) {
      console.error("Failed to load IP events:", error);
      res.status(500).json({ success: false, error: "Failed to load IP events" });
    }
  },
);

export default router;
