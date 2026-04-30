import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  ENHANCE_ENABLED: false,
  ENHANCE_API_URL: '',
  ENHANCE_MASTER_ORG_ID: '',
  ENHANCE_API_KEY: '',
}));

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('../config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../lib/database.js', () => ({
  query: mockQuery,
}));

vi.mock('../services/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { EnhanceToggleService } from './enhanceToggle.js';

describe('EnhanceToggleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.ENHANCE_ENABLED = false;
    mockConfig.ENHANCE_API_URL = '';
    mockConfig.ENHANCE_MASTER_ORG_ID = '';
    mockConfig.ENHANCE_API_KEY = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns effectiveEnabled=true when hard gate, env, and runtime are all true', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({
        rows: [{
          enabled: true,
          last_health_check_at: null,
          last_health_status: null,
          last_health_message: null,
        }],
      });

      const status = await EnhanceToggleService.getStatus();
      expect(status.hardEnabled).toBe(true);
      expect(status.envConfigured).toBe(true);
      expect(status.runtimeEnabled).toBe(true);
      expect(status.effectiveEnabled).toBe(true);
    });

    it('returns effectiveEnabled=false when hard gate is false', async () => {
      mockConfig.ENHANCE_ENABLED = false;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({
        rows: [{ enabled: true, last_health_check_at: null, last_health_status: null, last_health_message: null }],
      });

      const status = await EnhanceToggleService.getStatus();
      expect(status.effectiveEnabled).toBe(false);
    });

    it('returns effectiveEnabled=false when env vars are missing', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockQuery.mockResolvedValue({
        rows: [{ enabled: true, last_health_check_at: null, last_health_status: null, last_health_message: null }],
      });

      const status = await EnhanceToggleService.getStatus();
      expect(status.effectiveEnabled).toBe(false);
      expect(status.missingEnv).toContain('ENHANCE_API_URL');
      expect(status.missingEnv).toContain('ENHANCE_MASTER_ORG_ID');
      expect(status.missingEnv).toContain('ENHANCE_API_KEY');
    });

    it('returns effectiveEnabled=false when runtime toggle is false', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({
        rows: [{ enabled: false, last_health_check_at: null, last_health_status: null, last_health_message: null }],
      });

      const status = await EnhanceToggleService.getStatus();
      expect(status.effectiveEnabled).toBe(false);
    });

    it('includes health check fields from the database', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({
        rows: [{
          enabled: true,
          last_health_check_at: '2026-01-01T00:00:00Z',
          last_health_status: 'healthy',
          last_health_message: 'All good',
        }],
      });

      const status = await EnhanceToggleService.getStatus();
      expect(status.lastHealthCheckAt).toBe('2026-01-01T00:00:00Z');
      expect(status.lastHealthStatus).toBe('healthy');
      expect(status.lastHealthMessage).toBe('All good');
    });
  });

  describe('isEffectivelyEnabled', () => {
    it('returns true when all gates are true', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({
        rows: [{ enabled: true, last_health_check_at: null, last_health_status: null, last_health_message: null }],
      });

      const result = await EnhanceToggleService.isEffectivelyEnabled();
      expect(result).toBe(true);
    });

    it('returns false when any gate is false', async () => {
      mockConfig.ENHANCE_ENABLED = false;
      mockQuery.mockResolvedValue({
        rows: [{ enabled: true, last_health_check_at: null, last_health_status: null, last_health_message: null }],
      });

      const result = await EnhanceToggleService.isEffectivelyEnabled();
      expect(result).toBe(false);
    });
  });

  describe('setRuntimeEnabled', () => {
    it('throws when hard gate is false and trying to enable', async () => {
      mockConfig.ENHANCE_ENABLED = false;
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(EnhanceToggleService.setRuntimeEnabled(true, 'user-123')).rejects.toThrow(
        'Cannot enable Enhance when ENHANCE_ENABLED hard gate is false'
      );
    });

    it('throws when env vars are missing and trying to enable', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(EnhanceToggleService.setRuntimeEnabled(true, 'user-123')).rejects.toThrow(
        'Cannot enable Enhance: missing env vars: ENHANCE_API_URL, ENHANCE_MASTER_ORG_ID, ENHANCE_API_KEY'
      );
    });

    it('succeeds when all gates are true', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      mockQuery.mockResolvedValue({ rows: [] });

      await EnhanceToggleService.setRuntimeEnabled(true, 'user-123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE platform_integrations'),
        [true]
      );
    });

    it('allows disabling regardless of hard gate or env', async () => {
      mockConfig.ENHANCE_ENABLED = false;
      mockConfig.ENHANCE_API_URL = '';
      mockQuery.mockResolvedValue({ rows: [] });

      await EnhanceToggleService.setRuntimeEnabled(false, 'user-123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE platform_integrations'),
        [false]
      );
    });
  });

  describe('runHealthCheck', () => {
    it('returns success when fetch returns 200', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(true);
      expect(result.message).toBe('API connectivity confirmed');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.enhance.test/orgs/org-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer key-123',
          }),
        })
      );
    });

    it('returns failure when fetch returns 4xx', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(false);
      expect(result.message).toBe('API returned 404');
    });

    it('returns failure when fetch returns 5xx', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(false);
      expect(result.message).toBe('API returned 503');
    });

    it('returns failure on network error', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockConfig.ENHANCE_API_URL = 'https://api.enhance.test';
      mockConfig.ENHANCE_MASTER_ORG_ID = 'org-123';
      mockConfig.ENHANCE_API_KEY = 'key-123';
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network failure');
    });

    it('returns failure when hard gate is false', async () => {
      mockConfig.ENHANCE_ENABLED = false;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Hard gate is false');
    });

    it('returns failure when env vars are missing', async () => {
      mockConfig.ENHANCE_ENABLED = true;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await EnhanceToggleService.runHealthCheck('user-123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing env vars');
    });
  });
});
