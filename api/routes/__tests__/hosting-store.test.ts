import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import app from '../../app.js';

const mockEnsureEnhanceCustomerForPurchase = vi.hoisted(() => vi.fn());
const mockCreateCustomerSubscription = vi.hoisted(() => vi.fn());
const mockCreateWebsite = vi.hoisted(() => vi.fn());
const mockDeleteWebsite = vi.hoisted(() => vi.fn());
const mockDeleteSubscription = vi.hoisted(() => vi.fn());
const mockGetStagingDomain = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockSendEnhanceCredentialsEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockIsEffectivelyEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../../services/enhanceService.js', () => ({
  EnhanceService: {
    createCustomerSubscription: (...args: any[]) => mockCreateCustomerSubscription(...args),
    createWebsite: (...args: any[]) => mockCreateWebsite(...args),
    deleteWebsite: (...args: any[]) => mockDeleteWebsite(...args),
    deleteSubscription: (...args: any[]) => mockDeleteSubscription(...args),
    getStagingDomain: (...args: any[]) => mockGetStagingDomain(...args),
  },
}));

vi.mock('../../services/enhanceOnboardingService.js', () => ({
  EnhanceOnboardingService: {
    ensureEnhanceCustomerForPurchase: (...args: any[]) => mockEnsureEnhanceCustomerForPurchase(...args),
  },
}));

vi.mock('../../services/emailService.js', () => ({
  sendEnhanceCredentialsEmail: (...args: any[]) => mockSendEnhanceCredentialsEmail(...args),
}));

vi.mock('../../services/enhanceToggle.js', () => ({
  EnhanceToggleService: {
    isEffectivelyEnabled: (...args: any[]) => mockIsEffectivelyEnabled(...args),
  },
}));

