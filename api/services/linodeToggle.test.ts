import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  LINODE_API_TOKEN: '',
}));

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('../config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../lib/database.js', () => ({
  query: mockQuery,
}));

vi.mock('./activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { LinodeToggleService } from './linodeToggle.js';

describe('LinodeToggleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.LINODE_API_TOKEN = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns effectiveEnabled=true when token, env, and runtime are all true', async () => {
      mockConfig.LINODE_API_TOKEN = 'tok';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ enabled: true }] });

      const status = await LinodeToggleService.getStatus();
      expect(status.hardEnabled).toBe(true);
      expect(status.envConfigured).toBe(true);
      expect(status.runtimeEnabled).toBe(true);
      expect(status.effectiveEnabled).toBe(true);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO platform_integrations'),
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("WHERE slug = 'linode'"),
      );
    });

    it('returns effectiveEnabled=false when token missing', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ enabled: true }] });

      const status = await LinodeToggleService.getStatus();
      expect(status.effectiveEnabled).toBe(false);
      expect(status.missingEnv).toContain('LINODE_API_TOKEN');
    });

    it('returns effectiveEnabled=false when runtime toggle is false', async () => {
      mockConfig.LINODE_API_TOKEN = 'tok';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ enabled: false }] });

      const status = await LinodeToggleService.getStatus();
      expect(status.effectiveEnabled).toBe(false);
    });
  });

  describe('setRuntimeEnabled', () => {
    it('throws when enabling without token', async () => {
      mockConfig.LINODE_API_TOKEN = '';
      await expect(
        LinodeToggleService.setRuntimeEnabled(true, 'user-1'),
      ).rejects.toThrow(/LINODE_API_TOKEN/);
    });

    it('ensures row then updates database when enabling with token', async () => {
      mockConfig.LINODE_API_TOKEN = 'tok';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await LinodeToggleService.setRuntimeEnabled(true, 'user-1');

      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO platform_integrations'),
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE platform_integrations'),
        expect.arrayContaining([true]),
      );
    });

    it('throws when UPDATE affects zero rows after ensure', async () => {
      mockConfig.LINODE_API_TOKEN = 'tok';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(LinodeToggleService.setRuntimeEnabled(true, 'user-1')).rejects.toThrow(
        /affected 0 row/,
      );
    });
  });
});
