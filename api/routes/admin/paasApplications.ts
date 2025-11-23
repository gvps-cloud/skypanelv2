/**
 * Admin PaaS Applications Routes
 * Platform-wide application management for administrators
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { PaaSApplicationService } from '../../services/paasApplicationService.js';
import { query } from '../../lib/database.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// List all applications across all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, userId, workerNodeId, limit = 50, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM paas_applications WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      queryText += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (userId) {
      paramCount++;
      queryText += ` AND user_id = $${paramCount}`;
      params.push(userId);
    }
    
    if (workerNodeId) {
      paramCount++;
      queryText += ` AND target_worker_node_id = $${paramCount}`;
      params.push(workerNodeId);
    }
    
    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(Number(limit), Number(offset));
    
    const result = await query(queryText, params);
    
    res.json({ success: true, applications: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error listing applications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get platform-wide statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_apps,
        COUNT(*) FILTER (WHERE status = 'running') as running_apps,
        COUNT(*) FILTER (WHERE status = 'stopped') as stopped_apps,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_apps,
        COUNT(*) FILTER (WHERE status = 'building') as building_apps,
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT target_worker_node_id) as workers_in_use
      FROM paas_applications
    `);
    
    const deploymentStats = await query(`
      SELECT 
        COUNT(*) as total_deployments,
        COUNT(*) FILTER (WHERE status = 'success') as successful_deployments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_deployments,
        COUNT(*) FILTER (WHERE status = 'building') as active_deployments
      FROM paas_deployments
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    
    res.json({ 
      success: true, 
      stats: {
        ...stats.rows[0],
        ...deploymentStats.rows[0]
      }
    });
  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single application (any user)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    res.json({ success: true, application: app });
  } catch (error: any) {
    console.error('Error getting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update any application
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const result = await PaaSApplicationService.updateApplication(req.params.id, req.body);
    res.json({ success: true, application: result });
  } catch (error: any) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Force delete any application
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { force } = req.query;
    
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    // Stop the application first if running
    if (app.status === 'running' && force === 'true') {
      await PaaSApplicationService.stopApplication(req.params.id);
    }
    
    await PaaSApplicationService.deleteApplication(req.params.id);
    res.json({ success: true, message: 'Application deleted' });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Force stop any application
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const result = await PaaSApplicationService.stopApplication(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error stopping application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Force restart any application
router.post('/:id/restart', async (req: Request, res: Response) => {
  try {
    const result = await PaaSApplicationService.restartApplication(req.params.id);
    res.json(result);
  } catch (error: any) {
    console.error('Error restarting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Migrate application to different worker
router.post('/:id/migrate', async (req: Request, res: Response) => {
  try {
    const { targetWorkerNodeId } = req.body;
    
    if (!targetWorkerNodeId) {
      return res.status(400).json({ success: false, error: 'targetWorkerNodeId required' });
    }
    
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    // Stop on current worker
    if (app.status === 'running') {
      await PaaSApplicationService.stopApplication(req.params.id);
    }
    
    // Update worker assignment
    await PaaSApplicationService.updateApplication(req.params.id, {
      targetWorkerNodeId: Number(targetWorkerNodeId)
    });
    
    // Restart on new worker
    const result = await PaaSApplicationService.restartApplication(req.params.id);
    
    res.json({ success: true, message: 'Application migrated', result });
  } catch (error: any) {
    console.error('Error migrating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get logs for any application
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const { lines = 100 } = req.query;
    const result = await PaaSApplicationService.getApplicationLogs(req.params.id, Number(lines));
    res.json(result);
  } catch (error: any) {
    console.error('Error getting logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
