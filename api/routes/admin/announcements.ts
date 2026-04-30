/**
 * Admin Announcements Routes
 * Handle announcement CRUD operations for administrators
 */
import { Router, type Response } from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

const VALID_TYPES = ['info', 'warning', 'success', 'maintenance', 'urgent'];
const VALID_AUDIENCES = ['all', 'authenticated', 'guests', 'admin'];

/**
 * List all announcements
 * GET /api/admin/announcements
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, is_active } = req.query;

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type && VALID_TYPES.includes(type as string)) {
      whereClause += ` AND a.type = $${paramIndex++}`;
      params.push(type);
    }

    if (is_active !== undefined) {
      whereClause += ` AND a.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    const result = await query(
      `SELECT a.*, u.email as created_by_email
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE ${whereClause}
       ORDER BY a.priority DESC, a.created_at DESC`,
      params
    );

    res.json({ success: true, announcements: result.rows || [] });
  } catch (error: any) {
    console.error('Admin announcements fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * Get a single announcement
 * GET /api/admin/announcements/:id
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT a.*, u.email as created_by_email
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    res.json({ success: true, announcement: result.rows[0] });
  } catch (error: any) {
    console.error('Admin announcement fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

/**
 * Create a new announcement
 * POST /api/admin/announcements
 */
router.post(
  '/',
  [
    body('title').isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title is required (max 255 characters)'),
    body('message').isString().trim().isLength({ min: 1, max: 10000 }).withMessage('Message is required (max 10000 characters)'),
    body('type').isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),
    body('target_audience').isIn(VALID_AUDIENCES).withMessage(`Target audience must be one of: ${VALID_AUDIENCES.join(', ')}`),
    body('is_active').optional().isBoolean(),
    body('is_dismissable').optional().isBoolean(),
    body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
    body('starts_at').optional().isISO8601().withMessage('starts_at must be a valid ISO date'),
    body('expires_at').optional().isISO8601().withMessage('expires_at must be a valid ISO date'),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        title,
        message,
        type,
        target_audience,
        is_active = false,
        is_dismissable = true,
        priority = 0,
        starts_at,
        expires_at,
      } = req.body;

      const result = await query(
        `INSERT INTO announcements (title, message, type, target_audience, is_active, is_dismissable, priority, starts_at, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          title,
          message,
          type,
          target_audience,
          is_active,
          is_dismissable,
          priority,
          starts_at || null,
          expires_at || null,
          req.user!.id,
        ]
      );

      const announcement = result.rows[0];

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'announcement.create',
          entityType: 'announcement',
          entityId: announcement.id,
          message: `Created announcement: ${announcement.title}`,
          status: 'success',
          metadata: { type, target_audience, is_active },
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.status(201).json({ success: true, announcement });
    } catch (error: any) {
      console.error('Admin announcement create error:', error);
      res.status(500).json({ error: 'Failed to create announcement' });
    }
  }
);

/**
 * Update an announcement
 * PUT /api/admin/announcements/:id
 */
router.put(
  '/:id',
  [
    body('title').optional().isString().trim().isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters'),
    body('message').optional().isString().trim().isLength({ min: 1, max: 10000 }).withMessage('Message must be 1-10000 characters'),
    body('type').optional().isIn(VALID_TYPES).withMessage(`Type must be one of: ${VALID_TYPES.join(', ')}`),
    body('target_audience').optional().isIn(VALID_AUDIENCES).withMessage(`Target audience must be one of: ${VALID_AUDIENCES.join(', ')}`),
    body('is_active').optional().isBoolean(),
    body('is_dismissable').optional().isBoolean(),
    body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
    body('starts_at').optional({ nullable: true }).isISO8601().withMessage('starts_at must be a valid ISO date'),
    body('expires_at').optional({ nullable: true }).isISO8601().withMessage('expires_at must be a valid ISO date'),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const existing = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Announcement not found' });
        return;
      }

      const fields = req.body;
      const current = existing.rows[0];

      const title = fields.title ?? current.title;
      const message = fields.message ?? current.message;
      const type = fields.type ?? current.type;
      const target_audience = fields.target_audience ?? current.target_audience;
      const is_active = fields.is_active ?? current.is_active;
      const is_dismissable = fields.is_dismissable ?? current.is_dismissable;
      const priority = fields.priority ?? current.priority;
      const starts_at = 'starts_at' in fields ? (fields.starts_at || null) : current.starts_at;
      const expires_at = 'expires_at' in fields ? (fields.expires_at || null) : current.expires_at;

      const result = await query(
        `UPDATE announcements
         SET title = $1, message = $2, type = $3, target_audience = $4,
             is_active = $5, is_dismissable = $6, priority = $7,
             starts_at = $8, expires_at = $9, updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [title, message, type, target_audience, is_active, is_dismissable, priority, starts_at, expires_at, req.params.id]
      );

      const announcement = result.rows[0];

      try {
        await logActivity({
          userId: req.user!.id,
          organizationId: req.user!.organizationId || null,
          eventType: 'announcement.update',
          entityType: 'announcement',
          entityId: announcement.id,
          message: `Updated announcement: ${announcement.title}`,
          status: 'success',
          metadata: { type, target_audience, is_active },
        }, req as any);
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      res.json({ success: true, announcement });
    } catch (error: any) {
      console.error('Admin announcement update error:', error);
      res.status(500).json({ error: 'Failed to update announcement' });
    }
  }
);

/**
 * Delete an announcement
 * DELETE /api/admin/announcements/:id
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    const announcement = existing.rows[0];

    await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);

    try {
      await logActivity({
        userId: req.user!.id,
        organizationId: req.user!.organizationId || null,
        eventType: 'announcement.delete',
        entityType: 'announcement',
        entityId: announcement.id,
        message: `Deleted announcement: ${announcement.title}`,
        status: 'success',
        metadata: { type: announcement.type, target_audience: announcement.target_audience },
      }, req as any);
    } catch (logError) {
      console.warn('Failed to log activity:', logError);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Admin announcement delete error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
