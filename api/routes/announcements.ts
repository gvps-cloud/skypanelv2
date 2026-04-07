/**
 * Public Announcements Route
 * Returns active announcements based on the current user's audience.
 * Unauthenticated -- guests see "all" + "guests" announcements.
 */
import { Router, type Response } from 'express';
import { query } from '../lib/database.js';

const router = Router();

/**
 * Get active announcements for the current viewer
 * GET /api/announcements
 */
router.get('/', async (req: any, res: Response): Promise<void> => {
  try {
    const isAuthenticated = !!req.user;
    const isAdmin = isAuthenticated && req.user.role === 'admin';

    const audienceClauses: string[] = ["'all'"];
    if (isAdmin) audienceClauses.push("'admin'");
    if (isAuthenticated) audienceClauses.push("'authenticated'");
    else audienceClauses.push("'guests'");

    const result = await query(
      `SELECT id, title, message, type, target_audience, is_dismissable, priority
       FROM announcements
       WHERE is_active = true
         AND target_audience IN (${audienceClauses.join(',')})
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY priority DESC, created_at DESC
       LIMIT 10`
    );

    res.json({ success: true, announcements: result.rows || [] });
  } catch (error: any) {
    console.error('Public announcements fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

export default router;
