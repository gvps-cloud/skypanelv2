/**
 * Hosting middleware for checking if hosting features are enabled
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/database.js';

/**
 * Middleware to check if web hosting is enabled
 * Returns 403 with appropriate error message if hosting is disabled
 */
export const requireHostingEnabled = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check enhance_config table for enabled status
    const enhanceConfig = await pool.query(
      'SELECT enabled FROM enhance_config WHERE is_active = true LIMIT 1'
    );

    // Default to enabled if no config found (backward compatibility)
    const isHostingEnabled = enhanceConfig.rows.length > 0
      ? enhanceConfig.rows[0].enabled
      : true;

    if (!isHostingEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Web hosting is currently disabled. Please contact support for more information.'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking hosting status:', error);
    // On error, allow the request to proceed (fail open for better UX)
    next();
  }
};

/**
 * Middleware that skips the hosting check for admin users
 * Admins can access hosting routes even when disabled
 */
export const requireHostingEnabledForUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip check for admin users
  const user = (req as any).user;
  if (user && user.role === 'admin') {
    return next();
  }

  // Apply the regular hosting check for non-admin users
  return requireHostingEnabled(req, res, next);
};
