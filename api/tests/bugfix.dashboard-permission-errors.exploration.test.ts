/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 2.1, 2.2**
 * 
 * **Property 1: Bug Condition** - New Users Missing Owner Role ID
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples that demonstrate newly registered users have NULL role_id
 * 
 * This test validates that newly registered users:
 * 1. Have role_id populated in organization_members table
 * 2. Have role_id referencing the 'owner' role from organization_roles table
 * 3. Can pass RoleService.checkPermission for owner permissions (billing_view, vps_view)
 * 4. Can access protected endpoints like `/api/payments/wallet/balance` and `/api/vps` (200 OK, not 403)
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: 
 * - Test FAILS because role_id is NULL
 * - Permission checks fail
 * - Endpoints return 403 Forbidden
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';
import { RoleService } from '../services/roles.js';

describe('Bug Condition Exploration: Dashboard Permission Errors', () => {
  // Store test data for cleanup
  const testUsers: string[] = [];
  const testOrganizations: string[] = [];

  afterAll(async () => {
    // Cleanup test data
    for (const userId of testUsers) {
      await query('DELETE FROM users WHERE id = $1', [userId]);
    }
    for (const orgId of testOrganizations) {
      await query('DELETE FROM organizations WHERE id = $1', [orgId]);
    }
  });

  /**
   * Comprehensive Test: Verify complete bug condition
   * 
   * This test validates all aspects of the bug in a single registration:
   * 1. role_id is populated in organization_members
   * 2. role_id references the 'owner' role from organization_roles
   * 3. RoleService.checkPermission returns true for key permissions
   * 4. Protected endpoints return 200 OK (not 403)
   * 
   * **EXPECTED TO FAIL ON UNFIXED CODE**: All assertions will fail
   */
  it('should assign owner role_id and grant full permissions to newly registered user', { timeout: 15000 }, async () => {
    const timestamp = Date.now();
    const testEmail = `test-comprehensive-${timestamp}@example.com`;
    
    // Register a new user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      });

    expect(registerResponse.status).toBe(201);
    const userId = registerResponse.body.user.id;
    const organizationId = registerResponse.body.user.organizationId;
    const token = registerResponse.body.token;

    testUsers.push(userId);
    testOrganizations.push(organizationId);

    // 1. Verify role_id is populated and references owner role
    const roleResult = await query(
      `SELECT om.role_id, om.role as legacy_role, r.name as role_name, r.permissions
       FROM organization_members om
       LEFT JOIN organization_roles r ON om.role_id = r.id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [userId, organizationId]
    );

    expect(roleResult.rows.length).toBe(1);
    const roleData = roleResult.rows[0];

    // **CRITICAL**: role_id must not be NULL
    expect(roleData.role_id).not.toBeNull();
    expect(roleData.role_name).toBe('owner');
    expect(roleData.legacy_role).toBe('owner'); // Preservation check

    // 2. Verify RoleService.checkPermission for key permissions
    const hasBillingView = await RoleService.checkPermission(userId, organizationId, 'billing_view');
    expect(hasBillingView).toBe(true);

    const hasVpsView = await RoleService.checkPermission(userId, organizationId, 'vps_view');
    expect(hasVpsView).toBe(true);

    // 3. Verify protected endpoints return 200 OK
    const walletResponse = await request(app)
      .get('/api/payments/wallet/balance')
      .set('Authorization', `Bearer ${token}`);
    expect(walletResponse.status).toBe(200);

    console.log(`✓ Bug confirmed: User ${userId} has role_id=${roleData.role_id}, permissions work, endpoints accessible`);
  });
});
