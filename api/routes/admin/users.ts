import express, { type CookieOptions, type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import {
  formatValidationErrors,
  formatBusinessLogicError,
  formatServerError,
  BusinessValidation,
} from "../../lib/validation.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";

const router = express.Router();

const AUTH_COOKIE_NAME = "auth_token";

function getAuthCookieOptions(): CookieOptions {
  const isProduction = config.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

const isMissingTableError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
};

router.get(
  "/users",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.phone,
        u.timezone,
        u.created_at,
        u.updated_at,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'organizationId', om.organization_id,
              'organizationName', org.name,
              'organizationSlug', org.slug,
              'role', om.role
            )
          ) FILTER (WHERE om.organization_id IS NOT NULL),
          '[]'::jsonb
        ) AS organizations
      FROM users u
      LEFT JOIN organization_members om ON om.user_id = u.id
      LEFT JOIN organizations org ON org.id = om.organization_id
      GROUP BY u.id
      ORDER BY u.created_at DESC`,
      );
      res.json({ users: result.rows || [] });
    } catch (err: any) {
      console.error("Admin users list error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch users" });
    }
  },
);

router.get(
  "/users/search",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchQuery = (req.query.q as string) || "";
      const organizationId = req.query.organizationId as string;
      const page = parseInt((req.query.page as string) || "1");
      const limit = parseInt((req.query.limit as string) || "20");
      const offset = (page - 1) * limit;

      let baseQuery = `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.created_at,
          CASE
            WHEN om.user_id IS NOT NULL THEN true
            ELSE false
          END as is_already_member,
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'id', org.id,
                'name', org.name,
                'role', om2.role
              )
            ) FILTER (WHERE org.id IS NOT NULL),
            '[]'::jsonb
          ) AS organizations
        FROM users u
        LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = $1
        LEFT JOIN organization_members om2 ON om2.user_id = u.id
        LEFT JOIN organizations org ON org.id = om2.organization_id
      `;

      const params: any[] = [organizationId || null];
      let paramCount = 2;

      if (searchQuery) {
        baseQuery += ` WHERE (
          LOWER(u.name) LIKE LOWER($${paramCount}) OR
          LOWER(u.email) LIKE LOWER($${paramCount})
        )`;
        params.push(`%${searchQuery}%`);
        paramCount++;
      }

      baseQuery += `
        GROUP BY u.id, u.name, u.email, u.role, u.created_at, om.user_id
        ORDER BY
          CASE WHEN om.user_id IS NOT NULL THEN 1 ELSE 0 END,
          u.name ASC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      params.push(limit, offset);

      const result = await query(baseQuery, params);

      let countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
      `;

      const countParams: any[] = [];
      const countParamCount = 1;

      if (searchQuery) {
        countQuery += ` WHERE (
          LOWER(u.name) LIKE LOWER($${countParamCount}) OR
          LOWER(u.email) LIKE LOWER($${countParamCount})
        )`;
        countParams.push(`%${searchQuery}%`);
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const users = result.rows.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        isAlreadyMember: user.is_already_member,
        organizations: user.organizations || [],
      }));

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (err: any) {
      console.error("Admin user search error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to search users",
            "USER_SEARCH_ERROR",
          ),
        );
    }
  },
);

router.get(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  (req: Request, _res: Response, next) => {
    if (req.params.id === "search") {
      next("route");
      return;
    }
    next();
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const userResult = await query(
        `SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.phone,
          u.timezone,
          u.preferences,
          u.created_at,
          u.updated_at,
          COALESCE(
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'organizationId', om.organization_id,
                'organizationName', org.name,
                'organizationSlug', org.slug,
                'role', om.role,
                'joinedAt', om.created_at
              )
            ) FILTER (WHERE om.organization_id IS NOT NULL),
            '[]'::jsonb
          ) AS organizations
        FROM users u
        LEFT JOIN organization_members om ON om.user_id = u.id
        LEFT JOIN organizations org ON org.id = om.organization_id
        WHERE u.id = $1
        GROUP BY u.id`,
        [id],
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userResult.rows[0];

      const vpsCountResult = await query(
        `SELECT COUNT(*) as vps_count
         FROM vps_instances v
         JOIN organizations org ON org.id = v.organization_id
         JOIN organization_members om ON om.organization_id = org.id
         WHERE om.user_id = $1`,
        [id],
      );

      let lastActivity = null;
      try {
        const activityResult = await query(
          `SELECT created_at
           FROM activity_logs
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [id],
        );
        lastActivity = activityResult.rows[0]?.created_at || null;
      } catch (activityErr: any) {
        if (!isMissingTableError(activityErr)) {
          console.warn("Error fetching last activity for user:", activityErr);
        }
      }

      const detailedUser = {
        ...user,
        status: "active",
        activity_summary: {
          vps_count: parseInt(vpsCountResult.rows[0]?.vps_count || "0"),
          last_activity: lastActivity,
        },
      };

      res.json({ user: detailedUser });
    } catch (err: any) {
      console.error("Admin user detail error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch user details" });
    }
  },
);

