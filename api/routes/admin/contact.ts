/**
 * Admin Contact Management Routes
 * Manage contact categories and contact methods
 */
import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';

const router = express.Router();

// ============================================================================
// CONTACT CATEGORIES ROUTES
// ============================================================================

/**
 * Get all contact categories (including inactive)
 * GET /api/admin/contact/categories
 */
router.get('/categories', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, label, value, display_order, is_active, created_at, updated_at 
       FROM contact_categories 
       ORDER BY display_order ASC`
    );

    res.json({ categories: result.rows || [] });
  } catch (err: any) {
    console.error('Admin contact categories list error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch contact categories' });
  }
});

/**
 * Create a new contact category
 * POST /api/admin/contact/categories
 */
router.post(
  '/categories',
  authenticateToken,
  requireAdmin,
  [
    body('label').isString().trim().notEmpty().withMessage('Label is required'),
    body('value').isString().trim().notEmpty().withMessage('Value is required')
      .matches(/^[a-z0-9_-]+$/).withMessage('Value must contain only lowercase letters, numbers, hyphens, and underscores'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { label, value, display_order, is_active = true } = req.body;

      // Check if value already exists
      const existingResult = await query(
        'SELECT id FROM contact_categories WHERE value = $1',
        [value]
      );

      if (existingResult.rows.length > 0) {
        res.status(409).json({ error: 'A category with this value already exists' });
        return;
      }

      // If display_order not provided, get the next available order
      let finalDisplayOrder = display_order;
      if (typeof finalDisplayOrder === 'undefined') {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM contact_categories'
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const now = new Date().toISOString();
      const insertResult = await query(
        `INSERT INTO contact_categories (label, value, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, label, value, display_order, is_active, created_at, updated_at`,
        [label, value, finalDisplayOrder, is_active, now, now]
      );

      const newCategory = insertResult.rows[0];

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_category.create',
          entityType: 'contact_category',
          entityId: newCategory.id,
          message: `Created contact category '${newCategory.label}'`,
          status: 'success',
          metadata: { label: newCategory.label, value: newCategory.value }
        }, req);
      }

      res.status(201).json({ category: newCategory });
    } catch (err: any) {
      console.error('Admin contact category create error:', err);
      res.status(500).json({ error: err.message || 'Failed to create contact category' });
    }
  }
);

/**
 * Update an existing contact category
 * PUT /api/admin/contact/categories/:id
 */
router.put(
  '/categories/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid category ID'),
    body('label').optional().isString().trim().notEmpty().withMessage('Label cannot be empty'),
    body('value').optional().isString().trim().notEmpty().withMessage('Value cannot be empty')
      .matches(/^[a-z0-9_-]+$/).withMessage('Value must contain only lowercase letters, numbers, hyphens, and underscores'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { label, value, is_active } = req.body;

      // Check if category exists
      const existingResult = await query(
        'SELECT id, label FROM contact_categories WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({ error: 'Contact category not found' });
        return;
      }

      // If updating value, check for conflicts
      if (value) {
        const conflictResult = await query(
          'SELECT id FROM contact_categories WHERE value = $1 AND id != $2',
          [value, id]
        );

        if (conflictResult.rows.length > 0) {
          res.status(409).json({ error: 'A category with this value already exists' });
          return;
        }
      }

      if (typeof label === 'undefined' && typeof value === 'undefined' && typeof is_active === 'undefined') {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      const updateResult = await query(
        `UPDATE contact_categories 
         SET
           label = CASE WHEN $1::boolean THEN $2 ELSE label END,
           value = CASE WHEN $3::boolean THEN $4 ELSE value END,
           is_active = CASE WHEN $5::boolean THEN $6::boolean ELSE is_active END,
           updated_at = $7
         WHERE id = $8
         RETURNING id, label, value, display_order, is_active, created_at, updated_at`,
        [
          typeof label !== 'undefined',
          typeof label !== 'undefined' ? label : null,
          typeof value !== 'undefined',
          typeof value !== 'undefined' ? value : null,
          typeof is_active !== 'undefined',
          typeof is_active !== 'undefined' ? is_active : null,
          new Date().toISOString(),
          id
        ]
      );

      const updatedCategory = updateResult.rows[0];

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_category.update',
          entityType: 'contact_category',
          entityId: updatedCategory.id,
          message: `Updated contact category '${updatedCategory.label}'`,
          status: 'success',
          metadata: { label: updatedCategory.label, value: updatedCategory.value }
        }, req);
      }

      res.json({ category: updatedCategory });
    } catch (err: any) {
      console.error('Admin contact category update error:', err);
      res.status(500).json({ error: err.message || 'Failed to update contact category' });
    }
  }
);

/**
 * Delete a contact category
 * DELETE /api/admin/contact/categories/:id
 */
router.delete(
  '/categories/:id',
  authenticateToken,
  requireAdmin,
  [param('id').isUUID().withMessage('Invalid category ID')],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Check if category exists
      const existingResult = await query(
        'SELECT id, label FROM contact_categories WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({ error: 'Contact category not found' });
        return;
      }

      const categoryLabel = existingResult.rows[0].label;

      // Delete the category
      await query('DELETE FROM contact_categories WHERE id = $1', [id]);

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_category.delete',
          entityType: 'contact_category',
          entityId: id,
          message: `Deleted contact category '${categoryLabel}'`,
          status: 'success',
          metadata: { label: categoryLabel }
        }, req);
      }

      res.status(204).send();
    } catch (err: any) {
      console.error('Admin contact category delete error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete contact category' });
    }
  }
);

/**
 * Reorder contact categories (drag-and-drop)
 * POST /api/admin/contact/categories/reorder
 */
router.post(
  '/categories/reorder',
  authenticateToken,
  requireAdmin,
  [
    body('categories').isArray().withMessage('Categories must be an array'),
    body('categories.*.id').isUUID().withMessage('Each category must have a valid ID'),
    body('categories.*.display_order').isInt({ min: 0 }).withMessage('Each category must have a valid display_order')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { categories } = req.body as { categories: Array<{ id: string; display_order: number }> };

      if (categories.length === 0) {
        res.status(400).json({ error: 'Categories array cannot be empty' });
        return;
      }

      // Update display_order for each category
      const updatePromises = categories.map(({ id, display_order }) =>
        query(
          'UPDATE contact_categories SET display_order = $1, updated_at = $2 WHERE id = $3',
          [display_order, new Date().toISOString(), id]
        )
      );

      await Promise.all(updatePromises);

      // Fetch updated categories
      const result = await query(
        `SELECT id, label, value, display_order, is_active, created_at, updated_at 
         FROM contact_categories 
         ORDER BY display_order ASC`
      );

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_category.reorder',
          entityType: 'contact_category',
          entityId: 'bulk',
          message: `Reordered ${categories.length} contact categories`,
          status: 'success',
          metadata: { count: categories.length }
        }, req);
      }

      res.json({ categories: result.rows || [] });
    } catch (err: any) {
      console.error('Admin contact category reorder error:', err);
      res.status(500).json({ error: err.message || 'Failed to reorder contact categories' });
    }
  }
);

// ============================================================================
// CONTACT METHODS ROUTES
// ============================================================================

/**
 * Get all contact methods (including inactive)
 * GET /api/admin/contact/methods
 */
router.get('/methods', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, method_type, title, description, is_active, config, created_at, updated_at 
       FROM contact_methods 
       ORDER BY method_type ASC`
    );

    res.json({ methods: result.rows || [] });
  } catch (err: any) {
    console.error('Admin contact methods list error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch contact methods' });
  }
});

