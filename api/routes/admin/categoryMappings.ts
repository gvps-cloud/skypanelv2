/**
 * Admin Category Mappings Routes
 * Manage white-label category mappings for VPS plan types
 */
import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { categoryMappingService } from '../../services/categoryMappingService.js';
import { logActivity } from '../../services/activityLogger.js';

const router = express.Router();

// Valid original categories from Linode API
const VALID_ORIGINAL_CATEGORIES = [
  'standard',
  'nanode',
  'dedicated',
  'premium',
  'highmem',
  'gpu',
  'accelerated',
  'memory',
  'cpu'
];

// ============================================================================
// CATEGORY MAPPINGS ROUTES
// ============================================================================

/**
 * Get all category mappings
 * GET /api/admin/category-mappings
 */
router.get('/category-mappings', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const mappings = await categoryMappingService.getAllCategoryMappings();
    res.json({ mappings });
  } catch (err: any) {
    console.error('Admin category mappings fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch category mappings' });
  }
});

/**
 * Get enabled category mappings (for frontend display)
 * GET /api/admin/category-mappings/enabled
 */
router.get('/category-mappings/enabled', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mappings = await categoryMappingService.getEnabledCategoryMappings();
    res.json({ mappings });
  } catch (err: any) {
    console.error('Enabled category mappings fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch enabled category mappings' });
  }
});

/**
 * Get a single category mapping by ID
 * GET /api/admin/category-mappings/:id
 */
router.get(
  '/category-mappings/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid category mapping ID')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const mapping = await categoryMappingService.getCategoryMappingById(req.params.id);

      if (!mapping) {
        res.status(404).json({ error: 'Category mapping not found' });
        return;
      }

      res.json({ mapping });
    } catch (err: any) {
      console.error('Admin category mapping fetch error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch category mapping' });
    }
  }
);

/**
 * Create a new category mapping
 * POST /api/admin/category-mappings
 */
router.post(
  '/category-mappings',
  authenticateToken,
  requireAdmin,
  [
    body('original_category')
      .isString()
      .trim()
      .toLowerCase()
      .isIn(VALID_ORIGINAL_CATEGORIES)
      .withMessage(`Original category must be one of: ${VALID_ORIGINAL_CATEGORIES.join(', ')}`),
    body('custom_name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Custom name must be between 1 and 100 characters'),
    body('custom_description')
      .optional()
      .isString()
      .trim()
      .withMessage('Custom description must be a string'),
    body('display_order')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Display order must be a non-negative integer'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean'),
    body('provider_id')
      .optional()
      .isUUID()
      .withMessage('Provider ID must be a valid UUID')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const mapping = await categoryMappingService.createCategoryMapping(req.body);

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'category_mapping.create',
          entityType: 'category_mapping',
          entityId: mapping.id,
          message: `Created category mapping: ${mapping.original_category} -> ${mapping.custom_name}`,
          status: 'success',
          metadata: {
            original_category: mapping.original_category,
            custom_name: mapping.custom_name
          }
        }, req);
      }

      res.status(201).json({ mapping });
    } catch (err: any) {
      console.error('Admin category mapping creation error:', err);

      // Handle unique constraint violations
      if (err.code === '23505') {
        res.status(409).json({ error: 'A mapping for this category already exists' });
        return;
      }

      res.status(500).json({ error: err.message || 'Failed to create category mapping' });
    }
  }
);

/**
 * Update an existing category mapping
 * PUT /api/admin/category-mappings/:id
 */
router.put(
  '/category-mappings/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid category mapping ID'),
    body('custom_name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Custom name must be between 1 and 100 characters'),
    body('custom_description')
      .optional()
      .isString()
      .trim()
      .withMessage('Custom description must be a string'),
    body('display_order')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Display order must be a non-negative integer'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const mapping = await categoryMappingService.updateCategoryMapping(
        req.params.id,
        req.body
      );

      if (!mapping) {
        res.status(404).json({ error: 'Category mapping not found' });
        return;
      }

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'category_mapping.update',
          entityType: 'category_mapping',
          entityId: mapping.id,
          message: `Updated category mapping: ${mapping.original_category} -> ${mapping.custom_name}`,
          status: 'success',
          metadata: {
            original_category: mapping.original_category,
            custom_name: mapping.custom_name
          }
        }, req);
      }

      res.json({ mapping });
    } catch (err: any) {
      console.error('Admin category mapping update error:', err);
      res.status(500).json({ error: err.message || 'Failed to update category mapping' });
    }
  }
);

