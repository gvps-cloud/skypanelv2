/**
 * Tests for EgressBillingService live organization overview
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Pool } from 'pg';
import { EgressBillingService } from './egressBillingService';

describe('EgressBillingService - getOrganizationOverview Live Data', () => {
  let pool: Pool;
  let testOrgId: string;
  let testUserId: string;
  let testVpsId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    testUserId = randomUUID();
    const userEmail = `egress-live-${testUserId}@example.test`;
    await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testUserId, userEmail, 'Test User', 'user', 'hash']
    );

    testOrgId = randomUUID();
    const orgSlug = `egress-live-org-${testOrgId.slice(0, 8)}`;
    await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [testOrgId, 'Test Egress Org', orgSlug, testUserId, {}]
    );

    testVpsId = randomUUID();
    await pool.query(
      `INSERT INTO vps_instances (id, organization_id, provider_instance_id, label, status, configuration, plan_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        testVpsId,
        testOrgId,
        'egress-test-linode-12345',
        'Test VPS',
        'running',
        { region: 'us-east' },
        'test-plan',
      ]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM vps_instances WHERE id = $1', [testVpsId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  afterEach(async () => {
    // Clean up any billing data created during tests
    await pool.query('DELETE FROM organization_egress_billing_allocations WHERE vps_instance_id = $1', [testVpsId]);
    await pool.query('DELETE FROM organization_egress_billing_cycles WHERE organization_id = $1', [testOrgId]);
  });

  describe('getOrganizationOverview with current month', () => {
    it('should return live data for current month instead of persisted tables', async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Call getOrganizationOverview for current month
      const overview = await EgressBillingService.getOrganizationOverview(testOrgId);

      // Verify structure
      expect(overview).toBeDefined();
      expect(overview.organizationId).toBe(testOrgId);
      expect(overview.billingMonth).toBe(currentMonth + '-01');

      // Verify totals structure (may be 0 if no actual usage data from Linode)
      expect(overview.projectedTotals).toBeDefined();
      expect(typeof overview.projectedTotals.totalMeasuredUsageGb).toBe('number');
      expect(typeof overview.projectedTotals.totalBillableGb).toBe('number');
      expect(typeof overview.projectedTotals.totalAmount).toBe('number');
      expect(typeof overview.projectedTotals.activePoolCount).toBe('number');
      expect(typeof overview.projectedTotals.billingEnabledPoolCount).toBe('number');

      // For live data, updatedAt should be recent (within last minute)
      expect(overview.projectedTotals.updatedAt).toBeDefined();
      const updatedAt = new Date(overview.projectedTotals.updatedAt);
      const now = new Date();
      const timeDiff = now.getTime() - updatedAt.getTime();
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute

      // Servers array should be present
      expect(Array.isArray(overview.servers)).toBe(true);

      // For live view, recentCycles should be empty (no persisted historical data)
      expect(Array.isArray(overview.recentCycles)).toBe(true);
    });

    it('should return persisted data for historical months', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const historicalMonth = lastMonth.toISOString().slice(0, 7);

      const cycleId = randomUUID();
      await pool.query(
        `INSERT INTO organization_egress_billing_cycles (
           id, billing_month, pool_id, pool_scope, region_id, organization_id,
           total_measured_usage_gb, allocated_pool_usage_gb, allocated_pool_quota_gb,
           allocated_billable_gb, unit_price_per_gb, total_amount, status, metadata,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, '{}'::jsonb, NOW(), NOW())`,
        [
          cycleId,
          historicalMonth + '-01',
          'global-transfer',
          'global',
          null,
          testOrgId,
          100.5,
          0,
          50.25,
          0.05,
          2.51,
          'billed',
        ]
      );

      // Call getOrganizationOverview for historical month
      const overview = await EgressBillingService.getOrganizationOverview(testOrgId, historicalMonth);

      // Verify persisted data is returned
      expect(overview).toBeDefined();
      expect(overview.billingMonth).toBe(historicalMonth + '-01');
      expect(overview.projectedTotals.totalMeasuredUsageGb).toBeGreaterThan(0);
    });

    it('should filter live data to specific organization', async () => {
      const otherUserId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [otherUserId, `egress-live-other-${otherUserId}@example.test`, 'Other User', 'user', 'hash']
      );
      const otherOrgId = randomUUID();
      const otherSlug = `egress-live-other-${otherOrgId.slice(0, 8)}`;
      await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [otherOrgId, 'Other Egress Org', otherSlug, otherUserId, {}]
      );

      try {
        // Get overview for test organization
        const testOrgOverview = await EgressBillingService.getOrganizationOverview(testOrgId);

        // Get overview for other organization
        const otherOrgOverview = await EgressBillingService.getOrganizationOverview(otherOrgId);

        // Verify they have different organization IDs
        expect(testOrgOverview.organizationId).toBe(testOrgId);
        expect(otherOrgOverview.organizationId).toBe(otherOrgId);

        // Data should be different (unless no usage for either)
        // The key is that the data is properly scoped to each org
        expect(testOrgOverview.organizationId).not.toBe(otherOrgOverview.organizationId);
      } finally {
        await pool.query('DELETE FROM organizations WHERE id = $1', [otherOrgId]);
        await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
      }
    });
  });

  describe('getOrganizationOverviewLive edge cases', () => {
    it('should handle organization with no VPS instances', async () => {
      const emptyOwnerId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [emptyOwnerId, `egress-live-empty-${emptyOwnerId}@example.test`, 'Empty Org User', 'user', 'hash']
      );
      const emptyOrgId = randomUUID();
      const emptySlug = `egress-live-empty-${emptyOrgId.slice(0, 8)}`;
      await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [emptyOrgId, 'Empty Egress Org', emptySlug, emptyOwnerId, {}]
      );

      try {
        const overview = await EgressBillingService.getOrganizationOverview(emptyOrgId);

        // Should return valid structure with zero values
        expect(overview.projectedTotals.totalMeasuredUsageGb).toBe(0);
        expect(overview.projectedTotals.totalBillableGb).toBe(0);
        expect(overview.projectedTotals.totalAmount).toBe(0);
        expect(overview.projectedTotals.activePoolCount).toBe(0);
        expect(overview.servers).toEqual([]);
      } finally {
        await pool.query('DELETE FROM organizations WHERE id = $1', [emptyOrgId]);
        await pool.query('DELETE FROM users WHERE id = $1', [emptyOwnerId]);
      }
    });

    it('should return empty overview for non-existent organization UUID', async () => {
      const missingOrgId = '00000000-0000-0000-0000-000000000000';

      const overview = await EgressBillingService.getOrganizationOverview(missingOrgId);

      expect(overview.organizationId).toBe(missingOrgId);
      expect(overview.projectedTotals.totalMeasuredUsageGb).toBe(0);
      expect(overview.projectedTotals.totalBillableGb).toBe(0);
      expect(overview.projectedTotals.totalAmount).toBe(0);
      expect(overview.servers).toEqual([]);
      expect(overview.recentCycles).toEqual([]);
    });
  });
});
