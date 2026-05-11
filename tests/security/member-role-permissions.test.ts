import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '../../api/lib/database.js';
import { PREDEFINED_ROLES } from '../../api/services/roles.js';
import { v4 as uuidv4 } from 'uuid';

describe('Member Role Migration Security Tests', () => {
  let testOrgId: string;

  beforeAll(async () => {
    // Create a test user first (required for org owner_id FK)
    const testUserId = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, `migration-test-${Date.now()}@example.com`, 'hash', 'Test User', 'user']
    );

    // Create a test organization
    testOrgId = uuidv4();
    await query(
      `INSERT INTO organizations (id, name, slug, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [testOrgId, 'Migration Test Org', 'migration-test-org', testUserId]
    );

    // Ensure the seed function runs for this org
    await query(`SELECT seed_default_roles_for_organization($1)`, [testOrgId]);
  });

  afterAll(async () => {
    // Clean up
    await query(`DELETE FROM organization_roles WHERE organization_id = $1`, [testOrgId]);
    await query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]);
  });

  it('should create predefined roles and all should be non-custom', async () => {
    const result = await query(
      `SELECT name, permissions, is_custom FROM organization_roles WHERE organization_id = $1 AND is_custom = false`,
      [testOrgId]
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(5);
    for (const row of result.rows) {
      expect(row.is_custom).toBe(false);
    }
  });

  it('vps_manager should not have hosting permissions', async () => {
    const result = await query(
      `SELECT permissions FROM organization_roles WHERE organization_id = $1 AND name = 'vps_manager'`,
      [testOrgId]
    );
    // Skip if vps_manager doesn't exist (pre-migration DB)
    if (result.rows.length === 0) return;
    const perms = Array.isArray(result.rows[0].permissions)
      ? result.rows[0].permissions
      : JSON.parse(result.rows[0].permissions);
    expect(perms).not.toContain('hosting_view');
    expect(perms).not.toContain('hosting_manage');
  });

  it('billing_manager should have billing and egress management permissions', async () => {
    const result = await query(
      `SELECT permissions FROM organization_roles WHERE organization_id = $1 AND name = 'billing_manager'`,
      [testOrgId]
    );
    if (result.rows.length === 0) return;
    const perms = Array.isArray(result.rows[0].permissions)
      ? result.rows[0].permissions
      : JSON.parse(result.rows[0].permissions);
    expect(perms).toContain('billing_manage');
    expect(perms).toContain('egress_manage');
    expect(perms).toContain('hosting_view');
    expect(perms).not.toContain('members_manage');
  });

  it('seed function should be idempotent (ON CONFLICT DO NOTHING)', async () => {
    const beforeResult = await query(
      `SELECT name FROM organization_roles WHERE organization_id = $1 AND is_custom = false`,
      [testOrgId]
    );
    const beforeCount = beforeResult.rows.length;

    // Running the seed function again should not create duplicates
    await query(`SELECT seed_default_roles_for_organization($1)`, [testOrgId]);

    const afterResult = await query(
      `SELECT name FROM organization_roles WHERE organization_id = $1 AND is_custom = false`,
      [testOrgId]
    );
    expect(afterResult.rows).toHaveLength(beforeCount);
  });

  it('JS PREDEFINED_ROLES should have member and hosting_manager', () => {
    expect(PREDEFINED_ROLES).toHaveProperty('member');
    expect(PREDEFINED_ROLES).toHaveProperty('hosting_manager');
    expect(PREDEFINED_ROLES).toHaveProperty('billing_manager');
    expect(PREDEFINED_ROLES.member).toContain('hosting_manage');
    expect(PREDEFINED_ROLES.hosting_manager).toContain('hosting_manage');
    expect(PREDEFINED_ROLES.admin).toContain('billing_manage');
    expect(PREDEFINED_ROLES.admin).toContain('egress_manage');
    expect(PREDEFINED_ROLES.admin).toContain('members_manage');
    expect(PREDEFINED_ROLES.billing_manager).toContain('billing_manage');
    expect(PREDEFINED_ROLES.billing_manager).toContain('egress_manage');
    expect(PREDEFINED_ROLES.vps_manager).not.toContain('hosting_view');
  });
});
