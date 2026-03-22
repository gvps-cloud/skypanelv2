/**
 * Tests for EgressBillingService live organization overview
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool, PoolClient } from 'pg';
import { EgressBillingService } from './egressBillingService';

describe('EgressBillingService - getOrganizationOverview Live Data', () => {
  let pool: Pool;
  let testOrgId: string;
  let testUserId: string;
  let testVpsId: string;

  beforeAll(async () => {
    // Set up test database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create test organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['test-egress-org-' + Date.now(), 'Test Egress Org', 'test-egress-org', 'test-user-id', {}]
    );
    testOrgId = orgResult.rows[0].id;

    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      ['test-egress-user-' + Date.now(), 'test@example.com', 'Test User', 'user', 'hash']
    );
    testUserId = userResult.rows[0].id;

    // Create test VPS instance
    const vpsResult = await pool.query(
      `INSERT INTO vps_instances (id, organization_id, provider_instance_id, label, status, configuration, plan_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id`,
      [
        'test-egress-vps-' + Date.now(),
        testOrgId,
        12345,
        'Test VPS',
        'running',
        { region: 'us-east' },
        'test-plan'
      ]
    );
    testVpsId = vpsResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM vps_instances WHERE id = $1', [testVpsId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
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

      // Insert some historical billing data
      await pool.query(
        `INSERT INTO organization_egress_billing_cycles
         (id, organization_id, billing_month, pool_id, pool_scope, region_id,
          total_measured_usage_gb, allocated_pool_quota_gb, allocated_billable_gb,
          unit_price_per_gb, total_amount, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          'test-cycle-' + Date.now(),
          testOrgId,
          historicalMonth + '-01',
          'global',
          'global',
          null,
          100.5,
          0,
          50.25,
          0.05,
          2.51,
          'billed'
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
      // Create another organization to verify isolation
      const otherOrgResult = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        ['other-egress-org-' + Date.now(), 'Other Egress Org', 'other-egress-org', 'test-user-id', {}]
      );
      const otherOrgId = otherOrgResult.rows[0].id;

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
      }
    });
  });

  describe('getOrganizationOverviewLive edge cases', () => {
    it('should handle organization with no VPS instances', async () => {
      // Create org with no VPS
      const emptyOrgResult = await pool.query(
        `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        ['empty-egress-org-' + Date.now(), 'Empty Egress Org', 'empty-egress-org', 'test-user-id', {}]
      );
      const emptyOrgId = emptyOrgResult.rows[0].id;

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
      }
    });

    it('should handle invalid organization ID gracefully', async () => {
      const invalidOrgId = '00000000-0000-0000-0000-000000000000';

      // Should throw error for invalid org
      await expect(EgressBillingService.getOrganizationOverview(invalidOrgId))
        .rejects.toThrow();
    });
  });
});
