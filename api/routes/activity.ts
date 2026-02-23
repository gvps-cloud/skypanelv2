import express, { Request, Response } from 'express';
import { authenticateToken, requireOrganization } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { ensureActivityLogsTable } from '../services/activityLogger.js';

const router = express.Router();

// All activity endpoints require auth; listing can be org-scoped when available
router.use(authenticateToken);

// Recent activity for current user (and org when present)
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const organizationId = user.organizationId || null;

    await ensureActivityLogsTable();

    const result = await query(
      `SELECT id, user_id, organization_id, event_type, entity_type, entity_id, message, status, metadata, created_at
       FROM activity_logs
       WHERE user_id = $1
         ${organizationId ? 'AND (organization_id = $2 OR organization_id IS NULL)' : ''}
       ORDER BY created_at DESC
       LIMIT $${organizationId ? 3 : 2}`,
      organizationId ? [user.id, organizationId, limit] : [user.id, limit]
    );

    const activities = (result.rows || []).map((r: any) => ({
      id: r.id,
      type: r.entity_type,
      message: r.message || `${r.event_type} ${r.entity_type}`,
      timestamp: r.created_at,
      status: r.status || 'info',
      metadata: r.metadata || {}
    }));

    res.json({ activities });
  } catch (err: any) {
    console.error('Recent activity fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch recent activity' });
  }
});

// Full list with filters
router.get('/', requireOrganization, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user.organizationId;
    const { type, status, from, to, limit = '10', offset = '0' } = req.query as any;
    const clauses: string[] = ['organization_id = $1'];
    const params: any[] = [orgId];
    let paramIdx = 2;

    if (type && typeof type === 'string') { clauses.push('entity_type = $' + paramIdx); params.push(type); paramIdx++; }
    if (status && typeof status === 'string') { clauses.push('status = $' + paramIdx); params.push(status); paramIdx++; }
    if (from && typeof from === 'string') { clauses.push('created_at >= $' + paramIdx); params.push(new Date(from)); paramIdx++; }
    if (to && typeof to === 'string') { clauses.push('created_at <= $' + paramIdx); params.push(new Date(to)); paramIdx++; }

    const lim = Math.min(Number(limit) || 10, 200);
    const off = Math.max(Number(offset) || 0, 0);

    await ensureActivityLogsTable();

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) as total
                      FROM activity_logs
                      WHERE ${clauses.join(' AND ')}`;
    const countResult = await query(countSql, params.slice(0, paramIdx - 1));
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get paginated results
    const sql = `SELECT a.id, a.user_id, a.organization_id, a.event_type, a.entity_type, a.entity_id, a.message, a.status, a.metadata, a.created_at,
                        u.role as user_role
                 FROM activity_logs a
                 LEFT JOIN users u ON a.user_id = u.id
                 WHERE ${clauses.map(c => c.replace(/(\w+_id|\w+_type|status|created_at)/g, 'a.$1')).join(' AND ')}
                 ORDER BY a.created_at DESC
                 LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(lim, off);

    const result = await query(sql, params);

    res.json({
      activities: result.rows || [],
      pagination: {
        total,
        limit: lim,
        offset: off,
        page: Math.floor(off / lim) + 1,
        totalPages: Math.ceil(total / lim)
      }
    });
  } catch (err: any) {
    console.error('Activity list error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch activity' });
  }
});

// Summary counts by type and status
router.get('/summary', requireOrganization, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user.organizationId;
    const { from, to } = req.query as any;
    const clauses: string[] = ['organization_id = $1'];
    const params: any[] = [orgId];
    let paramIdx = 2;
    if (from && typeof from === 'string') { clauses.push('created_at >= $' + paramIdx); params.push(new Date(from)); paramIdx++; }
    if (to && typeof to === 'string') { clauses.push('created_at <= $' + paramIdx); params.push(new Date(to)); paramIdx++; }

    const sql = `SELECT entity_type AS type, status, COUNT(*) AS count
                 FROM activity_logs
                 WHERE ${clauses.join(' AND ')}
                 GROUP BY entity_type, status
                 ORDER BY type, status`;
    await ensureActivityLogsTable();
    const result = await query(sql, params);
    res.json({ summary: result.rows || [] });
  } catch (err: any) {
    console.error('Activity summary error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch activity summary' });
  }
});

// CSV export
router.get('/export', requireOrganization, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user.organizationId;
    const { from, to } = req.query as any;
    const clauses: string[] = ['organization_id = $1'];
    const params: any[] = [orgId];
    let paramIdx = 2;
    if (from && typeof from === 'string') { clauses.push('created_at >= $' + paramIdx); params.push(new Date(from)); paramIdx++; }
    if (to && typeof to === 'string') { clauses.push('created_at <= $' + paramIdx); params.push(new Date(to)); paramIdx++; }

    const sql = `SELECT created_at, user_id, event_type, entity_type, entity_id, status, message
                 FROM activity_logs
                 WHERE ${clauses.join(' AND ')}
                 ORDER BY created_at DESC`;
    await ensureActivityLogsTable();
    const result = await query(sql, params);

    const header = 'created_at,user_id,event_type,entity_type,entity_id,status,message\n';
    const rows = (result.rows || []).map((r: any) => {
      const fields = [r.created_at, r.user_id, r.event_type, r.entity_type, r.entity_id || '', r.status, (r.message || '').replace(/\n/g, ' ')];
      return fields.map(f => '"' + String(f).replace(/"/g, '""') + '"').join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="activity_export.csv"');
    res.send(header + rows + '\n');
  } catch (err: any) {
    console.error('Activity export error:', err);
    res.status(500).json({ error: err.message || 'Failed to export activity' });
  }
});

export default router;