describe('Hosting Store Routes', () => {
  let pool: Pool;
  let testOrgId: string;
  let testUserId: string;
  let authToken: string;
  let jwt: typeof import('jsonwebtoken');
  let planId: string;
  let inactivePlanId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEffectivelyEnabled.mockResolvedValue(true);
    mockSendEnhanceCredentialsEmail.mockResolvedValue(undefined);
  });

  beforeAll(async () => {
    jwt = await import('jsonwebtoken');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), `hosting-store-${Date.now()}@example.com`, 'Hosting Store User', 'user', 'hash']
    );
    testUserId = userResult.rows[0].id;

    // Create test organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), 'Hosting Store Org', 'hosting-store-org-' + Date.now(), testUserId, '{}']
    );
    testOrgId = orgResult.rows[0].id;

    // Set active organization
    await pool.query(
      'UPDATE users SET active_organization_id = $1 WHERE id = $2',
      [testOrgId, testUserId]
    );

    // Update owner role to include hosting permissions
    await pool.query(
      `UPDATE organization_roles
       SET permissions = permissions || '["hosting_view","hosting_manage"]'::jsonb
       WHERE organization_id = $1 AND name = 'owner'`,
      [testOrgId]
    );

    const ownerRoleResult = await pool.query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [testOrgId]
    );
    const ownerRoleId = ownerRoleResult.rows[0].id;

    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
       VALUES ($1, $2, 'owner', $3, NOW())`,
      [testOrgId, testUserId, ownerRoleId]
    );

    // Create wallet with balance
    await pool.query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'USD', NOW(), NOW())`,
      [testOrgId, 50.00]
    );

    // Create active hosting plan
    const planResult = await pool.query(
      `INSERT INTO hosting_plans (id, enhance_plan_id, name, description, features, service_type, price_monthly, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), '101', 'Basic Hosting', 'Basic plan', '{}', 'web', 10.00]
    );
    planId = planResult.rows[0].id;

    // Create inactive hosting plan
    const inactivePlanResult = await pool.query(
      `INSERT INTO hosting_plans (id, enhance_plan_id, name, description, features, service_type, price_monthly, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), '102', 'Pro Hosting', 'Pro plan', '{}', 'web', 25.00]
    );
    inactivePlanId = inactivePlanResult.rows[0].id;

    // Ensure platform_integrations has enhance row
    await pool.query(
      `INSERT INTO platform_integrations (slug, display_name, enabled, created_at, updated_at)
       VALUES ('enhance', 'Enhance Web Hosting', true, NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET enabled = EXCLUDED.enabled`
    );

    authToken = jwt.sign(
      { userId: testUserId, email: `hosting-store-${Date.now()}@example.com`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM hosting_subscriptions WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM hosting_plans WHERE id = $1 OR id = $2', [planId, inactivePlanId]);
    await pool.query('DELETE FROM payment_transactions WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM wallets WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_roles WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('GET /api/hosting/plans', () => {
    it('returns only active plans', async () => {
      const response = await request(app)
        .get('/api/hosting/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.plans)).toBe(true);
      const planIds = response.body.plans.map((p: any) => p.id);
      expect(planIds).toContain(planId);
      expect(planIds).not.toContain(inactivePlanId);
    });
  });

  describe('POST /api/hosting/purchase', () => {
    it('returns first-time onboarding flags when credentials are created and emailed', async () => {
      await pool.query('UPDATE wallets SET balance = 50 WHERE organization_id = $1', [testOrgId]);

      mockEnsureEnhanceCustomerForPurchase.mockResolvedValue({
        enhanceCustomerId: 'cust-123',
        purchaserLoginId: 'login-123',
        purchaserMemberId: 'member-123',
        credentialsCreated: true,
        credentialsEmail: {
          recipient: 'buyer@example.com',
          displayName: 'Buyer User',
          firstName: 'Buyer',
          organizationName: 'Hosting Store Org',
          password: 'Password123!',
        },
        ownerAssigned: true,
      });
      mockCreateCustomerSubscription.mockResolvedValue({ id: '123' });
      mockCreateWebsite.mockResolvedValue({ id: 'web-123', primary_ip: '1.2.3.4' });

      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId, domain: 'first-purchase.com' })
        .expect(201);

      expect(response.body.credentialsCreated).toBe(true);
      expect(response.body.credentialsEmailed).toBe(true);
      expect(mockEnsureEnhanceCustomerForPurchase).toHaveBeenCalledWith({
        organizationId: testOrgId,
        purchaserUserId: testUserId,
      });
      expect(mockSendEnhanceCredentialsEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@example.com',
          organizationName: 'Hosting Store Org',
        })
      );
      expect(mockCreateWebsite).toHaveBeenCalledWith('cust-123', {
        subscriptionId: 123,
        domain: 'first-purchase.com',
      });
    });

    it('rejects missing planId', async () => {
      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ domain: 'example.com' })
        .expect(400);

      expect(response.body.error).toContain('planId and domain are required');
    });

    it('rejects missing domain (and no useStagingDomain)', async () => {
      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId })
        .expect(400);

      expect(response.body.error).toContain('planId and domain are required');
    });

    it('rejects insufficient balance', async () => {
      // Set wallet balance below plan price
      await pool.query('UPDATE wallets SET balance = 5 WHERE organization_id = $1', [testOrgId]);

      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId, domain: 'example.com' })
        .expect(500);

      expect(response.body.error).toContain('Insufficient wallet balance');

      // Verify no subscription was created
      const subResult = await pool.query(
        'SELECT * FROM hosting_subscriptions WHERE organization_id = $1 AND domain = $2',
        [testOrgId, 'example.com']
      );
      expect(subResult.rows.length).toBe(0);
    });

    it('successfully purchases hosting with sufficient balance', async () => {
      // Restore balance
      await pool.query('UPDATE wallets SET balance = 50 WHERE organization_id = $1', [testOrgId]);

      mockEnsureEnhanceCustomerForPurchase.mockResolvedValue({
        enhanceCustomerId: 'cust-123',
        purchaserLoginId: 'login-123',
        purchaserMemberId: 'member-123',
        credentialsCreated: false,
        credentialsEmail: null,
        ownerAssigned: false,
      });
      mockCreateCustomerSubscription.mockResolvedValue({ id: '123' });
      mockCreateWebsite.mockResolvedValue({ id: 'web-123', primary_ip: '1.2.3.4' });

      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId, domain: 'purchase-test.com' })
        .expect(201);

      expect(response.body.subscription.status).toBe('active');
      expect(response.body.credentialsCreated).toBe(false);
      expect(response.body.credentialsEmailed).toBe(false);
      expect(mockCreateWebsite).toHaveBeenCalledWith('cust-123', {
        subscriptionId: 123,
        domain: 'purchase-test.com',
      });

      // Verify wallet was debited
      const walletResult = await pool.query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [testOrgId]
      );
      expect(Number(walletResult.rows[0].balance)).toBe(40.00);

      // Verify subscription was created
      const subResult = await pool.query(
        'SELECT * FROM hosting_subscriptions WHERE organization_id = $1 AND domain = $2',
        [testOrgId, 'purchase-test.com']
      );
      expect(subResult.rows.length).toBe(1);
      expect(subResult.rows[0].status).toBe('active');
    });

    it('includes serverGroupId when plan allows server group selection', async () => {
      // Create a plan that allows server group selection
      const sgPlanResult = await pool.query(
        `INSERT INTO hosting_plans (id, enhance_plan_id, name, description, features, service_type, price_monthly, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id`,
        [randomUUID(), 'ep-999', 'SG Plan', 'Plan allowing server group selection',
         '{"allowServerGroupSelection":true}', 'web', 10.00]
      );
      const sgPlanId = sgPlanResult.rows[0].id;

      await pool.query('UPDATE wallets SET balance = 100 WHERE organization_id = $1', [testOrgId]);

      mockEnsureEnhanceCustomerForPurchase.mockResolvedValue({
        enhanceCustomerId: 'cust-123',
        purchaserLoginId: 'login-123',
        purchaserMemberId: 'member-123',
        credentialsCreated: false,
        credentialsEmail: null,
        ownerAssigned: false,
      });
      mockCreateCustomerSubscription.mockResolvedValue({ id: 456 });
      mockCreateWebsite.mockResolvedValue({ id: 'web-sg-1' });

      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: sgPlanId, domain: 'sg-test.com' });

      expect(response.status).toBe(201);
      expect(mockCreateWebsite).toHaveBeenCalledWith('cust-123', {
        subscriptionId: 456,
        domain: 'sg-test.com',
        serverGroupId: expect.any(String),
      });

      // Cleanup
      await pool.query('DELETE FROM hosting_subscriptions WHERE plan_id = $1', [sgPlanId]);
      await pool.query('DELETE FROM hosting_plans WHERE id = $1', [sgPlanId]);
    });

    it('resolves staging domain when useStagingDomain is true', async () => {
      await pool.query('UPDATE wallets SET balance = 100 WHERE organization_id = $1', [testOrgId]);

      mockGetStagingDomain.mockResolvedValue('staging.examplehost.com');
      mockEnsureEnhanceCustomerForPurchase.mockResolvedValue({
        enhanceCustomerId: 'cust-123',
        purchaserLoginId: 'login-123',
        purchaserMemberId: 'member-123',
        credentialsCreated: false,
        credentialsEmail: null,
        ownerAssigned: false,
      });
      mockCreateCustomerSubscription.mockResolvedValue({ id: 789 });
      mockCreateWebsite.mockResolvedValue({ id: 'web-staging-1' });

      const response = await request(app)
        .post('/api/hosting/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId, useStagingDomain: true });

      expect(response.status).toBe(201);
      expect(response.body.stagingDomain).toBe(true);
      // The domain should end with the staging suffix
      expect(response.body.subscription.domain).toMatch(/\.staging\.examplehost\.com$/);
      // serverGroupId should NOT be in the payload (features='{}' → allowServerGroupSelection=false)
      expect(mockCreateWebsite).toHaveBeenCalledWith('cust-123', {
        subscriptionId: 789,
        domain: expect.stringMatching(/\.staging\.examplehost\.com$/),
      });

      // Cleanup
      await pool.query('DELETE FROM hosting_subscriptions WHERE domain LIKE $1', ['%.staging.examplehost.com']);
    });
  });

  describe('POST /api/hosting/services/:id/cancel', () => {
    it('resolves org-scoped subscription', async () => {
      await pool.query(
        'UPDATE organizations SET enhance_customer_id = $1 WHERE id = $2',
        ['cust-org-999', testOrgId]
      );

      // Create a subscription for the org
      const subResult = await pool.query(
        `INSERT INTO hosting_subscriptions (organization_id, created_by, plan_id, domain, status, next_billing_at, enhance_website_id, enhance_subscription_id)
         VALUES ($1, $2, $3, $4, 'active', NOW() + interval '1 month', 'web-999', 'sub-999')
         RETURNING id`,
        [testOrgId, testUserId, planId, 'cancel-test.com']
      );
      const subId = subResult.rows[0].id;

      mockDeleteWebsite.mockResolvedValue(undefined);
      mockDeleteSubscription.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/api/hosting/services/${subId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDeleteWebsite).toHaveBeenCalledWith('cust-org-999', 'web-999');
      expect(mockDeleteSubscription).toHaveBeenCalledWith(expect.any(String), 'sub-999');

      // Verify subscription was cancelled
      const updatedSub = await pool.query(
        'SELECT status FROM hosting_subscriptions WHERE id = $1',
        [subId]
      );
      expect(updatedSub.rows[0].status).toBe('cancelled');
    });
  });

  describe('Cross-org access blocking', () => {
    it('blocks GET service detail for subscription in another org', async () => {
      // Create another org
      const otherOrgResult = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'Other Org', 'other-org-' + Date.now(), testUserId, '{}']
      );
      const otherOrgId = otherOrgResult.rows[0].id;

      // Create subscription in other org
      const subResult = await pool.query(
        `INSERT INTO hosting_subscriptions (organization_id, created_by, plan_id, domain, status, next_billing_at)
         VALUES ($1, $2, $3, $4, 'active', NOW() + interval '1 month')
         RETURNING id`,
        [otherOrgId, testUserId, planId, 'other-org.com']
      );
      const otherSubId = subResult.rows[0].id;

      const response = await request(app)
        .get(`/api/hosting/services/${otherSubId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('Service not found');

      // Cleanup
      await pool.query('DELETE FROM hosting_subscriptions WHERE id = $1', [otherSubId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrgId]);
    });

    it('blocks POST cancel for subscription in another org', async () => {
      const otherOrgResult = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'Other Org 2', 'other-org-2-' + Date.now(), testUserId, '{}']
      );
      const otherOrgId = otherOrgResult.rows[0].id;

      const subResult = await pool.query(
        `INSERT INTO hosting_subscriptions (organization_id, created_by, plan_id, domain, status, next_billing_at, enhance_website_id, enhance_subscription_id)
         VALUES ($1, $2, $3, $4, 'active', NOW() + interval '1 month', 'web-888', 'sub-888')
         RETURNING id`,
        [otherOrgId, testUserId, planId, 'other-org-2.com']
      );
      const otherSubId = subResult.rows[0].id;

      const response = await request(app)
        .post(`/api/hosting/services/${otherSubId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('Service not found');

      // Verify subscription is still active
      const updatedSub = await pool.query(
        'SELECT status FROM hosting_subscriptions WHERE id = $1',
        [otherSubId]
      );
      expect(updatedSub.rows[0].status).toBe('active');

      // Cleanup
      await pool.query('DELETE FROM hosting_subscriptions WHERE id = $1', [otherSubId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrgId]);
    });
  });
});
