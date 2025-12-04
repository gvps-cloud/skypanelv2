/**
 * GitHub API Routes for SkyPanelV2
 * Provides endpoints to fetch repository information
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { fetchGitHubCommits } from '../services/githubService.js';

const router = Router();

// All routes require authentication and admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/github/commits
 * Fetch recent commits from the repository
 * Query params:
 *   - limit: number (default: 10, max: 100)
 *   - refresh: boolean (force cache refresh)
 */
router.get('/commits', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
    const forceRefresh = req.query.refresh === 'true';

    const commits = await fetchGitHubCommits(limit, forceRefresh);

    res.json({
      success: true,
      commits,
      count: commits.length,
    });
  } catch (error: any) {
    console.error('GitHub API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch commits from GitHub',
    });
  }
});

export default router;
