/**
 * Hosting Purchase Saga Tests
 *
 * End-to-end tests for the hosting purchase flow covering:
 * - Happy path: successful purchase with wallet debit and remote resource creation
 * - Failure path: remote error triggers compensation (wallet credit + error status)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Mock EnhanceToggleService so hosting routes are accessible
vi.mock('../services/enhanceToggle.js', () => ({
  EnhanceToggleService: {
    isEffectivelyEnabled: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockResolvedValue({ effectiveEnabled: true }),
  },
}));

// Mock EnhanceService methods; per-test behavior set via vi.mocked(...)
vi.mock('../services/enhanceService.js', () => ({
  EnhanceService: {
    createCustomer: vi.fn(),
    createCustomerSubscription: vi.fn(),
    createWebsite: vi.fn(),
    deleteWebsite: vi.fn().mockResolvedValue(undefined),
    deleteSubscription: vi.fn().mockResolvedValue(undefined),
    getServerGroups: vi.fn().mockResolvedValue([]),
  },
}));

// Mock activity logger
vi.mock('../services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Lazy-load app and supertest
let app: any;
const getApp = async () => {
  if (!app) {
    const { default: appModule } = await import('../app.js');
    app = appModule;
  }
  return app;
};

describe('Hosting Purchase Saga', () => {
  let testUserId: string;
  let testOrgId: string;
  let authToken: string;
  let hostingPlanId: string;

  beforeAll(async () => {
    // Create test user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, `saga-user-${Date.now()}@test.com`, hashedPassword, 'Saga Test User', 'user']
    );

    // Create test organization
    const orgResult = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Saga Test Org', `saga-test-org-${Date.now()}`, testUserId]
    );
    testOrgId = orgResult.rows[0].id;

    // Get owner role
    const ownerRoleResult = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [testOrgId]
    );
    const ownerRoleId = ownerRoleResult.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [testOrgId, testUserId, ownerRoleId]
    );

    // Create wallet with $100 balance
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 100.00, 'USD', NOW(), NOW())`,
      [testOrgId]
    );

    // Create hosting plan priced at $10/month (use unique enhance_plan_id to avoid collisions)
    hostingPlanId = uuidv4();
    await query(
      `INSERT INTO hosting_plans (id, enhance_plan_id, name, description, features, service_type, price_monthly, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [hostingPlanId, `enhance-plan-saga-${Date.now()}`, 'Saga Plan', 'Test plan for saga', '{}', 'web', 10.00]
    );

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUserId, email: `saga-user@test.com`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    // Reset test data between tests
    await query('DELETE FROM hosting_subscriptions WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM payment_transactions WHERE organization_id = $1', [testOrgId]);
    await query('UPDATE wallets SET balance = 100.00 WHERE organization_id = $1', [testOrgId]);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await query('DELETE FROM hosting_subscriptions WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM payment_transactions WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM wallets WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM organization_roles WHERE organization_id = $1', [testOrgId]);
    await query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await query('DELETE FROM users WHERE id = $1', [testUserId]);
    await query('DELETE FROM hosting_plans WHERE id = $1', [hostingPlanId]);
  });

  describe('Happy Path', () => {
    it('should purchase hosting, debit wallet, and create active subscription', async () => {
      const { EnhanceService } = await import('../services/enhanceService.js');
      const { default: request } = await import('supertest');
      const testApp = await getApp();

      // Mock remote Enhance calls
      vi.mocked(EnhanceService.createCustomer).mockResolvedValue({ id: 'fake-customer-id' });
      vi.mocked(EnhanceService.createCustomerSubscription).mockResolvedValue({ id: 'fake-subscription-id' });
      vi.mocked(EnhanceService.createWebsite).mockResolvedValue({
        id: 'fake-website-id',
        primary_ip: '203.0.113.1',
      });

      const response = await request(testApp)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: hostingPlanId,
          domain: 'saga-test.example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.status).toBe('active');

      // Assert wallet debited to $90
      const walletResult = await query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [testOrgId]
      );
      expect(Number(walletResult.rows[0].balance)).toBe(90.00);

      // Assert wallet_debit transaction exists
      const debitResult = await query(
        `SELECT * FROM payment_transactions
         WHERE organization_id = $1 AND payment_method = 'wallet_debit'
         ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(debitResult.rows.length).toBe(1);
      expect(Number(debitResult.rows[0].amount)).toBe(-10.00);

      // Assert hosting_subscriptions is active with remote IDs
      const subResult = await query(
        `SELECT * FROM hosting_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(subResult.rows.length).toBe(1);
      expect(subResult.rows[0].status).toBe('active');
      expect(subResult.rows[0].enhance_subscription_id).toBe('fake-subscription-id');
      expect(subResult.rows[0].enhance_website_id).toBe('fake-website-id');
      expect(subResult.rows[0].primary_ip).toBe('203.0.113.1');
    });
  });

  describe('Failure Path (remote error)', () => {
    it('should compensate wallet and mark subscription error when createWebsite fails', async () => {
      const { EnhanceService } = await import('../services/enhanceService.js');
      const { default: request } = await import('supertest');
      const testApp = await getApp();

      // Mock remote calls: createCustomer and createSubscription succeed, createWebsite fails
      vi.mocked(EnhanceService.createCustomer).mockResolvedValue({ id: 'fake-customer-id' });
      vi.mocked(EnhanceService.createCustomerSubscription).mockResolvedValue({ id: 'fake-subscription-id' });
      vi.mocked(EnhanceService.createWebsite).mockRejectedValue(new Error('Remote website creation failed'));

      const response = await request(testApp)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planId: hostingPlanId,
          domain: 'saga-fail.example.com',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Remote website creation failed');

      // Assert wallet balance restored to $100
      const walletResult = await query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [testOrgId]
      );
      expect(Number(walletResult.rows[0].balance)).toBe(100.00);

      // Assert compensating wallet_credit transaction exists
      const creditResult = await query(
        `SELECT * FROM payment_transactions
         WHERE organization_id = $1 AND payment_method = 'wallet_credit'
         ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(creditResult.rows.length).toBe(1);
      expect(Number(creditResult.rows[0].amount)).toBe(10.00);
      expect(creditResult.rows[0].description).toContain('rollback');

      // Assert hosting_subscriptions row has status 'error'
      const subResult = await query(
        `SELECT * FROM hosting_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(subResult.rows.length).toBe(1);
      expect(subResult.rows[0].status).toBe('error');
    });
  });
});
