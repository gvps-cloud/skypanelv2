/**
 * Admin Documentation Routes
 * Handle documentation management operations for administrators
 */
import { Router, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { logActivity } from '../services/activityLogger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply authentication and admin role check to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Configure multer for file uploads
const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const DOCUMENTATION_UPLOAD_DIR = path.join(UPLOAD_DIR, 'documentation');

// Ensure upload directory exists
if (!fs.existsSync(DOCUMENTATION_UPLOAD_DIR)) {
  fs.mkdirSync(DOCUMENTATION_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCUMENTATION_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/markdown',
    'application/json',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB default
  }
});

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ==================== CATEGORY ROUTES ====================

/**
 * Get all documentation categories (including inactive)
 * GET /api/admin/documentation/categories
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, name, description, slug, icon, display_order, is_active, created_at, updated_at
       FROM documentation_categories
       ORDER BY display_order ASC, created_at ASC`
    );

    // Get article counts
    const categories = result.rows || [];
    const categoryIds = categories.map(c => c.id);

    const articleCounts: Record<string, number> = {};
    if (categoryIds.length > 0) {
      const countsResult = await query(
        `SELECT category_id, COUNT(*) as count
         FROM documentation_articles
         WHERE category_id = ANY($1)
         GROUP BY category_id`,
        [categoryIds]
      );

      countsResult.rows.forEach(row => {
        articleCounts[row.category_id] = parseInt(row.count, 10);
      });
    }

    const categoriesWithCounts = categories.map(cat => ({
      ...cat,
      article_count: articleCounts[cat.id] || 0
    }));

    res.json({ categories: categoriesWithCounts });
  } catch (error: any) {
    console.error('Admin documentation categories fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documentation categories',
    });
  }
});

/**
 * Create a new documentation category
 * POST /api/admin/documentation/categories
 */
