import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';

const router = express.Router();

// Middleware to check if user is system admin or org admin/owner
const requireOrgAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // System admin bypass
  if (user.role === 'admin') {
    return next();
  }

  // Check if user is member of the organization with sufficient role
  try {
    const result = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const memberRole = result.rows[0].role;
    if (memberRole === 'owner' || memberRole === 'admin') {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (error) {
    console.error('Organization access check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.use(authenticateToken);

// GET /:id/members
router.get('/:id/members', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, om.role, om.created_at as joined_at
       FROM organization_members om
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1
       ORDER BY om.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST /:id/members (Add by email)
router.post('/:id/members', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validRoles = ['admin', 'member']; // Owner is usually singular or handled differently
  const newRole = validRoles.includes(role) ? role : 'member';

  try {
    // 1. Find user by email
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // 2. Add to organization
    const insertResult = await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [id, userId, newRole]
    );

    if (insertResult.rowCount === 0) {
        return res.status(409).json({ error: 'User is already a member of this organization' });
    }

    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Failed to add member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// PUT /:id/members/:userId (Update role)
router.put('/:id/members/:userId', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId } = req.params;
  const { role } = req.body;

  const validRoles = ['admin', 'member', 'owner']; 
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Check if trying to demote the last owner
    if (role !== 'owner') {
        const memberCheck = await query(
            `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
            [id, userId]
        );
        
        if (memberCheck.rows.length > 0 && memberCheck.rows[0].role === 'owner') {
            const ownerCount = await query(
                `SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1 AND role = 'owner'`,
                [id]
            );
            if (parseInt(ownerCount.rows[0].count) <= 1) {
                return res.status(400).json({ error: 'Cannot demote the last owner' });
            }
        }
    }

    const result = await query(
      `UPDATE organization_members
       SET role = $1
       WHERE organization_id = $2 AND user_id = $3
       RETURNING *`,
      [role, id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member role updated' });
  } catch (error) {
    console.error('Failed to update member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /:id/members/:userId (Remove member)
router.delete('/:id/members/:userId', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId } = req.params;

  try {
    // Check if trying to remove the last owner
    const memberCheck = await query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [id, userId]
    );
    
    if (memberCheck.rows.length > 0 && memberCheck.rows[0].role === 'owner') {
        const ownerCount = await query(
            `SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1 AND role = 'owner'`,
            [id]
        );
        if (parseInt(ownerCount.rows[0].count) <= 1) {
            return res.status(400).json({ error: 'Cannot remove the last owner' });
        }
    }

    const result = await query(
      `DELETE FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Failed to remove member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
