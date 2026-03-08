import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/database.js';

export interface Activity {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: string;
  title: string;
  description: string | null;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface CreateActivityData {
  userId: string;
  organizationId?: string;
  type: string;
  title: string;
  description?: string;
  data?: Record<string, any>;
}

export class ActivityFeedService {
  static async createActivity({
    userId,
    organizationId,
    type,
    title,
    description,
    data = {}
  }: CreateActivityData): Promise<Activity> {
    const now = new Date().toISOString();
    const activityId = uuidv4();

    const result = await query(
      `INSERT INTO activity_feed 
       (id, user_id, organization_id, type, title, description, data, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [activityId, userId, organizationId || null, type, title, description || null, JSON.stringify(data), false, now]
    );

    return result.rows[0];
  }

  static async getUserActivities(userId: string, unreadOnly = false): Promise<Activity[]> {
    const result = await query(
      `SELECT 
         af.id,
         af.user_id,
         af.organization_id,
         af.type,
         af.title,
         af.description,
         af.data,
         af.is_read,
         af.created_at,
         o.name as organization_name
       FROM activity_feed af
       LEFT JOIN organizations o ON af.organization_id = o.id
       WHERE af.user_id = $1
         AND ($2 = false OR af.is_read = false)
       ORDER BY af.created_at DESC
       LIMIT 50`,
      [userId, unreadOnly]
    );

    return result.rows;
  }

  static async markAsRead(activityId: string, userId: string): Promise<void> {
    const result = await query(
      `UPDATE activity_feed 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Activity not found or access denied');
    }
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await query(
      `UPDATE activity_feed 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM activity_feed 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  static async deleteActivity(activityId: string, userId: string): Promise<void> {
    const result = await query(
      `DELETE FROM activity_feed 
       WHERE id = $1 AND user_id = $2`,
      [activityId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Activity not found or access denied');
    }
  }

  static async getActivitiesByOrganization(userId: string, organizationId: string): Promise<Activity[]> {
    const result = await query(
      `SELECT 
         af.id,
         af.user_id,
         af.organization_id,
         af.type,
         af.title,
         af.description,
         af.data,
         af.is_read,
         af.created_at,
         o.name as organization_name
       FROM activity_feed af
       LEFT JOIN organizations o ON af.organization_id = o.id
       WHERE af.user_id = $1 AND af.organization_id = $2
       ORDER BY af.created_at DESC
       LIMIT 50`,
      [userId, organizationId]
    );

    return result.rows;
  }

  static async getActivityById(activityId: string, userId: string): Promise<Activity> {
    const result = await query(
      `SELECT 
         af.id,
         af.user_id,
         af.organization_id,
         af.type,
         af.title,
         af.description,
         af.data,
         af.is_read,
         af.created_at,
         o.name as organization_name
       FROM activity_feed af
       LEFT JOIN organizations o ON af.organization_id = o.id
       WHERE af.id = $1 AND af.user_id = $2`,
      [activityId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Activity not found');
    }

    return result.rows[0];
  }
}
