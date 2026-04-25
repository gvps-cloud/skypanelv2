import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnhanceService, EnhanceApiError } from './enhanceService.js';

describe('EnhanceService', () => {
  beforeEach(() => {
    process.env.ENHANCE_API_URL = 'https://api.enhance.test';
    process.env.ENHANCE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw EnhanceApiError on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: 'Org not found' }),
    });

    await expect(EnhanceService.getOrg('invalid-org')).rejects.toThrow(EnhanceApiError);
  });

  it('should return data on successful response', async () => {
    const mockData = { id: 'org-123', name: 'Test Org' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const result = await EnhanceService.getOrg('org-123');
    expect(result).toEqual(mockData);
  });

  it('should include Authorization header with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    global.fetch = fetchMock;

    await EnhanceService.getOrg('org-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/orgs/org-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
        }),
      })
    );
  });

  it('should handle 204 No Content responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await EnhanceService.deleteSubscription('org-123', 'sub-123');
    expect(result).toBeUndefined();
  });
});
