import { type Request, type Response, type NextFunction } from 'express';
import { EnhanceToggleService } from '../services/enhanceToggle.js';
import { RoleService } from '../services/roles.js';
import type { AuthenticatedRequest } from './auth.js';

export async function requireHostingEnabled(req: Request, res: Response, next: NextFunction) {
  const enabled = await EnhanceToggleService.isEffectivelyEnabled();
  if (!enabled) {
    return res.status(503).json({ error: 'Hosting service is not available' });
  }
  next();
}

export async function requireHostingEnabledForUsers(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  // Platform admins bypass the check so they can still inspect/administer
  if (user?.role === 'admin') {
    return next();
  }

  const enabled = await EnhanceToggleService.isEffectivelyEnabled();
  if (!enabled) {
    return res.status(503).json({ error: 'Hosting service is not available' });
  }
  next();
}

export function requireOrgPermission(permission: Parameters<typeof RoleService.checkPermission>[2]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const organizationId = authReq.user?.organizationId || req.params.organizationId || req.body.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({ error: 'Authentication and organization context required' });
    }

    const hasPermission = await RoleService.checkPermission(userId, organizationId, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}