/**
 * Get a specific contact method by type
 * GET /api/admin/contact/methods/:method_type
 */
router.get(
  '/methods/:method_type',
  authenticateToken,
  requireAdmin,
  [
    param('method_type')
      .isIn(['email', 'ticket', 'phone', 'office'])
      .withMessage('Invalid method type. Must be one of: email, ticket, phone, office')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { method_type } = req.params;

      const result = await query(
        `SELECT id, method_type, title, description, is_active, config, created_at, updated_at 
         FROM contact_methods 
         WHERE method_type = $1`,
        [method_type]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Contact method not found' });
        return;
      }

      res.json({ method: result.rows[0] });
    } catch (err: any) {
      console.error('Admin contact method fetch error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch contact method' });
    }
  }
);

/**
 * Update a contact method
 * PUT /api/admin/contact/methods/:method_type
 */
router.put(
  '/methods/:method_type',
  authenticateToken,
  requireAdmin,
  [
    param('method_type')
      .isIn(['email', 'ticket', 'phone', 'office'])
      .withMessage('Invalid method type. Must be one of: email, ticket, phone, office'),
    body('title').optional().isString().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    body('config').optional().isObject().withMessage('Config must be an object'),
    // Email-specific validation
    body('config.email_address')
      .if(param('method_type').equals('email'))
      .optional()
      .isEmail()
      .withMessage('Invalid email address format'),
    body('config.response_time')
      .if(param('method_type').equals('email'))
      .optional()
      .isString()
      .withMessage('Response time must be a string'),
    // Ticket-specific validation
    body('config.dashboard_link')
      .if(param('method_type').equals('ticket'))
      .optional()
      .matches(/^\/[a-zA-Z0-9\-_/]*$/)
      .withMessage('Dashboard link must be a valid internal route starting with /'),
    body('config.priority_queues')
      .if(param('method_type').equals('ticket'))
      .optional()
      .isArray()
      .withMessage('Priority queues must be an array'),
    body('config.priority_queues.*.label')
      .if(param('method_type').equals('ticket'))
      .optional()
      .isString()
      .withMessage('Priority queue label must be a string'),
    body('config.priority_queues.*.response_time')
      .if(param('method_type').equals('ticket'))
      .optional()
      .isString()
      .withMessage('Priority queue response time must be a string'),
    // Phone-specific validation
    body('config.phone_number')
      .if(param('method_type').equals('phone'))
      .optional()
      .matches(/^\+?[0-9\s().-]+$/)
      .withMessage('Invalid phone number format'),
    body('config.availability_text')
      .if(param('method_type').equals('phone'))
      .optional()
      .isString()
      .withMessage('Availability text must be a string'),
    // Office-specific validation
    body('config.address_line1')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Address line 1 is required for office method'),
    body('config.address_line2')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .withMessage('Address line 2 must be a string'),
    body('config.city')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('City is required for office method'),
    body('config.state')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('State is required for office method'),
    body('config.postal_code')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Postal code is required for office method'),
    body('config.country')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Country is required for office method'),
    body('config.appointment_required')
      .if(param('method_type').equals('office'))
      .optional()
      .isString()
      .withMessage('Appointment required text must be a string')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { method_type } = req.params;
      const { title, description, is_active, config } = req.body;

      // Check if method exists
      const existingResult = await query(
        'SELECT id, title FROM contact_methods WHERE method_type = $1',
        [method_type]
      );

      if (existingResult.rows.length === 0) {
        res.status(404).json({ error: 'Contact method not found' });
        return;
      }

      if (typeof title === 'undefined' && typeof description === 'undefined' && typeof is_active === 'undefined' && typeof config === 'undefined') {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      const updateResult = await query(
        `UPDATE contact_methods 
         SET
           title = CASE WHEN $1::boolean THEN $2 ELSE title END,
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           is_active = CASE WHEN $5::boolean THEN $6::boolean ELSE is_active END,
           config = CASE WHEN $7::boolean THEN $8::jsonb ELSE config END,
           updated_at = $9
         WHERE method_type = $10
         RETURNING id, method_type, title, description, is_active, config, created_at, updated_at`,
        [
          typeof title !== 'undefined',
          typeof title !== 'undefined' ? title : null,
          typeof description !== 'undefined',
          typeof description !== 'undefined' ? description : null,
          typeof is_active !== 'undefined',
          typeof is_active !== 'undefined' ? is_active : null,
          typeof config !== 'undefined',
          typeof config !== 'undefined' ? JSON.stringify(config) : null,
          new Date().toISOString(),
          method_type
        ]
      );

      const updatedMethod = updateResult.rows[0];

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_method.update',
          entityType: 'contact_method',
          entityId: updatedMethod.id,
          message: `Updated contact method '${updatedMethod.title}' (${method_type})`,
          status: 'success',
          metadata: { method_type, title: updatedMethod.title }
        }, req);
      }

      res.json({ method: updatedMethod });
    } catch (err: any) {
      console.error('Admin contact method update error:', err);
      res.status(500).json({ error: err.message || 'Failed to update contact method' });
    }
  }
);

export default router;
