import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../lib/database.js';
import { tokenBlacklistService } from '../services/tokenBlacklistService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    timezone?: string;
    organizationId?: string;
    preferences?: any;
    twoFactorEnabled?: boolean;
  };
  userId?: string;
  organizationId?: string;
}

/**
 * Resolve organization context for a user (JWT and API key auth).
 * Order: X-Organization-ID (if member) → active_organization_id (if still member; clears DB if stale)
 * → first membership → owned org → auto-create (non-admin only).
 */
export async function resolveOrganizationIdForUser(options: {
  userId: string;
  email: string;
  role: string;
  activeOrganizationId: string | null | undefined;
  headerOrgId: string | undefined;
}): Promise<string | undefined> {
  const { userId, email, role, activeOrganizationId, headerOrgId } = options;
  let organizationId: string | undefined;

  try {
    if (headerOrgId) {
      const orgResult = await query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
        [userId, headerOrgId]
      );
      if (orgResult.rows.length > 0) {
        organizationId = orgResult.rows[0].organization_id;
      }
    }

    if (!organizationId && activeOrganizationId) {
      const activeOrgResult = await query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
        [userId, activeOrganizationId]
      );
      if (activeOrgResult.rows[0]) {
        organizationId = activeOrganizationId;
      } else {
        console.warn('User is no longer a member of active organization, clearing it:', {
          userId,
          activeOrgId: activeOrganizationId
        });
        await query(
          'UPDATE users SET active_organization_id = NULL WHERE id = $1',
          [userId]
        );
      }
    }

    if (!organizationId) {
      const orgResult = await query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
        [userId]
      );
      organizationId = orgResult.rows[0]?.organization_id;
    }
  } catch {
    console.warn('organization_members table not found, skipping organization lookup');
  }

  if (!organizationId) {
    try {
      const ownerOrg = await query(
        'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      if (ownerOrg.rows[0]) {
        organizationId = ownerOrg.rows[0].id;
      }
    } catch {
      console.warn('organizations lookup failed for owner fallback');
    }
  }

  if (!organizationId && role !== 'admin') {
    try {
      const newOrg = await query(
        `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [
          `${email}'s Organization`,
          email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          userId
        ]
      );
      organizationId = newOrg.rows[0].id;
      console.log('Created automatic organization for user:', { userId, organizationId });

      await query(
        `INSERT INTO organization_members (organization_id, user_id, role, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [organizationId, userId, 'owner']
      );
    } catch (orgCreateError) {
      console.error('Failed to create automatic organization:', orgCreateError);
    }
  }

  return organizationId;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // If API key authentication already set req.user, skip JWT validation
    if ((req as any).user?.isApiKey) {
      return next();
    }

    // Extract token from Authorization header or cookies
    let token: string | null = null;

    // Try Authorization header first
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // Fallback to HttpOnly cookie
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token has been blacklisted (revoked)
    const isRevoked = await tokenBlacklistService.isRevoked(token);
    if (isRevoked) {
      console.warn('Authentication attempt with revoked token:', {
        hasToken: !!token,
        tokenPrefix: token.substring(0, 10) + '...'
      });
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    // Get user from database (including active_organization_id)
    const userResult = await query(
      'SELECT id, email, role, name, phone, timezone, preferences, two_factor_enabled AS "twoFactorEnabled", active_organization_id FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      console.error('Authentication - User lookup failed:', {
        decodedUserId: decoded.userId,
        userExists: false
      });
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = userResult.rows[0];

    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    const organizationId = await resolveOrganizationIdForUser({
      userId: user.id,
      email: user.email,
      role: user.role,
      activeOrganizationId: user.active_organization_id,
      headerOrgId: requestedOrgId
    });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.name ? user.name.split(' ')[0] || '' : '',
      lastName: user.name ? user.name.split(' ').slice(1).join(' ') || '' : '',
      role: user.role,
      phone: user.phone,
      timezone: user.timezone,
      organizationId,
      preferences: user.preferences,
      twoFactorEnabled: user.twoFactorEnabled
    };
    (req as any).userId = user.id;
    (req as any).organizationId = organizationId;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);

export const requireOrganization = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.organizationId) {
    console.error('requireOrganization failed:', {
      hasUser: !!req.user,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: 'Organization membership required' });
  }
  next();
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but continues even if no token is provided
 * Sets req.user if authentication succeeds, leaves it undefined otherwise
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;

    // Get user from database
    const userResult = await query(
      'SELECT id, email, role, name, phone, timezone, preferences, two_factor_enabled AS "twoFactorEnabled" FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      // Invalid token, continue without authentication
      return next();
    }

    const user = userResult.rows[0];

    // Get user's organization
    let orgMember = null;
    let organizationId: string | undefined;

    try {
      // Check for X-Organization-ID header
      const requestedOrgId = req.headers['x-organization-id'] as string;
      
      if (requestedOrgId) {
        const orgResult = await query(
          'SELECT organization_id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
          [user.id, requestedOrgId]
        );
        if (orgResult.rows.length > 0) {
          organizationId = orgResult.rows[0].organization_id;
        }
      }

      if (!organizationId) {
        const orgResult = await query(
          'SELECT organization_id FROM organization_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
          [user.id]
        );
        orgMember = orgResult.rows[0] || null;
        organizationId = orgMember?.organization_id;
      }
    } catch {
      console.warn('organization_members table not found, skipping organization lookup');
    }

    if (!organizationId) {
      try {
        const ownerOrg = await query(
          'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        if (ownerOrg.rows[0]) {
          organizationId = ownerOrg.rows[0].id;
        }
      } catch {
        console.warn('organizations lookup failed for owner fallback');
      }
    }

    // If still no organization, create one automatically for the user
    if (!organizationId) {
      try {
        const newOrg = await query(
          `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING id`,
          [
            `${user.email}'s Organization`,
            user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            user.id
          ]
        );
        organizationId = newOrg.rows[0].id;
        console.log('Created automatic organization for user:', { userId: user.id, organizationId });

        // Add user to organization members
        await query(
          `INSERT INTO organization_members (organization_id, user_id, role, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (organization_id, user_id) DO NOTHING`,
          [organizationId, user.id, 'owner']
        );
      } catch (orgCreateError) {
        console.error('Failed to create automatic organization:', orgCreateError);
        // Continue without organization - this will be handled by requireOrganization middleware
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.name ? user.name.split(' ')[0] || '' : '',
      lastName: user.name ? user.name.split(' ').slice(1).join(' ') || '' : '',
      role: user.role,
      phone: user.phone,
      timezone: user.timezone,
      organizationId,
      preferences: user.preferences,
      twoFactorEnabled: user.twoFactorEnabled
    };
    (req as any).userId = user.id;
    (req as any).organizationId = organizationId;

    next();
  } catch {
    // Authentication failed, continue without user
    next();
  }
};
