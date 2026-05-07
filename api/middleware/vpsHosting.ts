import { type Request, type Response, type NextFunction } from 'express';
import { LinodeToggleService } from '../services/linodeToggle.js';
import type { AuthenticatedRequest } from './auth.js';

export async function requireVpsEnabled(req: Request, res: Response, next: NextFunction) {
  const enabled = await LinodeToggleService.isEffectivelyEnabled();
  if (!enabled) {
    return res.status(503).json({ error: 'VPS service is not available' });
  }
  next();
}

export async function requireVpsEnabledForUsers(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user?.role === 'admin') {
    return next();
  }

  const enabled = await LinodeToggleService.isEffectivelyEnabled();
  if (!enabled) {
    return res.status(503).json({ error: 'VPS service is not available' });
  }
  next();
}
