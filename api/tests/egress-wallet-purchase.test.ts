/**
 * Tests for egress wallet purchase functionality
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import app from '../app';

describe('Egress Wallet Purchase API', () => {
  let pool: Pool;
  let testOrgId: string;
  let testUserId: string;
  let authToken: string;
  let jwt: typeof import('jsonwebtoken');

  beforeAll(async () => {
    jwt = await import('jsonwebtoken');

    // Set up test database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), `tw-${Date.now()}@example.com`, 'Test Wallet User', 'user', 'hash']
    );
    testUserId = userResult.rows[0].id;

    // Create test organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), 'Test Wallet Org', 'test-wallet-org-' + Date.now(), testUserId, {}]
    );
    testOrgId = orgResult.rows[0].id;

    // The DB trigger auto-creates default roles on org INSERT (migration 015).
    // Those roles lack egress permissions (added later by migration 032).
    // Update the auto-created owner role to include egress_view and egress_manage.
    await pool.query(
      `UPDATE organization_roles
       SET permissions = permissions || '["egress_view","egress_manage"]'::jsonb
       WHERE organization_id = $1 AND name = 'owner'`,
      [testOrgId]
    );

    // Look up the owner role ID (created by the trigger)
    const ownerRoleResult = await pool.query(
      `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`,
      [testOrgId]
    );
    const ownerRoleId = ownerRoleResult.rows[0].id;

    // Add user to organization as owner with role_id set (required for RoleService.checkPermission)
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
       VALUES ($1, $2, 'owner', $3, NOW())`,
      [testOrgId, testUserId, ownerRoleId]
    );

    // Create wallet with initial balance
    await pool.query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'USD', NOW(), NOW())`,
      [testOrgId, 100.00]
    );

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUserId, email: `tw-${Date.now()}@example.com`, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM organization_egress_credits WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM egress_credit_packs WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM payment_transactions WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM wallets WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_roles WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('GET /api/egress/credits/wallet-balance', () => {
    it('should return wallet balance for authenticated user', async () => {
      const response = await request(app)
        .get('/api/egress/credits/wallet-balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBeDefined();
      expect(response.body.data.balance).toBe(100.00);
    });

    it('should return 0 balance if wallet does not exist', async () => {
      // Create user with no wallet (use unique email to avoid constraint violations)
      const uniqueEmail = `nw-${randomUUID()}@example.com`;
      const noWalletUser = await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), uniqueEmail, 'No Wallet User', 'user', 'hash']
      );

      const noWalletOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'No Wallet Org', 'no-wallet-org-' + Date.now(), noWalletUser.rows[0].id, {}]
      );

      const noWalletToken = jwt.sign(
        { userId: noWalletUser.rows[0].id, email: uniqueEmail, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/egress/credits/wallet-balance')
        .set('Authorization', `Bearer ${noWalletToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);

      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id = $1', [noWalletOrg.rows[0].id]);
      await pool.query('DELETE FROM users WHERE id = $1', [noWalletUser.rows[0].id]);
    });
  });

  describe('POST /api/egress/credits/purchase/wallet', () => {
    beforeEach(async () => {
      // Ensure credit packs exist in platform_settings.
      // 1tb is priced at $200 so it exceeds the $100 starting wallet balance.
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify([
          { id: '100gb', gb: 100, price: 0.60, isPopular: true, isRecommended: false },
          { id: '1tb', gb: 1000, price: 200.00, isPopular: false, isRecommended: true },
        ])]
      );
    });

    it('should successfully purchase egress credits with wallet', async () => {
      const response = await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testOrgId,
          packId: '100gb'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newBalance).toBeDefined();
      expect(response.body.data.walletDeducted).toBe(0.60);

      // Verify egress credits were added
      const creditsResult = await pool.query(
        'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1',
        [testOrgId]
      );
      expect(creditsResult.rows.length).toBeGreaterThan(0);
      expect(Number(creditsResult.rows[0].credits_gb)).toBeGreaterThanOrEqual(100);

      // Verify wallet was deducted
      const walletResult = await pool.query(
        'SELECT balance FROM wallets WHERE organization_id = $1',
        [testOrgId]
      );
      expect(Number(walletResult.rows[0].balance)).toBeLessThan(100);
    });

    it('should reject purchase with insufficient wallet balance', async () => {
      // 1tb costs $200, wallet has ~$99.40 (after prior test) — insufficient
      const response = await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testOrgId,
          packId: '1tb'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient wallet balance');
    });

    it('should reject purchase for invalid pack ID', async () => {
      const response = await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testOrgId,
          packId: 'invalid-pack-id'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should reject purchase for organization user is not member of', async () => {
      const otherOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'Other Wallet Org', 'other-wallet-org-' + Date.now(), testUserId, {}]
      );

      const response = await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: otherOrg.rows[0].id,
          packId: '100gb'
        })
        .expect(403);

      expect(response.body.success).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrg.rows[0].id]);
    });

    it('should create proper transaction records', async () => {
      await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testOrgId,
          packId: '100gb'
        })
        .expect(200);

      // Verify wallet debit transaction
      const transactionResult = await pool.query(
        `SELECT * FROM payment_transactions
         WHERE organization_id = $1 AND payment_method = 'wallet_debit'
         ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(transactionResult.rows.length).toBeGreaterThan(0);
      expect(Number(transactionResult.rows[0].amount)).toBe(-0.60);

      // Verify credit pack purchase record
      const packResult = await pool.query(
        `SELECT * FROM egress_credit_packs
         WHERE organization_id = $1 AND pack_id = $2 AND adjustment_type = 'purchase'
         ORDER BY created_at DESC LIMIT 1`,
        [testOrgId, '100gb']
      );
      expect(packResult.rows.length).toBeGreaterThan(0);
      expect(Number(packResult.rows[0].credits_gb)).toBe(100);
      expect(Number(packResult.rows[0].amount_paid)).toBe(0.60);
    });
  });

  describe('POST /api/organizations/:id/egress/credits/purchase/complete', () => {
    it('should complete purchase with provided organizationId', async () => {
      // Store paymentId so it matches in both the INSERT and the request body
      const paymentId = 'test-paypal-order-' + Date.now();

      // First create a PayPal payment transaction
      await pool.query(
        `INSERT INTO payment_transactions (organization_id, amount, currency, payment_method, payment_provider, status, provider_transaction_id, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [testOrgId, 0.60, 'USD', 'paypal', 'paypal', 'completed', paymentId, 'Egress credit purchase']
      );

      // Ensure credit packs exist
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify([{ id: '100gb', gb: 100, price: 0.60 }])]
      );

      const response = await request(app)
        .post(`/api/organizations/${testOrgId}/egress/credits/purchase/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId,
          packId: '100gb',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject completion for organization user is not member of', async () => {
      const otherOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'Other Complete Org', 'other-complete-org-' + Date.now(), testUserId, {}]
      );

      const response = await request(app)
        .post(`/api/organizations/${otherOrg.rows[0].id}/egress/credits/purchase/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: 'some-payment-id',
          packId: '100gb',
        })
        .expect(403);

      expect(response.body.error).toBeDefined();

      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrg.rows[0].id]);
    });
  });

  describe('POST /api/egress/credits/refund/wallet', () => {
    beforeEach(async () => {
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify([{ id: '100gb', gb: 100, price: 0.6 }])]
      );
      await pool.query(
        `INSERT INTO organization_egress_credits (organization_id, credits_gb, created_at, updated_at)
         VALUES ($1, 500, NOW(), NOW())
         ON CONFLICT (organization_id)
         DO UPDATE SET credits_gb = 500, updated_at = NOW()`,
        [testOrgId]
      );
    });

    it('should credit main wallet and deduct egress credits', async () => {
      const walletBefore = await pool.query('SELECT balance FROM wallets WHERE organization_id = $1', [testOrgId]);
      const creditsBefore = await pool.query(
        'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1',
        [testOrgId]
      );
      const w0 = Number(walletBefore.rows[0].balance);
      const c0 = Number(creditsBefore.rows[0].credits_gb);

      const response = await request(app)
        .post('/api/egress/credits/refund/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: testOrgId, amount: 0.6 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.creditsDeductedGb).toBeCloseTo(100, 1);

      const walletAfter = await pool.query('SELECT balance FROM wallets WHERE organization_id = $1', [testOrgId]);
      const creditsAfter = await pool.query(
        'SELECT credits_gb FROM organization_egress_credits WHERE organization_id = $1',
        [testOrgId]
      );
      expect(Number(walletAfter.rows[0].balance)).toBeCloseTo(w0 + 0.6, 2);
      expect(Number(creditsAfter.rows[0].credits_gb)).toBeCloseTo(c0 - 100, 1);

      const packRow = await pool.query(
        `SELECT adjustment_type, pack_id FROM egress_credit_packs
         WHERE organization_id = $1 AND adjustment_type = 'customer_refund'
         ORDER BY created_at DESC LIMIT 1`,
        [testOrgId]
      );
      expect(packRow.rows[0].pack_id).toBe('customer_refund');
    });

    it('should reject refund above available credit value', async () => {
      const response = await request(app)
        .post('/api/egress/credits/refund/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: testOrgId, amount: 99999 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject refund for a different organization', async () => {
      const otherOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [randomUUID(), 'Egress Refund Other', 'egress-refund-other-' + Date.now(), testUserId, {}]
      );

      const response = await request(app)
        .post('/api/egress/credits/refund/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ organizationId: otherOrg.rows[0].id, amount: 1 })
        .expect(403);

      expect(response.body.success).toBe(false);

      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrg.rows[0].id]);
    });
  });
});
