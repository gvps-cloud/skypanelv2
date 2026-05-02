import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnhanceService, EnhanceApiError } from './enhanceService.js';

const mockResponse = (options: {
  ok: boolean;
  status: number;
  statusText?: string;
  body?: unknown;
}) => ({
  ok: options.ok,
  status: options.status,
  statusText: options.statusText ?? '',
  text: () => Promise.resolve(options.body == null ? '' : JSON.stringify(options.body)),
});

describe('EnhanceService', () => {
  beforeEach(() => {
    process.env.ENHANCE_API_URL = 'https://api.enhance.test';
    process.env.ENHANCE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw EnhanceApiError on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        body: { error: 'Org not found' },
      })
    );

    await expect(EnhanceService.getOrg('invalid-org')).rejects.toThrow(EnhanceApiError);
  });

  it('should return data on successful response', async () => {
    const mockData = { id: 'org-123', name: 'Test Org' };
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: mockData,
      })
    );

    const result = await EnhanceService.getOrg('org-123');
    expect(result).toEqual(mockData);
  });

  it('should include Authorization header with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {},
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.getOrg('org-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
        }),
      })
    );
  });

  it('should handle 204 No Content responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 204 }));

    const result = await EnhanceService.deleteSubscription('org-123', 'sub-123');
    expect(result).toBeUndefined();
  });

  it('should create a login in the org realm', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 201,
        body: { id: 'login-123' },
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.createLogin('org-123', {
      email: 'owner@example.com',
      name: 'Owner',
      password: 'Password123!',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/logins?orgId=org-123',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'owner@example.com',
          name: 'Owner',
          password: 'Password123!',
        }),
      })
    );
  });

  it('should query org logins', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { items: [] },
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.getOrgLogins('org-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/logins',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should query all logins with pagination parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { items: [], total: 0 },
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.getLogins({ limit: 100, offset: 200 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/logins?limit=100&offset=200',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should create an org member', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 201,
        body: { id: 'member-123' },
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.createOrgMember('org-123', {
      loginId: 'login-123',
      roles: ['SuperAdmin'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/members',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          loginId: 'login-123',
          roles: ['SuperAdmin'],
        }),
      })
    );
  });

  it('should update org owner using the membership id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {},
      })
    );
    global.fetch = fetchMock;

    await EnhanceService.updateOrgOwner('org-123', { memberId: 'member-123' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/owner',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ memberId: 'member-123' }),
      })
    );
  });

  it('should patch DNS records using the documented endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 204 }));
    global.fetch = fetchMock;

    await EnhanceService.updateWebsiteDomainDnsZoneRecord('org-123', 'web-123', 'domain-123', 'record-123', {
      value: '203.0.113.10',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/websites/web-123/domains/domain-123/dns-zone/records/record-123',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ value: '203.0.113.10' }),
      })
    );
  });

  it('should create backups with includeEmails as a query parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 201, body: { id: 'backup-123' } }));
    global.fetch = fetchMock;

    await EnhanceService.backupWebsite('org-123', 'web-123', {
      includeEmails: true,
      description: 'Manual backup',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/websites/web-123/backups?includeEmails=true',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ description: 'Manual backup' }),
      })
    );
  });

  it('should restore backups with PUT on the backup resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, body: {} }));
    global.fetch = fetchMock;

    await EnhanceService.restoreWebsiteBackup('org-123', 'web-123', 'backup-123', {
      restoreFiles: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.enhance.test/api/orgs/org-123/websites/web-123/backups/backup-123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ restoreFiles: true }),
      })
    );
  });

  it('should send backups disabled and force SSL as bare booleans', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, body: {} }));
    global.fetch = fetchMock;

    await EnhanceService.setBackupsDisabled('web-123', true);
    await EnhanceService.setWebsiteDomainForceSsl('org-123', 'web-123', 'domain-123', false);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.enhance.test/api/websites/web-123/backups_disabled',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(true),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.enhance.test/api/v2/domains/domain-123/ssl/force_ssl',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(false),
      })
    );
  });

  it('should use documented crontab and persistent app log endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ ok: true, status: 200, body: {} }));
    global.fetch = fetchMock;

    await EnhanceService.updateCrontab('org-123', 'web-123', { items: [] });
    await EnhanceService.getWebsitePersistentAppLog('web-123', 'app-123');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.enhance.test/api/orgs/org-123/websites/web-123/crontab',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ items: [] }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.enhance.test/api/websites/web-123/apps/persistent/app-123',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
