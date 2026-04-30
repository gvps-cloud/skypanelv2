import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { ensureDirectory, removePath } from './fsUtils';

vi.mock('fs/promises', () => {
  return {
    mkdir: vi.fn(),
    access: vi.fn(),
    rm: vi.fn(),
    constants: {
      W_OK: 2,
    },
  };
});

describe('fsUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureDirectory', () => {
    it('creates a directory and verifies accessibility successfully', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await expect(ensureDirectory('/path/to/dir')).resolves.toBeUndefined();

      expect(fs.mkdir).toHaveBeenCalledWith('/path/to/dir', { recursive: true });
      expect(fs.access).toHaveBeenCalledWith('/path/to/dir', fs.constants.W_OK);
    });

    it('throws the original error when fs.mkdir fails', async () => {
      const mockError = new Error('Permission denied');
      (mockError as any).code = 'EACCES';
      vi.mocked(fs.mkdir).mockRejectedValue(mockError);

      await expect(ensureDirectory('/path/to/dir')).rejects.toThrow('Permission denied');
    });

    it('throws the original error when fs.access fails', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      const mockError = new Error('Permission denied');
      (mockError as any).code = 'EACCES';
      vi.mocked(fs.access).mockRejectedValue(mockError);

      await expect(ensureDirectory('/path/to/dir')).rejects.toThrow('Permission denied');
    });
  });

  describe('removePath', () => {
    it('removes a path successfully', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await expect(removePath('/path/to/file')).resolves.toBeUndefined();

      expect(fs.rm).toHaveBeenCalledWith('/path/to/file', { recursive: true, force: true });
    });

    it('resolves silently when path does not exist (ENOENT)', async () => {
      const mockError = new Error('Not found');
      (mockError as any).code = 'ENOENT';
      vi.mocked(fs.rm).mockRejectedValue(mockError);

      await expect(removePath('/path/to/file')).resolves.toBeUndefined();
    });

    it('throws the original error when fs.rm fails with EACCES', async () => {
      const mockError = new Error('Permission denied');
      (mockError as any).code = 'EACCES';
      vi.mocked(fs.rm).mockRejectedValue(mockError);

      await expect(removePath('/path/to/file')).rejects.toThrow('Permission denied');
    });
  });
});
