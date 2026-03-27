/**
 * Public Documentation Routes
 * Handle public-facing documentation content retrieval
 */
import { Router, type Request, type Response } from 'express';
import { query } from '../lib/database.js';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_PATH || './uploads';
const DOCUMENTATION_UPLOAD_DIR = path.resolve(UPLOAD_DIR, 'documentation');

const router = Router();

/**
 * Get all active documentation categories with article counts
 * GET /api/documentation/categories
 */
router.get('/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch active categories
    const categoriesResult = await query(
      `SELECT id, name, description, slug, icon, display_order
       FROM documentation_categories
       WHERE is_active = true
       ORDER BY display_order ASC, created_at ASC`
    );

    const categories = categoriesResult.rows || [];

    // Get article counts for each category
    const categoryIds = categories.map(c => c.id);

    const articleCounts: Record<string, number> = {};
    if (categoryIds.length > 0) {
      const countsResult = await query(
        `SELECT category_id, COUNT(*) as count
         FROM documentation_articles
         WHERE category_id = ANY($1) AND is_active = true
         GROUP BY category_id`,
        [categoryIds]
      );

      countsResult.rows.forEach(row => {
        articleCounts[row.category_id] = parseInt(row.count, 10);
      });
    }

    // Build response with article counts
    const categoriesWithCounts = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      icon: category.icon,
      display_order: category.display_order,
      article_count: articleCounts[category.id] || 0
    }));

    res.json({ categories: categoriesWithCounts });
  } catch (error: any) {
    console.error('Documentation categories fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documentation categories',
    });
  }
});

/**
 * Get a single category by slug with its articles
 * GET /api/documentation/categories/:slug
 */
router.get('/categories/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    // Fetch the category
    const categoryResult = await query(
      `SELECT id, name, description, slug, icon, display_order
       FROM documentation_categories
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (categoryResult.rows.length === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const category = categoryResult.rows[0];

    // Fetch articles in this category
    const articlesResult = await query(
      `SELECT id, title, slug, summary, display_order
       FROM documentation_articles
       WHERE category_id = $1 AND is_active = true
       ORDER BY display_order ASC, created_at ASC`,
      [category.id]
    );

    const categoryWithArticles = {
      ...category,
      articles: articlesResult.rows || []
    };

    res.json({ category: categoryWithArticles });
  } catch (error: any) {
    console.error('Documentation category fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documentation category',
    });
  }
});

/**
 * Get a single article by slug with its files
 * GET /api/documentation/articles/:slug
 * Optional query param: category_slug for disambiguation
 */
router.get('/articles/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const { category_slug } = req.query;

    let articleQuery = `
      SELECT a.id, a.category_id, a.title, a.slug, a.content, a.summary,
             a.display_order, a.created_at, a.updated_at,
             c.name as category_name, c.slug as category_slug
      FROM documentation_articles a
      JOIN documentation_categories c ON a.category_id = c.id
      WHERE a.slug = $1 AND a.is_active = true AND c.is_active = true
    `;
    const queryParams: any[] = [slug];

    // If category_slug is provided, add it to the query for disambiguation
    if (category_slug) {
      articleQuery += ' AND c.slug = $2';
      queryParams.push(category_slug);
    }

    articleQuery += ' LIMIT 1';

    const articleResult = await query(articleQuery, queryParams);

    if (articleResult.rows.length === 0) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const article = articleResult.rows[0];

    // Fetch files for this article
    const filesResult = await query(
      `SELECT id, filename, file_size, mime_type, created_at
       FROM documentation_files
       WHERE article_id = $1
       ORDER BY created_at ASC`,
      [article.id]
    );

    const articleWithFiles = {
      id: article.id,
      category_id: article.category_id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.summary,
      display_order: article.display_order,
      created_at: article.created_at,
      updated_at: article.updated_at,
      category: {
        name: article.category_name,
        slug: article.category_slug
      },
      files: filesResult.rows || []
    };

    res.json({ article: articleWithFiles });
  } catch (error: any) {
    console.error('Documentation article fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch documentation article',
    });
  }
});

/**
 * Download a file by ID
 * GET /api/documentation/files/:id
 */
router.get('/files/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: 'Invalid file ID format' });
      return;
    }

    // Get file info from database
    const fileResult = await query(
      `SELECT f.id, f.filename, f.stored_path, f.file_size, f.mime_type, f.article_id,
              a.is_active as article_active, c.is_active as category_active
       FROM documentation_files f
       JOIN documentation_articles a ON f.article_id = a.id
       JOIN documentation_categories c ON a.category_id = c.id
       WHERE f.id = $1`,
      [id]
    );

    if (fileResult.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = fileResult.rows[0];

    // Check if the article and category are active
    if (!file.article_active || !file.category_active) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Resolve and validate file path is within upload directory
    const resolvedPath = path.resolve(DOCUMENTATION_UPLOAD_DIR, file.stored_path);
    if (!resolvedPath.startsWith(DOCUMENTATION_UPLOAD_DIR)) {
      console.error('Documentation file path traversal attempt:', file.stored_path);
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check if file exists on disk
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'File not found on server' });
      return;
    }

    // Set headers and send file
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Length', file.file_size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (error: any) {
    console.error('Documentation file download error:', error);
    res.status(500).json({
      error: 'Failed to download file',
    });
  }
});

export default router;
