import express, { type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import {
  OrganizationValidation,
  MemberValidation,
  BusinessValidation,
  formatValidationErrors,
  formatBusinessLogicError,
  formatServerError,
} from "../../lib/validation.js";

const router = express.Router();

const normalizeOrganizationRoleName = (roleName?: string | null) => {
  if (!roleName) return null;
  return roleName === "member" ? "viewer" : roleName;
};

const toLegacyOrganizationMemberRole = (roleName?: string | null) => {
  const normalizedRoleName = normalizeOrganizationRoleName(roleName);

  if (normalizedRoleName === "owner") return "owner";
  if (normalizedRoleName === "admin") return "admin";
  return "member";
};

const buildAdminOrganizationQuery = (whereClause = "") => `
  SELECT
    org.id,
    org.name,
    org.slug,
    org.owner_id AS "ownerId",
    org.settings->>'description' AS description,
    org.created_at AS "createdAt",
    org.updated_at AS "updatedAt",
    owner.name AS "ownerName",
    owner.email AS "ownerEmail",
    COALESCE(
      (
        SELECT COUNT(*)::INTEGER
        FROM organization_members om
        WHERE om.organization_id = org.id
      ),
      0
    ) AS "memberCount",
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'userId', member_user.id,
            'userName', member_user.name,
            'userEmail', member_user.email,
            'role', COALESCE(
              role_by_id.name,
              legacy_role.name,
              CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END,
              'viewer'
            ),
            'roleId', COALESCE(role_by_id.id, legacy_role.id),
            'roleName', COALESCE(
              role_by_id.name,
              legacy_role.name,
              CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END,
              'viewer'
            ),
            'userRole', member_user.role,
            'joinedAt', om.created_at
          )
          ORDER BY
            CASE COALESCE(
              role_by_id.name,
              legacy_role.name,
              CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END,
              'viewer'
            )
              WHEN 'owner' THEN 0
              WHEN 'admin' THEN 1
              WHEN 'vps_manager' THEN 2
              WHEN 'support_agent' THEN 3
              WHEN 'viewer' THEN 4
              ELSE 5
            END,
            LOWER(COALESCE(member_user.name, member_user.email, ''))
        )
        FROM organization_members om
        JOIN users member_user ON member_user.id = om.user_id
        LEFT JOIN organization_roles role_by_id ON role_by_id.id = om.role_id
        LEFT JOIN organization_roles legacy_role
          ON legacy_role.organization_id = om.organization_id
         AND legacy_role.name = CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END
        WHERE om.organization_id = org.id
      ),
      '[]'::jsonb
    ) AS members,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', role.id,
            'name', role.name,
            'permissions', role.permissions,
            'isCustom', role.is_custom,
            'createdAt', role.created_at,
            'updatedAt', role.updated_at
          )
          ORDER BY role.is_custom ASC, LOWER(role.name)
        )
        FROM organization_roles role
        WHERE role.organization_id = org.id
      ),
      '[]'::jsonb
    ) AS roles
  FROM organizations org
  LEFT JOIN users owner ON owner.id = org.owner_id
  ${whereClause}
  ORDER BY org.created_at DESC`;

const DEFAULT_ADMIN_ORGANIZATION_PAGE_SIZE = 10;
const MAX_ADMIN_ORGANIZATION_PAGE_SIZE = 200;
type QueryParamValue = Request["query"][string];

const clampOrganizationPageSize = (value?: number) => {
  if (!Number.isFinite(value ?? NaN)) {
    return DEFAULT_ADMIN_ORGANIZATION_PAGE_SIZE;
  }

  const positiveValue = Math.max(1, Math.floor(value as number));
  return Math.min(positiveValue, MAX_ADMIN_ORGANIZATION_PAGE_SIZE);
};

const parsePositivePageParam = (
  rawValue: QueryParamValue,
  fallback: number,
) => {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
};

const fetchAdminOrganizations = async (options?: {
  limit?: number;
  offset?: number;
}) => {
  const limit = clampOrganizationPageSize(options?.limit);
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));

  const result = await query(
    `${buildAdminOrganizationQuery()} LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return result.rows || [];
};

const fetchAdminOrganizationById = async (organizationId: string) => {
  const result = await query(buildAdminOrganizationQuery("WHERE org.id = $1"), [
    organizationId,
  ]);
  return result.rows[0] ?? null;
};

const getOrganizationRoleByName = async (
  organizationId: string,
  roleName: string,
) => {
  const result = await query(
    `SELECT id, name
     FROM organization_roles
     WHERE organization_id = $1 AND name = $2`,
    [organizationId, roleName],
  );

  return result.rows[0] ?? null;
};

const resolveOrganizationRoleSelection = async (
  organizationId: string,
  selection: { role?: string; roleId?: string },
) => {
  if (selection.roleId) {
    const result = await query(
      `SELECT id, name
       FROM organization_roles
       WHERE id = $1 AND organization_id = $2`,
      [selection.roleId, organizationId],
    );

    return result.rows[0] ?? null;
  }

  const normalizedRoleName = normalizeOrganizationRoleName(selection.role);
  if (!normalizedRoleName) {
    return null;
  }

  return getOrganizationRoleByName(organizationId, normalizedRoleName);
};

router.get(
  "/organizations",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const requestedPage = parsePositivePageParam(req.query.page, 1);
      const requestedLimit = parsePositivePageParam(
        req.query.limit,
        DEFAULT_ADMIN_ORGANIZATION_PAGE_SIZE,
      );
      const pageSize = clampOrganizationPageSize(requestedLimit);

      if (search && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        const result = await query(
          `SELECT id, name, slug, owner_id
           FROM organizations
           WHERE name ILIKE $1 OR slug ILIKE $1
           ORDER BY name
           LIMIT 20`,
          [searchPattern]
        );

        return res.json({
          success: true,
          organizations: result.rows.map((org: any) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            owner_id: org.owner_id,
          })),
        });
      }

      const [organizationCountResult, memberCountResult] = await Promise.all([
        query("SELECT COUNT(*)::INTEGER AS total FROM organizations"),
        query("SELECT COUNT(*)::INTEGER AS total FROM organization_members"),
      ]);

      const totalOrganizations =
        organizationCountResult.rows[0]?.total ?? 0;
      const totalMembers = memberCountResult.rows[0]?.total ?? 0;
      const totalPages =
        totalOrganizations === 0
          ? 1
          : Math.max(1, Math.ceil(totalOrganizations / pageSize));
      const safePage =
        totalOrganizations === 1
          ? 1
          : Math.min(Math.max(requestedPage, 1), totalPages);
      const offset = (safePage - 1) * pageSize;

      const organizations = await fetchAdminOrganizations({
        limit: pageSize,
        offset,
      });

      res.json({
        organizations,
        pagination: {
          page: safePage,
          pageSize,
          totalItems: totalOrganizations,
          totalPages,
        },
        statistics: {
          totalMembers,
        },
      });
    } catch (err: any) {
      console.error("Admin organizations list error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch organizations" });
    }
  },
);

router.post(
  "/organizations",
  authenticateToken,
  requireAdmin,
  OrganizationValidation.create,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { name, slug, ownerId, description } = req.body as {
        name: string;
        slug: string;
        ownerId: string;
        description?: string;
      };

      const ownerExists = await BusinessValidation.userExists(ownerId);
      if (!ownerExists) {
        res
          .status(400)
          .json(
            formatBusinessLogicError("Owner user not found", "USER_NOT_FOUND"),
          );
        return;
      }

      const nameUnique =
        await BusinessValidation.isOrganizationNameUnique(name);
      if (!nameUnique) {
        res
          .status(400)
          .json(
            formatBusinessLogicError(
              "Organization name already exists",
              "NAME_NOT_UNIQUE",
            ),
          );
        return;
      }

      const slugUnique =
        await BusinessValidation.isOrganizationSlugUnique(slug);
      if (!slugUnique) {
        res
          .status(400)
          .json(
            formatBusinessLogicError(
              "Organization slug already exists",
              "SLUG_NOT_UNIQUE",
            ),
          );
        return;
      }

      const now = new Date().toISOString();

      await query("BEGIN");

      try {
        const orgResult = await query(
          `INSERT INTO organizations (name, slug, owner_id, settings, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [name, slug, ownerId, description ? { description } : {}, now, now],
        );

        const organization = orgResult.rows[0];

        const ownerRole = await getOrganizationRoleByName(organization.id, "owner");
        if (!ownerRole) {
          throw new Error("Failed to resolve organization owner role");
        }

        await query(
          `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [organization.id, ownerId, "owner", ownerRole.id, now],
        );

        await query(
          `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [organization.id, 0.0, "USD", now, now],
        );

        await query("COMMIT");

        if (req.user?.id) {
          await logActivity(
            {
              userId: req.user.id,
              organizationId: organization.id,
              eventType: "organization.create",
              entityType: "organization",
              entityId: organization.id,
              message: `Created organization "${name}"`,
              status: "success",
              metadata: {
                organizationName: name,
                organizationSlug: slug,
                ownerId: ownerId,
              },
            },
            req,
          );
        }

        const createdOrganization = await fetchAdminOrganizationById(organization.id);

        res.status(201).json({
          organization: createdOrganization,
        });
      } catch (transactionError) {
        await query("ROLLBACK");
        throw transactionError;
      }
    } catch (err: any) {
      console.error("Admin organization create error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to create organization",
            "ORGANIZATION_CREATE_ERROR",
          ),
        );
    }
  },
);