router.get(
  "/users/:id/detail",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID().withMessage("Invalid user id")],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        res.status(400).json({ error: "Invalid user ID format" });
        return;
      }

      let userResult;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          userResult = await query(
            `SELECT
              u.id,
              u.email,
              u.name,
              u.role,
              u.phone,
              u.timezone,
              u.preferences,
              u.created_at,
              u.updated_at
            FROM users u
            WHERE u.id = $1
            GROUP BY u.id`,
            [id],
          );
          break;
        } catch (queryErr: any) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw queryErr;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!userResult || userResult.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userResult.rows[0];

      let vpsInstances: any[] = [];
      try {
        const vpsResult = await query(
          `SELECT
            v.id,
            v.label,
            v.status,
            v.ip_address,
            v.provider_type,
            v.backup_frequency,
            v.created_at,
            v.updated_at,
            p.name as plan_name,
            p.base_price,
            p.markup_price,
            sp.name as provider_name,
            sp.type as provider_type_name,
            COALESCE(v.configuration->>'region', 'unknown') as region_label
          FROM vps_instances v
          JOIN organizations org ON org.id = v.organization_id
          JOIN organization_members om ON om.organization_id = org.id
          LEFT JOIN vps_plans p ON p.id::text = v.plan_id OR p.id = v.plan_id::uuid
          LEFT JOIN service_providers sp ON sp.id = v.provider_id
          WHERE om.user_id = $1
          ORDER BY v.created_at DESC`,
          [id],
        );
        vpsInstances = vpsResult.rows || [];
      } catch (vpsErr: any) {
        console.warn("Error fetching VPS instances for user:", vpsErr.message);
        vpsInstances = [];
      }

      const billing = {
        wallet_balance: 0,
        monthly_spend: 0,
        total_spend: 0,
        total_payments: 0,
        last_payment_date: null,
        last_payment_amount: null,
        payment_history: [],
      };

      try {
        const walletResult = await query(
          `SELECT COALESCE(SUM(w.balance), 0) as total_balance
          FROM wallets w
          JOIN organizations org ON org.id = w.organization_id
          JOIN organization_members om ON om.organization_id = org.id
          WHERE om.user_id = $1`,
          [id],
        );

        if (walletResult.rows.length > 0) {
          billing.wallet_balance =
            parseFloat(walletResult.rows[0].total_balance) || 0;
        }

        const currentMonth = new Date();
        const startOfMonth = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          1,
        );

        const spendResult = await query(
          `SELECT
            COALESCE(SUM(CASE WHEN pt.created_at >= $2 THEN pt.amount ELSE 0 END), 0) as monthly_spend,
            COALESCE(SUM(pt.amount), 0) as total_spend,
            COUNT(*) as total_payments
          FROM payment_transactions pt
          JOIN organizations org ON org.id = pt.organization_id
          JOIN organization_members om ON om.organization_id = org.id
          WHERE om.user_id = $1
          AND pt.status = 'completed'`,
          [id, startOfMonth.toISOString()],
        );

        if (spendResult.rows.length > 0) {
          const spendData = spendResult.rows[0];
          billing.monthly_spend = parseFloat(spendData.monthly_spend) || 0;
          billing.total_spend = parseFloat(spendData.total_spend) || 0;
          billing.total_payments = parseInt(spendData.total_payments) || 0;
        }

        const paymentsResult = await query(
          `SELECT
            pt.id,
            pt.amount,
            pt.status,
            pt.payment_method,
            pt.description,
            pt.created_at
          FROM payment_transactions pt
          JOIN organizations org ON org.id = pt.organization_id
          JOIN organization_members om ON om.organization_id = org.id
          WHERE om.user_id = $1
          AND pt.status = 'completed'
          ORDER BY pt.created_at DESC
          LIMIT 10`,
          [id],
        );

        billing.payment_history = paymentsResult.rows || [];

        if (paymentsResult.rows && paymentsResult.rows.length > 0) {
          const lastPayment = paymentsResult.rows[0];
          billing.last_payment_date = lastPayment.created_at;
          billing.last_payment_amount = parseFloat(lastPayment.amount) || 0;
        }
      } catch (billingErr: any) {
        console.warn(
          "Error fetching billing data for user:",
          billingErr.message,
        );
      }

      let activity: any[] = [];
      try {
        const activityResult = await query(
          `SELECT
            id,
            event_type,
            entity_type,
            entity_id,
            message,
            status,
            created_at
          FROM activity_logs
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 20`,
          [id],
        );
        activity = activityResult.rows || [];
      } catch (activityErr: any) {
        console.warn(
          "Error fetching activity data for user:",
          activityErr.message,
        );
        activity = [];
      }

      let supportTickets: any[] = [];
      try {
        const ticketsResult = await query(
          `SELECT
            st.id,
            st.subject,
            st.status,
            st.priority,
            st.category,
            st.created_at,
            st.updated_at,
            org.name as organization_name
          FROM support_tickets st
          JOIN organizations org ON org.id = st.organization_id
          JOIN organization_members om ON om.organization_id = org.id
          WHERE om.user_id = $1
          ORDER BY st.created_at DESC
          LIMIT 10`,
          [id],
        );
        supportTickets = ticketsResult.rows || [];
      } catch (ticketsErr: any) {
        console.warn(
          "Error fetching support tickets for user:",
          ticketsErr.message,
        );
        supportTickets = [];
      }

      let totalOrganizations = 0;
      try {
        const orgsResult = await query(
          "SELECT COUNT(DISTINCT organization_id) as count FROM organization_members WHERE user_id = $1",
          [id],
        );
        if (orgsResult.rows.length > 0) {
          totalOrganizations = parseInt(orgsResult.rows[0].count) || 0;
        }
      } catch (orgsErr: any) {
        console.warn(
          "Error fetching organizations count for user:",
          orgsErr.message,
        );
      }

      const statistics = {
        totalVPS: vpsInstances.length,
        activeVPS: vpsInstances.filter((vps) => vps.status === "running")
          .length,
        totalSpend: billing.total_spend,
        monthlySpend: billing.monthly_spend,
        totalOrganizations,
        totalSupportTickets: supportTickets.length,
        openSupportTickets: supportTickets.filter(
          (ticket) => ticket.status === "open",
        ).length,
      };

      const detailedUser = {
        user: {
          ...user,
          preferences: user.preferences || {},
        },
        vpsInstances,
        billing,
        activity,
        supportTickets,
        statistics,
      };

      res.json(detailedUser);
    } catch (err: any) {
      console.error("Admin user comprehensive detail error:", err);

      let errorMessage = "Failed to fetch user details";
      if (err.message?.includes("invalid input syntax for type uuid")) {
        errorMessage = "Invalid user ID format";
      } else if (err.message?.includes("connection")) {
        errorMessage = "Database connection error";
      } else if (err.message) {
        errorMessage = err.message;
      }

      res.status(500).json({
        error: errorMessage,
        details: config.NODE_ENV === "development" ? err.stack : undefined,
      });
    }
  },
);

