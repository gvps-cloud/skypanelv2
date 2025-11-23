/**
 * Admin PaaS Worker Management Routes
 * Admin-only endpoints for managing PaaS worker nodes
 */

import express, { Request, Response } from 'express';
import { PaaSWorkerService } from '../../services/paasWorkerService.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/paas/workers
 * List all worker nodes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const workers = await PaaSWorkerService.getAllWorkers(status as string);
    res.json({ success: true, workers });
  } catch (error: any) {
    console.error('Error listing workers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/workers/stats
 * Get worker statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await PaaSWorkerService.getWorkerStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error getting worker stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/workers/discover
 * Auto-discover and register workers from existing uncloud contexts
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const result = await PaaSWorkerService.discoverAndRegisterWorkers();
    res.json({ 
      success: true, 
      discovered: result.discovered,
      registered: result.registered,
      message: `Discovered ${result.discovered} worker(s), registered ${result.registered} new worker(s)`
    });
  } catch (error: any) {
    console.error('Error discovering workers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/workers/:id
 * Get a specific worker
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    
    res.json({ success: true, worker });
  } catch (error: any) {
    console.error('Error getting worker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/workers
 * Create a new worker node
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, hostIp, sshPort, sshUser, sshKeyPath } = req.body;
    
    if (!name || !hostIp || !sshUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, hostIp, and sshUser are required' 
      });
    }
    
    // Validate authentication method
    if (!sshKeyPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'sshKeyPath is required' 
      });
    }
    
    const result = await PaaSWorkerService.createWorker({
      name,
      hostIp,
      sshPort: sshPort ? parseInt(sshPort) : 22,
      sshUser,
      sshKeyPath,
      createdBy: authReq.user?.id
    });
    
    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to create worker' });
    }
    
    res.status(201).json({ 
      success: true, 
      worker: result.worker,
      logs: result.logs || 'Worker created successfully'
    });
  } catch (error: any) {
    console.error('Error creating worker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/workers/:id
 * Update a worker node
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    
    const updatedWorker = await PaaSWorkerService.updateWorker(req.params.id, req.body);
    
    if (!updatedWorker) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    res.json({ success: true, worker: updatedWorker });
  } catch (error: any) {
    console.error('Error updating worker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/workers/:id
 * Delete a worker node
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    
    const success = await PaaSWorkerService.deleteWorker(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    res.json({ success: true, message: 'Worker deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/workers/:id/health-check
 * Trigger a health check
 */
router.post('/:id/health-check', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    
    const success = await PaaSWorkerService.performHealthCheck(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Health check failed' });
    }
    
    const updatedWorker = await PaaSWorkerService.getWorkerById(req.params.id);
    res.json({ success: true, worker: updatedWorker });
  } catch (error: any) {
    console.error('Error performing health check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/workers/:id/test
 * Test worker connection (alias for health check)
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.id);
    
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' });
    }
    
    // Perform health check as the test
    const success = await PaaSWorkerService.performHealthCheck(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Connection test failed' });
    }
    
    res.json({ success: true, message: 'Connection test successful' });
  } catch (error: any) {
    console.error('Error testing worker connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
