import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { query } from '../lib/database.js';
import { InvitationService } from '../services/invitations.js';
import { ActivityFeedService } from '../services/activityFeed.js';
import { EgressBillingService } from '../services/egressBillingService.js';
import { RoleService } from '../services/roles.js';

const router = express.Router();

// Middleware to check if user is system admin or org admin/owner
const requireOrgAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = req.user;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid organization ID format' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user is member of the organization with sufficient role
  try {
    const result = await query(
      `SELECT om.role, r.permissions, r.name as role_name
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const member = result.rows[0];
    const roleName = member.role_name || member.role;
    
    // Check if user has admin or owner role
    if (roleName === 'owner' || roleName === 'admin') {
      return next();
    }

    // Check if user has custom role with members_manage permission
    if (member.permissions) {
      const permissions = typeof member.permissions === 'string' 
        ? JSON.parse(member.permissions) 
        : member.permissions;
      
      if (permissions.members_manage === true) {
        return next();
      }
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (error) {
    console.error('Organization access check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user is a member of the organization
const checkOrganizationMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    next();
  } catch (error) {
    console.error('Organization membership check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user can manage invitations (by invitation ID)
const requireInvitationAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { id } = req.params; // This is the invitation ID
  const user = req.user;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid invitation ID format' });
  }

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Get the invitation to find the organization
    const invitationResult = await query(
      `SELECT organization_id FROM organization_invitations WHERE id = $1`,
      [id]
    );

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const organizationId = invitationResult.rows[0].organization_id;

    // Check if user is member of the organization with sufficient role
    const memberResult = await query(
      `SELECT om.role, r.permissions, r.name as role_name
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [organizationId, user.id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const member = memberResult.rows[0];
    const roleName = member.role_name || member.role;

    // Check if user has admin or owner role
    if (roleName === 'owner' || roleName === 'admin') {
      return next();
    }

    // Check if user has custom role with members_manage permission
    if (member.permissions) {
      const permissions = typeof member.permissions === 'string'
        ? JSON.parse(member.permissions)
        : member.permissions;

      if (permissions.members_manage === true) {
        return next();
      }
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (error) {
    console.error('Invitation access check failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.use(authenticateToken);

// GET /resources - List resources across all organizations
router.get('/resources', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    let orgs = [];

    const result = await query(
      `SELECT o.id, o.name 
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY o.name ASC`,
      [user.id]
    );
    orgs = result.rows;

    const resources = await Promise.all(orgs.map(async (org) => {
      // Get user's permissions for this org
      let permissions = {
        vps_view: false,
        vps_create: false,
        vps_delete: false,
        vps_manage: false,
        ssh_keys_view: false,
        ssh_keys_manage: false,
        tickets_view: false,
        tickets_create: false,
        tickets_manage: false,
        billing_view: false,
        billing_manage: false,
        members_manage: false,
        settings_manage: false
      };

      const memberResult = await query(
        `SELECT om.role_id, r.permissions, om.role as legacy_role
         FROM organization_members om
         LEFT JOIN organization_roles r ON om.role_id = r.id
         WHERE om.organization_id = $1 AND om.user_id = $2`,
        [org.id, user.id]
      );

      if (memberResult.rows.length > 0) {
        const member = memberResult.rows[0];
        
        // Add permissions from role
        if (member.permissions) {
          const perms = Array.isArray(member.permissions) 
            ? member.permissions 
            : JSON.parse(member.permissions);
          
          perms.forEach((p: string) => {
            if (p in permissions) (permissions as any)[p] = true;
          });
        }

        // Fallback for legacy roles if no granular permissions
        if (member.legacy_role === 'owner') {
          Object.keys(permissions).forEach(key => (permissions as any)[key] = true);
        } else if (member.legacy_role === 'admin') {
          ['vps_view', 'vps_create', 'vps_delete', 'vps_manage', 
           'ssh_keys_view', 'ssh_keys_manage',
           'tickets_view', 'tickets_create', 'tickets_manage', 
           'billing_view', 'settings_manage'].forEach(p => {
             if (p in permissions) (permissions as any)[p] = true;
           });
        } else if (member.legacy_role === 'member') {
          ['vps_view', 'tickets_view'].forEach(p => {
             if (p in permissions) (permissions as any)[p] = true;
           });
        }
      }

      // Fetch resources if authorized
      let vpsInstances: any[] = [];
      let sshKeys: any[] = [];
      let tickets: any[] = [];

      if (permissions.vps_view) {
        const vpsResult = await query(
          `SELECT v.id, v.label, v.status, v.ip_address, v.plan_id, v.created_at, v.configuration, p.name as plan_name
           FROM vps_instances v
           LEFT JOIN LATERAL (
             SELECT name
             FROM vps_plans p
             WHERE p.id::text = v.plan_id OR p.provider_plan_id = v.plan_id
             ORDER BY (p.id::text = v.plan_id)::int DESC, p.created_at DESC
             LIMIT 1
           ) p ON true
           WHERE v.organization_id = $1 
           ORDER BY v.created_at DESC LIMIT 5`,
          [org.id]
        );
        vpsInstances = vpsResult.rows;
      }

      if (permissions.tickets_view) {
        const ticketResult = await query(
          `SELECT id, subject, status, priority, category, created_at 
           FROM support_tickets 
           WHERE organization_id = $1 
           ORDER BY created_at DESC LIMIT 5`,
          [org.id]
        );
        tickets = ticketResult.rows;
      }

      if (permissions.ssh_keys_view) {
        const sshKeyResult = await query(
          `SELECT id, name, fingerprint, linode_key_id, created_at, updated_at
           FROM user_ssh_keys
           WHERE organization_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [org.id]
        );
        sshKeys = sshKeyResult.rows;
      }

      return {
        organization_id: org.id,
        organization_name: org.name,
        permissions,
        vps_instances: vpsInstances,
        ssh_keys: sshKeys,
        tickets
      };
    }));

    res.json({ resources });
  } catch (error) {
    console.error('Failed to fetch organization resources:', error);
    res.status(500).json({ error: 'Failed to fetch organization resources' });
  }
});

router.get('/:id/egress', checkOrganizationMembership, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const hasBillingPermission = await RoleService.checkPermission(
      user.id,
      id,
      'billing_view',
    );

    if (!hasBillingPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const month =
      typeof req.query.month === 'string' ? req.query.month : undefined;
    const overview = await EgressBillingService.getOrganizationOverview(id, month);

    res.json({ overview });
  } catch (error) {
    console.error('Failed to fetch organization egress overview:', error);
    res.status(500).json({ error: 'Failed to fetch organization egress overview' });
  }
});

// GET / - List user's organizations with stats
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const offset = (page - 1) * limit;

    let orgs;
    let totalCount;
    
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1`,
      [user.id]
    );
    totalCount = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT o.id, o.name, o.slug, o.created_at, om.role as member_role, 
              COALESCE(r.permissions, '[]'::jsonb) as role_permissions,
              om.created_at as joined_at
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    orgs = result.rows;

    const enrichedOrgs = await Promise.all(orgs.map(async (org) => {
      const vpsCount = await query(
        'SELECT COUNT(*) as count FROM vps_instances WHERE organization_id = $1',
        [org.id]
      );
      
      const ticketCount = await query(
        'SELECT COUNT(*) as count FROM support_tickets WHERE organization_id = $1',
        [org.id]
      );

      const sshKeyCount = await query(
        'SELECT COUNT(*) as count FROM user_ssh_keys WHERE organization_id = $1',
        [org.id]
      );

      const memberCount = await query(
        'SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1',
        [org.id]
      );

      return {
        ...org,
        stats: {
          vps_count: parseInt(vpsCount.rows[0].count),
          ticket_count: parseInt(ticketCount.rows[0].count),
          ssh_key_count: parseInt(sshKeyCount.rows[0].count),
          member_count: parseInt(memberCount.rows[0].count)
        }
      };
    }));

    res.json({ 
      organizations: enrichedOrgs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// PUT /:id - Update organization settings
router.put('/:id', requirePermission('settings_manage'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  try {
    const result = await query(
      `UPDATE organizations
       SET name = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, updated_at`,
      [id, name.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      message: 'Organization updated',
      organization: result.rows[0],
    });
  } catch (error) {
    console.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// GET /:id/members
router.get('/:id/members', checkOrganizationMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, om.role_id, r.name as role_name, om.created_at as joined_at
       FROM organization_members om
       JOIN users u ON om.user_id = u.id
       LEFT JOIN organization_roles r ON om.role_id = r.id
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

  const validRoles = ['admin', 'member'];
  const newRole = validRoles.includes(role) ? role : 'member';

  try {
    const user = req.user;
    // 1. Find user by email
    const userResult = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    const userName = userResult.rows[0].name || email;

    // 2. Get organization name
    const orgResult = await query('SELECT name FROM organizations WHERE id = $1', [id]);
    const orgName = orgResult.rows[0]?.name || 'the organization';

    // 3. Add to organization
    const insertResult = await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [id, userId, newRole]
    );

    if (insertResult.rowCount === 0) {
        return res.status(409).json({ error: 'User is already a member of this organization' });
    }

    await ActivityFeedService.createActivity({
      userId,
      organizationId: id,
      type: 'member_added',
      title: `You have been added to ${orgName}`,
      description: `${user?.name || 'An admin'} has added you to ${orgName} as a ${newRole}.`,
      data: {
        organizationName: orgName,
        roleName: newRole,
        addedBy: user?.name || 'An admin'
      }
    });

    const membersResult = await query(
      `SELECT om.user_id
       FROM organization_members om
       WHERE om.organization_id = $1 AND om.user_id != $2`,
      [id, userId]
    );

    for (const member of membersResult.rows) {
      await ActivityFeedService.createActivity({
        userId: member.user_id,
        organizationId: id,
        type: 'member_joined',
        title: `${userName} has joined ${orgName}`,
        description: `${userName} has been added to ${orgName} as a ${newRole}.`,
        data: {
          userId,
          userName,
          organizationName: orgName,
          roleName: newRole,
          addedBy: user?.name || 'An admin'
        }
      });
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
  const { role, roleId } = req.body;

  try {
    const user = req.user;
    const memberCheck = await query(
      `SELECT role, role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get requester's role to check for ownership transfer authorization
    const requesterRoleResult = await query(
      `SELECT om.role, r.name as role_name
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [id, req.user!.id]
    );

    const requesterRoleName = requesterRoleResult.rows[0]?.role_name || 
                              requesterRoleResult.rows[0]?.role;

    const oldRole = memberCheck.rows[0].role;
    const oldRoleId = memberCheck.rows[0].role_id;
    let updateField, updateValue, newRoleDisplay, oldRoleDisplay;

    // Handle new role_id system
    if (roleId) {
      // Validate that the role exists and belongs to this organization
      const roleCheck = await query(
        `SELECT name FROM organization_roles WHERE id = $1 AND organization_id = $2`,
        [roleId, id]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const targetRoleName = roleCheck.rows[0].name;

      // Ownership transfer authorization check
      if (targetRoleName === 'owner' && requesterRoleName !== 'owner') {
        return res.status(403).json({ 
          error: 'Only the organization owner can transfer ownership' 
        });
      }

      // Check if trying to demote the last owner
      const ownerRoleCheck = await query(
        `SELECT id FROM organization_roles WHERE name = 'owner' AND organization_id = $1`,
        [id]
      );

      if (oldRoleId === ownerRoleCheck.rows[0]?.id && roleId !== oldRoleId) {
        const ownerCount = await query(
          `SELECT COUNT(*) as count FROM organization_members om
           JOIN organization_roles r ON om.role_id = r.id
           WHERE om.organization_id = $1 AND r.name = 'owner'`,
          [id]
        );
        if (parseInt(ownerCount.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last owner' });
        }
      }

      updateField = 'role_id';
      updateValue = roleId;
      newRoleDisplay = roleCheck.rows[0].name;

      // Get old role name for activity feed
      if (oldRoleId) {
        const oldRoleNameCheck = await query(
          `SELECT name FROM organization_roles WHERE id = $1`,
          [oldRoleId]
        );
        oldRoleDisplay = oldRoleNameCheck.rows[0]?.name || oldRole;
      } else {
        oldRoleDisplay = oldRole;
      }
    }
    // Handle legacy role system
    else if (role) {
      const validRoles = ['admin', 'member', 'owner'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Ownership transfer authorization check for legacy system
      if (role === 'owner' && requesterRoleName !== 'owner') {
        return res.status(403).json({ 
          error: 'Only the organization owner can transfer ownership' 
        });
      }

      if (role !== 'owner' && oldRole === 'owner') {
        const ownerCount = await query(
          `SELECT COUNT(*) as count FROM organization_members WHERE organization_id = $1 AND role = 'owner'`,
          [id]
        );
        if (parseInt(ownerCount.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last owner' });
        }
      }

      updateField = 'role';
      updateValue = role;
      newRoleDisplay = role;
      oldRoleDisplay = oldRole;
    } else {
      return res.status(400).json({ error: 'Either role or roleId must be provided' });
    }

    const result = await query(
      `UPDATE organization_members
       SET ${updateField} = $1
       WHERE organization_id = $2 AND user_id = $3
       RETURNING *`,
      [updateValue, id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const orgResult = await query('SELECT name FROM organizations WHERE id = $1', [id]);
    const orgName = orgResult.rows[0]?.name || 'the organization';

    const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'A team member';

    await ActivityFeedService.createActivity({
      userId,
      organizationId: id,
      type: 'role_updated',
      title: `Your role in ${orgName} has been updated`,
      description: `Your role in ${orgName} has been changed from ${oldRoleDisplay} to ${newRoleDisplay}.`,
      data: {
        organizationName: orgName,
        oldRole: oldRoleDisplay,
        newRole: newRoleDisplay,
        updatedBy: user?.name || 'An admin'
      }
    });

    const membersResult = await query(
      `SELECT om.user_id
       FROM organization_members om
       WHERE om.organization_id = $1 AND om.user_id != $2`,
      [id, userId]
    );

    for (const member of membersResult.rows) {
      await ActivityFeedService.createActivity({
        userId: member.user_id,
        organizationId: id,
        type: 'member_role_updated',
        title: `${userName}'s role has been updated`,
        description: `${userName}'s role in ${orgName} has been changed from ${oldRoleDisplay} to ${newRoleDisplay}.`,
        data: {
          userId,
          userName,
          organizationName: orgName,
          oldRole: oldRoleDisplay,
          newRole: newRoleDisplay,
          updatedBy: user?.name || 'An admin'
        }
      });
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
    const user = req.user;
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

    const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.name || 'A team member';

    const result = await query(
      `DELETE FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const orgResult = await query('SELECT name FROM organizations WHERE id = $1', [id]);
    const orgName = orgResult.rows[0]?.name || 'the organization';

    await ActivityFeedService.createActivity({
      userId,
      organizationId: id,
      type: 'member_removed',
      title: `You have been removed from ${orgName}`,
      description: `You have been removed from ${orgName} by ${user?.name || 'an admin'}.`,
      data: {
        organizationName: orgName,
        removedBy: user?.name || 'An admin'
      }
    });

    const membersResult = await query(
      `SELECT om.user_id
       FROM organization_members om
       WHERE om.organization_id = $1`,
      [id]
    );

    for (const member of membersResult.rows) {
      await ActivityFeedService.createActivity({
        userId: member.user_id,
        organizationId: id,
        type: 'member_left',
        title: `${userName} has left ${orgName}`,
        description: `${userName} has been removed from ${orgName} by ${user?.name || 'an admin'}.`,
        data: {
          userId,
          userName,
          organizationName: orgName,
          removedBy: user?.name || 'An admin'
        }
      });
    }

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Failed to remove member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST /:id/members/invite - Create invitation
router.post('/:id/members/invite', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { email, roleId } = req.body;
  const user = req.user;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!roleId) {
    return res.status(400).json({ error: 'Role ID is required' });
  }

  try {
    const result = await InvitationService.createInvitation(
      id,
      email,
      roleId,
      user!.id
    );

    res.status(201).json({
      id: result.invitation.id,
      organization_id: result.invitation.organization_id,
      invited_email: result.invitation.invited_email,
      role_id: result.invitation.role_id,
      token: result.invitation.token,
      status: result.invitation.status,
      expires_at: result.invitation.expires_at,
      created_at: result.invitation.created_at,
      emailSent: result.emailSent,
      emailError: result.emailError
    });
  } catch (error) {
    console.error('Failed to create invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to create invitation';
    res.status(400).json({ error: message });
  }
});

// POST /invitations/:token/accept - Accept invitation
router.post('/invitations/:token/accept', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await InvitationService.acceptInvitation(token, user.id);
    res.json({ 
      message: 'Invitation accepted successfully',
      organization_id: result.organization_id 
    });
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to accept invitation';
    res.status(400).json({ error: message });
  }
});

// GET /invitations/:token - Validate invitation (public endpoint, no auth required)
router.get('/invitations/:token', async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;

  try {
    const invitation = await InvitationService.validateInvitation(token);
    res.json(invitation);
  } catch (error) {
    console.error('Failed to validate invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to validate invitation';
    res.status(400).json({ error: message });
  }
});

// POST /invitations/:token/decline - Decline invitation
router.post('/invitations/:token/decline', async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;

  try {
    await InvitationService.declineInvitation(token);
    res.json({ message: 'Invitation declined successfully' });
  } catch (error) {
    console.error('Failed to decline invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to decline invitation';
    res.status(400).json({ error: message });
  }
});

// DELETE /invitations/:id - Cancel invitation
router.delete('/invitations/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // First get the invitation to find the organization ID
    const invitation = await InvitationService.getInvitationById(id);

    // Check if user has permission to manage invitations for this organization
    const memberCheck = await query(
      `SELECT om.role, r.permissions, r.name as role_name
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.organization_id = $1 AND om.user_id = $2`,
      [invitation.organization_id, user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const member = memberCheck.rows[0];
    const roleName = member.role_name || member.role;

    // Check if user has admin or owner role
    const hasAdminRole = roleName === 'owner' || roleName === 'admin';

    // Check if user has custom role with members_manage permission
    const hasMembersManagePermission = member.permissions && (
      typeof member.permissions === 'string'
        ? JSON.parse(member.permissions).members_manage === true
        : member.permissions.members_manage === true
    );

    if (!hasAdminRole && !hasMembersManagePermission) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Proceed with cancellation
    await InvitationService.cancelInvitation(id);
    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel invitation';
    res.status(400).json({ error: message });
  }
});

// GET /:id/invitations - List pending invitations for organization
router.get('/:id/invitations', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const invitations = await InvitationService.getPendingInvitations(id);
    res.json(invitations);
  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// GET /:id/roles - List all roles for organization
router.get('/:id/roles', checkOrganizationMembership, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT 
         id, 
         name, 
         permissions, 
         is_custom,
         created_at,
         updated_at
       FROM organization_roles 
       WHERE organization_id = $1
       ORDER BY is_custom ASC, name ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /:id/roles - Create custom role
router.post('/:id/roles', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, permissions } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array' });
  }

  const validPermissions = [
    'vps_view', 'vps_create', 'vps_delete', 'vps_manage',
    'ssh_keys_view', 'ssh_keys_manage',
    'tickets_view', 'tickets_create', 'tickets_manage',
    'billing_view', 'billing_manage',
    'members_manage', 'settings_manage'
  ];

  const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
  if (invalidPermissions.length > 0) {
    return res.status(400).json({ 
      error: `Invalid permissions: ${invalidPermissions.join(', ')}` 
    });
  }

  try {
    const result = await query(
      `INSERT INTO organization_roles (organization_id, name, permissions, is_custom, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
       RETURNING *`,
      [id, name.trim(), JSON.stringify(permissions), true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to create role:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /:id/roles/:roleId - Update custom role
router.put('/:id/roles/:roleId', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id, roleId } = req.params;
  const { name, permissions } = req.body;

  try {
    const roleCheck = await query(
      `SELECT is_custom FROM organization_roles WHERE id = $1 AND organization_id = $2`,
      [roleId, id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (!roleCheck.rows[0].is_custom) {
      return res.status(400).json({ error: 'Cannot modify predefined roles' });
    }

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Role name cannot be empty' });
    }

    if (permissions !== undefined && !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    if (permissions) {
      const validPermissions = [
        'vps_view', 'vps_create', 'vps_delete', 'vps_manage',
        'ssh_keys_view', 'ssh_keys_manage',
        'tickets_view', 'tickets_create', 'tickets_manage',
        'billing_view', 'billing_manage',
        'members_manage', 'settings_manage'
      ];

      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({ 
          error: `Invalid permissions: ${invalidPermissions.join(', ')}` 
        });
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name.trim());
    }

    if (permissions !== undefined) {
      updateFields.push(`permissions = $${paramIndex++}::jsonb`);
      updateValues.push(JSON.stringify(permissions));
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(roleId);
    updateValues.push(id);

    const result = await query(
      `UPDATE organization_roles
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex}
       RETURNING *`,
      updateValues
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to update role:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /:id/roles/:roleId - Delete custom role
router.delete('/:id/roles/:roleId', requireOrgAccess, async (req: AuthenticatedRequest, res: Response) => {
  const { id, roleId } = req.params;

  try {
    const roleCheck = await query(
      `SELECT is_custom FROM organization_roles WHERE id = $1 AND organization_id = $2`,
      [roleId, id]
    );

    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (!roleCheck.rows[0].is_custom) {
      return res.status(400).json({ error: 'Cannot delete predefined roles' });
    }

    const memberCount = await query(
      `SELECT COUNT(*) as count FROM organization_members WHERE role_id = $1`,
      [roleId]
    );

    if (parseInt(memberCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is assigned to members. Reassign members first.' 
      });
    }

    const invitationCount = await query(
      `SELECT COUNT(*) as count FROM organization_invitations WHERE role_id = $1 AND status = 'pending'`,
      [roleId]
    );

    if (parseInt(invitationCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is used in pending invitations. Cancel invitations first.' 
      });
    }

    await query(
      'DELETE FROM organization_roles WHERE id = $1 AND organization_id = $2',
      [roleId, id]
    );

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Failed to delete role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

export default router;