router.put(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id } = req.params;
      const { name, email, role, phone, timezone } = req.body as {
        name?: string;
        email?: string;
        role?: string;
        phone?: string;
        timezone?: string;
      };

      const userExists = await BusinessValidation.userExists(id);
      if (!userExists) {
        res
          .status(404)
          .json(formatBusinessLogicError("User not found", "USER_NOT_FOUND"));
        return;
      }

      if (email) {
        const emailUnique = await BusinessValidation.isUserEmailUnique(
          email,
          id,
        );
        if (!emailUnique) {
          res
            .status(400)
            .json(
              formatBusinessLogicError(
                "Email address already exists",
                "EMAIL_NOT_UNIQUE",
              ),
            );
          return;
        }
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramCount}`);
        values.push(name.trim());
        paramCount++;
      }

      if (email !== undefined) {
        updateFields.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }

      if (role !== undefined) {
        updateFields.push(`role = $${paramCount}`);
        values.push(role);
        paramCount++;
      }

      if (phone !== undefined) {
        updateFields.push(`phone = $${paramCount}`);
        values.push(phone.trim() || null);
        paramCount++;
      }

      if (timezone !== undefined) {
        updateFields.push(`timezone = $${paramCount}`);
        values.push(timezone.trim() || null);
        paramCount++;
      }

      if (updateFields.length === 0) {
        res
          .status(400)
          .json(formatBusinessLogicError("No fields to update", "NO_UPDATES"));
        return;
      }

      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      values.push(id);

      const updateResult = await query(
        `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
        values,
      );

      const updatedUser = updateResult.rows[0];

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "user.update",
            entityType: "user",
            entityId: id,
            message: `Updated user "${updatedUser.name}"`,
            status: "success",
            metadata: {
              userName: updatedUser.name,
              userEmail: updatedUser.email,
              changes: { name, email, role, phone, timezone },
            },
          },
          req,
        );
      }

      const { password, ...userResponse } = updatedUser;
      res.json({ user: userResponse });
    } catch (err: any) {
      console.error("Admin user update error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to update user",
            "USER_UPDATE_ERROR",
          ),
        );
    }
  },
);

