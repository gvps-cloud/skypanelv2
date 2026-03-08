import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../lib/database.js';
import { ActivityFeedService } from './activityFeed.js';
import { sendInvitationEmail } from './emailService.js';

export interface Invitation {
  id: string;
  organization_id: string;
  invited_email: string;
  role_id: string;
  inviter_id: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface InvitationDetails extends Invitation {
  organization_name: string;
  role_name: string;
  inviter_name: string;
  inviter_email: string;
}

const INVITATION_EXPIRY_DAYS = 7;
const TOKEN_LENGTH = 32;

export class InvitationService {
  static async createInvitation(
    organizationId: string,
    invitedEmail: string,
    roleId: string,
    inviterId: string
  ): Promise<Invitation> {
    return await transaction(async (client) => {
      const normalizedEmail = invitedEmail.toLowerCase().trim();

      // Check if organization exists
      const orgResult = await client.query(
        'SELECT id, name FROM organizations WHERE id = $1',
        [organizationId]
      );
      if (orgResult.rows.length === 0) {
        throw new Error('Organization not found');
      }

      // Check if role exists for this organization
      const roleResult = await client.query(
        'SELECT id, name FROM organization_roles WHERE id = $1 AND organization_id = $2',
        [roleId, organizationId]
      );
      if (roleResult.rows.length === 0) {
        throw new Error('Role not found for this organization');
      }

      // Check if user is already a member of the organization
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        const existingMember = await client.query(
          'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
          [organizationId, userId]
        );
        if (existingMember.rows.length > 0) {
          throw new Error('User is already a member of this organization');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await client.query(
        `SELECT id, status, expires_at 
         FROM organization_invitations 
         WHERE organization_id = $1 AND invited_email = $2 AND status = 'pending' AND expires_at > NOW()`,
        [organizationId, normalizedEmail]
      );

      if (existingInvitation.rows.length > 0) {
        throw new Error('A pending invitation already exists for this email');
      }

      // Generate token and expiration
      const token = randomBytes(TOKEN_LENGTH).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      // Create invitation
      const now = new Date().toISOString();
      const invitationId = uuidv4();

      const result = await client.query(
        `INSERT INTO organization_invitations 
         (id, organization_id, invited_email, role_id, inviter_id, token, status, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [invitationId, organizationId, normalizedEmail, roleId, inviterId, token, 'pending', expiresAt.toISOString(), now, now]
      );

      const invitation = result.rows[0];

      await ActivityFeedService.createActivity({
        userId: inviterId,
        organizationId,
        type: 'invitation_created',
        title: `Invitation sent to ${normalizedEmail}`,
        description: `You have sent an invitation to ${normalizedEmail} to join the organization.`,
        data: {
          invitationId,
          invitedEmail: normalizedEmail,
          roleName: roleResult.rows[0].name,
          expiresAt
        }
      });

      if (userResult.rows.length > 0) {
        const inviteeId = userResult.rows[0].id;
        await ActivityFeedService.createActivity({
          userId: inviteeId,
          organizationId,
          type: 'invitation_received',
          title: `You have been invited to join ${orgResult.rows[0].name}`,
          description: `${inviterId} has invited you to join the organization with the role ${roleResult.rows[0].name}.`,
          data: {
            invitationId,
            organizationName: orgResult.rows[0].name,
            roleName: roleResult.rows[0].name,
            token
          }
        });
      }

      const inviterResult = await client.query(
        'SELECT name, email FROM users WHERE id = $1',
        [inviterId]
      );

      const inviter = inviterResult.rows[0];

      try {
        await sendInvitationEmail({
          organizationName: orgResult.rows[0].name,
          inviterName: inviter.name || 'A team member',
          inviterEmail: inviter.email,
          role: roleResult.rows[0].name,
          token: invitation.token,
          invitedEmail: invitation.invited_email,
          expiresAt: invitation.expires_at
        });
      } catch (emailError) {
        console.error('[InvitationService] Failed to send invitation email:', emailError);
      }

      return invitation;
    });
  }

  static async acceptInvitation(token: string, userId: string): Promise<{ organization_id: string }> {
    return await transaction(async (client) => {
      // Validate invitation
      const invitation = await client.query(
        `SELECT oi.*, org.name as organization_name, r.name as role_name
         FROM organization_invitations oi
         JOIN organizations org ON oi.organization_id = org.id
         JOIN organization_roles r ON oi.role_id = r.id
         WHERE oi.token = $1`,
        [token]
      );

      if (invitation.rows.length === 0) {
        throw new Error('Invitation not found');
      }

      const invitationData = invitation.rows[0];

      if (invitationData.status !== 'pending') {
        throw new Error('Invitation is no longer valid');
      }

      if (new Date(invitationData.expires_at) < new Date()) {
        // Mark as expired if it has passed expiration
        await client.query(
          'UPDATE organization_invitations SET status = $1, updated_at = $2 WHERE id = $3',
          ['expired', new Date().toISOString(), invitationData.id]
        );
        throw new Error('Invitation has expired');
      }

      // Verify that the user's email matches the invited email
      const userResult = await client.query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const userEmail = userResult.rows[0].email.toLowerCase();
      const invitedEmail = invitationData.invited_email.toLowerCase();

      if (userEmail !== invitedEmail) {
        throw new Error('This invitation is not for your email address');
      }

      // Check if user is already a member
      const existingMember = await client.query(
        'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [invitationData.organization_id, userId]
      );

      if (existingMember.rows.length > 0) {
        throw new Error('You are already a member of this organization');
      }

      // Add user to organization
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
         VALUES ($1, $2, $3, $4)`,
        [invitationData.organization_id, userId, invitationData.role_id, now]
      );

      // Update invitation status
      await client.query(
        `UPDATE organization_invitations 
         SET status = $1, updated_at = $2 
         WHERE id = $3`,
        ['accepted', now, invitationData.id]
      );

      const userInfo = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [userId]
      );

      const userName = userInfo.rows[0]?.name || 'A new member';

      await ActivityFeedService.createActivity({
        userId,
        organizationId: invitationData.organization_id,
        type: 'invitation_accepted',
        title: `You have joined ${invitationData.organization_name}`,
        description: `You have successfully joined ${invitationData.organization_name} as a ${invitationData.role_name}.`,
        data: {
          organizationName: invitationData.organization_name,
          roleName: invitationData.role_name
        }
      });

      const membersResult = await client.query(
        `SELECT om.user_id
         FROM organization_members om
         WHERE om.organization_id = $1 AND om.user_id != $2`,
        [invitationData.organization_id, userId]
      );

      for (const member of membersResult.rows) {
        await ActivityFeedService.createActivity({
          userId: member.user_id,
          organizationId: invitationData.organization_id,
          type: 'member_joined',
          title: `${userName} has joined ${invitationData.organization_name}`,
          description: `${userName} has joined the organization as a ${invitationData.role_name}.`,
          data: {
            userId,
            userName,
            organizationName: invitationData.organization_name,
            roleName: invitationData.role_name
          }
        });
      }

      return { organization_id: invitationData.organization_id };
    });
  }

