/**
 * Admin Blog Routes
 * Handle blog post, category, and tag CRUD operations for administrators
 */
import { Router, type Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

const BLOG_UPLOAD_DIR = path.resolve(config.UPLOAD_PATH, 'blog');

function resolveBlogFilePath(storedName: string): string | null {
  const normalized = path.basename(String(storedName));
  if (!normalized || normalized !== storedName) return null;
  return path.join(BLOG_UPLOAD_DIR, normalized);
}

if (!fs.existsSync(BLOG_UPLOAD_DIR)) {
  fs.mkdirSync(BLOG_UPLOAD_DIR, { recursive: true });
}

const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BLOG_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    },
  }),
  fileFilter: imageFilter,
  limits: { fileSize: config.MAX_FILE_SIZE },
});

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function ensureUniqueSlug(
  slug: string,
  publishedYear: number,
  excludeId?: string,
): Promise<string> {
  return (async () => {
    let candidate = slug;
    let suffix = 1;
    const exclude = excludeId || '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const clash = await query(
        `SELECT id FROM blog_posts WHERE slug = $1 AND published_year = $2 AND deleted_at IS NULL AND id != $3`,
        [candidate, publishedYear, exclude],
      );
      if (clash.rows.length === 0) return candidate;
      suffix++;
      candidate = `${slug}-${suffix}`;
    }
  })();
}

// ─── Cover Image Upload ────────────────────────────────────────────────

router.post(
  '/posts/:id/cover-image',
  upload.single('cover'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const existing = await query('SELECT id FROM blog_posts WHERE id = $1 AND deleted_at IS NULL', [id]);
      if (existing.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      const coverImageUrl = `/api/blog/images/${req.file.filename}`;
      await query('UPDATE blog_posts SET cover_image_url = $1, updated_at = NOW() WHERE id = $2', [coverImageUrl, id]);
      res.json({ success: true, coverImageUrl });
    } catch (error: any) {
      console.error('Blog cover image upload error:', error);
      res.status(500).json({ error: 'Failed to upload cover image' });
    }
  },
);

router.delete(
  '/posts/:id/cover-image',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const existing = await query('SELECT cover_image_url FROM blog_posts WHERE id = $1 AND deleted_at IS NULL', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }
      const url = existing.rows[0].cover_image_url;
      if (url) {
        const filename = path.basename(url);
        const filePath = resolveBlogFilePath(filename);
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await query('UPDATE blog_posts SET cover_image_url = NULL, updated_at = NOW() WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Blog cover image delete error:', error);
      res.status(500).json({ error: 'Failed to remove cover image' });
    }
  },
);

// ─── Posts ─────────────────────────────────────────────────────────────