router.put(
  "/organizations/:id",
  authenticateToken,
  requireAdmin,
  OrganizationValidation.update,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id } = req.params;
      const { name, slug, description } = req.body as {
        name?: string;
        slug?: string;
        description?: string;
      };

      const organizationExists =
        await BusinessValidation.organizationExists(id);
      if (!organizationExists) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Organization not found",
              "ORGANIZATION_NOT_FOUND",
            ),
          );
        return;
      }

      const orgResult = await query(
        "SELECT * FROM organizations WHERE id = $1",
        [id],
      );
      const existingOrg = orgResult.rows[0];

      if (name && name !== existingOrg.name) {
        const nameUnique = await BusinessValidation.isOrganizationNameUnique(
          name,
          id,
        );
        if (!nameUnique) {
          res
            .status(400)
            .json(
              formatBusinessLogicError(
                "Organization name already exists",
                "NAME_NOT_UNIQUE",
              ),
            );
          return;
        }
      }

      if (slug && slug !== existingOrg.slug) {
        const slugUnique = await BusinessValidation.isOrganizationSlugUnique(
          slug,
          id,
        );
        if (!slugUnique) {
          res
            .status(400)
            .json(
              formatBusinessLogicError(
                "Organization slug already exists",
                "SLUG_NOT_UNIQUE",
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
        values.push(name);
        paramCount++;
      }

      if (slug !== undefined) {
        updateFields.push(`slug = $${paramCount}`);
        values.push(slug);
        paramCount++;
      }

      if (description !== undefined) {
        const newSettings = { ...existingOrg.settings, description };
        updateFields.push(`settings = $${paramCount}`);
        values.push(JSON.stringify(newSettings));
        paramCount++;
      }

      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date().toISOString());
      paramCount++;

      values.push(id);

      const updateResult = await query(
        `UPDATE organizations SET ${updateFields.join(", ")} WHERE id = $${paramCount} RETURNING *`,
        values,
      );

      const updatedOrg = updateResult.rows[0];

      const organizationWithMembers = await fetchAdminOrganizationById(id);

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: id,
            eventType: "organization.update",
            entityType: "organization",
            entityId: id,
            message: `Updated organization "${updatedOrg.name}"`,
            status: "success",
            metadata: {
              organizationName: updatedOrg.name,
              organizationSlug: updatedOrg.slug,
              changes: { name, slug, description },
            },
          },
          req,
        );
      }

      res.json({ organization: organizationWithMembers });
    } catch (err: any) {
      console.error("Admin organization update error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to update organization",
            "ORGANIZATION_UPDATE_ERROR",
          ),
        );
    }
  },
);

