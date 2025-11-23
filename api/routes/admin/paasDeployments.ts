/**
 * Admin PaaS Deployments Routes
 * Platform-wide deployment oversight
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { PaaSDeploymentService } from '../../services/paasDeploymentService.js';
import { query } from '../../lib/database.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// List all deployments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, applicationId, limit = 50, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM paas_deployments WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      queryText += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (applicationId) {
      paramCount++;
      queryText += ` AND application_id = $${paramCount}`;
      params.push(applicationId);
    }
    
    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(Number(limit), Number(offset));
    
    const result = await query(queryText, params);
    
    res.json({ success: true, deployments: result.rows, total: result.rowCount });
  } catch (error: any) {
    console.error('Error listing deployments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get deployment statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_deployments,
        COUNT(*) FILTER (WHERE status = 'success') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'building') as building,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_duration_seconds
      FROM paas_deployments
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    
    res.json({ success: true, stats: stats.rows[0] });
  } catch (error: any) {
    console.error('Error getting deployment stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single deployment
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM paas_deployments WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }
    
    res.json({ success: true, deployment: result.rows[0] });
  } catch (error: any) {
    console.error('Error getting deployment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel running deployment
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `UPDATE paas_deployments 
       SET status = 'cancelled', completed_at = NOW() 
       WHERE id = $1 AND status IN ('pending', 'building')
       RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deployment not found or cannot be cancelled' });
    }
    
    res.json({ success: true, deployment: result.rows[0] });
  } catch (error: any) {
    console.error('Error cancelling deployment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retry failed deployment
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const deployment = await query('SELECT * FROM paas_deployments WHERE id = $1', [req.params.id]);
    
    if (deployment.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }
    
    const dep = deployment.rows[0];
    
    // Create new deployment with same parameters
    const result = await PaaSDeploymentService.createDeployment({
      applicationId: dep.application_id,
      version: `${dep.version}-retry`,
      gitBranch: dep.git_branch,
      triggeredBy: 'admin-retry'
    });
    
    res.json({ success: true, deployment: result });
  } catch (error: any) {
    console.error('Error retrying deployment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete deployment record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM paas_deployments WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }
    
    res.json({ success: true, message: 'Deployment deleted' });
  } catch (error: any) {
    console.error('Error deleting deployment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get deployment logs
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT build_logs FROM paas_deployments WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deployment not found' });
    }
    
    res.json({ success: true, logs: result.rows[0].build_logs || 'No logs available' });
  } catch (error: any) {
    console.error('Error getting deployment logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
