/**
 * Admin FAQ Routes
 * Handle FAQ management operations for administrators
 */
import { Router, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { logActivity } from '../services/activityLogger.js';

const router = Router();

// Apply authentication and admin role check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Get all FAQ categories (including inactive)
 * GET /api/admin/faq/categories
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, name, description, display_order, is_active, created_at, updated_at
       FROM faq_categories
       ORDER BY display_order ASC, created_at ASC`
    );

    res.json({ categories: result.rows || [] });
  } catch (error: any) {
    console.error('Admin FAQ categories fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch FAQ categories',
      details: error.message 
    });
  }
});

/**
 * Create a new FAQ category
 * POST /api/admin/faq/categories
 */
router.post(
  '/categories',
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Category name is required (max 255 characters)'),
    body('description').optional().isString().trim(),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, description, display_order, is_active } = req.body;
      const now = new Date().toISOString();

      // If display_order not provided, get the next available order
      let finalDisplayOrder = display_order;
      if (finalDisplayOrder === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM faq_categories'
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const result = await query(
        `INSERT INTO faq_categories (name, description, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, display_order, is_active, created_at, updated_at`,
        [
          name,
          description || null,
          finalDisplayOrder,
          is_active !== undefined ? is_active : true,
          now,
          now
        ]
      );

      const category = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.category.create',
          entityType: 'faq_category',
          entityId: category.id,
          message: `Created FAQ category: ${category.name}`,
          status: 'success',
          metadata: { category_name: category.name }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ category });
    } catch (error: any) {
      console.error('Admin FAQ category create error:', error);
      res.status(500).json({ 
        error: 'Failed to create FAQ category',
        details: error.message 
      });
    }
  }
);

/**
 * Update an existing FAQ category
 * PUT /api/admin/faq/categories/:id
 */
router.put(
  '/categories/:id',
  [
    param('id').isUUID().withMessage('Invalid category ID'),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().trim(),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { name, description, is_active } = req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      values.push(id);

      const result = await query(
        `UPDATE faq_categories
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, display_order, is_active, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'FAQ category not found' });
        return;
      }

      const category = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.category.update',
          entityType: 'faq_category',
          entityId: category.id,
          message: `Updated FAQ category: ${category.name}`,
          status: 'success',
          metadata: { category_name: category.name }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ category });
    } catch (error: any) {
      console.error('Admin FAQ category update error:', error);
      res.status(500).json({ 
        error: 'Failed to update FAQ category',
        details: error.message 
      });
    }
  }
);

/**
 * Delete an FAQ category
 * DELETE /api/admin/faq/categories/:id
 */
router.delete(
  '/categories/:id',
  [param('id').isUUID().withMessage('Invalid category ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Get category name for logging before deletion
      const categoryResult = await query(
        'SELECT name FROM faq_categories WHERE id = $1',
        [id]
      );

      if (categoryResult.rows.length === 0) {
        res.status(404).json({ error: 'FAQ category not found' });
        return;
      }

      const categoryName = categoryResult.rows[0].name;

      // Delete category (cascade will delete associated items)
      await query('DELETE FROM faq_categories WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.category.delete',
          entityType: 'faq_category',
          entityId: id,
          message: `Deleted FAQ category: ${categoryName}`,
          status: 'success',
          metadata: { category_name: categoryName }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin FAQ category delete error:', error);
      res.status(500).json({ 
        error: 'Failed to delete FAQ category',
        details: error.message 
      });
    }
  }
);

/**
 * Reorder FAQ categories
 * POST /api/admin/faq/categories/reorder
 */
router.post(
  '/categories/reorder',
  [
    body('categories').isArray().withMessage('Categories must be an array'),
    body('categories.*.id').isUUID().withMessage('Invalid category ID'),
    body('categories.*.display_order').isInt({ min: 0 }).withMessage('Display order must be a non-negative integer')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { categories } = req.body as { categories: Array<{ id: string; display_order: number }> };

      if (categories.length === 0) {
        res.status(400).json({ error: 'No categories provided' });
        return;
      }

      // Update display_order for each category
      const now = new Date().toISOString();
      const categoryIds = categories.map(c => c.id);
      const categoryOrders = categories.map(c => c.display_order);

      await query(
        `UPDATE faq_categories
         SET display_order = data.display_order, updated_at = $1
         FROM (SELECT unnest($2::uuid[]) as id, unnest($3::integer[]) as display_order) AS data
         WHERE faq_categories.id = data.id`,
        [now, categoryIds, categoryOrders]
      );

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.category.reorder',
          entityType: 'faq_category',
          entityId: 'bulk',
          message: `Reordered ${categories.length} FAQ categories`,
          status: 'success',
          metadata: { count: categories.length }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ message: 'Categories reordered successfully' });
    } catch (error: any) {
      console.error('Admin FAQ categories reorder error:', error);
      res.status(500).json({ 
        error: 'Failed to reorder FAQ categories',
        details: error.message 
      });
    }
  }
);

