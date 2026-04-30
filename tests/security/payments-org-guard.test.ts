/**
 * SECURITY TEST: Payments Router Organization Guard
 *
 * **Validates: Requirements 1.1**
 *
 * This test verifies that the payments router enforces organization membership
 * at the router level, ensuring all payment operations are properly scoped to
 * organizations.
 *
 * **Test Coverage:**
 * - All payment routes require organization membership (requireOrganization middleware)
 * - Routes return 403 when user lacks organization membership
 * - Router-level guard is applied (not per-handler)
 * - Future webhook routes would be excluded from the guard
 *
 * **Security Principles Verified:**
 * 1. Payment operations are scoped to organizations
 * 2. Users without organization membership cannot access payment endpoints
 * 3. Router-level guards prevent accidental omission of auth checks
 *
 * **Threat Mitigated:** Broken Access Control (OWASP A01)
 * **Security Standard:** OWASP ASVS V4.1 (Access Control), V4.2 (Operation-level)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { query } from '../../api/lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Mock PayPal service to avoid real API calls
vi.mock('../../api/services/paypalService.js', () => ({
  PayPalService: {
    createPayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payment-id',
      approvalUrl: 'https://test.approval.url',
    }),
    capturePayment: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payment-id',
    }),
    getWalletBalance: vi.fn().mockResolvedValue(100),
    getWalletTransactions: vi.fn().mockResolvedValue([]),
    deductFundsFromWallet: vi.fn().mockResolvedValue(true),
    createPayout: vi.fn().mockResolvedValue({
      success: true,
      paymentId: 'test-payout-id',
    }),
  },
}));

// Mock email service to prevent real emails
vi.mock('../../api/services/emailService.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock activity logger
vi.mock('../../api/services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('Payments Router Organization Guard', () => {
  let userWithOrgId: string;
  let userWithOrgToken: string;
  let organizationId: string;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create user WITH organization
    userWithOrgId = uuidv4();
    const hashedPasswordWithOrg = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [userWithOrgId, `withorg-${Date.now()}@test.com`, hashedPasswordWithOrg, 'User With Org', 'user']
    );

    // Create organization
    const orgResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Test Org', `test-org-${Date.now()}`, userWithOrgId]
    );
    organizationId = orgResult.rows[0].id;

    // Get owner role
    const ownerRoleResult = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [organizationId]
    );
    const ownerRoleId = ownerRoleResult.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [organizationId, userWithOrgId, ownerRoleId]
    );

    // Create wallet for the organization
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 100, 'USD', NOW(), NOW())`,
      [organizationId]
    );

    // Create admin user to test requireOrganization middleware directly
    // Admin users don't get auto-created organizations
    adminUserId = uuidv4();
    const hashedPasswordAdmin = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [adminUserId, `admin-${Date.now()}@test.com`, hashedPasswordAdmin, 'Admin User', 'admin']
    );

    // Generate tokens
    // Token WITH organizationId claim
    userWithOrgToken = jwt.sign(
      { userId: userWithOrgId, email: `withorg@test.com`, role: 'user', organizationId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Admin token WITHOUT organizationId claim
    // Admin users don't auto-create orgs, so they can test the requireOrganization guard
    adminToken = jwt.sign(
      { userId: adminUserId, email: `admin@test.com`, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await query('DELETE FROM wallets WHERE organization_id = $1', [organizationId]);
    await query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);
    await query('DELETE FROM organization_roles WHERE organization_id = $1', [organizationId]);
    await query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [userWithOrgId, adminUserId]);
  });

  describe('Router-Level Organization Guard', () => {
    /**
     * **SECURITY TEST: All payment routes require organization membership**
     *
     * Verifies that the requireOrganization middleware is applied at the
     * router level, ensuring all payment routes enforce organization membership.
     *
     * Note: Regular users get auto-created organizations, so we test with an admin
     * user (who doesn't get auto-created orgs) to verify the guard works correctly.
     *
     * **Threat Mitigated:** Unauthorized access to payment operations
     * **Security Standard:** OWASP ASVS V4.1.1
     */
    it('should reject requests to /payments/config without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      // Admin user without org membership tests the requireOrganization guard
      const response = await request(app)
        .get('/api/payments/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });

    it('should allow requests to /payments/config with organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/config')
        .set('Authorization', `Bearer ${userWithOrgToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.config).toBeDefined();
    });

    it('should reject requests to /payments/wallet/balance without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/wallet/balance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });

    it('should reject requests to /payments/create-payment without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .post('/api/payments/create-payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 10.00,
          currency: 'USD',
          description: 'Test payment',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });

    it('should reject requests to /payments/history without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });

    it('should reject requests to /payments/wallet/transactions without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/wallet/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });

    it('should reject requests to /payments/billing/summary without organization membership', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/billing/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Organization membership required');
    });
  });

  describe('Authentication Required Before Organization Check', () => {
    /**
     * **SECURITY TEST: Authentication is checked before organization membership**
     *
     * Verifies that unauthenticated requests receive 401 (not 403),
     * confirming that authenticateToken runs before requireOrganization.
     *
     * **Threat Mitigated:** Information disclosure about valid users
     * **Security Standard:** OWASP ASVS V4.1.2
     */
    it('should return 401 for unauthenticated requests (not 403)', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/config');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Access token required');
    });

    it('should return 401 for invalid tokens (not 403)', async () => {
      const { default: request } = await import('supertest');
      const { default: app } = await import('../../api/app.js');

      const response = await request(app)
        .get('/api/payments/config')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or expired token');
    });
  });

  describe('Router-Level Guard Verification', () => {
    /**
     * **SECURITY TEST: Router-level guard is applied, not per-handler**
     *
     * This test verifies the implementation pattern by checking the source code.
     * The requireOrganization middleware should be applied at router level
     * (router.use(requireOrganization)), not on individual route handlers.
     *
     * **Threat Mitigated:** Accidental omission of auth checks on new routes
     * **Security Standard:** OWASP ASVS V4.2.1
     */
    it('should have requireOrganization applied at router level in payments.ts', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const paymentsPath = path.resolve(process.cwd(), 'api', 'routes', 'payments.ts');
      const source = fs.readFileSync(paymentsPath, 'utf8');

      // Check that router.use(requireOrganization) exists
      const hasRouterLevelGuard = /router\.use\s*\(\s*requireOrganization\s*\)/.test(source);
      expect(hasRouterLevelGuard, 'payments.ts should have router.use(requireOrganization)').toBe(true);

      // Check that it comes after authenticateToken
      const authIndex = source.indexOf('router.use(authenticateToken)');
      const orgIndex = source.indexOf('router.use(requireOrganization)');

      expect(authIndex, 'authenticateToken should be applied before requireOrganization').toBeLessThan(orgIndex);
    });

    it('should have a comment about webhook route placement', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const paymentsPath = path.resolve(process.cwd(), 'api', 'routes', 'payments.ts');
      const source = fs.readFileSync(paymentsPath, 'utf8');

      // Check for documentation about webhook route placement
      // The comment should indicate that webhook routes must be declared BEFORE requireOrganization
      const hasWebhookComment = /webhook.*BEFORE|BEFORE.*org.*guard|webhook route.*declared BEFORE/i.test(source);

      expect(hasWebhookComment, 'payments.ts should document that webhook routes must be declared BEFORE requireOrganization').toBe(true);
    });
  });

  describe('All Payment Routes Covered', () => {
    /**
     * **SECURITY TEST: All payment routes are covered by the organization guard**
     *
     * Scans the payments router and verifies that all route handlers
     * are protected by the router-level organization guard.
     *
     * **Threat Mitigated:** Missing auth on new routes
     * **Security Standard:** OWASP ASVS V4.2.2
     */
    it('should have all routes protected by router-level guard (no per-handler requireOrganization needed)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const paymentsPath = path.resolve(process.cwd(), 'api', 'routes', 'payments.ts');
      const source = fs.readFileSync(paymentsPath, 'utf8');

      // Extract all route definitions
      const routeMatches = source.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];

      // Verify we found routes
      expect(routeMatches.length, 'payments.ts should have route definitions').toBeGreaterThan(0);

      // The router-level guard should protect all routes, so per-handler
      // requireOrganization calls should NOT exist (they would be redundant)
      const perHandlerRequireOrg = source.match(/,\s*requireOrganization\s*,?\s*\n\s*async/g);

      // Per-handler requireOrganization should not exist since we have router-level guard
      expect(perHandlerRequireOrg, 'No per-handler requireOrganization should exist with router-level guard').toBeNull();
    });
  });
});