router.delete(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID().withMessage("Invalid user id")],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const userCheck = await query(
        "SELECT id, email, name, role FROM users WHERE id = $1",
        [id],
      );

      if (userCheck.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userCheck.rows[0];

      if (user.role === "admin" && req.user?.role !== "admin") {
        res.status(403).json({ error: "Cannot delete admin users" });
        return;
      }

      if (user.id === req.user?.id) {
        res.status(403).json({ error: "Cannot delete your own account" });
        return;
      }

      const orgsResult = await query(
        `SELECT DISTINCT om.organization_id
        FROM organization_members om
        WHERE om.user_id = $1`,
        [id],
      );

      const organizationIds = orgsResult.rows.map((row) => row.organization_id);

      if (organizationIds.length > 0) {
        const walletCheck = await query(
          `SELECT organization_id, balance
          FROM wallets
          WHERE organization_id = ANY($1) AND balance < 0`,
          [organizationIds],
        );

        if (walletCheck.rows.length > 0) {
          res.status(400).json({
            error:
              "Cannot delete user with negative wallet balance. Outstanding payments must be resolved first.",
            details: {
              organizations_with_debt: walletCheck.rows.map((row) => ({
                organization_id: row.organization_id,
                balance: row.balance,
              })),
            },
          });
          return;
        }
      }

      if (organizationIds.length > 0) {
        const activeVpsCheck = await query(
          `SELECT COUNT(*) as count
          FROM vps_instances
          WHERE organization_id = ANY($1)
          AND status NOT IN ('deleted', 'terminated')`,
          [organizationIds],
        );

        if (parseInt(activeVpsCheck.rows[0].count) > 0) {
          res.status(400).json({
            error:
              "Cannot delete user with active VPS instances. All VPS instances must be terminated first.",
            details: {
              active_vps_count: activeVpsCheck.rows[0].count,
            },
          });
          return;
        }
      }

      const openTicketsCheck = await query(
        `SELECT COUNT(*) as count
        FROM support_tickets
        WHERE created_by = $1
        AND status NOT IN ('resolved', 'closed')`,
        [id],
      );

      if (parseInt(openTicketsCheck.rows[0].count) > 0) {
        res.status(400).json({
          error:
            "Cannot delete user with open support tickets. All tickets must be resolved or closed first.",
          details: {
            open_tickets_count: openTicketsCheck.rows[0].count,
          },
        });
        return;
      }

      await query("BEGIN");

      try {
        const orgsResult = await query(
          `SELECT DISTINCT om.organization_id
          FROM organization_members om
          WHERE om.user_id = $1`,
          [id],
        );

        const organizationIds = orgsResult.rows.map(
          (row) => row.organization_id,
        );

        await query(
          `DELETE FROM organization_invitations WHERE inviter_id = $1`,
          [id],
        );

        await query(
          `DELETE FROM support_ticket_replies
          WHERE ticket_id IN (
            SELECT id FROM support_tickets WHERE created_by = $1
          )`,
          [id],
        );

        await query(`DELETE FROM support_tickets WHERE created_by = $1`, [id]);

        await query(`DELETE FROM activity_logs WHERE user_id = $1`, [id]);

        if (organizationIds.length > 0) {
          await query(
            `DELETE FROM vps_instances
            WHERE organization_id = ANY($1)`,
            [organizationIds],
          );

          await query(
            `DELETE FROM payment_transactions
            WHERE organization_id = ANY($1)`,
            [organizationIds],
          );

          await query(
            `DELETE FROM wallets
            WHERE organization_id = ANY($1)`,
            [organizationIds],
          );
        }

        await query(`DELETE FROM organization_members WHERE user_id = $1`, [
          id,
        ]);

        if (organizationIds.length > 0) {
          await query(
            `DELETE FROM organizations
            WHERE id = ANY($1)
            AND owner_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM organization_members
              WHERE organization_id = organizations.id
            )`,
            [organizationIds, id],
          );
        }

        await query(`DELETE FROM users WHERE id = $1`, [id]);

        await query("COMMIT");

        if (req.user?.id) {
          await logActivity(
            {
              userId: req.user.id,
              organizationId: req.user.organizationId ?? null,
              eventType: "user_deleted",
              entityType: "user",
              entityId: id,
              message: `Deleted user account: ${user.email}`,
              status: "success",
              metadata: {
                deleted_user_email: user.email,
                deleted_user_name: user.name,
                deleted_user_role: user.role,
              },
            },
            req,
          );
        }

        res.status(204).send();
      } catch (deleteErr: any) {
        await query("ROLLBACK");
        throw deleteErr;
      }
    } catch (err: any) {
      console.error("Admin user delete error:", err);
      res.status(500).json({ error: err.message || "Failed to delete user" });
    }
  },
);