  static async declineInvitation(token: string): Promise<void> {
    const result = await query(
      `SELECT oi.*, org.name as organization_name, u.name as user_name
       FROM organization_invitations oi
       JOIN organizations org ON oi.organization_id = org.id
       LEFT JOIN users u ON u.email = oi.invited_email
       WHERE oi.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invitation not found');
    }

    const invitation = result.rows[0];

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invitation has expired');
    }

    const now = new Date().toISOString();

    await query(
      `UPDATE organization_invitations 
       SET status = $1, updated_at = $2 
       WHERE id = $3`,
      ['declined', now, invitation.id]
    );

    const userName = invitation.user_name || invitation.invited_email;

    await ActivityFeedService.createActivity({
      userId: invitation.inviter_id,
      organizationId: invitation.organization_id,
      type: 'invitation_declined',
      title: `Invitation declined by ${userName}`,
      description: `${userName} has declined the invitation to join ${invitation.organization_name}.`,
      data: {
        invitedEmail: invitation.invited_email,
        userName,
        organizationName: invitation.organization_name
      }
    });
  }

  static async getPendingInvitations(organizationId: string): Promise<InvitationDetails[]> {
    const result = await query(
      `SELECT 
         oi.id,
         oi.organization_id,
         oi.invited_email,
         oi.role_id,
         oi.inviter_id,
         oi.token,
         oi.status,
         oi.expires_at,
         oi.created_at,
         oi.updated_at,
         org.name as organization_name,
         r.name as role_name,
         u.name as inviter_name,
         u.email as inviter_email
       FROM organization_invitations oi
       JOIN organizations org ON oi.organization_id = org.id
       JOIN organization_roles r ON oi.role_id = r.id
       JOIN users u ON oi.inviter_id = u.id
       WHERE oi.organization_id = $1 AND oi.status = 'pending' AND oi.expires_at > NOW()
       ORDER BY oi.created_at DESC`,
      [organizationId]
    );

    return result.rows;
  }

  static async cancelInvitation(invitationId: string): Promise<void> {
    const result = await query(
      `UPDATE organization_invitations 
       SET status = $1, updated_at = $2 
       WHERE id = $3 AND status = 'pending'`,
      ['cancelled', new Date().toISOString(), invitationId]
    );

    if (result.rowCount === 0) {
      throw new Error('Invitation not found or cannot be cancelled');
    }
  }

  static async validateInvitation(token: string): Promise<InvitationDetails> {
    const result = await query(
      `SELECT 
         oi.id,
         oi.organization_id,
         oi.invited_email,
         oi.role_id,
         oi.inviter_id,
         oi.token,
         oi.status,
         oi.expires_at,
         oi.created_at,
         oi.updated_at,
         org.name as organization_name,
         r.name as role_name,
         u.name as inviter_name,
         u.email as inviter_email
       FROM organization_invitations oi
       JOIN organizations org ON oi.organization_id = org.id
       JOIN organization_roles r ON oi.role_id = r.id
       JOIN users u ON oi.inviter_id = u.id
       WHERE oi.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invitation not found');
    }

    const invitation = result.rows[0];

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invitation has expired');
    }

    return invitation;
  }

  static async getInvitationById(invitationId: string): Promise<InvitationDetails> {
    const result = await query(
      `SELECT 
         oi.id,
         oi.organization_id,
         oi.invited_email,
         oi.role_id,
         oi.inviter_id,
         oi.token,
         oi.status,
         oi.expires_at,
         oi.created_at,
         oi.updated_at,
         org.name as organization_name,
         r.name as role_name,
         u.name as inviter_name,
         u.email as inviter_email
       FROM organization_invitations oi
       JOIN organizations org ON oi.organization_id = org.id
       JOIN organization_roles r ON oi.role_id = r.id
       JOIN users u ON oi.inviter_id = u.id
       WHERE oi.id = $1`,
      [invitationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Invitation not found');
    }

    return result.rows[0];
  }
}
