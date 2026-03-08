import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Preservation Property Tests - Organizations API
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests verify that existing functionality remains unchanged when we fix
 * the response structure bug. They test authentication, database queries, error
 * handling, and other endpoints to ensure no regressions are introduced.
 * 
 * IMPORTANT: These tests are run on UNFIXED code BEFORE implementing the fix.
 * They should PASS on unfixed code, confirming baseline behavior to preserve.
 * After the fix is implemented, these tests should still PASS, proving that
 * existing functionality was not broken.
 * 
 * Property 2: Preservation - Existing Functionality Unchanged
 * 
 * For any API behavior that is NOT the response structure of GET /api/organizations/
 * endpoint, the fixed code SHALL produce exactly the same behavior as the original code.
 */

describe('Organizations API - Preservation Properties', () => {
  let testUserId: string;
  let testOrgId: string;
  let authToken: string;
  let secondUserId: string;
  let secondOrgId: string;

  beforeAll(async () => {
    // Create first test user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-preservation-1@example.com', 'hashed-password', 'user', 'Test User 1']
    );
    testUserId = userResult.rows[0].id;

    // Create second test user
    const user2Result = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-preservation-2@example.com', 'hashed-password', 'user', 'Test User 2']
    );
    secondUserId = user2Result.rows[0].id;

    // Create first test organization
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['Test Org Preservation 1', 'test-org-preservation-1', testUserId]
    );
    testOrgId = orgResult.rows[0].id;

    // Create second test organization
    const org2Result = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['Test Org Preservation 2', 'test-org-preservation-2', secondUserId]
    );
    secondOrgId = org2Result.rows[0].id;

    // Add first user as member of first organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [testOrgId, testUserId, 'owner']
    );

    // Add second user as member of second organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [secondOrgId, secondUserId, 'owner']
    );

    // Create test data for statistics
    // Add VPS instances to first org
    await query(
      `INSERT INTO vps_instances (organization_id, label, status, plan_id, provider_instance_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Test VPS 1', 'active', 'test-plan-1', 'test-provider-1']
    );
    await query(
      `INSERT INTO vps_instances (organization_id, label, status, plan_id, provider_instance_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Test VPS 2', 'active', 'test-plan-2', 'test-provider-2']
    );

    // Add support tickets to first org
    await query(
      `INSERT INTO support_tickets (organization_id, created_by, subject, message, status, priority, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [testOrgId, testUserId, 'Test Ticket 1', 'Test Description 1', 'open', 'medium', 'technical']
    );
    await query(
      `INSERT INTO support_tickets (organization_id, created_by, subject, message, status, priority, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [testOrgId, testUserId, 'Test Ticket 2', 'Test Description 2', 'closed', 'low', 'billing']
    );
    await query(
      `INSERT INTO support_tickets (organization_id, created_by, subject, message, status, priority, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [testOrgId, testUserId, 'Test Ticket 3', 'Test Description 3', 'open', 'high', 'technical']
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
    if (secondOrgId) {
      await query('DELETE FROM organization_members WHERE organization_id = $1', [secondOrgId]);
      await query('DELETE FROM organizations WHERE id = $1', [secondOrgId]);
    }
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (secondUserId) {
      await query('DELETE FROM users WHERE id = $1', [secondUserId]);
    }
  });

  /**
   * Property 2.1: Authentication Preservation
   * 
   * **Validates: Requirement 3.1**
   * 
   * Verifies that authentication middleware continues to validate JWT tokens
   * and reject unauthorized requests. This tests multiple authentication scenarios
   * to ensure the authentication logic remains unchanged.
   */
  describe('Property 2.1: Authentication Preservation', () => {
    it('should reject requests without authentication token', async () => {
      const res = await request(app)
        .get('/api/organizations/');

      // Should return 401 Unauthorized
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject requests with invalid authentication token', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', 'Bearer invalid-token-12345');

      // Should return 401 or 403
      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject requests with malformed authentication header', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', 'InvalidFormat token');

      // Should return 401 or 403 (observed behavior: 403)
      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    });

    it('should accept requests with valid authentication token', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${authToken}`);

      // Should return 200 OK (authentication passed)
      expect(res.status).toBe(200);
    });

    it('should reject requests with expired token format', async () => {
      // Create a token with very short expiration
      const expiredToken = jwt.sign(
        { userId: testUserId, exp: Math.floor(Date.now() / 1000) - 3600 },
        config.JWT_SECRET
      );

      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${expiredToken}`);

      // Should return 401 or 403
      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
    });
  });

  /**
   * Property 2.2: Database Query Preservation
   * 
   * **Validates: Requirement 3.2**
   * 
   * Verifies that database queries for vps_count, ticket_count, and member_count
   * continue to execute correctly and produce accurate results. Tests multiple
   * scenarios with different data configurations.
   */
  describe('Property 2.2: Database Query Preservation', () => {
    it('should calculate vps_count correctly', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      // Find the test organization in the response
      // Note: On unfixed code, this is a direct array; on fixed code, it's wrapped
      const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
      const org = orgs.find((o: any) => o.id === testOrgId);

      expect(org).toBeDefined();
      expect(org.stats).toBeDefined();
      expect(org.stats.vps_count).toBe(2); // We created 2 VPS instances
    });

    it('should calculate ticket_count correctly', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
      const org = orgs.find((o: any) => o.id === testOrgId);

      expect(org).toBeDefined();
      expect(org.stats).toBeDefined();
      expect(org.stats.ticket_count).toBe(3); // We created 3 support tickets
    });

    it('should calculate member_count correctly', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
      const org = orgs.find((o: any) => o.id === testOrgId);

      expect(org).toBeDefined();
      expect(org.stats).toBeDefined();
      expect(org.stats.member_count).toBe(1); // Only the owner is a member
    });

    it('should handle organizations with zero resources correctly', async () => {
      // Second org has no VPS instances or tickets
      const secondAuthToken = jwt.sign({ userId: secondUserId }, config.JWT_SECRET);

      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${secondAuthToken}`);

      expect(res.status).toBe(200);

      const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
      const org = orgs.find((o: any) => o.id === secondOrgId);

      expect(org).toBeDefined();
      expect(org.stats).toBeDefined();
      expect(org.stats.vps_count).toBe(0);
      expect(org.stats.ticket_count).toBe(0);
      expect(org.stats.member_count).toBe(1); // Only the owner
    });

    it('should return all organization properties correctly', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
      const org = orgs.find((o: any) => o.id === testOrgId);

      expect(org).toBeDefined();
      expect(org).toHaveProperty('id');
      expect(org).toHaveProperty('name');
      expect(org).toHaveProperty('slug');
      expect(org).toHaveProperty('member_role');
      expect(org).toHaveProperty('stats');
      expect(org.name).toBe('Test Org Preservation 1');
      expect(org.slug).toBe('test-org-preservation-1');
    });
  });

  /**
   * Property 2.3: Error Handling Preservation
   * 
   * **Validates: Requirement 3.3**
   * 
   * Verifies that error handling continues to return 500 status with error message
   * on failures. Tests various error scenarios to ensure error handling logic
   * remains unchanged.
   */
  describe('Property 2.3: Error Handling Preservation', () => {
    it('should return error object structure on authentication failure', async () => {
      const res = await request(app)
        .get('/api/organizations/')
        .set('Authorization', 'Bearer invalid-token');

      expect([401, 403]).toContain(res.status);
      expect(res.body).toBeTypeOf('object');
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('should return error object structure on missing authentication', async () => {
      const res = await request(app)
        .get('/api/organizations/');

      expect(res.status).toBe(401);
      expect(res.body).toBeTypeOf('object');
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('should handle malformed UUID in other endpoints with error object', async () => {
      const res = await request(app)
        .get('/api/organizations/invalid-uuid/members')
        .set('Authorization', `Bearer ${authToken}`);

      // Should return error status (observed behavior: 500 for invalid UUID)
      expect([400, 500]).toContain(res.status);
      expect(res.body).toBeTypeOf('object');
      expect(res.body).toHaveProperty('error');
    });
  });

  /**
   * Property 2.4: Other Endpoints Preservation
   * 
   * **Validates: Requirement 3.5**
   * 
   * Verifies that other organization endpoints continue to use their existing
   * response structures. Tests multiple endpoints to ensure they are unaffected
   * by the fix to the main organizations list endpoint.
   */
  describe('Property 2.4: Other Endpoints Preservation', () => {
    it('should preserve /api/organizations/resources endpoint response structure', async () => {
      const res = await request(app)
        .get('/api/organizations/resources')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      
      // This endpoint returns a direct array of resources
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        const resource = res.body[0];
        expect(resource).toHaveProperty('organization_id');
        expect(resource).toHaveProperty('organization_name');
        expect(resource).toHaveProperty('permissions');
        expect(resource).toHaveProperty('vps_instances');
        expect(resource).toHaveProperty('tickets');
      }
    });

    it('should preserve /api/organizations/:id/members endpoint response structure', async () => {
      const res = await request(app)
        .get(`/api/organizations/${testOrgId}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      
      // This endpoint returns a direct array of members
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const member = res.body[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('joined_at');
    });

    it('should preserve /api/organizations/:id/roles endpoint response structure', async () => {
      const res = await request(app)
        .get(`/api/organizations/${testOrgId}/roles`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      
      // This endpoint returns a direct array of roles
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should preserve authentication requirements for all endpoints', async () => {
      // Test that other endpoints still require authentication
      const endpoints = [
        '/api/organizations/resources',
        `/api/organizations/${testOrgId}/members`,
        `/api/organizations/${testOrgId}/roles`
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
      }
    });
  });

  /**
   * Property 2.5: Response Consistency Across Multiple Requests
   * 
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Verifies that the API returns consistent results across multiple requests,
   * ensuring that database queries and authentication logic are stable and
   * deterministic.
   */
  describe('Property 2.5: Response Consistency', () => {
    it('should return consistent results across multiple requests', async () => {
      const responses = [];

      // Make 5 requests to the same endpoint
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/api/organizations/')
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(res.status).toBe(200);
        responses.push(res.body);
      }

      // All responses should have the same structure and data
      for (let i = 1; i < responses.length; i++) {
        const orgs1 = Array.isArray(responses[0]) ? responses[0] : responses[0].organizations;
        const orgs2 = Array.isArray(responses[i]) ? responses[i] : responses[i].organizations;
        
        expect(orgs1.length).toBe(orgs2.length);
        
        // Find matching organizations and compare stats
        const org1 = orgs1.find((o: any) => o.id === testOrgId);
        const org2 = orgs2.find((o: any) => o.id === testOrgId);
        
        expect(org1.stats.vps_count).toBe(org2.stats.vps_count);
        expect(org1.stats.ticket_count).toBe(org2.stats.ticket_count);
        expect(org1.stats.member_count).toBe(org2.stats.member_count);
      }
    });

    it('should maintain data integrity across concurrent requests', async () => {
      // Make multiple concurrent requests
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/organizations/')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // All should return the same data
      const firstOrgs = Array.isArray(responses[0].body) 
        ? responses[0].body 
        : responses[0].body.organizations;
      const firstOrg = firstOrgs.find((o: any) => o.id === testOrgId);

      responses.forEach(res => {
        const orgs = Array.isArray(res.body) ? res.body : res.body.organizations;
        const org = orgs.find((o: any) => o.id === testOrgId);
        
        expect(org.stats.vps_count).toBe(firstOrg.stats.vps_count);
        expect(org.stats.ticket_count).toBe(firstOrg.stats.ticket_count);
        expect(org.stats.member_count).toBe(firstOrg.stats.member_count);
      });
    });
  });
});
