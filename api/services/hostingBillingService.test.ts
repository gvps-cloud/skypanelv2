import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockIsEffectivelyEnabled = vi.hoisted(() => vi.fn());
const mockUpdateWebsite = vi.hoisted(() => vi.fn());
const mockLogActivity = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../lib/database.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

vi.mock('./enhanceToggle.js', () => ({
  EnhanceToggleService: {
    isEffectivelyEnabled: mockIsEffectivelyEnabled,
  },
}));

vi.mock('./enhanceService.js', () => ({
  EnhanceService: {
    updateWebsite: mockUpdateWebsite,
  },
}));

vi.mock('./activityLogger.js', () => ({
  logActivity: mockLogActivity,
}));

vi.mock('../config/index.js', () => ({
  config: {
    ENHANCE_MASTER_ORG_ID: 'master-org-123',
  },
}));

import { HostingBillingService } from './hostingBillingService.js';

describe('HostingBillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockIsEffectivelyEnabled.mockResolvedValue(true);
    mockUpdateWebsite.mockResolvedValue(undefined);
    (HostingBillingService as any).hostingBillingTablesEnsured = true;
  });

  describe('runMonthlyHostingBilling', () => {
    it('bills active subscription due for billing and updates dates', async () => {
      const sub = {
        id: 'sub-1',
        organization_id: 'org-1',
        plan_id: 'plan-1',
        enhance_subscription_id: 'enh-sub-1',
        enhance_website_id: 'enh-web-1',
        domain: 'example.com',
        next_billing_at: new Date().toISOString(),
        last_billed_at: null,
        created_by: 'user-1',
      };

      mockQuery.mockResolvedValueOnce({ rows: [sub] });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // ensure wallet
            .mockResolvedValueOnce({ rows: [{ id: 'wallet-1', balance: 100 }] }) // wallet lock
            .mockResolvedValueOnce({ rows: [{ price_monthly: '10.00', name: 'Basic' }] }) // plan
            .mockResolvedValueOnce({ rows: [{ id: 'cycle-1' }] }) // insert billing cycle
            .mockResolvedValueOnce({ rows: [] }) // update wallet
            .mockResolvedValueOnce({ rows: [{ id: 'txn-1' }] }) // insert transaction
            .mockResolvedValueOnce({ rows: [] }) // update cycle
            .mockResolvedValueOnce({ rows: [] }), // update subscription
        };
        return callback(client);
      });

      await HostingBillingService.runMonthlyHostingBilling('scheduled');

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'hosting.billing.completed',
          entityType: 'hosting_subscription',
          entityId: 'sub-1',
          status: 'success',
        })
      );
    });

    it('suspends subscription on insufficient balance and updates remote website', async () => {
      const sub = {
        id: 'sub-1',
        organization_id: 'org-1',
        plan_id: 'plan-1',
        enhance_subscription_id: 'enh-sub-1',
        enhance_website_id: 'enh-web-1',
        domain: 'example.com',
        next_billing_at: new Date().toISOString(),
        last_billed_at: null,
        created_by: 'user-1',
      };

      mockQuery.mockResolvedValueOnce({ rows: [sub] });

      mockTransaction.mockImplementation(async (callback) => {
        const client = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // ensure wallet
            .mockResolvedValueOnce({ rows: [{ id: 'wallet-1', balance: 5 }] }) // wallet lock
            .mockResolvedValueOnce({ rows: [{ price_monthly: '10.00', name: 'Basic' }] }) // plan
            .mockResolvedValueOnce({ rows: [{ id: 'cycle-1' }] }) // insert failed cycle
            .mockResolvedValueOnce({ rows: [] }), // update failed cycle
        };
        return callback(client);
      });

      await HostingBillingService.runMonthlyHostingBilling('scheduled');

      expect(mockUpdateWebsite).toHaveBeenCalledWith('master-org-123', 'enh-web-1', {
        status: 'disabled',
        isSuspended: true,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE hosting_subscriptions SET status = 'suspended'"),
        ['sub-1']
      );
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'hosting.billing.suspended',
          entityType: 'hosting_subscription',
          entityId: 'sub-1',
          status: 'warning',
        })
      );
    });

    it('does nothing when no subscriptions are due', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await HostingBillingService.runMonthlyHostingBilling('scheduled');

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockLogActivity).not.toHaveBeenCalled();
    });

    it('does nothing when Enhance is disabled', async () => {
      mockIsEffectivelyEnabled.mockResolvedValue(false);

      await HostingBillingService.runMonthlyHostingBilling('scheduled');

      expect(mockQuery).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('continues billing remaining subscriptions when one fails', async () => {
      const sub1 = {
        id: 'sub-1',
        organization_id: 'org-1',
        plan_id: 'plan-1',
        enhance_subscription_id: 'enh-sub-1',
        enhance_website_id: 'enh-web-1',
        domain: 'example.com',
        next_billing_at: new Date().toISOString(),
        last_billed_at: null,
        created_by: 'user-1',
      };
      const sub2 = {
        id: 'sub-2',
        organization_id: 'org-2',
        plan_id: 'plan-2',
        enhance_subscription_id: 'enh-sub-2',
        enhance_website_id: 'enh-web-2',
        domain: 'example.net',
        next_billing_at: new Date().toISOString(),
        last_billed_at: null,
        created_by: 'user-2',
      };

      mockQuery.mockResolvedValueOnce({ rows: [sub1, sub2] });

      // First subscription fails (no wallet)
      mockTransaction.mockImplementationOnce(async (callback) => {
        const client = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // ensure wallet
            .mockResolvedValueOnce({ rows: [] }), // wallet not found
        };
        return callback(client);
      });

      // Second subscription succeeds
      mockTransaction.mockImplementationOnce(async (callback) => {
        const client = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'wallet-2', balance: 100 }] })
            .mockResolvedValueOnce({ rows: [{ price_monthly: '10.00', name: 'Basic' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'cycle-2' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'txn-2' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return callback(client);
      });

      await HostingBillingService.runMonthlyHostingBilling('scheduled');

      expect(mockTransaction).toHaveBeenCalledTimes(2);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'hosting.billing.completed',
          entityId: 'sub-2',
        })
      );
    });
  });
});
