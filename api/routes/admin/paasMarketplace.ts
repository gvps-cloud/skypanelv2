/**
 * Admin PaaS Marketplace Management Routes
 * Admin-only endpoints for managing marketplace templates
 */

import express, { Request, Response } from 'express';
import { PaaSMarketplaceService } from '../../services/paasMarketplaceService.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/paas/marketplace
 * List all marketplace templates (including inactive)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const templates = await PaaSMarketplaceService.listTemplates(category as string);
    res.json({ success: true, templates });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/marketplace/:id
 * Get a specific template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await PaaSMarketplaceService.getTemplateById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, template });
  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/marketplace
 * Create a new marketplace template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const templateData = {
      ...req.body,
      createdBy: authReq.user?.id
    };
    
    const template = await PaaSMarketplaceService.createTemplate(templateData);
    
    if (!template) {
      return res.status(500).json({ success: false, error: 'Failed to create template' });
    }
    
    res.status(201).json({ success: true, template });
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/marketplace/:id
 * Update a marketplace template
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const success = await PaaSMarketplaceService.updateTemplate(req.params.id, req.body);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Template not found or update failed' });
    }
    
    const updatedTemplate = await PaaSMarketplaceService.getTemplateById(req.params.id);
    res.json({ success: true, template: updatedTemplate });
  } catch (error: any) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/marketplace/:id/active
 * Activate or deactivate a template
 */
router.put('/:id/active', async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }
    
    const success = await PaaSMarketplaceService.setTemplateActive(req.params.id, isActive);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, message: `Template ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error: any) {
    console.error('Error updating template status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/marketplace/:id
 * Delete a marketplace template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await PaaSMarketplaceService.deleteTemplate(req.params.id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