router.get(
  '/posts',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status, category_id, search, page = '1', limit = '10' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['bp.deleted_at IS NULL'];
      const params: any[] = [];
      let idx = 1;

      if (status && ['draft', 'published'].includes(status as string)) {
        conditions.push(`bp.status = $${idx++}`);
        params.push(status);
      }
      if (category_id) {
        conditions.push(`bp.category_id = $${idx++}`);
        params.push(category_id);
      }
      if (search) {
        conditions.push(`(bp.title ILIKE $${idx} OR bp.excerpt ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      const where = conditions.join(' AND ');

      const countResult = await query(`SELECT COUNT(*) as total FROM blog_posts bp WHERE ${where}`, params);
      const total = parseInt(countResult.rows[0].total, 10);

      const result = await query(
        `SELECT bp.*, bc.name as category_name, bc.slug as category_slug,
                u.name as author_name, u.email as author_email
         FROM blog_posts bp
         LEFT JOIN blog_categories bc ON bp.category_id = bc.id
         LEFT JOIN users u ON bp.author_id = u.id
         WHERE ${where}
         ORDER BY bp.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limitNum, offset],
      );

      const postsWithTagIds = await query(
        `SELECT bpt.post_id, bt.id as tag_id, bt.name as tag_name, bt.slug as tag_slug
         FROM blog_post_tags bpt
         JOIN blog_tags bt ON bpt.tag_id = bt.id
         WHERE bpt.post_id = ANY($1)`,
        [result.rows.map((r: any) => r.id)],
      );

      const tagMap = new Map<string, any[]>();
      for (const row of postsWithTagIds.rows) {
        if (!tagMap.has(row.post_id)) tagMap.set(row.post_id, []);
        tagMap.get(row.post_id)!.push({ id: row.tag_id, name: row.tag_name, slug: row.tag_slug });
      }

      const posts = result.rows.map((row: any) => ({
        ...row,
        tags: tagMap.get(row.id) || [],
      }));

      res.json({
        success: true,
        posts,
        pagination: { currentPage: pageNum, totalItems: total, itemsPerPage: limitNum },
      });
    } catch (error: any) {
      console.error('Blog posts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  },
);

router.get(
  '/posts/:id',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await query(
        `SELECT bp.*, bc.name as category_name, bc.slug as category_slug,
                u.name as author_name, u.email as author_email
         FROM blog_posts bp
         LEFT JOIN blog_categories bc ON bp.category_id = bc.id
         LEFT JOIN users u ON bp.author_id = u.id
         WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
        [req.params.id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const tagsResult = await query(
        `SELECT bt.id, bt.name, bt.slug FROM blog_post_tags bpt JOIN blog_tags bt ON bpt.tag_id = bt.id WHERE bpt.post_id = $1`,
        [req.params.id],
      );

      res.json({ success: true, post: { ...result.rows[0], tags: tagsResult.rows } });
    } catch (error: any) {
      console.error('Blog post fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  },
);

router.post(
  '/posts',
  [
    body('title').isString().trim().isLength({ min: 1, max: 255 }),
    body('content').optional().isString(),
    body('excerpt').optional().isString(),
    body('category_id').optional().isUUID(),
    body('status').optional().isIn(['draft', 'published']),
    body('meta_title').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
    body('meta_description').optional({ nullable: true }).isString(),
    body('og_image_url').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('slug').optional().isString().trim(),
    body('tag_ids').optional().isArray(),
    body('tag_ids.*').optional().isUUID(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        title, content, excerpt, category_id,
        status = 'draft', meta_title, meta_description, og_image_url,
        slug: customSlug, tag_ids = [],
      } = req.body;

      let publishedAt = null;
      const publishedYear = new Date().getFullYear();
      if (status === 'published') publishedAt = new Date().toISOString();

      const slug = await ensureUniqueSlug(customSlug || generateSlug(title), publishedYear);

      const ogImageUrl =
        typeof og_image_url === 'string' && og_image_url.trim().length > 0
          ? og_image_url.trim()
          : null;

      const result = await query(
        `INSERT INTO blog_posts (title, slug, content, excerpt, category_id, status, author_id, meta_title, meta_description, og_image_url, published_at, published_year)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [title, slug, content || '', excerpt || null, category_id || null, status, req.user!.id, meta_title || null, meta_description || null, ogImageUrl, publishedAt, publishedYear],
      );

      const post = result.rows[0];

      if (tag_ids.length > 0) {
        const values = tag_ids.map((tid: string) => `('${post.id}', '${tid}')`).join(',');
        await query(`INSERT INTO blog_post_tags (post_id, tag_id) VALUES ${values} ON CONFLICT DO NOTHING`);
      }

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.post_created',
          entityType: 'blog_post',
          entityId: post.id,
          message: `Created blog post: ${post.title}`,
          status: 'success',
          metadata: { status, slug },
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.post_created failed:', logErr);
      }

      const tagsResult = await query(
        `SELECT bt.id, bt.name, bt.slug FROM blog_post_tags bpt JOIN blog_tags bt ON bpt.tag_id = bt.id WHERE bpt.post_id = $1`,
        [post.id],
      );

      res.status(201).json({ success: true, post: { ...post, tags: tagsResult.rows } });
    } catch (error: any) {
      console.error('Blog post create error:', error);
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  },
);