router.delete(
  "/organizations/:id",
  authenticateToken,
  requireAdmin,
  OrganizationValidation.delete,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id } = req.params;

      const organizationExists =
        await BusinessValidation.organizationExists(id);
      if (!organizationExists) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Organization not found",
              "ORGANIZATION_NOT_FOUND",
            ),
          );
        return;
      }

      const orgNameResult = await query(
        "SELECT name FROM organizations WHERE id = $1",
        [id],
      );
      const organizationName = orgNameResult.rows[0].name;

      const vpsCount = await query(
        "SELECT COUNT(*) as count FROM vps_instances WHERE organization_id = $1",
        [id],
      );

      const memberCount = await query(
        "SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1",
        [id],
      );

      const ticketCount = await query(
        "SELECT COUNT(*) as count FROM support_tickets WHERE organization_id = $1",
        [id],
      );

      await query("BEGIN");

      try {
        await query("DELETE FROM vps_instances WHERE organization_id = $1", [
          id,
        ]);

        await query(
          "DELETE FROM support_ticket_replies WHERE ticket_id IN (SELECT id FROM support_tickets WHERE organization_id = $1)",
          [id],
        );
        await query("DELETE FROM support_tickets WHERE organization_id = $1", [
          id,
        ]);

        await query(
          "DELETE FROM payment_transactions WHERE organization_id = $1",
          [id],
        );

        await query("DELETE FROM wallets WHERE organization_id = $1", [id]);

        await query(
          "DELETE FROM organization_members WHERE organization_id = $1",
          [id],
        );

        await query("DELETE FROM activity_logs WHERE organization_id = $1", [
          id,
        ]);

        await query("DELETE FROM organizations WHERE id = $1", [id]);

        await query("COMMIT");

        if (req.user?.id) {
          await logActivity(
            {
              userId: req.user.id,
              organizationId: null,
              eventType: "organization.delete",
              entityType: "organization",
              entityId: id,
              message: `Deleted organization "${organizationName}"`,
              status: "success",
              metadata: {
                organizationName,
                resourcesDeleted: {
                  vpsInstances: parseInt(vpsCount.rows[0].count),
                  members: parseInt(memberCount.rows[0].count),
                  supportTickets: parseInt(ticketCount.rows[0].count),
                },
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
      console.error("Admin organization delete error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to delete organization",
            "ORGANIZATION_DELETE_ERROR",
          ),
        );
    }
  },
);

router.post(
  "/organizations/:id/members",
  authenticateToken,
  requireAdmin,
  MemberValidation.add,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id: organizationId } = req.params;
      const { userId, role, roleId } = req.body as {
        userId: string;
        role?: string;
        roleId?: string;
      };

      const organizationExists =
        await BusinessValidation.organizationExists(organizationId);
      if (!organizationExists) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Organization not found",
              "ORGANIZATION_NOT_FOUND",
            ),
          );
        return;
      }

      const userExists = await BusinessValidation.userExists(userId);
      if (!userExists) {
        res
          .status(400)
          .json(formatBusinessLogicError("User not found", "USER_NOT_FOUND"));
        return;
      }

      const isAlreadyMember =
        await BusinessValidation.isUserMemberOfOrganization(
          userId,
          organizationId,
        );
      if (isAlreadyMember) {
        res
          .status(400)
          .json(
            formatBusinessLogicError(
              "User is already a member of this organization",
              "USER_ALREADY_MEMBER",
            ),
          );
        return;
      }

      const orgResult = await query(
        "SELECT name, owner_id FROM organizations WHERE id = $1",
        [organizationId],
      );
      const organization = orgResult.rows[0];

      const selectedRole = await resolveOrganizationRoleSelection(organizationId, {
        role,
        roleId,
      });
      if (!selectedRole) {
        res
          .status(400)
          .json(formatBusinessLogicError("Invalid role", "INVALID_ROLE"));
        return;
      }
      const selectedLegacyRole = toLegacyOrganizationMemberRole(selectedRole.name);

      const userResult = await query(
        "SELECT id, name, email, role as user_role FROM users WHERE id = $1",
        [userId],
      );
      const user = userResult.rows[0];

      if (selectedRole.name === "owner") {
        const adminRole = await getOrganizationRoleByName(organizationId, "admin");
        if (!adminRole) {
          throw new Error("Failed to resolve admin role for ownership transfer");
        }

        await query("BEGIN");
        try {
          await query(
            `UPDATE organization_members
             SET role = $1, role_id = $2
             WHERE organization_id = $3 AND user_id = $4`,
            ["admin", adminRole.id, organizationId, organization.owner_id],
          );

          await query(
            "UPDATE organizations SET owner_id = $1, updated_at = $2 WHERE id = $3",
            [userId, new Date().toISOString(), organizationId],
          );

          await query(
            `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              organizationId,
              userId,
              selectedLegacyRole,
              selectedRole.id,
              new Date().toISOString(),
            ],
          );

          await query("COMMIT");
        } catch (ownershipErr) {
          await query("ROLLBACK");
          throw ownershipErr;
        }
      } else {
        await query(
          `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            organizationId,
            userId,
            selectedLegacyRole,
            selectedRole.id,
            new Date().toISOString(),
          ],
        );
      }

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: organizationId,
            eventType: "organization_member.add",
            entityType: "organization_member",
            entityId: `${organizationId}-${userId}`,
            message: `Added ${user.name} as ${selectedRole.name} to organization "${organization.name}"`,
            status: "success",
            metadata: {
              organizationName: organization.name,
              memberName: user.name,
              memberEmail: user.email,
              memberRole: selectedRole.name,
            },
          },
          req,
        );
      }

      res.status(201).json({
        member: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          role: selectedRole.name,
          roleId: selectedRole.id,
          roleName: selectedRole.name,
          userRole: user.user_role,
          joinedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error("Admin add organization member error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to add organization member",
            "MEMBER_ADD_ERROR",
          ),
        );
    }
  },
);