/**
 * Get all FAQ items (including inactive)
 * GET /api/admin/faq/items
 * Optional query param: category_id
 */
router.get('/items', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category_id } = req.query;

    let queryText = `SELECT id, category_id, question, answer, display_order, is_active, created_at, updated_at
                     FROM faq_items`;
    const queryParams: any[] = [];

    if (category_id) {
      queryText += ' WHERE category_id = $1';
      queryParams.push(category_id);
    }

    queryText += ' ORDER BY display_order ASC, created_at ASC';

    const result = await query(queryText, queryParams);

    res.json({ items: result.rows || [] });
  } catch (error: any) {
    console.error('Admin FAQ items fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch FAQ items',
      details: error.message 
    });
  }
});

/**
 * Create a new FAQ item
 * POST /api/admin/faq/items
 */
router.post(
  '/items',
  [
    body('category_id').isUUID().withMessage('Valid category ID is required'),
    body('question').isString().trim().isLength({ min: 1 }).withMessage('Question is required'),
    body('answer').isString().trim().isLength({ min: 1 }).withMessage('Answer is required'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { category_id, question, answer, display_order, is_active } = req.body;
      const now = new Date().toISOString();

      // Verify category exists
      const categoryCheck = await query(
        'SELECT id FROM faq_categories WHERE id = $1',
        [category_id]
      );

      if (categoryCheck.rows.length === 0) {
        res.status(404).json({ error: 'FAQ category not found' });
        return;
      }

      // If display_order not provided, get the next available order for this category
      let finalDisplayOrder = display_order;
      if (finalDisplayOrder === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM faq_items WHERE category_id = $1',
          [category_id]
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const result = await query(
        `INSERT INTO faq_items (category_id, question, answer, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, category_id, question, answer, display_order, is_active, created_at, updated_at`,
        [
          category_id,
          question,
          answer,
          finalDisplayOrder,
          is_active !== undefined ? is_active : true,
          now,
          now
        ]
      );

      const item = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.item.create',
          entityType: 'faq_item',
          entityId: item.id,
          message: `Created FAQ item: ${item.question.substring(0, 50)}...`,
          status: 'success',
          metadata: { question: item.question, category_id }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ item });
    } catch (error: any) {
      console.error('Admin FAQ item create error:', error);
      res.status(500).json({ 
        error: 'Failed to create FAQ item',
        details: error.message 
      });
    }
  }
);

/**
 * Update an existing FAQ item
 * PUT /api/admin/faq/items/:id
 */
