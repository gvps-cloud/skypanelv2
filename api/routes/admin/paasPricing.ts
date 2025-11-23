/**
 * Admin PaaS Pricing Management Routes
 * Admin-only endpoints for managing pricing plans and addon pricing
 */

import express, { Request, Response } from 'express';
import { PaaSPricingService } from '../../services/paasPricingService.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/paas/pricing/plans
 * List all pricing plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await PaaSPricingService.getAllPlans(true); // Include hidden plans
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error listing pricing plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/pricing/plans/:id
 * Get a specific pricing plan
 */
router.get('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await PaaSPricingService.getPlanById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Pricing plan not found' });
    }
    
    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Error getting pricing plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/pricing/plans
 * Create a new pricing plan
 */
router.post('/plans', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, slug, plan_type, monthly_price } = req.body;
    
    if (!name || !slug || !plan_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, slug, and plan_type are required' 
      });
    }
    
    const plan = await PaaSPricingService.createPlan({
      ...req.body,
      created_by: authReq.user?.id
    });
    
    if (!plan) {
      return res.status(500).json({ success: false, error: 'Failed to create pricing plan' });
    }
    
    res.status(201).json({ success: true, plan });
  } catch (error: any) {
    console.error('Error creating pricing plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/pricing/plans/:id
 * Update a pricing plan
 */
router.put('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await PaaSPricingService.getPlanById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Pricing plan not found' });
    }
    
    const updatedPlan = await PaaSPricingService.updatePlan(req.params.id, req.body);
    
    if (!updatedPlan) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    res.json({ success: true, plan: updatedPlan });
  } catch (error: any) {
    console.error('Error updating pricing plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/pricing/plans/:id
 * Delete a pricing plan
 */
router.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await PaaSPricingService.getPlanById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Pricing plan not found' });
    }
    
    const success = await PaaSPricingService.deletePlan(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    res.json({ success: true, message: 'Pricing plan deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting pricing plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/pricing/addons
 * List all addon pricing
 */
router.get('/addons', async (req: Request, res: Response) => {
  try {
    const addons = await PaaSPricingService.getAllAddonPricing(true); // Include hidden
    res.json({ success: true, addons });
  } catch (error: any) {
    console.error('Error listing addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/pricing/addons/:id
 * Get specific addon pricing
 */
router.get('/addons/:id', async (req: Request, res: Response) => {
  try {
    const addon = await PaaSPricingService.getAddonPricingById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Addon pricing not found' });
    }
    
    res.json({ success: true, addon });
  } catch (error: any) {
    console.error('Error getting addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/pricing/addons
 * Create new addon pricing
 */
router.post('/addons', async (req: Request, res: Response) => {
  try {
    const { name, slug, addon_type, monthly_price } = req.body;
    
    if (!name || !slug || !addon_type || monthly_price === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, slug, addon_type, and monthly_price are required' 
      });
    }
    
    const addon = await PaaSPricingService.createAddonPricing(req.body);
    
    if (!addon) {
      return res.status(500).json({ success: false, error: 'Failed to create addon pricing' });
    }
    
    res.status(201).json({ success: true, addon });
  } catch (error: any) {
    console.error('Error creating addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/pricing/addons/:id
 * Update addon pricing
 */
router.put('/addons/:id', async (req: Request, res: Response) => {
  try {
    const addon = await PaaSPricingService.getAddonPricingById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Addon pricing not found' });
    }
    
    const updatedAddon = await PaaSPricingService.updateAddonPricing(req.params.id, req.body);
    
    if (!updatedAddon) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    res.json({ success: true, addon: updatedAddon });
  } catch (error: any) {
    console.error('Error updating addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/pricing/addons/:id
 * Delete addon pricing
 */
router.delete('/addons/:id', async (req: Request, res: Response) => {
  try {
    const addon = await PaaSPricingService.getAddonPricingById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Addon pricing not found' });
    }
    
    const success = await PaaSPricingService.deleteAddonPricing(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    res.json({ success: true, message: 'Addon pricing deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
