import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { query } from '../lib/database.js';
import { RoleService, Permission } from '../services/roles.js';

export const checkOrganizationMembership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }

  try {
    const result = await query(
      `SELECT * FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    (req as any).member = result.rows[0];
    next();
  } catch (error) {
    console.error('Organization membership check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkOrganizationOwnerOrAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }

  if (user.role === 'admin') {
    return next();
  }

  try {
    const result = await query(
      `SELECT om.*, or.permissions
       FROM organization_members om
       LEFT JOIN organization_roles or ON om.role_id = or.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    const member = result.rows[0];

    const permissions = Array.isArray(member.permissions) 
      ? member.permissions 
      : JSON.parse(member.permissions || '[]');

    const hasManageMembersPermission = permissions.includes('members_manage');

    if (member.role === 'owner' || hasManageMembersPermission) {
      (req as any).member = member;
      return next();
    }

    return res.status(403).json({ error: 'Must be owner or have members_manage permission' });
  } catch (error) {
    console.error('Organization owner/admin check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const requirePermission = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid organization ID format' });
    }

    if (user.role === 'admin') {
      return next();
    }

    try {
      const hasPermission = await RoleService.checkPermission(
        user.id,
        id,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const requireAnyPermission = (permissions: Permission[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid organization ID format' });
    }

    if (user.role === 'admin') {
      return next();
    }

    try {
      const permissionChecks = await Promise.all(
        permissions.map(permission =>
          RoleService.checkPermission(user.id, id, permission)
        )
      );

      const hasAnyPermission = permissionChecks.some(check => check === true);

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const requireAllPermissions = (permissions: Permission[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid organization ID format' });
    }

    if (user.role === 'admin') {
      return next();
    }

    try {
      const permissionChecks = await Promise.all(
        permissions.map(permission =>
          RoleService.checkPermission(user.id, id, permission)
        )
      );

      const hasAllPermissions = permissionChecks.every(check => check === true);

      if (!hasAllPermissions) {
        const missingPermissions = permissions.filter((_, index) => !permissionChecks[index]);
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissions,
          missing: missingPermissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