router.put(
  '/items/:id',
  [
    param('id').isUUID().withMessage('Invalid item ID'),
    body('category_id').optional().isUUID().withMessage('Invalid category ID'),
    body('question').optional().isString().trim().isLength({ min: 1 }),
    body('answer').optional().isString().trim().isLength({ min: 1 }),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { category_id, question, answer, is_active } = req.body;

      // If category_id is being updated, verify it exists
      if (category_id) {
        const categoryCheck = await query(
          'SELECT id FROM faq_categories WHERE id = $1',
          [category_id]
        );

        if (categoryCheck.rows.length === 0) {
          res.status(404).json({ error: 'FAQ category not found' });
          return;
        }
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (category_id !== undefined) {
        updates.push(`category_id = $${paramIndex++}`);
        values.push(category_id);
      }
      if (question !== undefined) {
        updates.push(`question = $${paramIndex++}`);
        values.push(question);
      }
      if (answer !== undefined) {
        updates.push(`answer = $${paramIndex++}`);
        values.push(answer);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      values.push(id);

      const result = await query(
        `UPDATE faq_items
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, category_id, question, answer, display_order, is_active, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'FAQ item not found' });
        return;
      }

      const item = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.item.update',
          entityType: 'faq_item',
          entityId: item.id,
          message: `Updated FAQ item: ${item.question.substring(0, 50)}...`,
          status: 'success',
          metadata: { question: item.question }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ item });
    } catch (error: any) {
      console.error('Admin FAQ item update error:', error);
      res.status(500).json({ 
        error: 'Failed to update FAQ item',
        details: error.message 
      });
    }
  }
);

/**
 * Delete an FAQ item
 * DELETE /api/admin/faq/items/:id
 */
router.delete(
  '/items/:id',
  [param('id').isUUID().withMessage('Invalid item ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Get item question for logging before deletion
      const itemResult = await query(
        'SELECT question FROM faq_items WHERE id = $1',
        [id]
      );

      if (itemResult.rows.length === 0) {
        res.status(404).json({ error: 'FAQ item not found' });
        return;
      }

      const itemQuestion = itemResult.rows[0].question;

      // Delete item
      await query('DELETE FROM faq_items WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.item.delete',
          entityType: 'faq_item',
          entityId: id,
          message: `Deleted FAQ item: ${itemQuestion.substring(0, 50)}...`,
          status: 'success',
          metadata: { question: itemQuestion }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin FAQ item delete error:', error);
      res.status(500).json({ 
        error: 'Failed to delete FAQ item',
        details: error.message 
      });
    }
  }
);

/**
 * Reorder FAQ items within a category
 * POST /api/admin/faq/items/reorder
 */
router.post(
  '/items/reorder',
  [
    body('items').isArray().withMessage('Items must be an array'),
    body('items.*.id').isUUID().withMessage('Invalid item ID'),
    body('items.*.display_order').isInt({ min: 0 }).withMessage('Display order must be a non-negative integer')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { items } = req.body as { items: Array<{ id: string; display_order: number }> };

      if (items.length === 0) {
        res.status(400).json({ error: 'No items provided' });
        return;
      }

      // Update display_order for each item
      const now = new Date().toISOString();
      const itemIds = items.map(i => i.id);
      const itemOrders = items.map(i => i.display_order);

      await query(
        `UPDATE faq_items
         SET display_order = data.display_order, updated_at = $1
         FROM (SELECT unnest($2::uuid[]) as id, unnest($3::integer[]) as display_order) AS data
         WHERE faq_items.id = data.id`,
        [now, itemIds, itemOrders]
      );

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.item.reorder',
          entityType: 'faq_item',
          entityId: 'bulk',
          message: `Reordered ${items.length} FAQ items`,
          status: 'success',
          metadata: { count: items.length }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ message: 'Items reordered successfully' });
    } catch (error: any) {
      console.error('Admin FAQ items reorder error:', error);
      res.status(500).json({ 
        error: 'Failed to reorder FAQ items',
        details: error.message 
      });
    }
  }
);

/**
 * Get all FAQ updates (including inactive)
 * GET /api/admin/faq/updates
 */
router.get('/updates', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, title, description, published_date, display_order, is_active, created_at, updated_at
       FROM faq_updates
       ORDER BY display_order ASC, published_date DESC`
    );

    res.json({ updates: result.rows || [] });
  } catch (error: any) {
    console.error('Admin FAQ updates fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch FAQ updates',
      details: error.message 
    });
  }
});

/**
 * Create a new FAQ update
 * POST /api/admin/faq/updates
 */
