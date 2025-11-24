/**
 * Admin PaaS Pricing Management Routes
 * Admin-only endpoints for managing pricing plans and addon pricing
 */

import express, { Request, Response } from 'express';
import { PaaSPricingService } from '../../services/paasPricingService.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { logActivity } from '../../services/activityLogger.js';

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
    const { name, slug, plan_type } = req.body;
    
    if (!name || !slug || !plan_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, slug, and plan_type are required' 
      });
    }
    
    // Basic server-side validation for pricing fields to complement frontend checks
    if (plan_type === 'monthly') {
      const monthlyPrice = Number(req.body.monthly_price);
      if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'monthly_price must be a non-negative number for monthly plans'
        });
      }
      req.body.monthly_price = monthlyPrice;
    } else if (plan_type === 'per_resource') {
      const perResourceFields: Array<[string, any]> = [
        ['price_per_cpu_hour', req.body.price_per_cpu_hour],
        ['price_per_ram_gb_hour', req.body.price_per_ram_gb_hour],
        ['price_per_disk_gb_month', req.body.price_per_disk_gb_month],
        ['price_per_bandwidth_gb', req.body.price_per_bandwidth_gb],
      ];

      for (const [key, value] of perResourceFields) {
        if (value !== undefined) {
          const num = Number(value);
          if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({
              success: false,
              error: `${key} must be a non-negative number when provided`,
            });
          }
          (req.body as any)[key] = num;
        }
      }
    }
    
    const plan = await PaaSPricingService.createPlan({
      ...req.body,
      created_by: authReq.user?.id
    });
    
    if (!plan) {
      return res.status(500).json({ success: false, error: 'Failed to create pricing plan' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_plan_create',
        entityType: 'paas_pricing_plan',
        entityId: String((plan as any).id),
        message: `Created PaaS pricing plan ${(plan as any).slug || (plan as any).name}`,
        status: 'success',
        metadata: {
          planType: (plan as any).plan_type,
          monthlyPrice: (plan as any).monthly_price,
          maxApplications: (plan as any).max_applications,
        },
      }, authReq as any);
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
    const authReq = req as AuthenticatedRequest;
    const plan = await PaaSPricingService.getPlanById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Pricing plan not found' });
    }
    
    const updates = { ...req.body } as any;
    const effectivePlanType = updates.plan_type || plan.plan_type;

    if (effectivePlanType === 'monthly' && 'monthly_price' in updates) {
      const monthlyPrice = Number(updates.monthly_price);
      if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
        return res.status(400).json({
          success: false,
          error: 'monthly_price must be a non-negative number for monthly plans',
        });
      }
      updates.monthly_price = monthlyPrice;
    }

    if (effectivePlanType === 'per_resource') {
      const perResourceFields: Array<[string, any]> = [
        ['price_per_cpu_hour', updates.price_per_cpu_hour],
        ['price_per_ram_gb_hour', updates.price_per_ram_gb_hour],
        ['price_per_disk_gb_month', updates.price_per_disk_gb_month],
        ['price_per_bandwidth_gb', updates.price_per_bandwidth_gb],
      ];

      for (const [key, value] of perResourceFields) {
        if (value !== undefined) {
          const num = Number(value);
          if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({
              success: false,
              error: `${key} must be a non-negative number when provided`,
            });
          }
          updates[key] = num;
        }
      }
    }

    const updatedPlan = await PaaSPricingService.updatePlan(req.params.id, updates);
    
    if (!updatedPlan) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_plan_update',
        entityType: 'paas_pricing_plan',
        entityId: String((updatedPlan as any).id),
        message: `Updated PaaS pricing plan ${(updatedPlan as any).slug || (updatedPlan as any).name}`,
        status: 'success',
        metadata: {
          planType: (updatedPlan as any).plan_type,
          monthlyPrice: (updatedPlan as any).monthly_price,
          maxApplications: (updatedPlan as any).max_applications,
        },
      }, authReq as any);
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
    const authReq = req as AuthenticatedRequest;
    const plan = await PaaSPricingService.getPlanById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Pricing plan not found' });
    }
    
    const success = await PaaSPricingService.deletePlan(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_plan_delete',
        entityType: 'paas_pricing_plan',
        entityId: String(req.params.id),
        message: `Deleted PaaS pricing plan ${(plan as any).slug || (plan as any).name}`,
        status: 'success',
      }, authReq as any);
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
    const authReq = req as AuthenticatedRequest;
    const { name, slug, addon_type, monthly_price, storage_gb, max_connections } = req.body;
    
    if (!name || !slug || !addon_type || monthly_price === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, slug, addon_type, and monthly_price are required' 
      });
    }
    
    const price = Number(monthly_price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'monthly_price must be a non-negative number',
      });
    }

    let storageValue: number | undefined;
    if (storage_gb !== undefined) {
      storageValue = Number(storage_gb);
      if (!Number.isFinite(storageValue) || storageValue < 0) {
        return res.status(400).json({
          success: false,
          error: 'storage_gb must be a non-negative number when provided',
        });
      }
    }

    let maxConnectionsValue: number | undefined;
    if (max_connections !== undefined) {
      maxConnectionsValue = Number(max_connections);
      if (!Number.isFinite(maxConnectionsValue) || maxConnectionsValue < 0) {
        return res.status(400).json({
          success: false,
          error: 'max_connections must be a non-negative number when provided',
        });
      }
    }

    const addon = await PaaSPricingService.createAddonPricing({
      ...req.body,
      monthly_price: price,
      storage_gb: storageValue ?? storage_gb,
      max_connections: maxConnectionsValue ?? max_connections,
    });
    
    if (!addon) {
      return res.status(500).json({ success: false, error: 'Failed to create addon pricing' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_addon_create',
        entityType: 'paas_addon_pricing',
        entityId: String((addon as any).id),
        message: `Created PaaS addon pricing ${(addon as any).slug || (addon as any).name}`,
        status: 'success',
        metadata: {
          addonType: (addon as any).addon_type,
          monthlyPrice: (addon as any).monthly_price,
          storageGb: (addon as any).storage_gb,
          maxConnections: (addon as any).max_connections,
        },
      }, authReq as any);
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
    const authReq = req as AuthenticatedRequest;
    const addon = await PaaSPricingService.getAddonPricingById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Addon pricing not found' });
    }
    
    const updates = { ...req.body } as any;

    if ('monthly_price' in updates) {
      const price = Number(updates.monthly_price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          error: 'monthly_price must be a non-negative number',
        });
      }
      updates.monthly_price = price;
    }

    if ('storage_gb' in updates && updates.storage_gb !== undefined) {
      const storageValue = Number(updates.storage_gb);
      if (!Number.isFinite(storageValue) || storageValue < 0) {
        return res.status(400).json({
          success: false,
          error: 'storage_gb must be a non-negative number when provided',
        });
      }
      updates.storage_gb = storageValue;
    }

    if ('max_connections' in updates && updates.max_connections !== undefined) {
      const maxConnectionsValue = Number(updates.max_connections);
      if (!Number.isFinite(maxConnectionsValue) || maxConnectionsValue < 0) {
        return res.status(400).json({
          success: false,
          error: 'max_connections must be a non-negative number when provided',
        });
      }
      updates.max_connections = maxConnectionsValue;
    }

    const updatedAddon = await PaaSPricingService.updateAddonPricing(req.params.id, updates);
    
    if (!updatedAddon) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_addon_update',
        entityType: 'paas_addon_pricing',
        entityId: String((updatedAddon as any).id),
        message: `Updated PaaS addon pricing ${(updatedAddon as any).slug || (updatedAddon as any).name}`,
        status: 'success',
        metadata: {
          addonType: (updatedAddon as any).addon_type,
          monthlyPrice: (updatedAddon as any).monthly_price,
          storageGb: (updatedAddon as any).storage_gb,
          maxConnections: (updatedAddon as any).max_connections,
        },
      }, authReq as any);
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
    const authReq = req as AuthenticatedRequest;
    const addon = await PaaSPricingService.getAddonPricingById(req.params.id);
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Addon pricing not found' });
    }
    
    const success = await PaaSPricingService.deleteAddonPricing(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    if (authReq.user?.id) {
      await logActivity({
        userId: authReq.user.id,
        organizationId: authReq.user.organizationId ?? null,
        eventType: 'paas_addon_delete',
        entityType: 'paas_addon_pricing',
        entityId: String(req.params.id),
        message: `Deleted PaaS addon pricing ${(addon as any).slug || (addon as any).name}`,
        status: 'success',
      }, authReq as any);
    }

    res.json({ success: true, message: 'Addon pricing deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting addon pricing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
