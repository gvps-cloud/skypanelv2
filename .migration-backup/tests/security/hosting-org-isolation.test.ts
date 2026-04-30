/**
 * SECURITY TEST: Hosting Organization Isolation
 *
 * Validates that hosting subscriptions, services, and admin endpoints
 * are properly scoped to organizations and enforce permissions.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { query } from '../../api/lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Mock EnhanceToggleService so hosting routes are accessible
vi.mock('../../api/services/enhanceToggle.js', () => ({
  EnhanceToggleService: {
    isEffectivelyEnabled: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockResolvedValue({ effectiveEnabled: true }),
  },
}));

// Mock EnhanceService to avoid real API calls
vi.mock('../../api/services/enhanceService.js', () => ({
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
vi.mock('../../api/services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Lazy-load app to avoid initialization during test collection
let app: any;
const getApp = async () => {
  if (!app) {
    const { default: appModule } = await import('../../api/app.js');
    app = appModule;
  }
  return app;
};

describe('Hosting Organization Isolation', () => {
  let org1Id: string;
  let org1UserId: string;
  let org1Token: string;
  let org2Id: string;
  let org2UserId: string;
  let org2Token: string;
  let hostingPlanId: string;
  let org1SubscriptionId: string;

  beforeAll(async () => {
    // Create Org 1 user
    org1UserId = uuidv4();
    const hashedPassword1 = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [org1UserId, `org1-hosting-${Date.now()}@test.com`, hashedPassword1, 'Org 1 Hosting User', 'user']
    );

    // Create Org 1
    const org1Result = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Hosting Org 1', `hosting-org-1-${Date.now()}`, org1UserId]
    );
    org1Id = org1Result.rows[0].id;

    // Get owner role for Org 1
    const ownerRole1Result = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [org1Id]
    );
    const ownerRole1Id = ownerRole1Result.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [org1Id, org1UserId, ownerRole1Id]
    );

    // Create wallet for Org 1
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 100.00, 'USD', NOW(), NOW())`,
      [org1Id]
    );

    // Create Org 2 user
    org2UserId = uuidv4();
    const hashedPassword2 = await bcrypt.hash('Password123!', 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [org2UserId, `org2-hosting-${Date.now()}@test.com`, hashedPassword2, 'Org 2 Hosting User', 'user']
    );

    // Create Org 2
    const org2Result = await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [uuidv4(), 'Hosting Org 2', `hosting-org-2-${Date.now()}`, org2UserId]
    );
    org2Id = org2Result.rows[0].id;

    // Get owner role for Org 2
    const ownerRole2Result = await query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [org2Id]
    );
    const ownerRole2Id = ownerRole2Result.rows[0]?.id;

    await query(
      `INSERT INTO organization_members (organization_id, user_id, role_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [org2Id, org2UserId, ownerRole2Id]
    );

    // Create wallet for Org 2
    await query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, 0, 'USD', NOW(), NOW())`,
      [org2Id]
    );

    // Create a hosting plan
    hostingPlanId = uuidv4();
    await query(
      `INSERT INTO hosting_plans (id, enhance_plan_id, name, description, features, service_type, price_monthly, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [hostingPlanId, 'enhance-plan-123', 'Test Plan', 'Test hosting plan', '{}', 'web', 10.00]
    );

    // Create a hosting subscription in Org 1
    org1SubscriptionId = uuidv4();
    await query(
      `INSERT INTO hosting_subscriptions (id, organization_id, created_by, plan_id, domain, status, next_billing_at, settings)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW() + interval '1 month', $6)`,
      [org1SubscriptionId, org1Id, org1UserId, hostingPlanId, 'example.com', '{}']
    );

    // Generate tokens
    org1Token = jwt.sign(
      { userId: org1UserId, email: `org1-hosting@test.com`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    org2Token = jwt.sign(
      { userId: org2UserId, email: `org2-hosting@test.com`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await query('DELETE FROM hosting_subscriptions WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await query('DELETE FROM hosting_plans WHERE id = $1', [hostingPlanId]);
    await query('DELETE FROM wallets WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await query('DELETE FROM organization_roles WHERE organization_id IN ($1, $2)', [org1Id, org2Id]);
    await query('DELETE FROM organizations WHERE id IN ($1, $2)', [org1Id, org2Id]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [org1UserId, org2UserId]);
  });

  describe('GET /api/hosting/services', () => {
    it('should allow Org 1 user to see their subscription', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const allLayers: string[] = [];
      (testApp as any)._router.stack.forEach((layer: any, idx: number) => {
        allLayers.push(`layer-${idx} name:${layer.name} regexp:${layer.regexp?.toString()}`);
        if (layer.handle?.stack) {
          layer.handle.stack.forEach((subLayer: any, subIdx: number) => {
            allLayers.push(`  sub-${subIdx} name:${subLayer.name} routePath:${subLayer.route?.path} regexp:${subLayer.regexp?.toString()}`);
          });
        }
      });
      const hostingLayers: string[] = [];
      (testApp as any)._router.stack.forEach((layer: any, idx: number) => {
        if (layer.regexp?.toString().includes('hosting')) {
          hostingLayers.push(`layer-${idx} name:${layer.name}`);
          if (layer.handle?.stack) {
            layer.handle.stack.forEach((subLayer: any, subIdx: number) => {
              hostingLayers.push(`  sub-${subIdx} name:${subLayer.name} path:${subLayer.route?.path}`);
            });
          }
        }
      });
      console.log('DEBUG allLayers first test:', JSON.stringify(hostingLayers, null, 2));

      const response = await request(testApp)
        .get('/api/hosting/services')
        .set('Authorization', `Bearer ${org1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.services).toBeDefined();
      const ids = response.body.services.map((s: any) => s.id);
      expect(ids).toContain(org1SubscriptionId);
    });

    it('should NOT show Org 1 subscription to Org 2 user', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const response = await request(testApp)
        .get('/api/hosting/services')
        .set('Authorization', `Bearer ${org2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.services).toBeDefined();
      const ids = response.body.services.map((s: any) => s.id);
      expect(ids).not.toContain(org1SubscriptionId);
    });
  });

  describe('GET /api/hosting/services/:id', () => {
    it('should allow Org 1 user to read their own subscription', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const response = await request(testApp)
        .get(`/api/hosting/services/${org1SubscriptionId}`)
        .set('Authorization', `Bearer ${org1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.service).toBeDefined();
      expect(response.body.service.id).toBe(org1SubscriptionId);
    });

    it('should return 404 when Org 2 user tries to access Org 1 subscription', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const response = await request(testApp)
        .get(`/api/hosting/services/${org1SubscriptionId}`)
        .set('Authorization', `Bearer ${org2Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/hosting/services/:id/cancel', () => {
    it('should return 404 when Org 2 user tries to cancel Org 1 subscription', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const response = await request(testApp)
        .post(`/api/hosting/services/${org1SubscriptionId}/cancel`)
        .set('Authorization', `Bearer ${org2Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/hosting/status', () => {
    it('should return enabled status for unauthenticated request', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      console.log('DEBUG testApp type:', typeof testApp, testApp?.constructor?.name, 'router stack length:', testApp?._router?.stack?.length);

      const response = await request(testApp)
        .get('/api/hosting/status');

      const allLayers: string[] = [];
      if (testApp?._router?.stack) {
        (testApp as any)._router.stack.forEach((layer: any, idx: number) => {
          allLayers.push(`layer-${idx} name:${layer.name} regexp:${layer.regexp?.toString()}`);
          if (layer.handle?.stack) {
            layer.handle.stack.forEach((subLayer: any, subIdx: number) => {
              allLayers.push(`  sub-${subIdx} name:${subLayer.name} routePath:${subLayer.route?.path} regexp:${subLayer.regexp?.toString()}`);
            });
          }
        });
      }
      const stack = (testApp as any)._router.stack;
      console.log('DEBUG layer35:', stack?.[35]?.name, stack?.[35]?.regexp?.toString(), 'subcount:', stack?.[35]?.handle?.stack?.length);
      console.log('DEBUG layer35 sub0:', stack?.[35]?.handle?.stack?.[0]?.name, stack?.[35]?.handle?.stack?.[0]?.route?.path);
      console.log('DEBUG layer36:', stack?.[36]?.name, stack?.[36]?.regexp?.toString(), 'subcount:', stack?.[36]?.handle?.stack?.length);
      console.log('DEBUG status response:', response.status, response.body, response.text);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled');
      expect(typeof response.body.enabled).toBe('boolean');
    });
  });

  describe('GET /api/admin/enhance/subscriptions', () => {
    it('should return 403 for non-admin user', async () => {
      const testApp = await getApp();
      const { default: request } = await import('supertest');

      const response = await request(testApp)
        .get('/api/admin/enhance/subscriptions')
        .set('Authorization', `Bearer ${org1Token}`);

      expect(response.status).toBe(403);
    });
  });
});
