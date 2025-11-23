/**
 * Client PaaS Application Routes
 * User-facing endpoints for managing their applications
 */

import express, { Request, Response } from 'express';
import { PaaSApplicationService } from '../../services/paasApplicationService.js';
import { PaaSDeploymentService } from '../../services/paasDeploymentService.js';
import { PaaSAddonService } from '../../services/paasAddonService.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/client/paas/applications
 * List user's applications
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const applications = await PaaSApplicationService.getApplicationsByUserId(authReq.user!.id);
    res.json({ success: true, applications });
  } catch (error: any) {
    console.error('Error listing applications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id
 * Get a specific application
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const application = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    // Ensure user owns this application
    if (application.userId !== authReq.user!.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, application });
  } catch (error: any) {
    console.error('Error getting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications
 * Create a new application
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const application = await PaaSApplicationService.createApplication({
      ...req.body,
      userId: authReq.user!.id
    });
    
    if (!application) {
      return res.status(500).json({ success: false, error: 'Failed to create application' });
    }
    
    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_create',
      entityType: 'paas_application',
      entityId: application.id,
      message: `Created PaaS application ${application.name}`,
      status: 'success',
      metadata: { applicationId: application.id, name: application.name },
    }, req);

    res.status(201).json({ success: true, application });
  } catch (error: any) {
    console.error('Error creating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/ports/initial
 * Optionally create an initial port mapping right after app creation
 */
router.post('/:id/ports/initial', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    const { containerPort, protocol = 'https', customDomain } = req.body;
    if (!containerPort) {
      return res.status(400).json({ success: false, error: 'containerPort is required' });
    }
    const result = await query(
      `INSERT INTO paas_app_ports (application_id, container_port, protocol, custom_domain, is_primary, is_internal_only, enable_ssl, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, containerPort, protocol, customDomain || null, true, false, protocol === 'https', new Date()]
    );
    res.status(201).json({ success: true, port: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating initial port:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/client/paas/applications/:id
 * Update an application
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const success = await PaaSApplicationService.updateApplication(req.params.id, req.body);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    const updatedApp = await PaaSApplicationService.getApplicationById(req.params.id);
    res.json({ success: true, application: updatedApp });
  } catch (error: any) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/client/paas/applications/:id
 * Delete an application
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const success = await PaaSApplicationService.deleteApplication(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_delete',
      entityType: 'paas_application',
      entityId: app.id,
      message: `Deleted PaaS application ${app.name}`,
      status: success ? 'success' : 'error',
      metadata: { applicationId: app.id },
    }, req);

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/stats
 * Get application statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const stats = await PaaSApplicationService.getApplicationResourceUsage(req.params.id);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error getting application stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/deployments
 * Get deployment history for an application
 */
router.get('/:id/deployments', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const deployments = await PaaSDeploymentService.getDeploymentsByApplication(req.params.id, limit);
    
    res.json({ success: true, deployments });
  } catch (error: any) {
    console.error('Error getting deployments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/deploy
 * Trigger a new deployment
 */
router.post('/:id/deploy', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const { gitBranch, gitCommitSha } = req.body;
    
    const deployment = await PaaSDeploymentService.createDeployment({
      applicationId: req.params.id,
      triggerType: 'manual',
      triggeredBy: authReq.user!.id,
      gitBranch,
      gitCommitSha
    });
    
    if (!deployment) {
      return res.status(500).json({ success: false, error: 'Failed to create deployment' });
    }
    
    // Execute deployment asynchronously
    PaaSDeploymentService.executeDeployment(deployment.id).catch(err => {
      console.error('Error executing deployment:', err);
    });

    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_deploy',
      entityType: 'paas_application',
      entityId: app.id,
      message: `Triggered deployment ${deployment.id} for app ${app.name}`,
      status: 'success',
      metadata: { deploymentId: deployment.id, applicationId: app.id },
    }, req);

    res.status(201).json({ success: true, deployment });
  } catch (error: any) {
    console.error('Error triggering deployment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/addons
 * Get addons for an application
 */
router.get('/:id/addons', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const addons = await PaaSAddonService.getAddonsByApplication(req.params.id);
    res.json({ success: true, addons });
  } catch (error: any) {
    console.error('Error getting addons:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/addons
 * Create an addon for an application
 */
router.post('/:id/addons', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const addon = await PaaSAddonService.createAddon({
      applicationId: req.params.id,
      ...req.body
    });
    
    if (!addon) {
      return res.status(500).json({ success: false, error: 'Failed to create addon' });
    }
    
    res.status(201).json({ success: true, addon });
  } catch (error: any) {
    console.error('Error creating addon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/client/paas/applications/:appId/addons/:addonId
 * Delete an addon
 */
router.delete('/:appId/addons/:addonId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.appId);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const success = await PaaSAddonService.deleteAddon(req.params.addonId);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Addon not found or delete failed' });
    }
    
    res.json({ success: true, message: 'Addon deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting addon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/env
 * Get environment variables for an application
 */
router.get('/:id/env', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await query(
      'SELECT id, key, is_secret AS is_encrypted, created_at FROM paas_app_env_vars WHERE application_id = $1',
      [req.params.id]
    );
    
    res.json({ success: true, envVars: result.rows });
  } catch (error: any) {
    console.error('Error getting env vars:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/env
 * Add environment variable
 */
router.post('/:id/env', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const { key, value, is_secret, isSecret, isEncrypted } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({ success: false, error: 'Key and value are required' });
    }
    
    const isSecretFlag =
      typeof is_secret === 'boolean'
        ? is_secret
        : typeof isSecret === 'boolean'
        ? isSecret
        : typeof isEncrypted === 'boolean'
        ? isEncrypted
        : false;
    
    const result = await query(
      `INSERT INTO paas_app_env_vars (application_id, key, value_encrypted, is_secret, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, key, value, isSecretFlag, new Date(), authReq.user!.id]
    );
    
    res.status(201).json({ success: true, envVar: result.rows[0] });
  } catch (error: any) {
    console.error('Error adding env var:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/client/paas/applications/:id/env/:envId
 * Update environment variable
 */
router.put('/:id/env/:envId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const { value, is_secret, isSecret, isEncrypted } = req.body;
    
    if (!value) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    const isSecretFlag =
      typeof is_secret === 'boolean'
        ? is_secret
        : typeof isSecret === 'boolean'
        ? isSecret
        : typeof isEncrypted === 'boolean'
        ? isEncrypted
        : undefined;
    
    const result = await query(
      `UPDATE paas_app_env_vars 
       SET value_encrypted = $1, 
           is_secret = COALESCE($2, is_secret),
           updated_at = NOW()
       WHERE id = $3 AND application_id = $4
       RETURNING *`,
      [value, isSecretFlag, req.params.envId, req.params.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Environment variable not found' });
    }
    
    res.json({ success: true, envVar: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating env var:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/client/paas/applications/:appId/env/:envId
 * Delete environment variable
 */
router.delete('/:appId/env/:envId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.appId);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    await query('DELETE FROM paas_app_env_vars WHERE id = $1', [req.params.envId]);
    
    res.json({ success: true, message: 'Environment variable deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting env var:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/ports
 * Add a port mapping
 */
router.post('/:id/ports', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const {
      containerPort,
      internalPort,
      protocol,
      customDomain,
      isPrimary,
      isInternalOnly,
      hostPort,
      hostIp,
      targetMachine,
      enableSsl,
    } = req.body;
    
    const resolvedContainerPort = containerPort || internalPort;
    
    if (!resolvedContainerPort) {
      return res.status(400).json({ success: false, error: 'Container/internal port is required' });
    }
    
    const result = await query(
      `INSERT INTO paas_app_ports (
         application_id,
         container_port,
         protocol,
         custom_domain,
         is_primary,
         is_internal_only,
         host_port,
         host_ip,
         target_machine,
         enable_ssl,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.params.id,
        resolvedContainerPort,
        protocol || 'https',
        customDomain || null,
        isPrimary ?? false,
        isInternalOnly ?? false,
        hostPort ?? null,
        hostIp || null,
        targetMachine || null,
        enableSsl ?? true,
        new Date(),
      ]
    );
    
    res.status(201).json({ success: true, port: result.rows[0] });
  } catch (error: any) {
    console.error('Error adding port:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/ports
 * List port mappings
 */
router.get('/:id/ports', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await query(
      'SELECT * FROM paas_app_ports WHERE application_id = $1 ORDER BY container_port ASC, id ASC',
      [req.params.id]
    );
    
    res.json({ success: true, ports: result.rows });
  } catch (error: any) {
    console.error('Error listing ports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/client/paas/applications/:id/ports/:portId
 * Update a port mapping
 */
router.put('/:id/ports/:portId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await query(
      `UPDATE paas_app_ports 
       SET protocol = COALESCE($1, protocol),
           custom_domain = COALESCE($2, custom_domain),
           is_primary = COALESCE($3, is_primary),
           is_internal_only = COALESCE($4, is_internal_only),
           host_port = COALESCE($5, host_port),
           host_ip = COALESCE($6, host_ip),
           target_machine = COALESCE($7, target_machine),
           enable_ssl = COALESCE($8, enable_ssl),
           updated_at = NOW()
       WHERE id = $9 AND application_id = $10
       RETURNING *`,
      [
        req.body.protocol,
        req.body.customDomain,
        req.body.isPrimary,
        req.body.isInternalOnly,
        req.body.hostPort,
        req.body.hostIp,
        req.body.targetMachine,
        req.body.enableSsl,
        req.params.portId,
        req.params.id,
      ]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Port mapping not found' });
    }
    
    res.json({ success: true, port: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating port:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/client/paas/applications/:id/ports/:portId
 * Delete a port mapping
 */
router.delete('/:id/ports/:portId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await query(
      'DELETE FROM paas_app_ports WHERE id = $1 AND application_id = $2',
      [req.params.portId, req.params.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Port mapping not found' });
    }
    
    res.json({ success: true, message: 'Port mapping deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting port:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/start
 * Start an application
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await PaaSApplicationService.startApplication(req.params.id);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_start',
      entityType: 'paas_application',
      entityId: app.id,
      message: `Started PaaS application ${app.name}`,
      status: result.success ? 'success' : 'error',
      metadata: { applicationId: app.id },
    }, req);

    res.json({ success: true, message: 'Application started successfully' });
  } catch (error: any) {
    console.error('Error starting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/stop
 * Stop an application
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await PaaSApplicationService.stopApplication(req.params.id);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_stop',
      entityType: 'paas_application',
      entityId: app.id,
      message: `Stopped PaaS application ${app.name}`,
      status: result.success ? 'success' : 'error',
      metadata: { applicationId: app.id },
    }, req);

    res.json({ success: true, message: 'Application stopped successfully' });
  } catch (error: any) {
    console.error('Error stopping application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/applications/:id/restart
 * Restart an application
 */
router.post('/:id/restart', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const result = await PaaSApplicationService.restartApplication(req.params.id);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    await logActivity({
      userId: authReq.user!.id,
      organizationId: authReq.user!.organizationId,
      eventType: 'paas_app_restart',
      entityType: 'paas_application',
      entityId: app.id,
      message: `Restarted PaaS application ${app.name}`,
      status: result.success ? 'success' : 'error',
      metadata: { applicationId: app.id },
    }, req);

    res.json({ success: true, message: 'Application restarted successfully' });
  } catch (error: any) {
    console.error('Error restarting application:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/applications/:id/logs
 * Get application logs
 */
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);
    
    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    
    const lines = req.query.lines ? parseInt(req.query.lines as string, 10) : 100;
    const result = await PaaSApplicationService.getApplicationLogs(req.params.id, lines);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, logs: result.logs });
  } catch (error: any) {
    console.error('Error getting application logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/domains', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);

    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const { domain, containerPort, internalPort, protocol, isPrimary, enableSsl } = req.body;

    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domain is required' });
    }

    const resolvedContainerPort = containerPort || internalPort || app.appPort;

    if (!resolvedContainerPort) {
      return res.status(400).json({ success: false, error: 'No port specified and application has no default appPort' });
    }

    const insertResult = await query(
      `INSERT INTO paas_app_ports (
         application_id,
         container_port,
         protocol,
         custom_domain,
         is_primary,
         is_internal_only,
         enable_ssl,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.params.id,
        resolvedContainerPort,
        protocol || 'https',
        domain,
        isPrimary ?? false,
        false,
        enableSsl ?? true,
        new Date(),
      ]
    );

    const redeploy = await PaaSApplicationService.redeployConfig(app.id);

    if (!redeploy.success) {
      return res.status(500).json({ success: false, error: redeploy.error || 'Failed to apply domain configuration' });
    }

    return res.status(201).json({ success: true, domain: insertResult.rows[0], logs: redeploy.logs });
  } catch (error: any) {
    console.error('Error adding custom domain:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id/domains/:domain', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const app = await PaaSApplicationService.getApplicationById(req.params.id);

    if (!app || app.userId !== authReq.user!.id) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const deleteResult = await query(
      'DELETE FROM paas_app_ports WHERE application_id = $1 AND custom_domain = $2',
      [req.params.id, req.params.domain]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }

    const redeploy = await PaaSApplicationService.redeployConfig(app.id);

    if (!redeploy.success) {
      return res.status(500).json({ success: false, error: redeploy.error || 'Failed to apply domain configuration' });
    }

    return res.json({ success: true, message: 'Domain removed successfully', logs: redeploy.logs });
  } catch (error: any) {
    console.error('Error deleting custom domain:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