router.put(
  '/posts/:id',
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('content').optional().isString(),
    body('excerpt').optional().isString(),
    body('category_id').optional({ nullable: true }).isUUID(),
    body('status').optional().isIn(['draft', 'published']),
    body('meta_title').optional({ nullable: true }).isString().trim().isLength({ max: 255 }),
    body('meta_description').optional({ nullable: true }).isString(),
    body('og_image_url').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
    body('slug').optional().isString().trim(),
    body('tag_ids').optional().isArray(),
    body('tag_ids.*').optional().isUUID(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const existing = await query('SELECT * FROM blog_posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      const current = existing.rows[0];
      const fields = req.body;

      const title = fields.title ?? current.title;
      const content = fields.content ?? current.content;
      const excerpt = 'excerpt' in fields ? fields.excerpt : current.excerpt;
      const categoryId = 'category_id' in fields ? fields.category_id : current.category_id;
      const metaTitle = 'meta_title' in fields ? fields.meta_title : current.meta_title;
      const metaDescription = 'meta_description' in fields ? fields.meta_description : current.meta_description;
      const ogImageUrl =
        'og_image_url' in fields
          ? typeof fields.og_image_url === 'string' && fields.og_image_url.trim().length > 0
            ? fields.og_image_url.trim()
            : null
          : current.og_image_url;

      const newStatus = fields.status ?? current.status;
      let publishedAt = current.published_at;
      let publishedYear = Number(current.published_year);
      if (!Number.isFinite(publishedYear)) {
        publishedYear = new Date().getFullYear();
      }
      if (newStatus === 'published' && current.status !== 'published') {
        publishedAt = new Date().toISOString();
        publishedYear = new Date().getFullYear();
      } else if (newStatus === 'draft') {
        publishedAt = null;
      }

      const rawSlug = fields.slug ?? generateSlug(title);
      const slug = await ensureUniqueSlug(rawSlug, publishedYear, req.params.id);

      const result = await query(
        `UPDATE blog_posts SET title=$1, slug=$2, content=$3, excerpt=$4, category_id=$5,
                status=$6, meta_title=$7, meta_description=$8, og_image_url=$9, published_at=$10, published_year=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [title, slug, content, excerpt, categoryId, newStatus, metaTitle, metaDescription, ogImageUrl, publishedAt, publishedYear, req.params.id],
      );

      const post = result.rows[0];

      if ('tag_ids' in fields) {
        await query('DELETE FROM blog_post_tags WHERE post_id = $1', [req.params.id]);
        if (fields.tag_ids.length > 0) {
          const values = fields.tag_ids.map((tid: string) => `('${req.params.id}', '${tid}')`).join(',');
          await query(`INSERT INTO blog_post_tags (post_id, tag_id) VALUES ${values} ON CONFLICT DO NOTHING`);
        }
      }

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.post_updated',
          entityType: 'blog_post',
          entityId: post.id,
          message: `Updated blog post: ${post.title}`,
          status: 'success',
          metadata: { status: newStatus, slug: post.slug },
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.post_updated failed:', logErr);
      }

      const tagsResult = await query(
        `SELECT bt.id, bt.name, bt.slug FROM blog_post_tags bpt JOIN blog_tags bt ON bpt.tag_id = bt.id WHERE bpt.post_id = $1`,
        [post.id],
      );

      res.json({ success: true, post: { ...post, tags: tagsResult.rows } });
    } catch (error: any) {
      console.error('Blog post update error:', error);
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  },
);

router.delete(
  '/posts/:id',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const existing = await query('SELECT * FROM blog_posts WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      await query('UPDATE blog_posts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [req.params.id]);

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.post_deleted',
          entityType: 'blog_post',
          entityId: req.params.id,
          message: `Deleted blog post: ${existing.rows[0].title}`,
          status: 'success',
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.post_deleted failed:', logErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Blog post delete error:', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  },
);

// ─── Categories ────────────────────────────────────────────────────────

router.get(
  '/categories',
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await query(
        `SELECT bc.*, COUNT(bp.id) as post_count
         FROM blog_categories bc
         LEFT JOIN blog_posts bp ON bc.id = bp.category_id AND bp.deleted_at IS NULL
         GROUP BY bc.id
         ORDER BY bc.display_order ASC, bc.name ASC`,
      );
      res.json({ success: true, categories: result.rows });
    } catch (error: any) {
      console.error('Blog categories fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blog categories' });
    }
  },
);

router.post(
  '/categories',
  [
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().isString(),
    body('display_order').optional().isInt({ min: 0 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, description, display_order = 0 } = req.body;
      const slug = generateSlug(name);

      const result = await query(
        `INSERT INTO blog_categories (name, slug, description, display_order) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, slug, description || null, display_order],
      );

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.category_created',
          entityType: 'blog_category',
          entityId: result.rows[0].id,
          message: `Created blog category: ${name}`,
          status: 'success',
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.category_created failed:', logErr);
      }

      res.status(201).json({ success: true, category: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'A category with this name already exists' });
        return;
      }
      console.error('Blog category create error:', error);
      res.status(500).json({ error: 'Failed to create blog category' });
    }
  },
);

