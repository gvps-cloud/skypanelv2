import express, { type Request, type Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { LinodeToggleService } from '../../services/linodeToggle.js';
import { logActivity } from '../../services/activityLogger.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/linode/status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await LinodeToggleService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Failed to get linode integration status:', error);
    res.status(500).json({ error: error?.message || 'Failed to get linode status' });
  }
});

/**
 * PATCH /api/admin/linode/status
 */
router.patch('/status', async (req: Request, res: Response) => {
  const { enabled } = req.body;
  const userId = (req as any).user?.id;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  try {
    if (!enabled) {
      const activeResult = await query(
        `SELECT COUNT(*)::int AS n
         FROM vps_instances
         WHERE status NOT IN ('deleted', 'terminated')`,
      );
      const activeCount = activeResult.rows[0]?.n ?? 0;

      if (activeCount > 0) {
        await logActivity({
          userId,
          eventType: 'linode.toggle.disable_attempt_blocked',
          entityType: 'platform_integration',
          entityId: 'linode',
          message: `Attempted to disable VPS/Linode while ${activeCount} instance(s) still active`,
          status: 'error',
          metadata: { activeCount },
        });

        return res.status(409).json({
          error: `Cannot disable VPS hosting while ${activeCount} instance(s) are not deleted or terminated.`,
          activeCount,
        });
      }
    }

    await LinodeToggleService.setRuntimeEnabled(enabled, userId);
    const status = await LinodeToggleService.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Failed to update linode status:', error);
    res.status(400).json({ error: error?.message || 'Failed to update linode status' });
  }
});

export default router;