router.post(
  '/categories',
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Category name is required (max 255 characters)'),
    body('description').optional().isString().trim(),
    body('slug').optional().isString().trim().isLength({ min: 1, max: 255 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('icon').optional().isString().trim().isLength({ max: 100 }),
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

      const { name, description, slug, icon, display_order, is_active } = req.body;
      const now = new Date().toISOString();

      // Generate slug if not provided
      const finalSlug = slug || generateSlug(name);

      // Check if slug already exists
      const slugCheck = await query(
        'SELECT id FROM documentation_categories WHERE slug = $1',
        [finalSlug]
      );

      if (slugCheck.rows.length > 0) {
        res.status(400).json({ error: 'A category with this slug already exists' });
        return;
      }

      // If display_order not provided, get the next available order
      let finalDisplayOrder = display_order;
      if (finalDisplayOrder === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM documentation_categories'
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const result = await query(
        `INSERT INTO documentation_categories (name, description, slug, icon, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, description, slug, icon, display_order, is_active, created_at, updated_at`,
        [
          name,
          description || null,
          finalSlug,
          icon || null,
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
          eventType: 'documentation.category.create',
          entityType: 'documentation_category',
          entityId: category.id,
          message: `Created documentation category: ${category.name}`,
          status: 'success',
          metadata: { category_name: category.name, slug: category.slug }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ category });
    } catch (error: any) {
      console.error('Admin documentation category create error:', error);
      res.status(500).json({
        error: 'Failed to create documentation category',
      });
    }
  }
);

/**
 * Update an existing documentation category
 * PUT /api/admin/documentation/categories/:id
 */
router.put(
  '/categories/:id',
  [
    param('id').isUUID().withMessage('Invalid category ID'),
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().trim(),
    body('slug').optional().isString().trim().isLength({ min: 1, max: 255 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('icon').optional().isString().trim().isLength({ max: 100 }),
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
      const { name, description, slug, icon, is_active } = req.body;

      // Check if category exists
      const existingCategory = await query(
        'SELECT id, slug FROM documentation_categories WHERE id = $1',
        [id]
      );

      if (existingCategory.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // If slug is being changed, check for duplicates
      if (slug && slug !== existingCategory.rows[0].slug) {
        const slugCheck = await query(
          'SELECT id FROM documentation_categories WHERE slug = $1 AND id != $2',
          [slug, id]
        );

        if (slugCheck.rows.length > 0) {
          res.status(400).json({ error: 'A category with this slug already exists' });
          return;
        }
      }

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
      if (slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`);
        values.push(slug);
      }
      if (icon !== undefined) {
        updates.push(`icon = $${paramIndex++}`);
        values.push(icon);
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
        `UPDATE documentation_categories
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, slug, icon, display_order, is_active, created_at, updated_at`,
        values
      );

      const category = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.category.update',
          entityType: 'documentation_category',
          entityId: category.id,
          message: `Updated documentation category: ${category.name}`,
          status: 'success',
          metadata: { category_name: category.name }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ category });
    } catch (error: any) {
      console.error('Admin documentation category update error:', error);
      res.status(500).json({
        error: 'Failed to update documentation category',
      });
    }
  }
);

/**
 * Delete a documentation category
 * DELETE /api/admin/documentation/categories/:id
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

      // Get category info and associated files before deletion
      const categoryResult = await query(
        `SELECT dc.id, dc.name,
                df.id as file_id, df.stored_path
         FROM documentation_categories dc
         LEFT JOIN documentation_articles da ON dc.id = da.category_id
         LEFT JOIN documentation_files df ON da.id = df.article_id
         WHERE dc.id = $1`,
        [id]
      );

      if (categoryResult.rows.length === 0 || !categoryResult.rows[0].id) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const categoryName = categoryResult.rows[0].name;

      // Delete associated files from disk
      for (const row of categoryResult.rows) {
        if (row.stored_path) {
          const resolvedPath = path.resolve(DOCUMENTATION_UPLOAD_DIR, row.stored_path);
          if (resolvedPath.startsWith(DOCUMENTATION_UPLOAD_DIR) && fs.existsSync(resolvedPath)) {
            try {
              fs.unlinkSync(resolvedPath);
            } catch (unlinkError) {
              console.warn('Failed to delete file:', row.stored_path, unlinkError);
            }
          }
        }
      }

      // Delete category (cascade will delete articles and files from DB)
      await query('DELETE FROM documentation_categories WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.category.delete',
          entityType: 'documentation_category',
          entityId: id,
          message: `Deleted documentation category: ${categoryName}`,
          status: 'success',
          metadata: { category_name: categoryName }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin documentation category delete error:', error);
      res.status(500).json({
        error: 'Failed to delete documentation category',
      });
    }
  }
);

/**
 * Reorder documentation categories
 * POST /api/admin/documentation/categories/reorder
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
      for (const category of categories) {
        await query(
          'UPDATE documentation_categories SET display_order = $1, updated_at = $2 WHERE id = $3',
          [category.display_order, now, category.id]
        );
      }

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.category.reorder',
          entityType: 'documentation_category',
          entityId: 'bulk',
          message: `Reordered ${categories.length} documentation categories`,
          status: 'success',
          metadata: { count: categories.length }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ message: 'Categories reordered successfully' });
    } catch (error: any) {
      console.error('Admin documentation categories reorder error:', error);
      res.status(500).json({
        error: 'Failed to reorder documentation categories',
      });
    }
  }
);

// ==================== ARTICLE ROUTES ====================

/**
 * Get all documentation articles (including inactive)
 * GET /api/admin/documentation/articles
 * Optional query param: category_id
 */
router.get('/articles', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category_id } = req.query;

    let queryText = `
      SELECT a.id, a.category_id, a.title, a.slug, a.content, a.summary,
             a.display_order, a.is_active, a.created_at, a.updated_at,
             c.name as category_name, c.slug as category_slug
      FROM documentation_articles a
      JOIN documentation_categories c ON a.category_id = c.id
    `;
    const queryParams: any[] = [];

    if (category_id) {
      queryText += ' WHERE a.category_id = $1';
      queryParams.push(category_id);
    }

    queryText += ' ORDER BY a.display_order ASC, a.created_at ASC';

    const result = await query(queryText, queryParams);

    res.json({ articles: result.rows || [] });
  } catch (error: any) {
    console.error('Admin documentation articles fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documentation articles',
    });
  }
});

/**
 * Get a single article by ID with files
 * GET /api/admin/documentation/articles/:id
 */
router.get(
  '/articles/:id',
  [param('id').isUUID().withMessage('Invalid article ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const articleResult = await query(
        `SELECT a.id, a.category_id, a.title, a.slug, a.content, a.summary,
                a.display_order, a.is_active, a.created_at, a.updated_at,
                c.name as category_name, c.slug as category_slug
         FROM documentation_articles a
         JOIN documentation_categories c ON a.category_id = c.id
         WHERE a.id = $1`,
        [id]
      );

      if (articleResult.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const article = articleResult.rows[0];

      // Get files
      const filesResult = await query(
        `SELECT id, filename, file_size, mime_type, created_at
         FROM documentation_files
         WHERE article_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      const articleWithFiles = {
        ...article,
        category: {
          name: article.category_name,
          slug: article.category_slug
        },
        files: filesResult.rows || []
      };

      res.json({ article: articleWithFiles });
    } catch (error: any) {
      console.error('Admin documentation article fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch documentation article',
      });
    }
  }
);

/**
 * Create a new documentation article
 * POST /api/admin/documentation/articles
 */
router.post(
  '/articles',
  [
    body('category_id').isUUID().withMessage('Valid category ID is required'),
    body('title').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Title is required (max 500 characters)'),
    body('slug').optional().isString().trim().isLength({ min: 1, max: 500 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('content').isString().withMessage('Content is required'),
    body('summary').optional().isString().trim(),
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

      const { category_id, title, slug, content, summary, display_order, is_active } = req.body;
      const now = new Date().toISOString();

      // Verify category exists
      const categoryCheck = await query(
        'SELECT id FROM documentation_categories WHERE id = $1',
        [category_id]
      );

      if (categoryCheck.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Generate slug if not provided
      const finalSlug = slug || generateSlug(title);

      // Check if slug already exists in this category
      const slugCheck = await query(
        'SELECT id FROM documentation_articles WHERE slug = $1 AND category_id = $2',
        [finalSlug, category_id]
      );

      if (slugCheck.rows.length > 0) {
        res.status(400).json({ error: 'An article with this slug already exists in this category' });
        return;
      }

      // If display_order not provided, get the next available order for this category
      let finalDisplayOrder = display_order;
      if (finalDisplayOrder === undefined) {
        const maxOrderResult = await query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM documentation_articles WHERE category_id = $1',
          [category_id]
        );
        finalDisplayOrder = maxOrderResult.rows[0].next_order;
      }

      const result = await query(
        `INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, category_id, title, slug, content, summary, display_order, is_active, created_at, updated_at`,
        [
          category_id,
          title,
          finalSlug,
          content,
          summary || null,
          finalDisplayOrder,
          is_active !== undefined ? is_active : true,
          now,
          now
        ]
      );

      const article = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.article.create',
          entityType: 'documentation_article',
          entityId: article.id,
          message: `Created documentation article: ${article.title}`,
          status: 'success',
          metadata: { title: article.title, category_id }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ article });
    } catch (error: any) {
      console.error('Admin documentation article create error:', error);
      res.status(500).json({
        error: 'Failed to create documentation article',
      });
    }
  }
);

/**
 * Update an existing documentation article
 * PUT /api/admin/documentation/articles/:id
 */
router.put(
  '/articles/:id',
  [
    param('id').isUUID().withMessage('Invalid article ID'),
    body('category_id').optional().isUUID().withMessage('Invalid category ID'),
    body('title').optional().isString().trim().isLength({ min: 1, max: 500 }),
    body('slug').optional().isString().trim().isLength({ min: 1, max: 500 }).matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    body('content').optional().isString(),
    body('summary').optional().isString().trim(),
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
      const { category_id, title, slug, content, summary, is_active } = req.body;

      // Check if article exists
      const existingArticle = await query(
        'SELECT id, category_id, slug FROM documentation_articles WHERE id = $1',
        [id]
      );

      if (existingArticle.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      // If category_id is being updated, verify it exists
      if (category_id) {
        const categoryCheck = await query(
          'SELECT id FROM documentation_categories WHERE id = $1',
          [category_id]
        );

        if (categoryCheck.rows.length === 0) {
          res.status(404).json({ error: 'Category not found' });
          return;
        }
      }

      // If slug is being changed, check for duplicates in the target category
      const targetCategoryId = category_id || existingArticle.rows[0].category_id;
      if (slug && slug !== existingArticle.rows[0].slug) {
        const slugCheck = await query(
          'SELECT id FROM documentation_articles WHERE slug = $1 AND category_id = $2 AND id != $3',
          [slug, targetCategoryId, id]
        );

        if (slugCheck.rows.length > 0) {
          res.status(400).json({ error: 'An article with this slug already exists in this category' });
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
      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      if (slug !== undefined) {
        updates.push(`slug = $${paramIndex++}`);
        values.push(slug);
      }
      if (content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(content);
      }
      if (summary !== undefined) {
        updates.push(`summary = $${paramIndex++}`);
        values.push(summary);
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
        `UPDATE documentation_articles
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, category_id, title, slug, content, summary, display_order, is_active, created_at, updated_at`,
        values
      );

      const article = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.article.update',
          entityType: 'documentation_article',
          entityId: article.id,
          message: `Updated documentation article: ${article.title}`,
          status: 'success',
          metadata: { title: article.title }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ article });
    } catch (error: any) {
      console.error('Admin documentation article update error:', error);
      res.status(500).json({
        error: 'Failed to update documentation article',
      });
    }
  }
);

/**
 * Delete a documentation article
 * DELETE /api/admin/documentation/articles/:id
 */
router.delete(
  '/articles/:id',
  [param('id').isUUID().withMessage('Invalid article ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Get article title and associated files before deletion
      const articleResult = await query(
        `SELECT a.id, a.title, f.id as file_id, f.stored_path
         FROM documentation_articles a
         LEFT JOIN documentation_files f ON a.id = f.article_id
         WHERE a.id = $1`,
        [id]
      );

      if (articleResult.rows.length === 0 || !articleResult.rows[0].id) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const articleTitle = articleResult.rows[0].title;

      // Delete associated files from disk
      for (const row of articleResult.rows) {
        if (row.stored_path) {
          const resolvedPath = path.resolve(DOCUMENTATION_UPLOAD_DIR, row.stored_path);
          if (resolvedPath.startsWith(DOCUMENTATION_UPLOAD_DIR) && fs.existsSync(resolvedPath)) {
            try {
              fs.unlinkSync(resolvedPath);
            } catch (unlinkError) {
              console.warn('Failed to delete file:', row.stored_path, unlinkError);
            }
          }
        }
      }

      // Delete article (cascade will delete files from DB)
      await query('DELETE FROM documentation_articles WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.article.delete',
          entityType: 'documentation_article',
          entityId: id,
          message: `Deleted documentation article: ${articleTitle}`,
          status: 'success',
          metadata: { title: articleTitle }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin documentation article delete error:', error);
      res.status(500).json({
        error: 'Failed to delete documentation article',
      });
    }
  }
);

/**
 * Reorder documentation articles within a category
 * POST /api/admin/documentation/articles/reorder
 */
router.post(
  '/articles/reorder',
  [
    body('articles').isArray().withMessage('Articles must be an array'),
    body('articles.*.id').isUUID().withMessage('Invalid article ID'),
    body('articles.*.display_order').isInt({ min: 0 }).withMessage('Display order must be a non-negative integer')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { articles } = req.body as { articles: Array<{ id: string; display_order: number }> };

      if (articles.length === 0) {
        res.status(400).json({ error: 'No articles provided' });
        return;
      }

      // Update display_order for each article
      const now = new Date().toISOString();
      for (const article of articles) {
        await query(
          'UPDATE documentation_articles SET display_order = $1, updated_at = $2 WHERE id = $3',
          [article.display_order, now, article.id]
        );
      }

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.article.reorder',
          entityType: 'documentation_article',
          entityId: 'bulk',
          message: `Reordered ${articles.length} documentation articles`,
          status: 'success',
          metadata: { count: articles.length }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ message: 'Articles reordered successfully' });
    } catch (error: any) {
      console.error('Admin documentation articles reorder error:', error);
      res.status(500).json({
        error: 'Failed to reorder documentation articles',
      });
    }
  }
);

