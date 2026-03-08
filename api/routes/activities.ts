import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { ActivityFeedService } from '../services/activityFeed.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const unreadOnly = req.query.unread_only === 'true';

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const activities = await ActivityFeedService.getUserActivities(user.id, unreadOnly);
    res.json({ activities });
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const count = await ActivityFeedService.getUnreadCount(user.id);
    res.json({ count });
  } catch (error) {
    console.error('Failed to fetch unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.put('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ActivityFeedService.markAllAsRead(user.id);
    res.json({ message: 'All activities marked as read' });
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.put('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ActivityFeedService.markAsRead(id, user.id);
    res.json({ message: 'Activity marked as read' });
  } catch (error) {
    console.error('Failed to mark activity as read:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark activity as read';
    res.status(404).json({ error: message });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await ActivityFeedService.deleteActivity(id, user.id);
    res.json({ message: 'Activity deleted' });
  } catch (error) {
    console.error('Failed to delete activity:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete activity';
    res.status(404).json({ error: message });
  }
});

router.get('/organization/:organizationId', async (req: AuthenticatedRequest, res: Response) => {
  const { organizationId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const activities = await ActivityFeedService.getActivitiesByOrganization(user.id, organizationId);
    res.json({ activities });
  } catch (error) {
    console.error('Failed to fetch organization activities:', error);
    res.status(500).json({ error: 'Failed to fetch organization activities' });
  }
});

export default router;
