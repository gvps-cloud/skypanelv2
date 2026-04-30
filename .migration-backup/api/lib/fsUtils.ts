import * as fs from 'fs/promises';

export const ensureDirectory = async (directory: string): Promise<void> => {
  await fs.mkdir(directory, { recursive: true });
  // Verify directory was created and is accessible
  await fs.access(directory, fs.constants.W_OK);
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
    throw error;
  }
};