router.put(
  "/organizations/:id/members/:userId",
  authenticateToken,
  requireAdmin,
  MemberValidation.update,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id: organizationId, userId } = req.params;
      const { role, roleId } = req.body as { role?: string; roleId?: string };

      const organizationExists =
        await BusinessValidation.organizationExists(organizationId);
      if (!organizationExists) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Organization not found",
              "ORGANIZATION_NOT_FOUND",
            ),
          );
        return;
      }

      const isUserMember = await BusinessValidation.isUserMemberOfOrganization(
        userId,
        organizationId,
      );
      if (!isUserMember) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Member not found in organization",
              "MEMBER_NOT_FOUND",
            ),
          );
        return;
      }

      const orgResult = await query(
        "SELECT name, owner_id FROM organizations WHERE id = $1",
        [organizationId],
      );
      const organization = orgResult.rows[0];

      const memberResult = await query(
        `SELECT
           om.role as current_role,
           COALESCE(role_by_id.id, legacy_role.id) as current_role_id,
           COALESCE(
             role_by_id.name,
             legacy_role.name,
             CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END,
             'viewer'
           ) as current_role_name,
           u.name,
           u.email,
           u.role as user_role,
           om.created_at
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         LEFT JOIN organization_roles role_by_id ON role_by_id.id = om.role_id
         LEFT JOIN organization_roles legacy_role
           ON legacy_role.organization_id = om.organization_id
          AND legacy_role.name = CASE WHEN om.role = 'member' THEN 'viewer' ELSE om.role END
         WHERE om.organization_id = $1 AND om.user_id = $2`,
        [organizationId, userId],
      );
      const member = memberResult.rows[0];

      const selectedRole = await resolveOrganizationRoleSelection(organizationId, {
        role,
        roleId,
      });
      if (!selectedRole) {
        res
          .status(400)
          .json(formatBusinessLogicError("Invalid role", "INVALID_ROLE"));
        return;
      }
      const selectedLegacyRole = toLegacyOrganizationMemberRole(selectedRole.name);

      if (selectedRole.name === "owner") {
        const adminRole = await getOrganizationRoleByName(organizationId, "admin");
        if (!adminRole) {
          throw new Error("Failed to resolve admin role for ownership transfer");
        }

        await query("BEGIN");
        try {
          if (organization.owner_id !== userId) {
            await query(
              `UPDATE organization_members
               SET role = $1, role_id = $2
               WHERE organization_id = $3 AND user_id = $4`,
              ["admin", adminRole.id, organizationId, organization.owner_id],
            );
          }

          await query(
            "UPDATE organizations SET owner_id = $1, updated_at = $2 WHERE id = $3",
            [userId, new Date().toISOString(), organizationId],
          );

          await query(
            `UPDATE organization_members
             SET role = $1, role_id = $2
             WHERE organization_id = $3 AND user_id = $4`,
            [selectedLegacyRole, selectedRole.id, organizationId, userId],
          );

          await query("COMMIT");
        } catch (ownershipErr) {
          await query("ROLLBACK");
          throw ownershipErr;
        }
      } else {
        if (organization.owner_id === userId) {
          res
            .status(400)
            .json(
              formatBusinessLogicError(
                "Cannot change the current owner to a non-owner role. Transfer ownership first.",
                "CANNOT_DEMOTE_OWNER",
              ),
            );
          return;
        }

        await query(
          `UPDATE organization_members
           SET role = $1, role_id = $2
           WHERE organization_id = $3 AND user_id = $4`,
          [selectedLegacyRole, selectedRole.id, organizationId, userId],
        );
      }

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: organizationId,
            eventType: "organization_member.update",
            entityType: "organization_member",
            entityId: `${organizationId}-${userId}`,
            message: `Changed ${member.name}'s role from ${member.current_role_name} to ${selectedRole.name} in organization "${organization.name}"`,
            status: "success",
            metadata: {
              organizationName: organization.name,
              memberName: member.name,
              memberEmail: member.email,
              oldRole: member.current_role_name,
              newRole: selectedRole.name,
            },
          },
          req,
        );
      }

      res.json({
        member: {
          userId: userId,
          userName: member.name,
          userEmail: member.email,
          role: selectedRole.name,
          roleId: selectedRole.id,
          roleName: selectedRole.name,
          userRole: member.user_role,
          joinedAt: member.created_at,
        },
      });
    } catch (err: any) {
      console.error("Admin update organization member error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to update organization member",
            "MEMBER_UPDATE_ERROR",
          ),
        );
    }
  },
);

