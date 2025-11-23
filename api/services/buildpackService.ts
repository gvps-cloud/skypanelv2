/**
 * Buildpack Service
 * Manages Cloud Native Buildpacks for application builds
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface BuildpackInfo {
  id: string;
  version: string;
  name: string;
  description?: string;
}

export interface BuildConfig {
  projectPath: string;
  imageName: string;
  imageTag?: string;
  builder?: string;
  buildpacks?: string[];
  env?: Record<string, string>;
  clearCache?: boolean;
}

export interface BuildResult {
  success: boolean;
  imageName: string;
  imageTag: string;
  buildLogs: string;
  error?: string;
  duration?: number;
}

export class BuildpackService {
  // Default Cloud Native Buildpacks builder
  private static readonly DEFAULT_BUILDER = 'paketobuildpacks/builder:base';

  /**
   * Verify pack CLI is installed
   */
  static async verifyInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pack version');
      return stdout.includes('pack') || stdout.includes('version');
    } catch (error) {
      console.error('Pack CLI not found:', error);
      return false;
    }
  }

  /**
   * Get pack CLI version
   */
  static async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('pack version');
      // Extract version from output (format: "pack v0.x.x")
      const match = stdout.match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : stdout.trim();
    } catch (error) {
      console.error('Error getting pack version:', error);
      return null;
    }
  }

  /**
   * List available buildpack builders
   */
  static async listBuilders(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('pack builder suggest');
      const lines = stdout.split('\n');
      const builders: string[] = [];
      
      for (const line of lines) {
        // Extract builder names from suggested output
        const match = line.match(/\s+(\S+\/builder:\S+)/);
        if (match) {
          builders.push(match[1]);
        }
      }
      
      return builders;
    } catch (error) {
      console.error('Error listing builders:', error);
      return [];
    }
  }

  /**
   * Inspect a builder to get its buildpacks
   */
  static async inspectBuilder(builderName: string): Promise<BuildpackInfo[]> {
    try {
      const { stdout } = await execAsync(`pack builder inspect ${builderName}`);
      const lines = stdout.split('\n');
      const buildpacks: BuildpackInfo[] = [];
      
      let inBuildpacksSection = false;
      for (const line of lines) {
        if (line.includes('Buildpacks:')) {
          inBuildpacksSection = true;
          continue;
        }
        
        if (inBuildpacksSection && line.trim()) {
          // Parse buildpack info (format varies, but typically includes ID and version)
          const match = line.match(/^\s*-?\s*(\S+)[@:](\S+)/);
          if (match) {
            buildpacks.push({
              id: match[1],
              version: match[2],
              name: match[1].split('/').pop() || match[1]
            });
          }
        }
        
        // Stop when reaching next section
        if (inBuildpacksSection && line.match(/^[A-Z]/)) {
          break;
        }
      }
      
      return buildpacks;
    } catch (error) {
      console.error(`Error inspecting builder ${builderName}:`, error);
      return [];
    }
  }

  /**
   * Build an application using buildpacks
   */
  static async buildImage(config: BuildConfig): Promise<BuildResult> {
    const startTime = Date.now();
    const imageTag = config.imageTag || 'latest';
    const fullImageName = `${config.imageName}:${imageTag}`;
    
    try {
      // Verify project path exists
      try {
        await fs.access(config.projectPath);
      } catch {
        return {
          success: false,
          imageName: config.imageName,
          imageTag,
          buildLogs: '',
          error: `Project path does not exist: ${config.projectPath}`
        };
      }
      
      // Build the pack build command
      const builder = config.builder || this.DEFAULT_BUILDER;
      let command = `pack build ${fullImageName} --path ${config.projectPath} --builder ${builder}`;
      
      // Add buildpacks if specified
      if (config.buildpacks && config.buildpacks.length > 0) {
        for (const buildpack of config.buildpacks) {
          command += ` --buildpack ${buildpack}`;
        }
      }
      
      // Add environment variables
      if (config.env && Object.keys(config.env).length > 0) {
        for (const [key, value] of Object.entries(config.env)) {
          const escapedValue = value.replace(/"/g, '\\"');
          command += ` --env ${key}="${escapedValue}"`;
        }
      }
      
      // Clear cache if requested
      if (config.clearCache) {
        command += ' --clear-cache';
      }
      
      console.log(`🔨 Building image: ${fullImageName}`);
      console.log(`📦 Using builder: ${builder}`);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for build logs
        cwd: config.projectPath
      });
      
      const duration = Date.now() - startTime;
      const buildLogs = stdout + (stderr ? `\n${stderr}` : '');
      
      console.log(`✅ Successfully built image: ${fullImageName} (${duration}ms)`);
      
      return {
        success: true,
        imageName: config.imageName,
        imageTag,
        buildLogs,
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const buildLogs = (error.stdout || '') + (error.stderr ? `\n${error.stderr}` : '');
      
      console.error(`Failed to build image ${fullImageName}:`, error);
      
      return {
        success: false,
        imageName: config.imageName,
        imageTag,
        buildLogs,
        error: error.message || 'Build failed',
        duration
      };
    }
  }

  /**
   * Rebuild an existing image with updated source code
   */
  static async rebuildImage(config: BuildConfig): Promise<BuildResult> {
    console.log(`🔄 Rebuilding image: ${config.imageName}`);
    return this.buildImage(config);
  }

  /**
   * Detect buildpacks for a project
   */
  static async detectBuildpacks(
    projectPath: string,
    builder?: string
  ): Promise<BuildpackInfo[]> {
    try {
      const builderName = builder || this.DEFAULT_BUILDER;
      
      // Use pack detect to identify suitable buildpacks
      const { stdout } = await execAsync(
        `pack build --path ${projectPath} --builder ${builderName} --dry-run 2>&1 || true`
      );
      
      // Parse detected buildpacks from output
      const buildpacks: BuildpackInfo[] = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        if (line.includes('buildpack')) {
          const match = line.match(/(\S+\/\S+)[@:](\S+)/);
          if (match) {
            buildpacks.push({
              id: match[1],
              version: match[2],
              name: match[1].split('/').pop() || match[1]
            });
          }
        }
      }
      
      return buildpacks;
    } catch (error) {
      console.error('Error detecting buildpacks:', error);
      return [];
    }
  }

  /**
   * Set default builder for pack CLI
   */
  static async setDefaultBuilder(builderName: string): Promise<boolean> {
    try {
      await execAsync(`pack config default-builder ${builderName}`);
      console.log(`✅ Set default builder: ${builderName}`);
      return true;
    } catch (error) {
      console.error(`Failed to set default builder ${builderName}:`, error);
      return false;
    }
  }

  /**
   * Get current default builder
   */
  static async getDefaultBuilder(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('pack config default-builder');
      return stdout.trim() || this.DEFAULT_BUILDER;
    } catch (error) {
      console.error('Error getting default builder:', error);
      return this.DEFAULT_BUILDER;
    }
  }

  /**
   * Pull a builder image
   */
  static async pullBuilder(builderName: string): Promise<boolean> {
    try {
      console.log(`⬇️ Pulling builder: ${builderName}`);
      await execAsync(`docker pull ${builderName}`, {
        maxBuffer: 50 * 1024 * 1024
      });
      console.log(`✅ Successfully pulled builder: ${builderName}`);
      return true;
    } catch (error) {
      console.error(`Failed to pull builder ${builderName}:`, error);
      return false;
    }
  }

  /**
   * Inspect a built image to get metadata
   */
  static async inspectImage(imageName: string, imageTag: string = 'latest'): Promise<any> {
    try {
      const fullImageName = `${imageName}:${imageTag}`;
      const { stdout } = await execAsync(`pack inspect ${fullImageName}`);
      
      // Parse inspection output
      const info: any = {
        name: fullImageName,
        metadata: {}
      };
      
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Extract key-value pairs from output
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '_');
          const value = line.substring(colonIndex + 1).trim();
          if (key && value) {
            info.metadata[key] = value;
          }
        }
      }
      
      return info;
    } catch (error) {
      console.error(`Error inspecting image ${imageName}:${imageTag}:`, error);
      return null;
    }
  }

  /**
   * Clean pack build cache
   */
  static async cleanCache(): Promise<boolean> {
    try {
      // Pack doesn't have a direct cache clean command, but we can use Docker pruning
      await execAsync('docker builder prune -f');
      console.log('✅ Cleaned build cache');
      return true;
    } catch (error) {
      console.error('Failed to clean cache:', error);
      return false;
    }
  }
}
