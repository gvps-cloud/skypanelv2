import { query, transaction } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';

export type Permission = 
  | 'vps_view'
  | 'vps_create'
  | 'vps_delete'
  | 'vps_manage'
  | 'ssh_keys_view'
  | 'ssh_keys_manage'
  | 'tickets_view'
  | 'tickets_create'
  | 'tickets_manage'
  | 'billing_view'
  | 'billing_manage'
  | 'members_manage'
  | 'settings_manage';

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  permissions: Permission[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleData {
  organizationId: string;
  name: string;
  permissions: Permission[];
}

export interface UpdateRoleData {
  name?: string;
  permissions?: Permission[];
}

const PREDEFINED_ROLES: Record<string, Permission[]> = {
  owner: [
    'vps_view', 'vps_create', 'vps_delete', 'vps_manage',
    'ssh_keys_view', 'ssh_keys_manage',
    'tickets_view', 'tickets_create', 'tickets_manage',
    'billing_view', 'billing_manage',
    'members_manage',
    'settings_manage'
  ],
  admin: [
    'vps_view', 'vps_create', 'vps_delete', 'vps_manage',
    'ssh_keys_view', 'ssh_keys_manage',
    'tickets_view', 'tickets_create', 'tickets_manage',
    'billing_view',
    'settings_manage'
  ],
  vps_manager: [
    'vps_view', 'vps_create', 'vps_manage',
    'ssh_keys_view', 'ssh_keys_manage'
  ],
  support_agent: [
    'tickets_view', 'tickets_create', 'tickets_manage'
  ],
  viewer: [
    'vps_view', 'tickets_view'
  ]
};

export class RoleService {
  static async createCustomRole(data: CreateRoleData): Promise<Role> {
    const { organizationId, name, permissions } = data;

    return await transaction(async (client) => {
      const roleId = uuidv4();
      const now = new Date().toISOString();

      const result = await client.query(
        `INSERT INTO organization_roles (id, organization_id, name, permissions, is_custom, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [roleId, organizationId, name, JSON.stringify(permissions), true, now, now]
      );

      return this.mapRoleFromDb(result.rows[0]);
    });
  }

  static async getRoles(organizationId: string): Promise<Role[]> {
    const result = await query(
      `SELECT * FROM organization_roles
       WHERE organization_id = $1
       ORDER BY is_custom ASC, name ASC`,
      [organizationId]
    );

    const roles = result.rows.map(this.mapRoleFromDb);

    if (roles.length === 0) {
      await this.initializeDefaultRoles(organizationId);
      return await this.getRoles(organizationId);
    }

    return roles;
  }

  static async getRole(roleId: string): Promise<Role | null> {
    const result = await query(
      'SELECT * FROM organization_roles WHERE id = $1',
      [roleId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoleFromDb(result.rows[0]);
  }

  static async updateRole(roleId: string, data: UpdateRoleData): Promise<Role> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(data.permissions));
    }

    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(roleId);

    const result = await query(
      `UPDATE organization_roles
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       AND is_custom = TRUE
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Role not found or cannot modify predefined roles');
    }

    return this.mapRoleFromDb(result.rows[0]);
  }

  static async deleteRole(roleId: string): Promise<void> {
    const result = await query(
      `DELETE FROM organization_roles
       WHERE id = $1 AND is_custom = TRUE`,
      [roleId]
    );

    if (result.rowCount === 0) {
      throw new Error('Role not found or cannot delete predefined roles');
    }
  }

  static async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.getRole(roleId);

    if (!role) {
      throw new Error('Role not found');
    }

    return role.permissions;
  }

  static async checkPermission(
    userId: string,
    organizationId: string,
    permission: Permission
  ): Promise<boolean> {
    // Check if user is a platform admin (bypasses organization-level permissions)
    const userResult = await query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].role === 'admin') {
      // Platform admins have all permissions
      return true;
    }

    const result = await query(
      `SELECT om.role_id, r.permissions
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [organizationId, userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const member = result.rows[0];

    if (!member.role_id) {
      return false;
    }

    const permissions = Array.isArray(member.permissions) 
      ? member.permissions 
      : JSON.parse(member.permissions || '[]');

    return permissions.includes(permission);
  }

  static async initializeDefaultRoles(organizationId: string): Promise<void> {
    await transaction(async (client) => {
      const now = new Date().toISOString();

      for (const [roleName, permissions] of Object.entries(PREDEFINED_ROLES)) {
        const roleId = uuidv4();

        await client.query(
          `INSERT INTO organization_roles (id, organization_id, name, permissions, is_custom, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (organization_id, name) DO NOTHING`,
          [roleId, organizationId, roleName, JSON.stringify(permissions), false, now, now]
        );
      }

      const viewerRole = await client.query(
        `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'viewer'`,
        [organizationId]
      );

      if (viewerRole.rows.length > 0) {
        await client.query(
          `UPDATE organization_members
           SET role_id = $1
           WHERE organization_id = $2 AND role_id IS NULL`,
          [viewerRole.rows[0].id, organizationId]
        );
      }
    });
  }

  static async getRoleByName(organizationId: string, name: string): Promise<Role | null> {
    const result = await query(
      `SELECT * FROM organization_roles
       WHERE organization_id = $1 AND name = $2`,
      [organizationId, name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRoleFromDb(result.rows[0]);
  }

  static async assignRoleToMember(
    organizationId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    const role = await this.getRole(roleId);

    if (!role || role.organization_id !== organizationId) {
      throw new Error('Role not found or does not belong to this organization');
    }

    await query(
      `UPDATE organization_members
       SET role_id = $1
       WHERE organization_id = $2 AND user_id = $3`,
      [roleId, organizationId, userId]
    );
  }

  private static mapRoleFromDb(row: any): Role {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      permissions: Array.isArray(row.permissions) 
        ? row.permissions 
        : JSON.parse(row.permissions || '[]'),
      is_custom: row.is_custom,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
