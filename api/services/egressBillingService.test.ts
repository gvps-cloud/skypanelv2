import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryMock,
  transactionMock,
  getAccountTransferMock,
  getLinodeInstanceTransferMock,
  getLinodeRegionsMock,
} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn(),
  getAccountTransferMock: vi.fn(),
  getLinodeInstanceTransferMock: vi.fn(),
  getLinodeRegionsMock: vi.fn(),
}));

vi.mock('../lib/database.js', () => ({
  query: queryMock,
  transaction: transactionMock,
}));

vi.mock('./linodeService.js', () => ({
  linodeService: {
    getAccountTransfer: getAccountTransferMock,
    getLinodeInstanceTransfer: getLinodeInstanceTransferMock,
    getLinodeRegions: getLinodeRegionsMock,
  },
}));

vi.mock('./invoiceService.js', () => ({
  InvoiceService: {},
}));

import { EgressBillingService } from './egressBillingService.js';

describe('EgressBillingService.updateRegionPricing', () => {
  const pricingRow = {
    id: 'pricing-1',
    provider_type: 'linode',
    region_id: 'ca-central',
    region_label: 'Toronto, CA',
    pricing_scope: 'global',
    pricing_category: 'core',
    base_price_per_gb: 0.005,
    upcharge_price_per_gb: 1.5,
    billing_enabled: true,
    source: 'manual',
    sync_status: 'manual',
    source_reference: null,
    synced_at: null,
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
  };

  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockReset();
    getAccountTransferMock.mockReset();
    getLinodeInstanceTransferMock.mockReset();
    getLinodeRegionsMock.mockReset();
  });

  it('uses aligned placeholders for billing toggle updates', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...pricingRow, billing_enabled: false }] });

    const result = await EgressBillingService.updateRegionPricing({
      providerType: 'linode',
      regionId: 'ca-central',
      billingEnabled: false,
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toContain('billing_enabled = $1');
    expect(sql).toContain('WHERE provider_type = $2');
    expect(sql).toContain('AND region_id = $3');
    expect(params).toEqual([false, 'linode', 'ca-central']);
    expect(result?.billing_enabled).toBe(false);
  });

  it('uses aligned placeholders for upcharge-only updates', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ...pricingRow, upcharge_price_per_gb: 2.25 }] });

    const result = await EgressBillingService.updateRegionPricing({
      providerType: 'linode',
      regionId: 'ca-central',
      upchargePricePerGb: 2.25,
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toContain('upcharge_price_per_gb = $1');
    expect(sql).toContain('customer_rate_per_gb = COALESCE(base_price_per_gb, 0) + $2');
    expect(sql).toContain('WHERE provider_type = $3');
    expect(sql).toContain('AND region_id = $4');
    expect(params).toEqual([2.25, 2.25, 'linode', 'ca-central']);
    expect(result?.upcharge_price_per_gb).toBe(2.25);
    expect(result?.final_price_per_gb).toBe(2.255);
  });

  it('returns the existing record when no update fields are supplied', async () => {
    queryMock.mockResolvedValueOnce({ rows: [pricingRow] });

    const result = await EgressBillingService.updateRegionPricing({
      providerType: 'linode',
      regionId: 'ca-central',
    });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toContain('SELECT *');
    expect(sql).toContain('WHERE provider_type = $1');
    expect(sql).toContain('AND region_id = $2');
    expect(params).toEqual(['linode', 'ca-central']);
    expect(result?.region_id).toBe('ca-central');
  });
});
