/**
 * Admin PaaS Containers Routes
 * Container/service management across all worker nodes
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { UncloudService } from '../../services/uncloudService.js';
import { PaaSWorkerService } from '../../services/paasWorkerService.js';
import { query } from '../../lib/database.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// List all containers across all workers
router.get('/', async (req: Request, res: Response) => {
  try {
    const workers = await query('SELECT * FROM paas_worker_nodes WHERE status = $1', ['active']);
    
    const allContainers: any[] = [];
    
    for (const worker of workers.rows) {
      try {
        const result = await UncloudService.listServices({ context: worker.uncloud_context });
        
        if (result.success && result.services) {
          allContainers.push(...result.services.map((svc: any) => ({
            ...svc,
            workerNodeId: worker.id,
            workerName: worker.name,
            workerIp: worker.public_ip
          })));
        }
      } catch (err) {
        console.error(`Error listing services on worker ${worker.name}:`, err);
      }
    }
    
    res.json({ success: true, containers: allContainers, total: allContainers.length });
  } catch (error: any) {
    console.error('Error listing containers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get container stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const workers = await query('SELECT * FROM paas_worker_nodes WHERE status = $1', ['active']);
    
    let totalContainers = 0;
    let runningContainers = 0;
    
    for (const worker of workers.rows) {
      try {
        const result = await UncloudService.listServices({ context: worker.uncloud_context });
        
        if (result.success && result.services) {
          totalContainers += result.services.length;
          runningContainers += result.services.filter((s: any) => s.state === 'running').length;
        }
      } catch (err) {
        console.error(`Error getting stats from worker ${worker.name}:`, err);
      }
    }
    
    res.json({ 
      success: true, 
      stats: {
        total_containers: totalContainers,
        running_containers: runningContainers,
        stopped_containers: totalContainers - runningContainers
      }
    });
  } catch (error: any) {
    console.error('Error getting container stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single container details
router.get('/:serviceName', async (req: Request, res: Response) => {
  try {
    const { workerContext } = req.query;
    
    if (!workerContext) {
      return res.status(400).json({ success: false, error: 'workerContext required' });
    }
    
    const result = await UncloudService.listServices({ 
      context: workerContext as string 
    });
    
    if (!result.success || !result.services) {
      return res.status(404).json({ success: false, error: 'Container not found' });
    }
    
    const container = result.services.find((s: any) => s.name === req.params.serviceName);
    
    if (!container) {
      return res.status(404).json({ success: false, error: 'Container not found' });
    }
    
    res.json({ success: true, container });
  } catch (error: any) {
    console.error('Error getting container:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop container
router.post('/:serviceName/stop', async (req: Request, res: Response) => {
  try {
    const { workerContext } = req.body;
    
    if (!workerContext) {
      return res.status(400).json({ success: false, error: 'workerContext required' });
    }
    
    const result = await UncloudService.removeService({
      serviceName: req.params.serviceName,
      context: workerContext
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error stopping container:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove container
router.delete('/:serviceName', async (req: Request, res: Response) => {
  try {
    const { workerContext } = req.body;
    
    if (!workerContext) {
      return res.status(400).json({ success: false, error: 'workerContext required' });
    }
    
    const result = await UncloudService.removeService({
      serviceName: req.params.serviceName,
      context: workerContext
    });
    
    res.json({ success: true, message: 'Container removed', result });
  } catch (error: any) {
    console.error('Error removing container:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get container logs
router.get('/:serviceName/logs', async (req: Request, res: Response) => {
  try {
    const { workerContext, lines = 100 } = req.query;
    
    if (!workerContext) {
      return res.status(400).json({ success: false, error: 'workerContext required' });
    }
    
    const result = await UncloudService.getServiceLogs({
      serviceName: req.params.serviceName,
      lines: Number(lines),
      context: workerContext as string
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('Error getting container logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
