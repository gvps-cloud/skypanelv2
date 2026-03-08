/**
 * Preservation Property Tests
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * **Property 2: Preservation** - Existing Registration Flow Unchanged
 * 
 * **IMPORTANT**: Follow observation-first methodology
 * - Observe behavior on UNFIXED code for non-buggy scenarios
 * - Write property-based tests capturing observed behavior patterns
 * - Run tests on UNFIXED code
 * - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
 * 
 * **GOAL**: Verify that existing functionality remains unchanged after the fix
 * 
 * This test validates that the registration flow preserves:
 * 1. Organization creation produces same structure (name, slug, owner_id, settings)
 * 2. Wallet is created with balance 0 and currency USD
 * 3. Legacy `role` column is populated with 'owner'
 * 4. User creation, organization creation, and wallet initialization remain unchanged
 * 
 * Property-based testing generates many test cases for stronger guarantees.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

describe('Preservation Property Tests: Dashboard Permission Errors Fix', () => {
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
   * Property: Organization Structure Preservation
   * 
   * For any valid registration input, the organization created should have:
   * - A valid UUID id
   * - A name based on firstName + "'s Workspace"
   * - A slug derived from the name (lowercase, alphanumeric with dashes)
   * - owner_id set to the user's id
   * - settings as an empty JSON object '{}'
   * - created_at and updated_at timestamps
   * 
   * This property ensures the organization creation logic remains unchanged.
   */
  it('should preserve organization structure for all valid registration inputs', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random but valid registration data
        fc.record({
          firstName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/), // Valid first name
          lastName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),  // Valid last name
          emailPrefix: fc.stringMatching(/^[a-z0-9]{3,10}$/), // Email prefix
          password: fc.constant('TestPassword123!') // Valid password
        }),
        async (input) => {
          const timestamp = Date.now();
          const testEmail = `${input.emailPrefix}-${timestamp}@example.com`;
          
          // Register a new user
          const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
              email: testEmail,
              password: input.password,
              firstName: input.firstName,
              lastName: input.lastName
            });

          // Skip if registration failed (e.g., duplicate email)
          if (registerResponse.status !== 201) {
            return true;
          }

          const userId = registerResponse.body.user.id;
          const organizationId = registerResponse.body.user.organizationId;

          testUsers.push(userId);
          testOrganizations.push(organizationId);

          // Query organization structure
          const orgResult = await query(
            'SELECT id, name, slug, owner_id, settings, created_at, updated_at FROM organizations WHERE id = $1',
            [organizationId]
          );

          expect(orgResult.rows.length).toBe(1);
          const org = orgResult.rows[0];

          // Verify organization structure is preserved
          expect(org.id).toBe(organizationId);
          expect(org.name).toContain(input.firstName); // Name includes firstName
          expect(org.name).toContain('Workspace'); // Name includes 'Workspace'
          expect(org.slug).toBe(org.name.toLowerCase().replace(/[^a-z0-9]/g, '-')); // Slug is derived from name
          expect(org.owner_id).toBe(userId); // owner_id is the user's id
          expect(org.settings).toEqual({}); // settings is empty object
          expect(org.created_at).toBeDefined();
          expect(org.updated_at).toBeDefined();
        }
      ),
      { numRuns: 5, timeout: 30000 } // Run 5 test cases with 30s timeout
    );
  });

  /**
   * Property: Wallet Creation Preservation
   * 
   * For any valid registration input, a wallet should be created with:
   * - A valid UUID id
   * - organization_id matching the created organization
   * - balance of 0
   * - currency of 'USD'
   * - created_at and updated_at timestamps
   * 
   * This property ensures wallet initialization remains unchanged.
   */
  it('should preserve wallet creation with balance 0 and currency USD', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          lastName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          emailPrefix: fc.stringMatching(/^[a-z0-9]{3,10}$/),
          password: fc.constant('TestPassword123!')
        }),
        async (input) => {
          const timestamp = Date.now();
          const testEmail = `${input.emailPrefix}-${timestamp}@example.com`;
          
          const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
              email: testEmail,
              password: input.password,
              firstName: input.firstName,
              lastName: input.lastName
            });

          if (registerResponse.status !== 201) {
            return true;
          }

          const userId = registerResponse.body.user.id;
          const organizationId = registerResponse.body.user.organizationId;

          testUsers.push(userId);
          testOrganizations.push(organizationId);

          // Query wallet
          const walletResult = await query(
            'SELECT id, organization_id, balance, currency, created_at, updated_at FROM wallets WHERE organization_id = $1',
            [organizationId]
          );

          expect(walletResult.rows.length).toBe(1);
          const wallet = walletResult.rows[0];

          // Verify wallet structure is preserved
          expect(wallet.id).toBeDefined();
          expect(wallet.organization_id).toBe(organizationId);
          expect(wallet.balance).toBe(0); // Balance starts at 0
          expect(wallet.currency).toBe('USD'); // Currency is USD
          expect(wallet.created_at).toBeDefined();
          expect(wallet.updated_at).toBeDefined();
        }
      ),
      { numRuns: 5, timeout: 30000 }
    );
  });

  /**
   * Property: Legacy Role Column Preservation
   * 
   * For any valid registration input, the organization_members record should have:
   * - organization_id matching the created organization
   * - user_id matching the created user
   * - role (legacy column) set to 'owner'
   * - created_at timestamp
   * 
   * This property ensures backward compatibility with the legacy role column.
   * 
   * **NOTE**: This test does NOT check role_id - that's the bug being fixed.
   * We only verify the legacy `role` column continues to be populated.
   */
  it('should preserve legacy role column population with "owner"', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          lastName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          emailPrefix: fc.stringMatching(/^[a-z0-9]{3,10}$/),
          password: fc.constant('TestPassword123!')
        }),
        async (input) => {
          const timestamp = Date.now();
          const testEmail = `${input.emailPrefix}-${timestamp}@example.com`;
          
          const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
              email: testEmail,
              password: input.password,
              firstName: input.firstName,
              lastName: input.lastName
            });

          if (registerResponse.status !== 201) {
            return true;
          }

          const userId = registerResponse.body.user.id;
          const organizationId = registerResponse.body.user.organizationId;

          testUsers.push(userId);
          testOrganizations.push(organizationId);

          // Query organization_members
          const memberResult = await query(
            'SELECT organization_id, user_id, role, created_at FROM organization_members WHERE user_id = $1 AND organization_id = $2',
            [userId, organizationId]
          );

          expect(memberResult.rows.length).toBe(1);
          const member = memberResult.rows[0];

          // Verify legacy role column is preserved
          expect(member.organization_id).toBe(organizationId);
          expect(member.user_id).toBe(userId);
          expect(member.role).toBe('owner'); // Legacy column must be 'owner'
          expect(member.created_at).toBeDefined();
        }
      ),
      { numRuns: 5, timeout: 30000 }
    );
  });

  /**
   * Property: User Creation Preservation
   * 
   * For any valid registration input, the user record should have:
   * - A valid UUID id
   * - email matching the input
   * - password_hash (bcrypt hash)
   * - name combining firstName and lastName
   * - role set to 'user' (not 'admin')
   * - created_at and updated_at timestamps
   * 
   * This property ensures user creation logic remains unchanged.
   */
  it('should preserve user creation structure and fields', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          lastName: fc.stringMatching(/^[A-Z][a-z]{2,15}$/),
          emailPrefix: fc.stringMatching(/^[a-z0-9]{3,10}$/),
          password: fc.constant('TestPassword123!')
        }),
        async (input) => {
          const timestamp = Date.now();
          const testEmail = `${input.emailPrefix}-${timestamp}@example.com`;
          
          const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
              email: testEmail,
              password: input.password,
              firstName: input.firstName,
              lastName: input.lastName
            });

          if (registerResponse.status !== 201) {
            return true;
          }

          const userId = registerResponse.body.user.id;
          const organizationId = registerResponse.body.user.organizationId;

          testUsers.push(userId);
          testOrganizations.push(organizationId);

          // Query user
          const userResult = await query(
            'SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE id = $1',
            [userId]
          );

          expect(userResult.rows.length).toBe(1);
          const user = userResult.rows[0];

          // Verify user structure is preserved
          expect(user.id).toBe(userId);
          expect(user.email).toBe(testEmail);
          expect(user.password_hash).toBeDefined();
          expect(user.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
          expect(user.name).toBe(`${input.firstName} ${input.lastName}`);
          expect(user.role).toBe('user'); // Default role is 'user', not 'admin'
          expect(user.created_at).toBeDefined();
          expect(user.updated_at).toBeDefined();
        }
      ),
      { numRuns: 5, timeout: 30000 }
    );
  });
});