router.put(
  '/categories/:id',
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().isString(),
    body('display_order').optional().isInt({ min: 0 }),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const existing = await query('SELECT * FROM blog_categories WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const current = existing.rows[0];
      const name = req.body.name ?? current.name;
      const description = 'description' in req.body ? req.body.description : current.description;
      const displayOrder = req.body.display_order ?? current.display_order;
      const slug = req.body.name ? generateSlug(req.body.name) : current.slug;

      const result = await query(
        `UPDATE blog_categories SET name=$1, slug=$2, description=$3, display_order=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
        [name, slug, description, displayOrder, req.params.id],
      );

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.category_updated',
          entityType: 'blog_category',
          entityId: req.params.id,
          message: `Updated blog category: ${name}`,
          status: 'success',
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.category_updated failed:', logErr);
      }

      res.json({ success: true, category: result.rows[0] });
    } catch (error: any) {
      console.error('Blog category update error:', error);
      res.status(500).json({ error: 'Failed to update blog category' });
    }
  },
);

router.delete(
  '/categories/:id',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const existing = await query('SELECT * FROM blog_categories WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      await query('DELETE FROM blog_categories WHERE id = $1', [req.params.id]);

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'blog.category_deleted',
          entityType: 'blog_category',
          entityId: req.params.id,
          message: `Deleted blog category: ${existing.rows[0].name}`,
          status: 'success',
        }, req);
      } catch (logErr) {
        console.error('logActivity blog.category_deleted failed:', logErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Blog category delete error:', error);
      res.status(500).json({ error: 'Failed to delete blog category' });
    }
  },
);

router.post(
  '/categories/reorder',
  [body('orders').isArray(), body('orders.*.id').isUUID(), body('orders.*.display_order').isInt({ min: 0 })],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      for (const item of req.body.orders) {
        await query('UPDATE blog_categories SET display_order = $1, updated_at = NOW() WHERE id = $2', [
          item.display_order,
          item.id,
        ]);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Blog category reorder error:', error);
      res.status(500).json({ error: 'Failed to reorder blog categories' });
    }
  },
);

// ─── Tags ──────────────────────────────────────────────────────────────

router.get(
  '/tags',
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await query(
        `SELECT bt.*, COUNT(bpt.post_id) as post_count
         FROM blog_tags bt
         LEFT JOIN blog_post_tags bpt ON bt.id = bpt.tag_id
         LEFT JOIN blog_posts bp ON bpt.post_id = bp.id AND bp.deleted_at IS NULL
         GROUP BY bt.id
         ORDER BY bt.name ASC`,
      );
      res.json({ success: true, tags: result.rows });
    } catch (error: any) {
      console.error('Blog tags fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blog tags' });
    }
  },
);

router.post(
  '/tags',
  [body('name').isString().trim().isLength({ min: 1, max: 50 })],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name } = req.body;
      const slug = generateSlug(name);

      const result = await query('INSERT INTO blog_tags (name, slug) VALUES ($1,$2) RETURNING *', [name, slug]);
      res.status(201).json({ success: true, tag: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'A tag with this name already exists' });
        return;
      }
      console.error('Blog tag create error:', error);
      res.status(500).json({ error: 'Failed to create blog tag' });
    }
  },
);

router.delete(
  '/tags/:id',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const existing = await query('SELECT * FROM blog_tags WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Tag not found' });
        return;
      }

      await query('DELETE FROM blog_tags WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Blog tag delete error:', error);
      res.status(500).json({ error: 'Failed to delete blog tag' });
    }
  },
);

export default router;
