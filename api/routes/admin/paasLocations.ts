/**
 * Admin PaaS Location Management Routes
 * Admin-only endpoints for managing PaaS datacenter locations
 * 
 * These routes provide CRUD operations for datacenter locations that can be
 * assigned to PaaS worker nodes. This helps organize infrastructure by geographic
 * region and datacenter for better resource management.
 * 
 * All routes require admin authentication and are prefixed with /api/admin/paas/locations
 */

import express, { Request, Response } from 'express';
import { PaaSLocationService } from '../../services/paasLocationService.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/paas/locations
 * List all datacenter locations
 * 
 * Query parameters:
 * - activeOnly: boolean - If true, only return active locations
 * 
 * Response:
 * - success: boolean
 * - locations: PaaSLocation[]
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activeOnly } = req.query;
    const locations = await PaaSLocationService.getAllLocations(activeOnly === 'true');
    res.json({ success: true, locations });
  } catch (error: any) {
    console.error('Error listing locations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/locations/stats
 * Get location statistics
 * 
 * Response:
 * - success: boolean
 * - stats: LocationStats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await PaaSLocationService.getLocationStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error getting location stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/locations/:id
 * Get a specific location by ID
 * 
 * Response:
 * - success: boolean
 * - location: PaaSLocation
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const location = await PaaSLocationService.getLocationById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    
    // Also include worker count for this location
    const workerCount = await PaaSLocationService.getWorkerCountForLocation(req.params.id);
    
    res.json({ 
      success: true, 
      location: {
        ...location,
        workerCount
      }
    });
  } catch (error: any) {
    console.error('Error getting location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/locations
 * Create a new datacenter location
 * 
 * Request body:
 * - name: string (required) - Human-readable location name
 * - datacenterCode: string (required) - Unique datacenter code
 * - region: string (required) - Geographic region slug
 * - country: string (required) - Country name or ISO code
 * - description: string (optional) - Location description
 * - metadata: object (optional) - Additional metadata
 * - isActive: boolean (optional, default: true) - Whether location is active
 * 
 * Response:
 * - success: boolean
 * - location: PaaSLocation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { name, datacenterCode, region, country, description, metadata, isActive } = req.body;
    
    // Validate required fields
    if (!name || !datacenterCode || !region || !country) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, datacenterCode, region, and country are required' 
      });
    }
    
    // Validate datacenter code format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/i.test(datacenterCode)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datacenter code must contain only letters, numbers, and hyphens' 
      });
    }
    
    const location = await PaaSLocationService.createLocation({
      name: name.trim(),
      datacenterCode: datacenterCode.trim().toLowerCase(),
      region: region.trim(),
      country: country.trim(),
      description: description?.trim(),
      metadata: metadata || {},
      isActive: isActive !== undefined ? isActive : true,
      createdBy: authReq.user?.id ? Number(authReq.user.id) : undefined
    });
    
    if (!location) {
      return res.status(500).json({ success: false, error: 'Failed to create location' });
    }
    
    res.status(201).json({ 
      success: true, 
      location,
      message: 'Location created successfully'
    });
  } catch (error: any) {
    console.error('Error creating location:', error);
    
    // Return appropriate error message
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/locations/:id
 * Update an existing location
 * 
 * Request body: (all fields optional)
 * - name: string
 * - datacenterCode: string
 * - region: string
 * - country: string
 * - description: string
 * - metadata: object
 * - isActive: boolean
 * 
 * Response:
 * - success: boolean
 * - location: PaaSLocation
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const location = await PaaSLocationService.getLocationById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    
    const { name, datacenterCode, region, country, description, metadata, isActive } = req.body;
    
    // Validate datacenter code format if provided
    if (datacenterCode && !/^[a-z0-9-]+$/i.test(datacenterCode)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datacenter code must contain only letters, numbers, and hyphens' 
      });
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (datacenterCode !== undefined) updates.datacenterCode = datacenterCode.trim().toLowerCase();
    if (region !== undefined) updates.region = region.trim();
    if (country !== undefined) updates.country = country.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (metadata !== undefined) updates.metadata = metadata;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const updatedLocation = await PaaSLocationService.updateLocation(req.params.id, updates);
    
    if (!updatedLocation) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }
    
    res.json({ success: true, location: updatedLocation });
  } catch (error: any) {
    console.error('Error updating location:', error);
    
    // Return appropriate error message
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/locations/:id
 * Delete a location
 * 
 * Note: Workers assigned to this location will have their location_id set to NULL.
 * This operation cannot be undone.
 * 
 * Response:
 * - success: boolean
 * - message: string
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const location = await PaaSLocationService.getLocationById(req.params.id);
    
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    
    // Check worker count before deletion
    const workerCount = await PaaSLocationService.getWorkerCountForLocation(req.params.id);
    
    const success = await PaaSLocationService.deleteLocation(req.params.id);
    
    if (!success) {
      return res.status(500).json({ success: false, error: 'Delete failed' });
    }
    
    const message = workerCount > 0 
      ? `Location deleted successfully. ${workerCount} worker(s) were unassigned from this location.`
      : 'Location deleted successfully';
    
    res.json({ success: true, message });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
