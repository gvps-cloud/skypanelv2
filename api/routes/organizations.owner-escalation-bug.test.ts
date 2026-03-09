/**
 * Bug Condition Exploration Test - Organization Owner Privilege Escalation
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4**
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * - Test failure (assertions fail) = Bug exists (CORRECT - this is what we want to see)
 * - Test passes = Bug does not exist (UNEXPECTED - may indicate incorrect root cause)
 * 
 * This test explores the bug condition where non-owner users (admins, members with
 * permissions) can escalate their role or another member's role to "owner" through
 * the PUT /api/organizations/:id/members/:userId endpoint.
 * 
 * The test encodes the EXPECTED BEHAVIOR (403 Forbidden for non-owners attempting
 * to escalate to owner). When run on unfixed code, it will fail because the current
 * implementation allows the escalation (returns 200 OK instead of 403).
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
const TEST_ORG_PREFIX = 'bug-test-org-';
const TEST_USER_PREFIX = 'bug-test-user-';

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
  await query(`DELETE FROM organization_members WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE $1
  )`, [`${TEST_ORG_PREFIX}%`]);
  
  await query(`DELETE FROM organization_roles WHERE organization_id IN (
    SELECT id FROM organizations WHERE name LIKE $1
  )`, [`${TEST_ORG_PREFIX}%`]);
  
  await query(`DELETE FROM organizations WHERE name LIKE $1`, [`${TEST_ORG_PREFIX}%`]);
  await query(`DELETE FROM users WHERE email LIKE $1`, [`${TEST_USER_PREFIX}%`]);
}

describe('Bug Condition Exploration: Owner-Only Ownership Transfer', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  /**
   * Property 1: Bug Condition - Owner-Only Ownership Transfer
   * 
   * Test Case 1: Admin user attempts to update their own role to owner
   * 
   * EXPECTED BEHAVIOR: 403 Forbidden with message "Only the organization owner can transfer ownership"
   * ACTUAL BEHAVIOR (unfixed): 200 OK - escalation succeeds (BUG)
   */
  it('should reject admin self-escalation to owner with 403 Forbidden', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner@example.com`,
      'Owner User'
    );
    const adminId = await createTestUser(
      `${TEST_USER_PREFIX}admin@example.com`,
      'Admin User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}admin-self-escalate`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(adminId, orgId, adminRoleId);

    // Act: Admin attempts to escalate their own role to owner
    const adminToken = generateToken(adminId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: ownerRoleId });

    // Assert: Should receive 403 Forbidden (but will get 200 OK on unfixed code)
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the organization owner can transfer ownership');
  });

  /**
   * Test Case 2: Admin user attempts to update another member's role to owner
   * 
   * EXPECTED BEHAVIOR: 403 Forbidden with message "Only the organization owner can transfer ownership"
   * ACTUAL BEHAVIOR (unfixed): 200 OK - escalation succeeds (BUG)
   */
  it('should reject admin escalating another member to owner with 403 Forbidden', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner2@example.com`,
      'Owner User'
    );
    const adminId = await createTestUser(
      `${TEST_USER_PREFIX}admin2@example.com`,
      'Admin User'
    );
    const memberId = await createTestUser(
      `${TEST_USER_PREFIX}member@example.com`,
      'Member User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId, adminRoleId, memberRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}admin-escalate-other`,
      ownerId
    );

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(adminId, orgId, adminRoleId);
    await addUserToOrganization(memberId, orgId, memberRoleId);

    // Act: Admin attempts to escalate another member to owner
    const adminToken = generateToken(adminId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${memberId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: ownerRoleId });

    // Assert: Should receive 403 Forbidden (but will get 200 OK on unfixed code)
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the organization owner can transfer ownership');
  });

  /**
   * Test Case 3: Member with custom role having members_manage permission attempts to escalate to owner
   * 
   * EXPECTED BEHAVIOR: 403 Forbidden with message "Only the organization owner can transfer ownership"
   * ACTUAL BEHAVIOR (unfixed): May succeed if they have sufficient permissions (BUG)
   */
  it('should reject custom role with members_manage permission escalating to owner with 403 Forbidden', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner3@example.com`,
      'Owner User'
    );
    const customUserId = await createTestUser(
      `${TEST_USER_PREFIX}custom@example.com`,
      'Custom Role User'
    );

    // Create organization with owner
    const { orgId, ownerRoleId } = await createTestOrganization(
      `${TEST_ORG_PREFIX}custom-role-escalate`,
      ownerId
    );

    // Create custom role with members_manage permission
    const customRoleResult = await query(
      `INSERT INTO organization_roles (organization_id, name, permissions, created_at, updated_at)
       VALUES ($1, 'custom-manager', $2, NOW(), NOW())
       RETURNING id`,
      [orgId, JSON.stringify({ members_manage: true })]
    );
    const customRoleId = customRoleResult.rows[0].id;

    await addUserToOrganization(ownerId, orgId, ownerRoleId);
    await addUserToOrganization(customUserId, orgId, customRoleId);

    // Act: Custom role user attempts to escalate to owner
    const customToken = generateToken(customUserId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${customUserId}`)
      .set('Authorization', `Bearer ${customToken}`)
      .send({ roleId: ownerRoleId });

    // Assert: Should receive 403 Forbidden (but may get 200 OK on unfixed code)
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the organization owner can transfer ownership');
  });

  /**
   * Test Case 4: Legacy role system - Admin attempts to escalate using legacy 'role' field
   * 
   * EXPECTED BEHAVIOR: 403 Forbidden with message "Only the organization owner can transfer ownership"
   * ACTUAL BEHAVIOR (unfixed): 200 OK - escalation succeeds (BUG)
   */
  it('should reject admin escalation to owner using legacy role field with 403 Forbidden', async () => {
    // Setup: Create users first
    const ownerId = await createTestUser(
      `${TEST_USER_PREFIX}owner4@example.com`,
      'Owner User'
    );
    const adminId = await createTestUser(
      `${TEST_USER_PREFIX}admin4@example.com`,
      'Admin User'
    );

    // Create organization with legacy role system
    const slug = `${TEST_ORG_PREFIX}legacy-escalate`.toLowerCase().replace(/\s+/g, '-');
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [`${TEST_ORG_PREFIX}legacy-escalate`, slug, ownerId]
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
       VALUES ($1, $2, 'admin', NOW())`,
      [orgId, adminId]
    );

    // Act: Admin attempts to escalate using legacy role field
    const adminToken = generateToken(adminId);
    const response = await request(app)
      .put(`/api/organizations/${orgId}/members/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'owner' });

    // Assert: Should receive 403 Forbidden (but will get 200 OK on unfixed code)
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Only the organization owner can transfer ownership');
  });

  /**
   * Property-Based Test: Non-owner users cannot escalate to owner role
   * 
   * This test generates various combinations of non-owner roles attempting to
   * escalate to owner and verifies all receive 403 Forbidden.
   * 
   * Note: Only tests admin role since member role doesn't have members_manage permission
   */
  it('property: all non-owner users attempting owner escalation receive 403 Forbidden', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('admin'), // Non-owner roles with members_manage permission
        fc.boolean(), // Self-escalation vs escalating another user
        async (requesterRole, isSelfEscalation) => {
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
          const requesterId = await createTestUser(
            `${TEST_USER_PREFIX}pbt-requester-${Date.now()}-${Math.random()}@example.com`,
            'PBT Requester'
          );
          const requesterRoleId = requesterRole === 'admin' ? adminRoleId : memberRoleId;
          await addUserToOrganization(requesterId, orgId, requesterRoleId);

          // Create target user if not self-escalation
          let targetUserId = requesterId;
          if (!isSelfEscalation) {
            targetUserId = await createTestUser(
              `${TEST_USER_PREFIX}pbt-target-${Date.now()}-${Math.random()}@example.com`,
              'PBT Target'
            );
            await addUserToOrganization(targetUserId, orgId, memberRoleId);
          }

          // Act: Attempt escalation
          const token = generateToken(requesterId);
          const response = await request(app)
            .put(`/api/organizations/${orgId}/members/${targetUserId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ roleId: ownerRoleId });

          // Assert: Should always receive 403 Forbidden
          expect(response.status).toBe(403);
          expect(response.body.error).toBe('Only the organization owner can transfer ownership');

          // Cleanup - delete in correct order to avoid foreign key violations
          await query(`DELETE FROM activity_feed WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organization_roles WHERE organization_id = $1`, [orgId]);
          await query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
          await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [ownerId, requesterId, targetUserId]);
        }
      ),
      { numRuns: 10 } // Run 10 random test cases
    );
  }, 15000); // 15 second timeout for property-based test
});