// ==================== FILE ROUTES ====================

/**
 * Upload a file to an article
 * POST /api/admin/documentation/articles/:id/files
 */
router.post(
  '/articles/:id/files',
  [
    param('id').isUUID().withMessage('Invalid article ID')
  ],
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Verify article exists
      const articleCheck = await query(
        'SELECT id, title FROM documentation_articles WHERE id = $1',
        [id]
      );

      if (articleCheck.rows.length === 0) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      // Insert file record
      const result = await query(
        `INSERT INTO documentation_files (article_id, filename, stored_path, file_size, mime_type, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, filename, file_size, mime_type, created_at`,
        [
          id,
          file.originalname,
          file.filename,
          file.size,
          file.mimetype,
          new Date().toISOString()
        ]
      );

      const uploadedFile = result.rows[0];

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.file.upload',
          entityType: 'documentation_file',
          entityId: uploadedFile.id,
          message: `Uploaded file "${uploadedFile.filename}" to article: ${articleCheck.rows[0].title}`,
          status: 'success',
          metadata: { filename: uploadedFile.filename, article_id: id }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ file: uploadedFile });
    } catch (error: any) {
      console.error('Admin documentation file upload error:', error);
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        error: 'Failed to upload file',
      });
    }
  }
);

/**
 * Delete a file
 * DELETE /api/admin/documentation/files/:id
 */
router.delete(
  '/files/:id',
  [param('id').isUUID().withMessage('Invalid file ID')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      // Get file info before deletion
      const fileResult = await query(
        'SELECT id, filename, stored_path FROM documentation_files WHERE id = $1',
        [id]
      );

      if (fileResult.rows.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const file = fileResult.rows[0];

      // Delete file from disk with path containment check
      const resolvedPath = path.resolve(DOCUMENTATION_UPLOAD_DIR, file.stored_path);
      if (resolvedPath.startsWith(DOCUMENTATION_UPLOAD_DIR) && fs.existsSync(resolvedPath)) {
        try {
          fs.unlinkSync(resolvedPath);
        } catch (unlinkError) {
          console.warn('Failed to delete file from disk:', file.stored_path, unlinkError);
        }
      }

      // Delete from database
      await query('DELETE FROM documentation_files WHERE id = $1', [id]);

      // Log activity
      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'documentation.file.delete',
          entityType: 'documentation_file',
          entityId: id,
          message: `Deleted file: ${file.filename}`,
          status: 'success',
          metadata: { filename: file.filename }
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Admin documentation file delete error:', error);
      res.status(500).json({
        error: 'Failed to delete file',
      });
    }
  }
);

export default router;
