import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promisify } from 'util';

const execResponses = vi.hoisted(() => [] as Array<{ stdout?: string; stderr?: string; error?: Error }>);
const execCommands = vi.hoisted(() => [] as string[]);

vi.mock('child_process', () => {
  const runCommand = (command: string) => {
    execCommands.push(command);
    const next = execResponses.shift() || {};
    if (next.error) {
      throw next.error;
    }
    return {
      stdout: next.stdout ?? '',
      stderr: next.stderr ?? '',
    };
  };

  const execFn = (...args: any[]) => {
    const command = args[0] as string;
    const callback = typeof args[1] === 'function' ? args[1] : args[2];
    try {
      const result = runCommand(command);
      if (typeof callback === 'function') {
        callback(null, result.stdout, result.stderr);
      }
    } catch (error: any) {
      if (typeof callback === 'function') {
        callback(error);
      }
    }
    return {} as any;
  };

  const customKey = promisify.custom;
  execFn[customKey] = (command: string) => {
    try {
      return Promise.resolve(runCommand(command));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  return {
    exec: execFn,
    default: { exec: execFn },
  };
});

vi.mock('./settingsService.js', () => ({
  PaasSettingsService: {
    getGitConfig: vi.fn().mockResolvedValue({
      authType: 'none',
    }),
  },
}));

import { GitService } from './gitService.js';

const queueResponse = (response: { stdout?: string; stderr?: string; error?: Error }) => {
  execResponses.push(response);
};

describe('GitService.resolveBranch', () => {
  beforeEach(() => {
    execResponses.length = 0;
    execCommands.length = 0;
  });

  it('returns the requested branch when it exists', async () => {
    queueResponse({ stdout: '' });

    const result = await GitService.resolveBranch('https://example.com/repo.git', 'feature');

    expect(result).toEqual({
      branch: 'feature',
      wasFallback: false,
      reason: undefined,
    });
    expect(execCommands).toEqual(['git ls-remote --heads https://example.com/repo.git feature']);
  });

  it('falls back to default branch when requested branch is missing', async () => {
    queueResponse({ error: new Error('not found') });
    queueResponse({ stdout: 'ref: refs/heads/master\tHEAD\nabc123\tHEAD' });

    const result = await GitService.resolveBranch('https://example.com/repo.git', 'legacy');

    expect(result).toEqual({
      branch: 'master',
      wasFallback: true,
      reason: 'missing',
    });
    expect(execCommands).toEqual([
      'git ls-remote --heads https://example.com/repo.git legacy',
      'git ls-remote --symref https://example.com/repo.git HEAD',
    ]);
  });

  it('detects default branch when none is provided', async () => {
    queueResponse({ stdout: 'ref: refs/heads/main\tHEAD\nabc123\tHEAD' });

    const result = await GitService.resolveBranch('https://example.com/repo.git');

    expect(result).toEqual({
      branch: 'main',
      wasFallback: true,
      reason: 'unspecified',
    });
    expect(execCommands).toEqual(['git ls-remote --symref https://example.com/repo.git HEAD']);
  });

  it('falls back to main when default detection fails', async () => {
    queueResponse({ error: new Error('symref unsupported') });

    const result = await GitService.resolveBranch('https://example.com/repo.git');

    expect(result).toEqual({
      branch: 'main',
      wasFallback: true,
      reason: 'unspecified',
    });
    expect(execCommands).toEqual(['git ls-remote --symref https://example.com/repo.git HEAD']);
  });
});
