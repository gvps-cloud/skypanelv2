/**
 * Tests for hosting wallet → main wallet withdrawal
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import app from '../app';

describe('Hosting wallet withdraw API', () => {
  let pool: Pool;
  let testOrgId: string;
  let testUserId: string;
  let authToken: string;
  let jwt: typeof import('jsonwebtoken');

  beforeAll(async () => {
    jwt = await import('jsonwebtoken');

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const userResult = await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), `hw-withdraw-${Date.now()}@example.com`, 'Hosting Withdraw User', 'user', 'hash']
    );
    testUserId = userResult.rows[0].id;

    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [randomUUID(), 'Hosting Withdraw Org', 'hosting-withdraw-org-' + Date.now(), testUserId, {}]
    );
    testOrgId = orgResult.rows[0].id;

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

    await pool.query(
      `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'USD', NOW(), NOW())`,
      [testOrgId, 100.0]
    );

    await pool.query(
      `INSERT INTO hosting_wallets (organization_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, 'USD', NOW(), NOW())`,
      [testOrgId, 40.0]
    );

    authToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM payment_transactions WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM hosting_wallets WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM wallets WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organization_roles WHERE organization_id = $1', [testOrgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  it('should transfer funds from hosting wallet to main wallet', async () => {
    const mainBefore = await pool.query('SELECT balance FROM wallets WHERE organization_id = $1', [testOrgId]);
    const hostBefore = await pool.query('SELECT balance FROM hosting_wallets WHERE organization_id = $1', [testOrgId]);
    const mb = Number(mainBefore.rows[0].balance);
    const hb = Number(hostBefore.rows[0].balance);

    const amount = 12.5;
    const response = await request(app)
      .post('/api/payments/wallet/hosting/withdraw')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount })
      .expect(200);

    expect(response.body.success).toBe(true);

    const mainAfter = await pool.query('SELECT balance FROM wallets WHERE organization_id = $1', [testOrgId]);
    const hostAfter = await pool.query('SELECT balance FROM hosting_wallets WHERE organization_id = $1', [testOrgId]);

    expect(Number(mainAfter.rows[0].balance)).toBeCloseTo(mb + amount, 2);
    expect(Number(hostAfter.rows[0].balance)).toBeCloseTo(hb - amount, 2);
  });

  it('should reject withdraw when hosting balance is insufficient', async () => {
    await pool.query('UPDATE hosting_wallets SET balance = $1 WHERE organization_id = $2', [1.0, testOrgId]);

    const response = await request(app)
      .post('/api/payments/wallet/hosting/withdraw')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 500 })
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});
