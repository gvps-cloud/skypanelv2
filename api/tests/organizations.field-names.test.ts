import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Bug Condition Exploration Test - Integration Test
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * This test verifies that the GET /api/organizations/ endpoint returns
 * statistics with field names that match the TypeScript OrganizationStats interface.
 * 
 * Expected field names (singular):
 * - ticket_count
 * - member_count
 * - vps_count
 * 
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * The current API returns plural field names (tickets_count, members_count)
 * which causes a mismatch with the frontend TypeScript interface.
 * 
 * When this test FAILS, it confirms the bug exists.
 * When this test PASSES (after fix), it confirms the bug is resolved.
 */

describe('Organizations API - Field Name Consistency (Integration Test)', () => {
  let testUserId: string;
  let testOrgId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-field-names@example.com', 'hashed-password', 'user', 'Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test organization
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      ['Test Org for Field Names', 'test-org-field-names', testUserId]
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
      [testOrgId, 'Test VPS', 'active', 'test-plan-id', 'test-provider-id-123']
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

  it('Property 1: Bug Condition - API returns statistics with singular field names matching TypeScript interface', async () => {
    // Make request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    // Verify response status
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);

    // Find our test organization in the response
    const org = res.body.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();

    // Verify the organization has a stats object
    expect(org).toHaveProperty('stats');
    expect(org.stats).toBeDefined();

    // CRITICAL ASSERTIONS: Verify field names match TypeScript OrganizationStats interface
    // These assertions will FAIL on unfixed code because the API returns plural field names
    
    // Check for singular field names (expected behavior)
    expect(org.stats).toHaveProperty('ticket_count');
    expect(org.stats).toHaveProperty('member_count');
    expect(org.stats).toHaveProperty('vps_count');

    // Verify the values are numbers
    expect(typeof org.stats.ticket_count).toBe('number');
    expect(typeof org.stats.member_count).toBe('number');
    expect(typeof org.stats.vps_count).toBe('number');

    // Verify the values match what we created (1 VPS, 1 ticket, 1 member)
    expect(org.stats.vps_count).toBe(1);
    expect(org.stats.ticket_count).toBe(1);
    expect(org.stats.member_count).toBe(1);

    // Additional check: Ensure plural field names are NOT present
    // (This documents the bug - the API currently returns these)
    expect(org.stats).not.toHaveProperty('tickets_count');
    expect(org.stats).not.toHaveProperty('members_count');
  });
});

/**
 * Preservation Property Tests - Integration Test
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * These tests verify that non-buggy fields remain unchanged when we fix
 * the field name mismatch for ticket_count and member_count.
 * 
 * Fields to preserve:
 * - vps_count (already correctly named)
 * - id, name, slug (organization metadata)
 * - member_role, role_permissions (membership data)
 * 
 * IMPORTANT: These tests should PASS on unfixed code.
 * They establish the baseline behavior that must be preserved.
 */

describe('Organizations API - Preservation Properties (Integration Test)', () => {
  let testUserId: string;
  let testOrgId: string;
  let authToken: string;
  const testOrgName = 'Preservation Test Org';
  const testOrgSlug = 'preservation-test-org';

  beforeAll(async () => {
    // Create a test user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      ['test-preservation@example.com', 'hashed-password', 'user', 'Preservation Test User']
    );
    testUserId = userResult.rows[0].id;

    // Create a test organization
    const orgResult = await query(
      `INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [testOrgName, testOrgSlug, testUserId]
    );
    testOrgId = orgResult.rows[0].id;

    // Add user as member of the organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [testOrgId, testUserId, 'owner']
    );

    // Create test data for statistics
    // Add 2 VPS instances
    await query(
      `INSERT INTO vps_instances (organization_id, label, status, plan_id, provider_instance_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Preservation VPS 1', 'active', 'test-plan-id', 'test-provider-id-pres-1']
    );
    await query(
      `INSERT INTO vps_instances (organization_id, label, status, plan_id, provider_instance_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Preservation VPS 2', 'active', 'test-plan-id', 'test-provider-id-pres-2']
    );

    // Generate JWT token for authentication
    authToken = jwt.sign({ userId: testUserId }, config.JWT_SECRET);
  });

  afterAll(async () => {
    // Clean up test data
    if (testOrgId) {
      await query('DELETE FROM vps_instances WHERE organization_id = $1', [testOrgId]);
      await query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
      await query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    }
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  it('Property 2.1: Preservation - vps_count field name remains unchanged', async () => {
    // Make request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    // Find our test organization
    const org = res.body.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();
    expect(org.stats).toBeDefined();

    // CRITICAL: vps_count should exist with correct field name (already correct)
    expect(org.stats).toHaveProperty('vps_count');
    expect(typeof org.stats.vps_count).toBe('number');
    expect(org.stats.vps_count).toBe(2); // We created 2 VPS instances

    // Ensure no alternative naming exists
    expect(org.stats).not.toHaveProperty('vpsCount');
    expect(org.stats).not.toHaveProperty('vps_instances_count');
  });

  it('Property 2.2: Preservation - Organization metadata fields (id, name, slug) remain unchanged', async () => {
    // Make request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    // Find our test organization
    const org = res.body.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();

    // CRITICAL: Verify organization metadata fields are present and correct
    expect(org).toHaveProperty('id');
    expect(org.id).toBe(testOrgId);
    expect(typeof org.id).toBe('string');

    expect(org).toHaveProperty('name');
    expect(org.name).toBe(testOrgName);
    expect(typeof org.name).toBe('string');

    expect(org).toHaveProperty('slug');
    expect(org.slug).toBe(testOrgSlug);
    expect(typeof org.slug).toBe('string');
  });

  it('Property 2.3: Preservation - Membership fields (member_role, role_permissions) remain unchanged', async () => {
    // Make request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    // Find our test organization
    const org = res.body.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();

    // CRITICAL: Verify membership fields are present and correct
    expect(org).toHaveProperty('member_role');
    expect(org.member_role).toBe('owner');
    expect(typeof org.member_role).toBe('string');

    expect(org).toHaveProperty('role_permissions');
    // role_permissions should be an array (empty array for owner role in this case)
    expect(Array.isArray(org.role_permissions)).toBe(true);
  });

  it('Property 2.4: Preservation - All non-buggy fields remain correct together', async () => {
    // Make request to the organizations endpoint
    const res = await request(app)
      .get('/api/organizations/')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    // Find our test organization
    const org = res.body.find((o: any) => o.id === testOrgId);
    expect(org).toBeDefined();

    // CRITICAL: Comprehensive check that all preserved fields are correct
    // This property verifies that fixing the bug doesn't break anything else
    
    // Organization metadata
    expect(org.id).toBe(testOrgId);
    expect(org.name).toBe(testOrgName);
    expect(org.slug).toBe(testOrgSlug);
    
    // Membership data
    expect(org.member_role).toBe('owner');
    expect(Array.isArray(org.role_permissions)).toBe(true);
    
    // Stats object exists
    expect(org.stats).toBeDefined();
    expect(typeof org.stats).toBe('object');
    
    // vps_count is correct (already properly named)
    expect(org.stats.vps_count).toBe(2);
    expect(typeof org.stats.vps_count).toBe('number');
  });
});
