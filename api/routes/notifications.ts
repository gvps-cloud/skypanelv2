import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { notificationService, Notification } from '../services/notificationService.js';
import { tokenBlacklistService } from '../services/tokenBlacklistService.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const router = express.Router();

// Special middleware for SSE that supports token in query parameter
const authenticateSSE = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try to get token from query parameter (for SSE EventSource compatibility)
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Reject tokens that have been revoked (e.g. after logout / password reset)
    const isRevoked = await tokenBlacklistService.isRevoked(token);
    if (isRevoked) {
      console.warn('SSE authentication attempt with revoked token:', {
        hasToken: !!token,
        tokenPrefix: token.substring(0, 10) + '...'
      });
      return res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    
    // Get user from database
    const userResult = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = userResult.rows[0];

    // Get user's organization
    let organizationId;
    try {
      const orgResult = await query(
        'SELECT organization_id FROM organization_members WHERE user_id = $1',
        [user.id]
      );
      organizationId = orgResult.rows[0]?.organization_id;
    } catch {
      // Table might not exist yet
      console.warn('organization_members table not found');
    }

    // Fallback: use organization owned by the user
    if (!organizationId) {
      try {
        const ownerOrg = await query(
          'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        organizationId = ownerOrg.rows[0]?.id;
      } catch {
        console.warn('organizations lookup failed');
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId
    };

    next();
  } catch (error) {
    console.error('SSE authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// All notification endpoints require authentication (except SSE which uses custom auth)
router.use((req, res, next) => {
  if (req.path === '/stream') {
    return next(); // SSE uses its own auth
  }
  return authenticateToken(req as AuthenticatedRequest, res, next);
});

// Server-Sent Events endpoint for real-time notifications
router.get('/stream', authenticateSSE, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Notification stream connected' })}\n\n`);

  // Handler for new notifications
  const notificationHandler = (notification: Notification) => {
    // Only send notifications for this user
    if (notification.user_id === user.id) {
      res.write(`data: ${JSON.stringify({ 
        type: 'notification', 
        data: notification 
      })}\n\n`);
    }
  };

  // Subscribe to notifications
  notificationService.on('notification', notificationHandler);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    notificationService.off('notification', notificationHandler);
    res.end();
  });
});

// Get unread notification count
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT COUNT(*) as count
       FROM activity_logs
       WHERE user_id = $1 AND is_read = FALSE`,
      [user.id]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch unread count' });
  }
});

// Get recent unread notifications
router.get('/unread', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const result = await query(
      `SELECT id, user_id, organization_id, event_type, entity_type, entity_id, 
              message, status, metadata, created_at, is_read, read_at
       FROM activity_logs
       WHERE user_id = $1 AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT $2`,
      [user.id, limit]
    );

    res.json({ notifications: result.rows || [] });
  } catch (err) {
    console.error('Error fetching unread notifications:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch unread notifications' });
  }
});

// Get all notifications (read and unread)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await query(
      `SELECT id, user_id, organization_id, event_type, entity_type, entity_id, 
              message, status, metadata, created_at, is_read, read_at
       FROM activity_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM activity_logs WHERE user_id = $1`,
      [user.id]
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    res.json({ 
      notifications: result.rows || [],
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch notifications' });
  }
});

// Mark a specific notification as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const notificationId = req.params.id;

    const result = await query(
      `SELECT mark_notification_read($1, $2) as success`,
      [notificationId, user.id]
    );

    const success = result.rows[0]?.success || false;

    if (success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(404).json({ error: 'Notification not found or already read' });
    }
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT mark_all_notifications_read($1) as count`,
      [user.id]
    );

    const count = result.rows[0]?.count || 0;

    res.json({ 
      success: true, 
      message: `${count} notification(s) marked as read`,
      count 
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to mark all notifications as read' });
  }
});

export default router;