router.post(
  "/users/:id/impersonate",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID().withMessage("Invalid user id"),
    body("confirmAdminImpersonation").optional().isBoolean(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id: targetUserId } = req.params;
      const { confirmAdminImpersonation = false } = req.body;
      const adminUser = req.user!;

      const adminNameResult = await query(
        "SELECT name FROM users WHERE id = $1",
        [adminUser.id],
      );
      const adminName = adminNameResult.rows[0]?.name || "An administrator";

      const targetUserResult = await query(
        "SELECT id, email, name, role, phone, timezone, preferences, two_factor_enabled FROM users WHERE id = $1",
        [targetUserId],
      );

      if (targetUserResult.rows.length === 0) {
        res.status(404).json({ error: "Target user not found" });
        return;
      }

      const targetUser = targetUserResult.rows[0];

      const { validateImpersonationRequest } =
        await import("../../lib/security.js");
      const securityValidation = validateImpersonationRequest(
        adminUser,
        targetUser,
        confirmAdminImpersonation,
      );

      if (!securityValidation.isValid) {
        if (securityValidation.requiresConfirmation) {
          res.status(400).json({
            error: securityValidation.error,
            requiresConfirmation: true,
            targetUser: securityValidation.metadata?.targetUser,
          });
        } else {
          res.status(403).json({ error: securityValidation.error });
        }
        return;
      }

      let targetUserOrgId = null;
      try {
        const orgResult = await query(
          "SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1",
          [targetUserId],
        );
        if (orgResult.rows.length > 0) {
          targetUserOrgId = orgResult.rows[0].organization_id;
        } else {
          const ownerOrgResult = await query(
            "SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1",
            [targetUserId],
          );
          if (ownerOrgResult.rows.length > 0) {
            targetUserOrgId = ownerOrgResult.rows[0].id;
          }
        }
      } catch (orgErr) {
        console.warn("Error fetching target user organization:", orgErr);
      }

      const impersonationPayload = {
        userId: targetUser.id,
        originalAdminId: adminUser.id,
        isImpersonating: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      };

      const impersonationToken = jwt.sign(
        impersonationPayload,
        config.JWT_SECRET,
      );

      const { generateAuditMetadata } = await import("../../lib/security.js");
      const auditMetadata = generateAuditMetadata(
        req,
        "impersonation_start",
        targetUser,
        {
          admin_confirmation: confirmAdminImpersonation,
          target_user_role: targetUser.role,
          impersonation_token_expires: new Date(
            impersonationPayload.exp * 1000,
          ).toISOString(),
        },
      );

      await logActivity(
        {
          userId: adminUser.id,
          organizationId: adminUser.organizationId ?? null,
          eventType: "impersonation_start",
          entityType: "user",
          entityId: targetUserId,
          message: `Admin ${adminUser.email} started impersonating user ${
            targetUser.email
          }${
            targetUser.role === "admin"
              ? " (admin-to-admin with confirmation)"
              : ""
          }`,
          status: "warning",
          metadata: auditMetadata,
        },
        req,
      );

      await logActivity(
        {
          userId: targetUserId,
          organizationId: targetUserOrgId,
          eventType: "impersonation_target",
          entityType: "user",
          entityId: adminUser.id,
          message: `Your account is being accessed by admin ${adminName}`,
          status: "warning",
          metadata: {
            admin_user_id: adminUser.id,
            admin_user_name: adminName,
            impersonation_started_at: new Date().toISOString(),
          },
        },
        req,
      );

      const nameParts = (targetUser.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      res.cookie(AUTH_COOKIE_NAME, impersonationToken, getAuthCookieOptions());
      res.json({
        impersonationToken,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          firstName,
          lastName,
          role: targetUser.role,
          phone: targetUser.phone,
          timezone: targetUser.timezone,
          preferences: targetUser.preferences,
          twoFactorEnabled: targetUser.two_factor_enabled,
          organizationId: targetUserOrgId,
        },
        originalAdmin: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.email,
        },
        expiresAt: new Date(impersonationPayload.exp * 1000).toISOString(),
      });
    } catch (err: any) {
      console.error("Admin impersonation initiation error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to initiate impersonation" });
    }
  },
);