/**
 * Delete a category mapping
 * DELETE /api/admin/category-mappings/:id
 */
router.delete(
  '/category-mappings/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid category mapping ID')],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      // Get mapping details for logging before deletion
      const existingMapping = await categoryMappingService.getCategoryMappingById(req.params.id);

      if (!existingMapping) {
        res.status(404).json({ error: 'Category mapping not found' });
        return;
      }

      const success = await categoryMappingService.deleteCategoryMapping(req.params.id);

      if (!success) {
        res.status(404).json({ error: 'Category mapping not found' });
        return;
      }

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'category_mapping.delete',
          entityType: 'category_mapping',
          entityId: req.params.id,
          message: `Deleted category mapping: ${existingMapping.original_category} -> ${existingMapping.custom_name}`,
          status: 'success',
          metadata: {
            original_category: existingMapping.original_category,
            custom_name: existingMapping.custom_name
          }
        }, req);
      }

      res.status(204).send();
    } catch (err: any) {
      console.error('Admin category mapping deletion error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete category mapping' });
    }
  }
);

/**
 * Reorder category mappings
 * POST /api/admin/category-mappings/reorder
 */
router.post(
  '/category-mappings/reorder',
  authenticateToken,
  requireAdmin,
  [
    body('orderings')
      .isArray()
      .withMessage('Orderings must be an array'),
    body('orderings.*.id')
      .isUUID()
      .withMessage('Each ordering must have a valid UUID id'),
    body('orderings.*.display_order')
      .isInt({ min: 0 })
      .withMessage('Each ordering must have a non-negative display_order')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      await categoryMappingService.reorderCategoryMappings(req.body.orderings);

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'category_mapping.reorder',
          entityType: 'category_mapping',
          entityId: 'bulk',
          message: `Reordered ${req.body.orderings.length} category mapping(s)`,
          status: 'success',
          metadata: { count: req.body.orderings.length }
        }, req);
      }

      // Fetch and return updated mappings
      const mappings = await categoryMappingService.getAllCategoryMappings();
      res.json({ mappings });
    } catch (err: any) {
      console.error('Admin category mappings reorder error:', err);
      res.status(500).json({ error: err.message || 'Failed to reorder category mappings' });
    }
  }
);

/**
 * Bulk sync category mappings
 * POST /api/admin/category-mappings/sync
 */
router.post(
  '/category-mappings/sync',
  authenticateToken,
  requireAdmin,
  [
    body('mappings')
      .isArray()
      .withMessage('Mappings must be an array'),
    body('mappings.*.original_category')
      .isString()
      .trim()
      .toLowerCase()
      .isIn(VALID_ORIGINAL_CATEGORIES)
      .withMessage(`Each original category must be one of: ${VALID_ORIGINAL_CATEGORIES.join(', ')}`),
    body('mappings.*.custom_name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each custom name must be between 1 and 100 characters'),
    body('mappings.*.custom_description')
      .optional()
      .isString()
      .trim()
      .withMessage('Custom description must be a string'),
    body('mappings.*.display_order')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Display order must be a non-negative integer'),
    body('mappings.*.enabled')
      .optional()
      .isBoolean()
      .withMessage('Enabled must be a boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const mappings = await categoryMappingService.syncCategoryMappings(req.body.mappings);

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'category_mapping.sync',
          entityType: 'category_mapping',
          entityId: 'bulk',
          message: `Synced ${mappings.length} category mapping(s)`,
          status: 'success',
          metadata: { count: mappings.length }
        }, req);
      }

      res.json({ mappings });
    } catch (err: any) {
      console.error('Admin category mappings sync error:', err);

      // Handle unique constraint violations
      if (err.code === '23505') {
        res.status(409).json({ error: 'A mapping for one of the categories already exists' });
        return;
      }

      res.status(500).json({ error: err.message || 'Failed to sync category mappings' });
    }
  }
);

export default router;