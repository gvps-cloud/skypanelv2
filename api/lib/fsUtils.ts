import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

const getOwnerSpec = (): string => {
  const userInfo = os.userInfo();
  let group = userInfo.username;

  try {
    if (typeof process.getgid === 'function') {
      group = String(process.getgid());
    }
  } catch {
    // Fallback to username for environments where getgid is unsupported
    group = userInfo.username;
  }

  return `${userInfo.username}:${group}`;
};

const runSudoCommand = async (args: string[]): Promise<void> => {
  await execFileAsync('sudo', args);
};

export const ensureDirectory = async (directory: string): Promise<void> => {
  try {
    await fs.mkdir(directory, { recursive: true });
    // Verify directory was created and is accessible
    await fs.access(directory, fs.constants.W_OK);
    return;
  } catch (error: any) {
    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
      throw error;
    }

    console.warn(`[fsUtils] Permission denied creating directory: ${directory}. Attempting with sudo...`);

    try {
      await runSudoCommand(['mkdir', '-p', directory]);
      await runSudoCommand(['chown', '-R', getOwnerSpec(), directory]);

      // Verify directory is now accessible
      await fs.access(directory, fs.constants.W_OK);
    } catch (sudoError: any) {
      console.error(`[fsUtils] Failed to create directory even with sudo: ${directory}`, sudoError);
      throw new Error(`Unable to create directory ${directory}: ${sudoError.message}`);
    }
  }
};

export const removePath = async (targetPath: string): Promise<void> => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      // Path doesn't exist, that's fine
      return;
    }

    if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
      throw error;
    }

    console.warn(`[fsUtils] Permission denied removing path: ${targetPath}. Attempting with sudo...`);

    try {
      await runSudoCommand(['rm', '-rf', targetPath]);
    } catch (sudoError: any) {
      console.error(`[fsUtils] Failed to remove path even with sudo: ${targetPath}`, sudoError);
      throw new Error(`Unable to remove path ${targetPath}: ${sudoError.message}`);
    }
  }
};
