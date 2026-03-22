/**
 * Tests for egress wallet purchase functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
      ['test-wallet-user-' + Date.now(), 'test-wallet@example.com', 'Test Wallet User', 'user', 'hash']
    );
    testUserId = userResult.rows[0].id;

    // Create test organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['test-wallet-org-' + Date.now(), 'Test Wallet Org', 'test-wallet-org', testUserId, {}]
    );
    testOrgId = orgResult.rows[0].id;

    // Add user to organization
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, 'admin', NOW(), NOW())`,
      [testOrgId, testUserId]
    );

    // Create wallet with initial balance
    await pool.query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'USD', NOW(), NOW())`,
      [testOrgId, 100.00]
    );

    // Generate auth token
    authToken = jwt.sign(
      { id: testUserId, email: 'test-wallet@example.com', role: 'user', organizationId: testOrgId },
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
      // Create user with no wallet
      const noWalletUser = await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        ['no-wallet-user-' + Date.now(), 'no-wallet@example.com', 'No Wallet User', 'user', 'hash']
      );

      const noWalletOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        ['no-wallet-org-' + Date.now(), 'No Wallet Org', 'no-wallet-org', noWalletUser.rows[0].id, {}]
      );

      const noWalletToken = jwt.sign(
        { id: noWalletUser.rows[0].id, email: 'no-wallet@example.com', role: 'user', organizationId: noWalletOrg.rows[0].id },
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
      // Ensure credit packs exist in platform_settings
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify([
          { id: '100gb', gb: 100, price: 0.60, isPopular: true, isRecommended: false },
          { id: '1tb', gb: 1000, price: 5.00, isPopular: false, isRecommended: true },
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
      const response = await request(app)
        .post('/api/egress/credits/purchase/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          organizationId: testOrgId,
          packId: '1tb' // Costs $5.00, wallet only has $100
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
        ['other-wallet-org-' + Date.now(), 'Other Wallet Org', 'other-wallet-org', 'other-user-id', {}]
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

  describe('POST /api/egress/credits/purchase/complete with organizationId', () => {
    it('should complete purchase with provided organizationId', async () => {
      // First create a PayPal payment transaction
      const paymentResult = await pool.query(
        `INSERT INTO payment_transactions (organization_id, amount, currency, payment_method, payment_provider, status, paypal_order_id, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING id`,
        [testOrgId, 0.60, 'USD', 'paypal', 'paypal', 'completed', 'test-paypal-order-' + Date.now(), 'Egress credit purchase']
      );
      const transactionId = paymentResult.rows[0].id;

      // Ensure credit packs exist
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('egress_credit_packs', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify([{ id: '100gb', gb: 100, price: 0.60 }])]
      );

      const response = await request(app)
        .post('/api/egress/credits/purchase/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: 'test-paypal-order-' + Date.now(),
          packId: '100gb',
          organizationId: testOrgId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newBalance).toBeDefined();
    });

    it('should reject completion for organization user is not member of', async () => {
      const otherOrg = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        ['other-complete-org-' + Date.now(), 'Other Complete Org', 'other-complete-org', 'other-user-id', {}]
      );

      const response = await request(app)
        .post('/api/egress/credits/purchase/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: 'some-payment-id',
          packId: '100gb',
          organizationId: otherOrg.rows[0].id
        })
        .expect(403);

      expect(response.body.success).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrg.rows[0].id]);
    });
  });
});