router.delete(
  "/organizations/:id/members/:userId",
  authenticateToken,
  requireAdmin,
  MemberValidation.remove,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json(formatValidationErrors(errors.array()));
        return;
      }

      const { id: organizationId, userId } = req.params;

      const organizationExists =
        await BusinessValidation.organizationExists(organizationId);
      if (!organizationExists) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Organization not found",
              "ORGANIZATION_NOT_FOUND",
            ),
          );
        return;
      }

      const isUserMember = await BusinessValidation.isUserMemberOfOrganization(
        userId,
        organizationId,
      );
      if (!isUserMember) {
        res
          .status(404)
          .json(
            formatBusinessLogicError(
              "Member not found in organization",
              "MEMBER_NOT_FOUND",
            ),
          );
        return;
      }

      const isOwner = await BusinessValidation.isUserOrganizationOwner(
        userId,
        organizationId,
      );
      if (isOwner) {
        res
          .status(400)
          .json(
            formatBusinessLogicError(
              "Cannot remove organization owner. Transfer ownership first.",
              "CANNOT_REMOVE_OWNER",
            ),
          );
        return;
      }

      const orgResult = await query(
        "SELECT name, owner_id FROM organizations WHERE id = $1",
        [organizationId],
      );
      const organization = orgResult.rows[0];

      const memberResult = await query(
        `SELECT om.role, u.name, u.email
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND om.user_id = $2`,
        [organizationId, userId],
      );
      const member = memberResult.rows[0];

      await query(
        "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId],
      );

      if (req.user?.id) {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: organizationId,
            eventType: "organization_member.remove",
            entityType: "organization_member",
            entityId: `${organizationId}-${userId}`,
            message: `Removed ${member.name} (${member.role}) from organization "${organization.name}"`,
            status: "success",
            metadata: {
              organizationName: organization.name,
              memberName: member.name,
              memberEmail: member.email,
              memberRole: member.role,
            },
          },
          req,
        );
      }

      res.status(204).send();
    } catch (err: any) {
      console.error("Admin remove organization member error:", err);
      res
        .status(500)
        .json(
          formatServerError(
            err.message || "Failed to remove organization member",
            "MEMBER_REMOVE_ERROR",
          ),
        );
    }
  },
);

export default router;
