/**
 * Client PaaS Marketplace Routes
 * User-facing endpoints for browsing and deploying from marketplace
 */

import express, { Request, Response } from 'express';
import { PaaSMarketplaceService } from '../../services/paasMarketplaceService.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/client/paas/marketplace
 * List active marketplace templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const templates = await PaaSMarketplaceService.listTemplates(category as string);
    
    // Filter only active templates for clients
    const activeTemplates = templates.filter(t => t.isActive);
    
    res.json({ success: true, templates: activeTemplates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/marketplace/templates
 * Alias for listing templates (same as root /)
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const templates = await PaaSMarketplaceService.listTemplates(category as string);
    
    // Filter only active templates for clients
    const activeTemplates = templates.filter(t => t.isActive);
    
    res.json({ success: true, templates: activeTemplates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/marketplace/categories
 * Get available template categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await PaaSMarketplaceService.getCategories();
    res.json({ success: true, categories });
  } catch (error: any) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/client/paas/marketplace/:id
 * Get a specific template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await PaaSMarketplaceService.getTemplateById(req.params.id);
    
    if (!template || !template.isActive) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, template });
  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/client/paas/marketplace/:id/deploy
 * Deploy an application from a template
 */
router.post('/:id/deploy', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { applicationName, workerNodeId, environmentVariables } = req.body;
    
    if (!applicationName || !workerNodeId) {
      return res.status(400).json({
        success: false,
        error: 'applicationName and workerNodeId are required'
      });
    }
    
    const result = await PaaSMarketplaceService.deployFromTemplate({
      templateId: req.params.id,
      userId: authReq.user!.id,
      applicationName,
      workerNodeId,
      environmentVariables
    });
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error deploying from template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
