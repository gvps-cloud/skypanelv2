/**
 * Public Blog Routes
 * Read-only endpoints for published blog posts, categories, and tags.
 * No authentication required. Accessible even during maintenance mode.
 */
import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { query } from '../lib/database.js';
import { config } from '../config/index.js';

const router = Router();

const BLOG_UPLOAD_DIR = path.resolve(config.UPLOAD_PATH, 'blog');

if (!fs.existsSync(BLOG_UPLOAD_DIR)) {
  fs.mkdirSync(BLOG_UPLOAD_DIR, { recursive: true });
}

function resolveBlogImage(filename: string): string | null {
  const normalized = path.basename(filename);
  if (!normalized || normalized !== filename) return null;
  const filePath = path.join(BLOG_UPLOAD_DIR, normalized);
  return fs.existsSync(filePath) ? filePath : null;
}

// ─── Serve uploaded blog images ───────────────────────────────────────

router.get('/images/:filename', (req: Request, res: Response): void => {
  const filePath = resolveBlogImage(req.params.filename);
  if (!filePath) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Blog image sendFile error:', err);
      if (!res.headersSent) {
        res.status(404).json({ error: 'Image not found' });
      }
    }
  });
});

// ─── Posts ─────────────────────────────────────────────────────────────

router.get('/posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, tag, year, search, page = '1', limit = '9' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 9));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ["bp.status = 'published'", 'bp.deleted_at IS NULL'];
    const params: any[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`bc.slug = $${idx++}`);
      params.push(category);
    }
    if (tag) {
      conditions.push(`EXISTS (SELECT 1 FROM blog_post_tags bpt JOIN blog_tags bt ON bpt.tag_id = bt.id WHERE bpt.post_id = bp.id AND bt.slug = $${idx++})`);
      params.push(tag);
    }
    if (year) {
      conditions.push(`bp.published_year = $${idx++}`);
      params.push(parseInt(year as string, 10));
    }
    if (search) {
      conditions.push(`(bp.title ILIKE $${idx} OR bp.excerpt ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await query(`SELECT COUNT(*) as total FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const result = await query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.cover_image_url,
              bp.published_at, bp.published_year, bp.meta_title, bp.meta_description, bp.og_image_url,
              bc.name as category_name, bc.slug as category_slug,
              u.name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN users u ON bp.author_id = u.id
       WHERE ${where}
       ORDER BY bp.published_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limitNum, offset],
    );

    const tagResults = await query(
      `SELECT bpt.post_id, bt.id as tag_id, bt.name as tag_name, bt.slug as tag_slug
       FROM blog_post_tags bpt
       JOIN blog_tags bt ON bpt.tag_id = bt.id
       WHERE bpt.post_id = ANY($1)`,
      [result.rows.map((r: any) => r.id)],
    );

    const tagMap = new Map<string, any[]>();
    for (const row of tagResults.rows) {
      if (!tagMap.has(row.post_id)) tagMap.set(row.post_id, []);
      tagMap.get(row.post_id)!.push({ id: row.tag_id, name: row.tag_name, slug: row.tag_slug });
    }

    const posts = result.rows.map((row: any) => ({
      ...row,
      tags: tagMap.get(row.id) || [],
    }));

    res.json({
      posts,
      pagination: { currentPage: pageNum, totalItems: total, itemsPerPage: limitNum },
    });
  } catch (error: any) {
    console.error('Public blog posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

router.get('/posts/:year/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, slug } = req.params;
    const yearNum = parseInt(year, 10);

    const result = await query(
      `SELECT bp.*, bc.name as category_name, bc.slug as category_slug,
              u.name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN users u ON bp.author_id = u.id
       WHERE bp.slug = $1 AND bp.published_year = $2
         AND bp.status = 'published' AND bp.deleted_at IS NULL`,
      [slug, yearNum],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const tagsResult = await query(
      `SELECT bt.id, bt.name, bt.slug FROM blog_post_tags bpt JOIN blog_tags bt ON bpt.tag_id = bt.id WHERE bpt.post_id = $1`,
      [result.rows[0].id],
    );

    res.json({ post: { ...result.rows[0], tags: tagsResult.rows } });
  } catch (error: any) {
    console.error('Public blog post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

// ─── Categories ────────────────────────────────────────────────────────

router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT bc.id, bc.name, bc.slug, bc.description,
              COUNT(bp.id) as post_count
       FROM blog_categories bc
       LEFT JOIN blog_posts bp ON bc.id = bp.category_id AND bp.status = 'published' AND bp.deleted_at IS NULL
       GROUP BY bc.id
       HAVING COUNT(bp.id) > 0
       ORDER BY bc.display_order ASC, bc.name ASC`,
    );
    res.json({ categories: result.rows });
  } catch (error: any) {
    console.error('Public blog categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch blog categories' });
  }
});

// ─── Tags ──────────────────────────────────────────────────────────────

router.get('/tags', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT bt.id, bt.name, bt.slug,
              COUNT(bpt.post_id) as post_count
       FROM blog_tags bt
       JOIN blog_post_tags bpt ON bt.id = bpt.tag_id
       JOIN blog_posts bp ON bpt.post_id = bp.id AND bp.status = 'published' AND bp.deleted_at IS NULL
       GROUP BY bt.id
       ORDER BY bt.name ASC`,
    );
    res.json({ tags: result.rows });
  } catch (error: any) {
    console.error('Public blog tags fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch blog tags' });
  }
});

export default router;
