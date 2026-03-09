/**
 * Preservation Property Tests - Organization Role Management
 * 
 * **Validates: Requirements 3.1, 3.2, 3.5, 3.6**
 * 
 * IMPORTANT: These tests run on UNFIXED code to establish baseline behavior.
 * - Tests PASSING on unfixed code = Baseline behavior documented (CORRECT)
 * - Tests FAILING after fix = Regression introduced (CRITICAL ISSUE)
 * 
 * These tests verify that non-owner role management functionality continues to work
 * exactly as before after the ownership escalation fix is implemented. They capture
 * the behavior that must be preserved:
 * - Owner updating member roles to admin, member, or custom roles
 * - Admin updating member roles to non-owner roles
 * - Last owner demotion prevention
 * - Activity feed entries for role updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../lib/database.js';
import organizationsRouter from './organizations.js';
import { authenticateToken } from '../middleware/auth.js';
import fc from 'fast-check';

// Test configuration
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const TEST_ORG_PREFIX = 'preserve-test-org-';
const TEST_USER_PREFIX = 'preserve-test-user-';

// Test app setup
let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(authenticateToken);
  app.use('/api/organizations', organizationsRouter);
});

// Helper to generate JWT token
function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

// Helper to create test organization (roles are auto-seeded by trigger)
async function createTestOrganization(orgName: string, ownerId: string) {
  const slug = orgName.toLowerCase().replace(/\s+/g, '-');
  const orgResult = await query(
    `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [orgName, slug, ownerId]
  );
  const orgId = orgResult.rows[0].id;

  // Fetch the auto-seeded roles
  const rolesResult = await query(
    `SELECT id, name FROM organization_roles WHERE organization_id = $1`,
    [orgId]
  );

  const roles: Record<string, string> = {};
  rolesResult.rows.forEach((row: { id: string; name: string }) => {
    roles[row.name] = row.id;
  });

  return {
    orgId,
    ownerRoleId: roles['owner'],
    adminRoleId: roles['admin'],
    memberRoleId: roles['viewer'], // Using viewer as the basic member role
  };
}

// Helper to create test user
async function createTestUser(email: string, name: string) {
  const userResult = await query(
    `INSERT INTO users (email, name, password_hash, created_at, updated_at)
     VALUES ($1, $2, 'hashed-password', NOW(), NOW())
     RETURNING id`,
    [email, name]
  );
  return userResult.rows[0].id;
}

// Helper to add user to organization with role
async function addUserToOrganization(userId: string, orgId: string, roleId: string) {
  await query(
    `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [orgId, userId, roleId]
  );
}

// Cleanup helper
async function cleanupTestData() {
  await query(`DELETE FROM activity_feed WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE $1
  )`, [`${TEST_ORG_PREFIX}%`]);
  
  await query(`DELETE FROM organization_members WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE $1
  )`, [`${TEST_ORG_PREFIX}%`]);
  
  await query(`DELETE FROM organization_roles WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE $1
  )`, [`${TEST_ORG_PREFIX}%`]);
  
  await query(`DELETE FROM organizations WHERE name LIKE $1`, [`${TEST_ORG_PREFIX}%`]);
  await query(`DELETE FROM users WHERE email LIKE $1`, [`${TEST_USER_PREFIX}%`]);
}

describe('Preservation Property: Non-Owner Role Management', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  /**
   * Property 2: Preservation - Non-Owner Role Management
   * 
   * Test Case 1: Owner updating member roles to admin
   * 
   * EXPECTED BEHAVIOR: 200 OK - role update succeeds
   * This behavior must be preserved after the fix
   */
  it('should allow owner to update member role to admin', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner-update-admin@example.com`,
      'Owner User'
    );
    const memberId = await createTestUser(
      `${TEST_USER_PREFIX}member-to-admin@example.com`,
      'Member User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}owner-update-admin`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(memberId, orgId, memberRoleId);

    // Act: Owner updates member to admin
    const ownerToken = generateToken(ownerId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roleId: adminRoleId });

    // Assert: Should succeed with 200 OK
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Member role updated');

    // Verify role was updated in database
    const memberCheck = await query(
      `SELECT role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, memberId]
    );
    expect(memberCheck.rows[0].role_id).toBe(adminRoleId);
  });

  /**
   * Test Case 2: Owner updating admin role to member
   * 
   * EXPECTED BEHAVIOR: 200 OK - role update succeeds
   * This behavior must be preserved after the fix
   */
  it('should allow owner to demote admin to member', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner-demote-admin@example.com`,
      'Owner User'
    );
    const adminId = await createTestUser(
      `${TEST_USER_PREFIX}admin-to-member@example.com`,
      'Admin User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}owner-demote-admin`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(adminId, orgId, adminRoleId);

    // Act: Owner demotes admin to member
    const ownerToken = generateToken(ownerId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${adminId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roleId: memberRoleId });

    // Assert: Should succeed with 200 OK
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Member role updated');

    // Verify role was updated in database
    const memberCheck = await query(
      `SELECT role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, adminId]
    );
    expect(memberCheck.rows[0].role_id).toBe(memberRoleId);
  });

  /**
   * Test Case 3: Admin updating member role to admin
   * 
   * EXPECTED BEHAVIOR: 200 OK - role update succeeds
   * This behavior must be preserved after the fix
   */
  it('should allow admin to update member role to admin', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner-admin-update@example.com`,
      'Owner User'
    );
    const adminId = await createTestUser(
      `${TEST_USER_PREFIX}admin-update@example.com`,
      'Admin User'
    );
    const memberId = await createTestUser(
      `${TEST_USER_PREFIX}member-to-admin2@example.com`,
      'Member User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}admin-update-member`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(adminId, orgId, adminRoleId);
    await addUserToOrganization(memberId, orgId, memberRoleId);

    // Act: Admin updates member to admin
    const adminToken = generateToken(adminId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: adminRoleId });

    // Assert: Should succeed with 200 OK
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Member role updated');

    // Verify role was updated in database
    const memberCheck = await query(
      `SELECT role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, memberId]
    );
    expect(memberCheck.rows[0].role_id).toBe(adminRoleId);
  });

  /**
   * Test Case 4: Last owner attempting to demote themselves
   * 
   * EXPECTED BEHAVIOR: 400 Bad Request - "Cannot demote the last owner"
   * This behavior must be preserved after the fix
   */
  it('should reject last owner attempting to demote themselves', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}last-owner@example.com`,
      'Last Owner User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}last-owner-demote`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);

    // Act: Last owner attempts to demote themselves
    const ownerToken = generateToken(ownerId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roleId: adminRoleId });

    // Assert: Should be rejected with 400 Bad Request
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Cannot demote the last owner');
  });

  /**
   * Test Case 5: Activity feed entries created for role updates
   * 
   * EXPECTED BEHAVIOR: Activity feed entry is created when role is updated
   * This behavior must be preserved after the fix
   */
  it('should create activity feed entry when role is updated', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner-activity@example.com`,
      'Owner User'
    );
    const memberId = await createTestUser(
      `${TEST_USER_PREFIX}member-activity@example.com`,
      'Member User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}activity-feed`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(memberId, orgId, memberRoleId);

    // Act: Owner updates member to admin
    const ownerToken = generateToken(ownerId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ roleId: adminRoleId });

    // Assert: Should succeed
    expect(response.status).toBe(200);

    // Verify activity feed entry was created
    const activityCheck = await query(
      `SELECT * FROM activity_feed 
       WHERE user_id = $1 AND organization_id = $2 AND type = 'role_updated'
       ORDER BY created_at DESC LIMIT 1`,
      [memberId, orgId]
    );

    expect(activityCheck.rows.length).toBeGreaterThan(0);
    const activity = activityCheck.rows[0];
    expect(activity.type).toBe('role_updated');
    expect(activity.data).toBeDefined();
  });

  /**
   * Test Case 6: Legacy role system - Owner updating member using legacy 'role' field
   * 
   * EXPECTED BEHAVIOR: 200 OK - role update succeeds
   * This behavior must be preserved after the fix
   */
  it('should allow owner to update member role using legacy role field', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner-legacy@example.com`,
      'Owner User'
    );
    const memberId = await createTestUser(
      `${TEST_USER_PREFIX}member-legacy@example.com`,
      'Member User'
    );

    // Create organization with legacy role system
    const slug = `${TEST_ORG_PREFIX}legacy-update`.toLowerCase().replace(/\s+/g, '-');
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [`${TEST_ORG_PREFIX}legacy-update`, slug, ownerId]
    );
    const orgId = orgResult.rows[0].id;

    // Add users with legacy role field
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, 'owner', NOW())`,
      [orgId, ownerId]
    );
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, 'member', NOW())`,
      [orgId, memberId]
    );

    // Act: Owner updates member to admin using legacy role field
    const ownerToken = generateToken(ownerId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'admin' });

    // Assert: Should succeed with 200 OK
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Member role updated');

    // Verify role was updated in database
    const memberCheck = await query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, memberId]
    );
    expect(memberCheck.rows[0].role).toBe('admin');
  });

  /**
   * Property-Based Test: Non-owner role updates preserve existing behavior
   * 
   * This test generates various combinations of non-owner role updates and verifies
   * they all succeed as expected (200 OK).
   */
  it('property: all non-owner role updates succeed with 200 OK', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('owner', 'admin'), // Requester roles that can update roles
        fc.constantFrom('admin', 'member'), // Target roles (non-owner)
        async (requesterRole, targetRole) => {
          // Setup: Create users first
          const ownerId = await createTestUser(
            `${TEST_USER_PREFIX}pbt-owner-${Date.now()}-${Math.random()}@example.com`,
            'PBT Owner'
          );

          // Create organization
          const orgName = `${TEST_ORG_PREFIX}pbt-${Date.now()}-${Math.random()}`;
          const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(orgName, ownerId);

          await addUserToOrganization(ownerId, orgId, ownerRoleId);

          // Create requester with specified role
          let requesterId = ownerId;
          if (requesterRole === 'admin') {
            requesterId = await createTestUser(
              `${TEST_USER_PREFIX}pbt-requester-${Date.now()}-${Math.random()}@example.com`,
              'PBT Requester'
            );
            await addUserToOrganization(requesterId, orgId, adminRoleId);
          }

          // Create target user
          const targetUserId = await createTestUser(
            `${TEST_USER_PREFIX}pbt-target-${Date.now()}-${Math.random()}@example.com`,
            'PBT Target'
          );
          await addUserToOrganization(targetUserId, orgId, memberRoleId);

          // Act: Update to non-owner role
          const targetRoleId = targetRole === 'admin' ? adminRoleId : memberRoleId;
          const token = generateToken(requesterId);
          const response = await request(app)
            .put(`/api/organizations/${orgId}/members/${targetUserId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ roleId: targetRoleId });

          // Assert: Should always succeed with 200 OK
          expect(response.status).toBe(200);
          expect(response.body.message).toBe('Member role updated');

          // Verify role was updated in database
          const memberCheck = await query(
            `SELECT role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
            [orgId, targetUserId]
          );
          expect(memberCheck.rows[0].role_id).toBe(targetRoleId);

          // Cleanup
          await query(`DELETE FROM activity_feed WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organization_roles WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
          await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [ownerId, requesterId, targetUserId]);
        }
      ),
      { numRuns: 5 } // Run 5 random test cases
    );
  }, 15000); // 15 second timeout for property-based test
});