router.post(
  "/impersonation/exit",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;

      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        res.status(400).json({ error: "No token provided" });
        return;
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, config.JWT_SECRET);
      } catch {
        res.status(400).json({ error: "Invalid token" });
        return;
      }

      if (!decoded.isImpersonating || !decoded.originalAdminId) {
        res.status(400).json({ error: "Not an impersonation session" });
        return;
      }

      const adminResult = await query(
        "SELECT id, email, name, role, phone, timezone, preferences, two_factor_enabled FROM users WHERE id = $1",
        [decoded.originalAdminId],
      );

      if (adminResult.rows.length === 0) {
        res.status(400).json({ error: "Original admin user not found" });
        return;
      }

      const originalAdmin = adminResult.rows[0];

      let adminOrgId = null;
      try {
        const orgResult = await query(
          "SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1",
          [originalAdmin.id],
        );
        if (orgResult.rows.length > 0) {
          adminOrgId = orgResult.rows[0].organization_id;
        } else {
          const ownerOrgResult = await query(
            "SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1",
            [originalAdmin.id],
          );
          if (ownerOrgResult.rows.length > 0) {
            adminOrgId = ownerOrgResult.rows[0].id;
          }
        }
      } catch (orgErr) {
        console.warn("Error fetching admin organization:", orgErr);
      }

      const adminTokenPayload = {
        userId: originalAdmin.id,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      };

      const adminToken = jwt.sign(adminTokenPayload, config.JWT_SECRET);

      const impersonationDuration =
        Math.floor(Date.now() / 1000) - (decoded.iat || 0);
      const { generateAuditMetadata } = await import("../../lib/security.js");
      const auditMetadata = generateAuditMetadata(
        req,
        "impersonation_end",
        user,
        {
          impersonation_duration_seconds: impersonationDuration,
          impersonation_duration_human: `${Math.floor(
            impersonationDuration / 60,
          )} minutes`,
          original_admin_restored: true,
        },
      );

      await logActivity(
        {
          userId: originalAdmin.id,
          organizationId: adminOrgId,
          eventType: "impersonation_end",
          entityType: "user",
          entityId: user.id,
          message: `Admin ${originalAdmin.email} ended impersonation of user ${
            user.email
          } (duration: ${Math.floor(impersonationDuration / 60)} minutes)`,
          status: "info",
          metadata: auditMetadata,
        },
        req,
      );

      await logActivity(
        {
          userId: user.id,
          organizationId: user.organizationId ?? null,
          eventType: "impersonation_ended",
          entityType: "user",
          entityId: originalAdmin.id,
          message: `Admin access to your account by ${originalAdmin.name || "an administrator"} has ended`,
          status: "info",
          metadata: {
            admin_user_id: originalAdmin.id,
            admin_user_name: originalAdmin.name,
            impersonation_ended_at: new Date().toISOString(),
          },
        },
        req,
      );

      const nameParts = (originalAdmin.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      res.cookie(AUTH_COOKIE_NAME, adminToken, getAuthCookieOptions());
      res.json({
        adminToken,
        admin: {
          id: originalAdmin.id,
          email: originalAdmin.email,
          name: originalAdmin.name,
          firstName,
          lastName,
          role: originalAdmin.role,
          phone: originalAdmin.phone,
          timezone: originalAdmin.timezone,
          preferences: originalAdmin.preferences,
          twoFactorEnabled: originalAdmin.two_factor_enabled,
          organizationId: adminOrgId,
        },
        message: "Impersonation session ended successfully",
      });
    } catch (err: any) {
      console.error("Admin impersonation exit error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to exit impersonation" });
    }
  },
);

export default router;
