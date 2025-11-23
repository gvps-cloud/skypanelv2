/**
 * Unregistry Service
 * Manages SSH-based Docker image distribution using unregistry
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface UnregistryConfig {
  remoteHost: string;
  remoteUser: string;
  remotePort?: number;
  sshKeyPath?: string;
}

export interface ImagePushResult {
  success: boolean;
  imageTag: string;
  remoteUrl?: string;
  error?: string;
}

export class UnregistryService {
  static async verifyCli(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker pussh --version');
      return stdout.includes('unregistry') || stdout.includes('pussh');
    } catch {
      return false;
    }
  }

  static async pushImagePussh(
    params: {
      imageName: string;
      imageTag: string;
      sshUser: string;
      sshHost: string;
      sshKeyPath?: string;
      sshPort?: number;
    }
  ): Promise<ImagePushResult> {
    const { imageName, imageTag, sshUser, sshHost, sshKeyPath, sshPort } = params;
    try {
      const cliOk = await this.verifyCli();
      if (!cliOk) {
        return { success: false, imageTag: `${imageName}:${imageTag}`, error: 'docker pussh not available' };
      }
      const target = sshPort && sshPort !== 22 ? `${sshUser}@${sshHost}:${sshPort}` : `${sshUser}@${sshHost}`;
      const fullImage = `${imageName}:${imageTag}`;
      const keyOpt = sshKeyPath ? ` -i ${sshKeyPath}` : '';
      const { stdout, stderr } = await execAsync(`docker pussh ${fullImage} ${target}${keyOpt}`, { maxBuffer: 50 * 1024 * 1024 });
      return { success: true, imageTag: fullImage, remoteUrl: target, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, imageTag: `${imageName}:${imageTag}`, error: error.stderr || error.message };
    }
  }

  /**
   * Verify unregistry Docker plugin is installed
   */
  static async verifyInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker plugin ls');
      return stdout.includes('unregistry');
    } catch (error) {
      console.error('Docker or unregistry plugin not found:', error);
      return false;
    }
  }

  /**
   * Check if unregistry plugin is enabled
   */
  static async isPluginEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker plugin ls --format "{{.Name}} {{.Enabled}}"');
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        if (line.includes('unregistry') && line.includes('true')) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking unregistry plugin status:', error);
      return false;
    }
  }

  /**
   * Enable unregistry Docker plugin
   */
  static async enablePlugin(): Promise<boolean> {
    try {
      await execAsync('docker plugin enable unregistry');
      console.log('✅ Enabled unregistry Docker plugin');
      return true;
    } catch (error) {
      console.error('Failed to enable unregistry plugin:', error);
      return false;
    }
  }

  /**
   * Build the remote registry URL for unregistry
   * Format: unregistry://user@host:port/image:tag
   */
  static buildRegistryUrl(
    config: UnregistryConfig,
    imageName: string,
    tag: string = 'latest'
  ): string {
    const port = config.remotePort || 22;
    return `unregistry://${config.remoteUser}@${config.remoteHost}:${port}/${imageName}:${tag}`;
  }

  /**
   * Push a Docker image to a remote host via SSH
   */
  static async pushImage(
    localImage: string,
    localTag: string,
    config: UnregistryConfig,
    remoteImageName?: string,
    remoteTag?: string
  ): Promise<ImagePushResult> {
    try {
      const cliOk = await this.verifyCli();
      if (cliOk) {
        return await this.pushImagePussh({
          imageName: localImage,
          imageTag: localTag,
          sshUser: config.remoteUser,
          sshHost: config.remoteHost,
          sshKeyPath: config.sshKeyPath,
          sshPort: config.remotePort,
        });
      }
      const enabled = await this.isPluginEnabled();
      if (!enabled) {
        const enableSuccess = await this.enablePlugin();
        if (!enableSuccess) {
          return { success: false, imageTag: `${localImage}:${localTag}`, error: 'Unregistry not available' };
        }
      }
      const remoteName = remoteImageName || localImage;
      const remoteTagName = remoteTag || localTag;
      const remoteUrl = this.buildRegistryUrl(config, remoteName, remoteTagName);
      const fullLocalImage = `${localImage}:${localTag}`;
      await execAsync(`docker tag ${fullLocalImage} ${remoteUrl}`);
      let sshEnv = '';
      if (config.sshKeyPath) {
        sshEnv = `DOCKER_UNREGISTRY_SSH_KEY=${config.sshKeyPath} `;
      }
      const { stdout, stderr } = await execAsync(`${sshEnv}docker push ${remoteUrl}`, { maxBuffer: 50 * 1024 * 1024 });
      return { success: true, imageTag: fullLocalImage, remoteUrl, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, imageTag: `${localImage}:${localTag}`, error: error.stderr || error.message };
    }
  }

  /**
   * Pull a Docker image from a remote host via SSH
   */
  static async pullImage(
    config: UnregistryConfig,
    imageName: string,
    tag: string = 'latest'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure plugin is enabled
      const enabled = await this.isPluginEnabled();
      if (!enabled) {
        await this.enablePlugin();
      }
      
      // Build the remote registry URL
      const remoteUrl = this.buildRegistryUrl(config, imageName, tag);
      
      // Set SSH key if provided
      let sshEnv = '';
      if (config.sshKeyPath) {
        sshEnv = `DOCKER_UNREGISTRY_SSH_KEY=${config.sshKeyPath} `;
      }
      
      // Pull the image via unregistry
      console.log(`⬇️ Pulling image from ${remoteUrl}...`);
      const { stdout, stderr } = await execAsync(
        `${sshEnv}docker pull ${remoteUrl}`,
        { maxBuffer: 50 * 1024 * 1024 }
      );
      
      // Tag the pulled image for local use
      await execAsync(`docker tag ${remoteUrl} ${imageName}:${tag}`);
      
      console.log(`✅ Successfully pulled image: ${imageName}:${tag}`);
      
      return {
        success: true,
        error: stderr || undefined
      };
    } catch (error: any) {
      console.error(`Failed to pull image ${imageName}:${tag}:`, error);
      return {
        success: false,
        error: error.stderr || error.message
      };
    }
  }

  /**
   * List images on a remote host via SSH
   */
  static async listRemoteImages(
    config: UnregistryConfig
  ): Promise<{ success: boolean; images: string[]; error?: string }> {
    try {
      // Build SSH command to list images on remote host
      const port = config.remotePort || 22;
      const sshKeyOpt = config.sshKeyPath ? `-i ${config.sshKeyPath}` : '';
      
      const sshCommand = `ssh ${sshKeyOpt} -p ${port} ${config.remoteUser}@${config.remoteHost} "docker images --format '{{.Repository}}:{{.Tag}}'"`;
      
      const { stdout } = await execAsync(sshCommand);
      const images = stdout.split('\n').filter(line => line.trim() && !line.includes('<none>'));
      
      return {
        success: true,
        images
      };
    } catch (error: any) {
      console.error('Failed to list remote images:', error);
      return {
        success: false,
        images: [],
        error: error.message
      };
    }
  }

  /**
   * Remove an image from a remote host via SSH
   */
  static async removeRemoteImage(
    config: UnregistryConfig,
    imageName: string,
    tag: string = 'latest'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const port = config.remotePort || 22;
      const sshKeyOpt = config.sshKeyPath ? `-i ${config.sshKeyPath}` : '';
      
      const fullImage = `${imageName}:${tag}`;
      const sshCommand = `ssh ${sshKeyOpt} -p ${port} ${config.remoteUser}@${config.remoteHost} "docker rmi ${fullImage}"`;
      
      await execAsync(sshCommand);
      console.log(`🗑️ Removed remote image: ${fullImage}`);
      
      return { success: true };
    } catch (error: any) {
      console.error(`Failed to remove remote image ${imageName}:${tag}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test SSH connectivity to a remote host
   */
  static async testConnection(config: UnregistryConfig): Promise<boolean> {
    try {
      const port = config.remotePort || 22;
      const sshKeyOpt = config.sshKeyPath ? `-i ${config.sshKeyPath}` : '';
      
      const sshCommand = `ssh ${sshKeyOpt} -p ${port} -o ConnectTimeout=10 ${config.remoteUser}@${config.remoteHost} "echo 'Connection successful'"`;
      
      const { stdout } = await execAsync(sshCommand);
      return stdout.includes('Connection successful');
    } catch (error) {
      console.error('SSH connection test failed:', error);
      return false;
    }
  }

  /**
   * Get Docker daemon info from remote host
   */
  static async getRemoteDockerInfo(
    config: UnregistryConfig
  ): Promise<{ success: boolean; info?: any; error?: string }> {
    try {
      const port = config.remotePort || 22;
      const sshKeyOpt = config.sshKeyPath ? `-i ${config.sshKeyPath}` : '';
      
      const sshCommand = `ssh ${sshKeyOpt} -p ${port} ${config.remoteUser}@${config.remoteHost} "docker info --format json"`;
      
      const { stdout } = await execAsync(sshCommand);
      const info = JSON.parse(stdout);
      
      return {
        success: true,
        info
      };
    } catch (error: any) {
      console.error('Failed to get remote Docker info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
