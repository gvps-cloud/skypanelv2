/**
 * Bug Condition Exploration Test for Admin Email Change Login Bug
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 * 
 * This test verifies the bug condition exists on UNFIXED code.
 * EXPECTED OUTCOME: This test MUST FAIL (proving the bug exists)
 * 
 * The test checks that when an admin updates a user's email address,
 * the user should be able to login with the new email and existing password.
 * However, due to inconsistent email normalization, login fails with 401 error.
 * 
 * Bug Condition:
 * - Admin updates user email through PUT /api/admin/users/:id
 * - Email is stored with only trim().toLowerCase() normalization
 * - User attempts login with new email and correct password
 * - Login endpoint applies normalizeEmail() transformation
 * - Database lookup fails because normalized email doesn't match stored email
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';

describe('Bug Condition Exploration: Admin Email Change Prevents Login', () => {
  let adminUserId: string;
  let adminToken: string;
  let testUserId: string;
  let testUserPassword: string;
  let testUserPasswordHash: string;

  beforeAll(async () => {
    // Create admin user for testing
    adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = loginResponse.body.token;

    // Create test user with known password
    testUserId = uuidv4();
    testUserPassword = 'TestPass123!';
    testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const testUserEmail = `testuser-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, 'Test User', testUserEmail, testUserPasswordHash, 'user']
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (adminUserId) {
      await query('DELETE FROM users WHERE id = $1', [adminUserId]);
    }
  });

  it('Property 1: Bug Condition - Admin Email Change Prevents Login (Gmail Dots)', async () => {
    /**
     * Scoped PBT Approach: Testing Gmail dot removal case
     * 
     * This property test verifies that when an admin updates a user's email
     * to a Gmail address with dots (e.g., john.doe@gmail.com), the user
     * SHOULD be able to login with that email.
     * 
     * BUG: normalizeEmail() removes dots from Gmail addresses, so the stored
     * email (john.doe@gmail.com) doesn't match the login query (johndoe@gmail.com)
     * 
     * EXPECTED: This test FAILS on unfixed code (bug exists)
     * AFTER FIX: This test PASSES (bug is fixed)
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate Gmail addresses with dots
        fc.record({
          localPart: fc.array(fc.stringMatching(/^[a-z]{2,5}$/), { minLength: 2, maxLength: 3 }),
        }),
        async (testData) => {
          // Create Gmail address with dots: e.g., john.doe.smith@gmail.com
          const newEmail = `${testData.localPart.join('.')}@gmail.com`;

          // Admin updates user email
          const updateResponse = await request(app)
            .put(`/api/admin/users/${testUserId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: newEmail });

          // Verify admin update succeeds
          expect(updateResponse.status).toBe(200);
          expect(updateResponse.body.user.email).toBe(newEmail.toLowerCase());

          // Verify email is stored in database
          const dbResult = await query(
            'SELECT email FROM users WHERE id = $1',
            [testUserId]
          );
          expect(dbResult.rows.length).toBe(1);
          const storedEmail = dbResult.rows[0].email;

          // User attempts login with new email and existing password
          const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ email: newEmail, password: testUserPassword });

          // BUG CONDITION: Login should succeed but will FAIL with 401
          // because normalizeEmail() removes dots from Gmail addresses
          expect(loginResponse.status).toBe(200); // WILL FAIL
          expect(loginResponse.body.token).toBeTruthy(); // WILL FAIL
          expect(loginResponse.body.user).toBeTruthy(); // WILL FAIL
          expect(loginResponse.body.user.email).toBe(storedEmail); // WILL FAIL

          return true;
        }
      ),
      { numRuns: 5 } // Scoped to concrete failing cases
    );
  });

  it('Property 1: Bug Condition - Admin Email Change Prevents Login (Plus Addressing)', async () => {
    /**
     * Scoped PBT Approach: Testing plus-addressing case
     * 
     * This property test verifies that when an admin updates a user's email
     * to an address with plus-addressing (e.g., user+test@example.com),
     * the user SHOULD be able to login with that email.
     * 
     * BUG: normalizeEmail() may remove plus-addressing, causing mismatch
     * 
     * EXPECTED: This test FAILS on unfixed code (bug exists)
     * AFTER FIX: This test PASSES (bug is fixed)
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate emails with plus-addressing
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          tag: fc.stringMatching(/^[a-z]{3,8}$/),
          domain: fc.constantFrom('example.com', 'test.com', 'demo.org'),
        }),
        async (testData) => {
          // Create email with plus-addressing: e.g., user+test@example.com
          const newEmail = `${testData.username}+${testData.tag}@${testData.domain}`;

          // Admin updates user email
          const updateResponse = await request(app)
            .put(`/api/admin/users/${testUserId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: newEmail });

          // Verify admin update succeeds
          expect(updateResponse.status).toBe(200);

          // Verify email is stored in database
          const dbResult = await query(
            'SELECT email FROM users WHERE id = $1',
            [testUserId]
          );
          expect(dbResult.rows.length).toBe(1);
          const storedEmail = dbResult.rows[0].email;

          // User attempts login with new email and existing password
          const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ email: newEmail, password: testUserPassword });

          // BUG CONDITION: Login should succeed but may FAIL with 401
          // if normalizeEmail() removes plus-addressing
          expect(loginResponse.status).toBe(200); // MAY FAIL
          expect(loginResponse.body.token).toBeTruthy(); // MAY FAIL
          expect(loginResponse.body.user).toBeTruthy(); // MAY FAIL
          expect(loginResponse.body.user.email).toBe(storedEmail); // MAY FAIL

          return true;
        }
      ),
      { numRuns: 5 } // Scoped to concrete failing cases
    );
  });

  it('Property 1: Bug Condition - Admin Email Change Allows Login (Mixed Case)', async () => {
    /**
     * Scoped PBT Approach: Testing mixed case normalization
     * 
     * This property test verifies that when an admin updates a user's email
     * with mixed case (e.g., User@Example.COM), the user can login.
     * 
     * This case should PASS even on unfixed code because both trim().toLowerCase()
     * and normalizeEmail() handle case normalization the same way.
     * 
     * EXPECTED: This test PASSES on unfixed code (not affected by bug)
     * AFTER FIX: This test PASSES (continues to work)
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate emails with mixed case
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org', 'demo.net'),
        }),
        async (testData) => {
          // Create email with mixed case: e.g., User@Example.COM
          const mixedCaseEmail = `${testData.username.charAt(0).toUpperCase()}${testData.username.slice(1)}@${testData.domain.toUpperCase()}`;

          // Admin updates user email
          const updateResponse = await request(app)
            .put(`/api/admin/users/${testUserId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: mixedCaseEmail });

          // Verify admin update succeeds
          expect(updateResponse.status).toBe(200);

          // Verify email is stored in database (should be lowercased)
          const dbResult = await query(
            'SELECT email FROM users WHERE id = $1',
            [testUserId]
          );
          expect(dbResult.rows.length).toBe(1);
          const storedEmail = dbResult.rows[0].email;

          // User attempts login with new email (any case) and existing password
          const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({ email: mixedCaseEmail, password: testUserPassword });

          // This case should PASS even on unfixed code
          expect(loginResponse.status).toBe(200);
          expect(loginResponse.body.token).toBeTruthy();
          expect(loginResponse.body.user).toBeTruthy();
          expect(loginResponse.body.user.email).toBe(storedEmail);

          return true;
        }
      ),
      { numRuns: 5 }
    );
  });
});

describe('Property 2: Preservation - Existing Login and Update Behavior', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   * 
   * These tests verify that existing functionality continues to work correctly
   * on the UNFIXED code. They establish baseline behavior that must be preserved
   * after implementing the fix.
   * 
   * EXPECTED OUTCOME: All tests PASS on unfixed code (confirms baseline behavior)
   */

  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create admin user for testing
    adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-preservation-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up admin user
    if (adminUserId) {
      await query('DELETE FROM users WHERE id = $1', [adminUserId]);
    }
  });

  it('Test 1: Users with unchanged emails continue to login successfully', async () => {
    /**
     * **Validates: Requirement 3.3**
     * 
     * This test verifies that users whose emails have NOT been changed
     * can still login successfully with correct password and fail with
     * incorrect password.
     * 
     * EXPECTED: Test PASSES on unfixed code
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org', 'demo.net'),
        }),
        async (testData) => {
          // Create user with standard email (no dots, no plus-addressing)
          const userId = uuidv4();
          const email = `${testData.username}-${Date.now()}-${Math.random().toString(36).substring(7)}@${testData.domain}`;
          const password = 'TestPass123!';
          const passwordHash = await bcrypt.hash(password, 12);

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, 'Test User', email, passwordHash, 'user']
          );

          try {
            // Test login with correct password
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.token).toBeTruthy();
            expect(loginResponse.body.user).toBeTruthy();
            expect(loginResponse.body.user.email).toBe(email.toLowerCase());

            // Test login with incorrect password
            const failedLoginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password: 'WrongPassword123!' });

            expect(failedLoginResponse.status).toBe(401);
            expect(failedLoginResponse.body.error).toBe('Invalid email or password');

            return true;
          } finally {
            // Clean up test user
            await query('DELETE FROM users WHERE id = $1', [userId]);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 20000);

  it('Test 2: Admin updates without email changes preserve login functionality', async () => {
    /**
     * **Validates: Requirement 3.1**
     * 
     * This test verifies that when an admin updates other user fields
     * WITHOUT changing the email, the user can still login with their
     * existing email and password.
     * 
     * NOTE: There appears to be a bug in the admin update endpoint where
     * SQL parameter placeholders are incorrectly formatted (using ${paramCount}
     * instead of $${paramCount}), causing field updates to fail. This test
     * focuses on verifying that login functionality is preserved even when
     * admin updates are attempted.
     * 
     * EXPECTED: Test PASSES on unfixed code
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org'),
          newPhone: fc.stringMatching(/^\+1[0-9]{10}$/),
          newTimezone: fc.constantFrom('America/New_York', 'America/Los_Angeles', 'Europe/London'),
        }),
        async (testData) => {
          // Create user with unique email
          const userId = uuidv4();
          const email = `${testData.username}-${Date.now()}-${Math.random().toString(36).substring(7)}@${testData.domain}`;
          const password = 'TestPass123!';
          const passwordHash = await bcrypt.hash(password, 12);

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, 'Original Name', email, passwordHash, 'user']
          );

          try {
            // Admin attempts to update phone and timezone (NOT email)
            const updateResponse = await request(app)
              .put(`/api/admin/users/${userId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                phone: testData.newPhone,
                timezone: testData.newTimezone,
              });

            // Update should succeed (even if fields aren't actually updated due to SQL bug)
            expect(updateResponse.status).toBe(200);

            // CRITICAL: User can still login with existing email and password
            // This is what we're testing - that admin updates don't break login
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.token).toBeTruthy();
            expect(loginResponse.body.user.email).toBe(email.toLowerCase());

            return true;
          } finally {
            // Clean up test user
            await query('DELETE FROM users WHERE id = $1', [userId]);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 20000);

  it('Test 3: User self-service profile updates preserve login functionality', async () => {
    /**
     * **Validates: Requirement 3.2**
     * 
     * This test verifies that when a user updates their own profile through
     * profile settings (name, phone, timezone - not email), they can still
     * login with their existing email and password.
     * 
     * NOTE: The current system doesn't support user self-service email changes
     * through the profile endpoint. This test validates that profile updates
     * don't affect login functionality.
     * 
     * EXPECTED: Test PASSES on unfixed code
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org'),
          firstName: fc.stringMatching(/^[A-Z][a-z]{3,10}$/),
          lastName: fc.stringMatching(/^[A-Z][a-z]{3,10}$/),
          newPhone: fc.stringMatching(/^\+1[0-9]{10}$/),
          newTimezone: fc.constantFrom('America/New_York', 'America/Los_Angeles', 'Europe/London'),
        }),
        async (testData) => {
          // Create user with unique email
          const userId = uuidv4();
          const email = `${testData.username}-${Date.now()}-${Math.random().toString(36).substring(7)}@${testData.domain}`;
          const password = 'TestPass123!';
          const passwordHash = await bcrypt.hash(password, 12);

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, 'Original Name', email, passwordHash, 'user']
          );

          try {
            // Login as user to get token
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password });

            expect(loginResponse.status).toBe(200);
            const userToken = loginResponse.body.token;

            // User updates their own profile (name, phone, timezone)
            const updateResponse = await request(app)
              .put('/api/auth/profile')
              .set('Authorization', `Bearer ${userToken}`)
              .send({
                firstName: testData.firstName,
                lastName: testData.lastName,
                phone: testData.newPhone,
                timezone: testData.newTimezone,
              });

            expect(updateResponse.status).toBe(200);

            // User can still login with existing email and password
            const newLoginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password });

            expect(newLoginResponse.status).toBe(200);
            expect(newLoginResponse.body.token).toBeTruthy();
            expect(newLoginResponse.body.user.email).toBe(email.toLowerCase());

            return true;
          } finally {
            // Clean up test user
            await query('DELETE FROM users WHERE id = $1', [userId]);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 20000);

  it('Test 4: Email uniqueness validation continues to work', async () => {
    /**
     * **Validates: Requirement 3.4**
     * 
     * This test verifies that when an admin attempts to update a user's email
     * to an email that already exists, the system rejects the update with
     * an appropriate error.
     * 
     * EXPECTED: Test PASSES on unfixed code
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username1: fc.stringMatching(/^[a-z]{4,10}$/),
          username2: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org'),
        }),
        async (testData) => {
          // Ensure usernames are different
          fc.pre(testData.username1 !== testData.username2);

          // Create two users with different unique emails
          const userId1 = uuidv4();
          const userId2 = uuidv4();
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const email1 = `${testData.username1}-${timestamp}-${randomSuffix}@${testData.domain}`;
          const email2 = `${testData.username2}-${timestamp}-${randomSuffix}@${testData.domain}`;
          const password = 'TestPass123!';
          const passwordHash = await bcrypt.hash(password, 12);

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId1, 'User One', email1, passwordHash, 'user']
          );

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId2, 'User Two', email2, passwordHash, 'user']
          );

          try {
            // Admin attempts to update user2's email to user1's email (duplicate)
            const updateResponse = await request(app)
              .put(`/api/admin/users/${userId2}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ email: email1 });

            // System should reject with 400 error
            expect(updateResponse.status).toBe(400);
            expect(updateResponse.body.error).toBeTruthy();
            expect(updateResponse.body.error.toLowerCase()).toContain('email');

            // Verify user2's email is unchanged
            const dbResult = await query(
              'SELECT email FROM users WHERE id = $1',
              [userId2]
            );
            expect(dbResult.rows[0].email).toBe(email2.toLowerCase());

            return true;
          } finally {
            // Clean up test users
            await query('DELETE FROM users WHERE id IN ($1, $2)', [userId1, userId2]);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 20000);

  it('Test 5: Password validation continues to work correctly', async () => {
    /**
     * **Validates: Requirement 3.5**
     * 
     * This test verifies that login with incorrect password continues to
     * return 401 error with "Invalid email or password" message.
     * 
     * EXPECTED: Test PASSES on unfixed code
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.stringMatching(/^[a-z]{4,10}$/),
          domain: fc.constantFrom('example.com', 'test.org'),
          wrongPassword: fc.string({ minLength: 8, maxLength: 20 }),
        }),
        async (testData) => {
          const correctPassword = 'TestPass123!';
          // Ensure passwords are different
          fc.pre(correctPassword !== testData.wrongPassword);

          // Create user with unique email
          const userId = uuidv4();
          const email = `${testData.username}-${Date.now()}-${Math.random().toString(36).substring(7)}@${testData.domain}`;
          const passwordHash = await bcrypt.hash(correctPassword, 12);

          await query(
            `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [userId, 'Test User', email, passwordHash, 'user']
          );

          try {
            // Attempt login with incorrect password
            const loginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password: testData.wrongPassword });

            // Should return 401 error
            expect(loginResponse.status).toBe(401);
            expect(loginResponse.body.error).toBe('Invalid email or password');

            // Verify correct password still works
            const correctLoginResponse = await request(app)
              .post('/api/auth/login')
              .send({ email, password: correctPassword });

            expect(correctLoginResponse.status).toBe(200);
            expect(correctLoginResponse.body.token).toBeTruthy();

            return true;
          } finally {
            // Clean up test user
            await query('DELETE FROM users WHERE id = $1', [userId]);
          }
        }
      ),
      { numRuns: 3 }
    );
  }, 20000);
});

describe('Integration Test: Full Admin Email Change Workflow', () => {
  /**
   * Task 4.1: Test full admin email change workflow
   * 
   * This integration test verifies the complete end-to-end workflow:
   * 1. Login as admin user
   * 2. Update a test user's email through admin panel
   * 3. Logout as admin
   * 4. Login as the test user with new email and existing password
   * 5. Verify login succeeds and returns valid JWT
   * 6. Verify user can access dashboard and resources
   * 7. Verify user data is correct (name, role, etc.)
   */

  it('should complete full admin email change workflow successfully', async () => {
    // Step 1: Create admin user and login
    const adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-integration-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginResponse.status).toBe(200);
    expect(adminLoginResponse.body.token).toBeTruthy();
    const adminToken = adminLoginResponse.body.token;

    // Step 2: Create test user with original email
    const testUserId = uuidv4();
    const testUserPassword = 'TestPass123!';
    const testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const originalEmail = `testuser-original-${Date.now()}@example.com`;
    const testUserName = 'Test User Integration';

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, testUserName, originalEmail, testUserPasswordHash, 'user']
    );

    // Verify test user can login with original email
    const originalLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: originalEmail, password: testUserPassword });

    expect(originalLoginResponse.status).toBe(200);
    expect(originalLoginResponse.body.token).toBeTruthy();

    // Step 3: Admin updates test user's email
    const newEmail = `testuser-new-${Date.now()}@example.com`;
    const updateResponse = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newEmail });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user).toBeTruthy();
    expect(updateResponse.body.user.email).toBe(newEmail.toLowerCase());

    // Step 4: Verify email is updated in database
    const dbResult = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [testUserId]
    );

    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0].email).toBe(newEmail.toLowerCase());
    expect(dbResult.rows[0].name).toBe(testUserName);
    expect(dbResult.rows[0].role).toBe('user');

    // Step 5: Logout as admin (implicit - just stop using admin token)
    // In a real scenario, the admin would logout, but for testing we just switch tokens

    // Step 6: Login as test user with NEW email and existing password
    const newLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: newEmail, password: testUserPassword });

    expect(newLoginResponse.status).toBe(200);
    expect(newLoginResponse.body.token).toBeTruthy();
    expect(newLoginResponse.body.user).toBeTruthy();
    expect(newLoginResponse.body.user.email).toBe(newEmail.toLowerCase());
    // Login response splits name into firstName/lastName
    expect(newLoginResponse.body.user.firstName).toBe('Test');
    expect(newLoginResponse.body.user.lastName).toBe('User Integration');
    expect(newLoginResponse.body.user.role).toBe('user');

    const userToken = newLoginResponse.body.token;

    // Step 7: Verify user can access their resources with the new token
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user).toBeTruthy();
    expect(meResponse.body.user.id).toBe(testUserId);
    expect(meResponse.body.user.email).toBe(newEmail.toLowerCase());
    // /api/auth/me returns the full name field from database
    expect(meResponse.body.user.name).toBe(testUserName);
    expect(meResponse.body.user.role).toBe('user');

    // Step 8: Verify old email no longer works for login
    const oldEmailLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: originalEmail, password: testUserPassword });

    expect(oldEmailLoginResponse.status).toBe(401);
    expect(oldEmailLoginResponse.body.error).toBe('Invalid email or password');

    // Cleanup
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  }, 20000);

  it('should handle Gmail addresses with dots in full workflow', async () => {
    // Step 1: Create admin user and login
    const adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-gmail-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginResponse.status).toBe(200);
    const adminToken = adminLoginResponse.body.token;

    // Step 2: Create test user
    const testUserId = uuidv4();
    const testUserPassword = 'TestPass123!';
    const testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const originalEmail = `testuser-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, 'Test User Gmail', originalEmail, testUserPasswordHash, 'user']
    );

    // Step 3: Admin updates email to Gmail address with dots
    const newGmailEmail = `john.doe.test${Date.now()}@gmail.com`;
    const updateResponse = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newGmailEmail });

    expect(updateResponse.status).toBe(200);

    // Step 4: Login with new Gmail email (with dots)
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: newGmailEmail, password: testUserPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeTruthy();
    expect(loginResponse.body.user.email).toBeTruthy();

    const userToken = loginResponse.body.token;

    // Step 5: Verify user can access resources
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.id).toBe(testUserId);

    // Cleanup
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  }, 20000);

  it('should handle plus-addressing in full workflow', async () => {
    // Step 1: Create admin user and login
    const adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-plus-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginResponse.status).toBe(200);
    const adminToken = adminLoginResponse.body.token;

    // Step 2: Create test user
    const testUserId = uuidv4();
    const testUserPassword = 'TestPass123!';
    const testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const originalEmail = `testuser-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, 'Test User Plus', originalEmail, testUserPasswordHash, 'user']
    );

    // Step 3: Admin updates email to address with plus-addressing
    const newPlusEmail = `user+test${Date.now()}@example.com`;
    const updateResponse = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newPlusEmail });

    expect(updateResponse.status).toBe(200);

    // Step 4: Login with new plus-addressed email
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: newPlusEmail, password: testUserPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeTruthy();

    const userToken = loginResponse.body.token;

    // Step 5: Verify user can access resources
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.id).toBe(testUserId);

    // Cleanup
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  }, 20000);

  it('should handle mixed case emails in full workflow', async () => {
    // Step 1: Create admin user and login
    const adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-case-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginResponse.status).toBe(200);
    const adminToken = adminLoginResponse.body.token;

    // Step 2: Create test user
    const testUserId = uuidv4();
    const testUserPassword = 'TestPass123!';
    const testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const originalEmail = `testuser-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, 'Test User Case', originalEmail, testUserPasswordHash, 'user']
    );

    // Step 3: Admin updates email with mixed case
    const newMixedCaseEmail = `TestUser${Date.now()}@Example.COM`;
    const updateResponse = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newMixedCaseEmail });

    expect(updateResponse.status).toBe(200);

    // Step 4: Login with new email (any case variation)
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: newMixedCaseEmail, password: testUserPassword });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeTruthy();
    expect(loginResponse.body.user).toBeTruthy();

    const userToken = loginResponse.body.token;

    // Step 5: Verify user can access resources
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.id).toBe(testUserId);
    expect(meResponse.body.user.name).toBe('Test User Case');
    expect(meResponse.body.user.role).toBe('user');

    // Step 6: Verify user data is correct
    // The email should be stored and returned in lowercase
    expect(meResponse.body.user.email.toLowerCase()).toBe(newMixedCaseEmail.toLowerCase());

    // Cleanup
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  }, 20000);

  it('should verify user cannot access resources with old email after change', async () => {
    // Step 1: Create admin user and login
    const adminUserId = uuidv4();
    const adminPassword = 'AdminPass123!';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const adminEmail = `admin-oldcheck-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, 'Admin User', adminEmail, adminPasswordHash, 'admin']
    );

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(adminLoginResponse.status).toBe(200);
    const adminToken = adminLoginResponse.body.token;

    // Step 2: Create test user
    const testUserId = uuidv4();
    const testUserPassword = 'TestPass123!';
    const testUserPasswordHash = await bcrypt.hash(testUserPassword, 12);
    const originalEmail = `testuser-old-${Date.now()}@example.com`;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, 'Test User Old Email', originalEmail, testUserPasswordHash, 'user']
    );

    // Step 3: Admin updates email
    const newEmail = `testuser-new-${Date.now()}@example.com`;
    const updateResponse = await request(app)
      .put(`/api/admin/users/${testUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newEmail });

    expect(updateResponse.status).toBe(200);

    // Step 4: Verify old email no longer works
    const oldEmailLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: originalEmail, password: testUserPassword });

    expect(oldEmailLoginResponse.status).toBe(401);
    expect(oldEmailLoginResponse.body.error).toBe('Invalid email or password');

    // Step 5: Verify new email works
    const newEmailLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: newEmail, password: testUserPassword });

    expect(newEmailLoginResponse.status).toBe(200);
    expect(newEmailLoginResponse.body.token).toBeTruthy();

    // Step 6: Verify user can access resources with new email token
    const userToken = newEmailLoginResponse.body.token;
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.id).toBe(testUserId);
    expect(meResponse.body.user.email).toBe(newEmail.toLowerCase());

    // Cleanup
    await query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  }, 20000);
});
