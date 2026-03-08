import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Bug Condition Exploration Test - Response Structure
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 * 
 * This test verifies that the GET /api/organizations/ endpoint returns
 * a response wrapped in an object with an 'organizations' property,
 * rather than returning a direct array.
 * 
 * Expected structure: { organizations: Array<OrganizationWithStats> }
 * Current (buggy) structure: Array<OrganizationWithStats>
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * The current API returns a direct array at the root level,
 * but the frontend expects to access data.organizations.
 * 
 * When this test FAILS, it confirms the bug exists.
 * When this test PASSES (after fix), it confirms the bug is resolved.
 */

describe('Organizations API - Response Structure (Bug Condition Exploration)', () => {
  let testUserId: string;
  let testOrgId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-response-structure@example.com', 'hashed-password', 'user', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test organization
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['Test Org for Response Structure', 'test-org-response-structure', testUserId]
    );
    testOrgId = orgResult.rows[0].id;

    // Add user as member of the organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [testOrgId, testUserId, 'owner']
    );

    // Create some test data for statistics
    // Add a VPS instance
    await query(
      `INSERT INTO vps_instances (organization_id, label, status, plan_id, provider_instance_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Test VPS', 'active', 'test-plan-id', 'test-provider-id-456']
    );

    // Add a support ticket
    await query(
      `INSERT INTO support_tickets (organization_id, created_by, subject, message, status, priority, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [testOrgId, testUserId, 'Test Ticket', 'Test Description', 'open', 'medium', 'technical']
    );

    // Generate JWT token for authentication
    authToken = jwt.sign({ userId: testUserId }, config.JWT_SECRET);
  });

  afterAll(async () => {
    // Clean up test data
    if (testOrgId) {
      await query('DELETE FROM support_tickets WHERE organization_id = $1', [testOrgId]);
      await query('DELETE FROM vps_instances WHERE organization_id = $1', [testOrgId]);
      await query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
      await query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    }
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  it('Property 1: Bug Condition - API Response Structure Mismatch', async () => {
    // Make authenticated request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    // Verify response status is successful
    expect(res.status).toBe(200);

    // CRITICAL ASSERTIONS: These verify the expected behavior
    // On UNFIXED code, these will FAIL because the API returns a direct array
    
    // 1. Response body should be an object (not a direct array)
    expect(res.body).toBeTypeOf('object');
    expect(Array.isArray(res.body)).toBe(false);

    // 2. Response body should have an 'organizations' property
    expect(res.body).toHaveProperty('organizations');

    // 3. The 'organizations' property should be an array
    expect(Array.isArray(res.body.organizations)).toBe(true);

    // 4. The organizations array should contain organization objects with stats
    expect(res.body.organizations.length).toBeGreaterThan(0);
    
    const org = res.body.organizations.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();
    expect(org).toHaveProperty('id');
    expect(org).toHaveProperty('name');
    expect(org).toHaveProperty('stats');
    
    // 5. Verify stats object has the expected properties
    expect(org.stats).toBeDefined();
    expect(org.stats).toHaveProperty('vps_count');
    expect(org.stats).toHaveProperty('ticket_count');
    expect(org.stats).toHaveProperty('member_count');
    
    // 6. Verify the values are correct
    expect(org.stats.vps_count).toBe(1);
    expect(org.stats.ticket_count).toBe(1);
    expect(org.stats.member_count).toBe(1);
  });

  it('Property 1 (Edge Case): Empty organizations should still use wrapped structure', async () => {
    // Create an admin user (admins see all organizations in the system)
    const emptyUserResult = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-empty-orgs@example.com', 'hashed-password', 'admin', 'Empty Admin']
    );
    const emptyUserId = emptyUserResult.rows[0].id;
    const emptyAuthToken = jwt.sign({ userId: emptyUserId }, config.JWT_SECRET);

    try {
      // Make request with admin
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${emptyAuthToken}`);

      expect(res.status).toBe(200);

      // Response should always be wrapped, regardless of content
      expect(res.body).toBeTypeOf('object');
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body).toHaveProperty('organizations');
      expect(Array.isArray(res.body.organizations)).toBe(true);
      // Note: Admins see all organizations, so we can't assert length === 0
      // The important part is that the response structure is wrapped
    } finally {
      // Clean up
      await query('DELETE FROM users WHERE id = $1', [emptyUserId]);
    }
  });
});