router.post(
  '/updates',
  [
    body('title').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Title is required (max 500 characters)'),
    body('description').isString().trim().isLength({ min: 1 }).withMessage('Description is required'),
    body('published_date').optional().isISO8601().withMessage('Invalid date format'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { title, description, published_date, display_order, is_active } = req.body;
      const now = new Date().toISOString();

      // If display_order not provided, get the next available order
      let finalDisplayOrder = display_order;
      if (finalDisplayOrder === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM faq_updates'
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const result = await query(
        `INSERT INTO faq_updates (title, description, published_date, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, description, published_date, display_order, is_active, created_at, updated_at`,
        [
          title,
          description,
          published_date || now,
          finalDisplayOrder,
          is_active !== undefined ? is_active : true,
          now,
          now
        ]
      );

      const update = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.update.create',
          entityType: 'faq_update',
          entityId: update.id,
          message: `Created FAQ update: ${update.title}`,
          status: 'success',
          metadata: { title: update.title }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ update });
    } catch (error: any) {
      console.error('Admin FAQ update create error:', error);
      res.status(500).json({ 
        error: 'Failed to create FAQ update',
        details: error.message 
      });
    }
  }
);

/**
 * Update an existing FAQ update
 * PUT /api/admin/faq/updates/:id
 */
router.put(
  '/updates/:id',
  [
    param('id').isUUID().withMessage('Invalid update ID'),
    body('title').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('description').optional().isString().trim().isLength({ min: 1 }),
    body('published_date').optional().isISO8601().withMessage('Invalid date format'),
    body('is_active').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { title, description, published_date, is_active } = req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (published_date !== undefined) {
        updates.push(`published_date = $${paramIndex++}`);
        values.push(published_date);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      values.push(id);

      const result = await query(
        `UPDATE faq_updates
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, title, description, published_date, display_order, is_active, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'FAQ update not found' });
        return;
      }

      const update = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.update.update',
          entityType: 'faq_update',
          entityId: update.id,
          message: `Updated FAQ update: ${update.title}`,
          status: 'success',
          metadata: { title: update.title }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ update });
    } catch (error: any) {
      console.error('Admin FAQ update update error:', error);
      res.status(500).json({ 
        error: 'Failed to update FAQ update',
        details: error.message 
      });
    }
  }
);

/**
 * Delete an FAQ update
 * DELETE /api/admin/faq/updates/:id
 */
router.delete(
  '/updates/:id',
  [param('id').isUUID().withMessage('Invalid update ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Get update title for logging before deletion
      const updateResult = await query(
        'SELECT title FROM faq_updates WHERE id = $1',
        [id]
      );

      if (updateResult.rows.length === 0) {
        res.status(404).json({ error: 'FAQ update not found' });
        return;
      }

      const updateTitle = updateResult.rows[0].title;

      // Delete update
      await query('DELETE FROM faq_updates WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.update.delete',
          entityType: 'faq_update',
          entityId: id,
          message: `Deleted FAQ update: ${updateTitle}`,
          status: 'success',
          metadata: { title: updateTitle }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin FAQ update delete error:', error);
      res.status(500).json({ 
        error: 'Failed to delete FAQ update',
        details: error.message 
      });
    }
  }
);

/**
 * Reorder FAQ updates
 * POST /api/admin/faq/updates/reorder
 */
router.post(
  '/updates/reorder',
  [
    body('updates').isArray().withMessage('Updates must be an array'),
    body('updates.*.id').isUUID().withMessage('Invalid update ID'),
    body('updates.*.display_order').isInt({ min: 0 }).withMessage('Display order must be a non-negative integer')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { updates } = req.body as { updates: Array<{ id: string; display_order: number }> };

      if (updates.length === 0) {
        res.status(400).json({ error: 'No updates provided' });
        return;
      }

      // Update display_order for each update
      const now = new Date().toISOString();
      const updateIds = updates.map(u => u.id);
      const updateOrders = updates.map(u => u.display_order);

      await query(
        `UPDATE faq_updates
         SET display_order = data.display_order, updated_at = $1
         FROM (SELECT unnest($2::uuid[]) as id, unnest($3::integer[]) as display_order) AS data
         WHERE faq_updates.id = data.id`,
        [now, updateIds, updateOrders]
      );

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'faq.update.reorder',
          entityType: 'faq_update',
          entityId: 'bulk',
          message: `Reordered ${updates.length} FAQ updates`,
          status: 'success',
          metadata: { count: updates.length }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ message: 'Updates reordered successfully' });
    } catch (error: any) {
      console.error('Admin FAQ updates reorder error:', error);
      res.status(500).json({ 
        error: 'Failed to reorder FAQ updates',
        details: error.message 
      });
    }
  }
);

export default router;
