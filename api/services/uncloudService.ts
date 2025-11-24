/**
 * Uncloud CLI Service
 * Manages interactions with the uncloud CLI for PaaS infrastructure
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface UncloudContext {
  name: string;
  host: string;
  user: string;
  port?: number;
  isActive: boolean;
}

export interface UncloudServerInfo {
  hostname: string;
  ip: string;
  cpuCount: number;
  memoryTotal: string;
  diskSpace: string;
  os: string;
}

export interface UncloudAppInfo {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  ports: string[];
  image?: string;
  createdAt?: string;
  mode?: string;
  replicas?: number;
}

export class UncloudService {
  /**
   * Verify uncloud CLI is installed and working
   */
  static async verifyInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('uc version');
      return stdout.includes('uc version') || stdout.includes('uncloud');
    } catch (error) {
      console.error('Uncloud CLI not found:', error);
      return false;
    }
  }

  /**
   * List all configured uncloud contexts
   */
  static async listContexts(): Promise<UncloudContext[]> {
    // First try the newer table-style output: `uc context ls`
    try {
      const { stdout } = await execAsync('uc context ls');
      const lines = stdout.split('\n').filter((line) => line.trim());

      if (lines.length > 1 && /NAME\s+CURRENT\s+CONNECTIONS/i.test(lines[0])) {
        const contexts: UncloudContext[] = [];

        for (const line of lines.slice(1)) {
          // Expected row format (per `uc context ls`):
          // NAME   CURRENT   CONNECTIONS
          // default    ✓     2
          const match = line.match(/^(\S+)\s+(✓)?\s+(\d+)/);
          if (match) {
            const [, name, current] = match;
            contexts.push({
              name,
              host: '',
              user: '',
              port: 22,
              isActive: Boolean(current),
            });
          }
        }

        if (contexts.length > 0) {
          return contexts;
        }
      }
    } catch (error) {
      console.error('Error listing uncloud contexts with "uc context ls":', error);
    }

    // Fallback to older output style: `uc context list`
    try {
      const { stdout } = await execAsync('uc context list');
      const lines = stdout.split('\n').filter((line) => line.trim());

      const contexts: UncloudContext[] = [];
      for (const line of lines) {
        // Expected format: "* contextName user@host:port" or "  contextName user@host:port"
        const match = line.match(/^([* ])\s+(\S+)\s+(.+)/);
        if (match) {
          const [, activeMarker, name, connection] = match;
          const [userHost, portStr] = connection.split(':');
          const [user, host] = userHost.split('@');

          contexts.push({
            name,
            host,
            user,
            port: portStr ? parseInt(portStr, 10) : 22,
            isActive: activeMarker === '*',
          });
        }
      }

      return contexts;
    } catch (error) {
      console.error('Error listing uncloud contexts with "uc context list":', error);
      return [];
    }
  }

  /**
   * @deprecated This method is BROKEN - 'uc context add' command does not exist
   * Contexts are automatically created by 'uc machine init' or managed when using 'uc machine add'
   * Do NOT use this method - it will always fail
   */
  static async addContext(
    _contextName: string,
    _host: string,
    _user: string,
    _port: number = 22,
    _sshKeyPath?: string
  ): Promise<boolean> {
    console.error('❌ addContext() is deprecated - uc context add command does not exist!');
    console.error('   Contexts are managed automatically by uc machine init/add');
    return false;
  }

  /**
   * Switch to a different uncloud context
   */
  static async switchContext(contextName: string): Promise<boolean> {
    try {
      await execAsync(`uc context use ${contextName}`);
      console.log(`✅ Switched to uncloud context: ${contextName}`);
      return true;
    } catch (error) {
      console.error(`Failed to switch to context ${contextName}:`, error);
      return false;
    }
  }

  /**
   * Remove an uncloud context
   */
  static async removeContext(contextName: string): Promise<boolean> {
    try {
      await execAsync(`uc context rm ${contextName}`);
      console.log(`✅ Removed uncloud context: ${contextName}`);
      return true;
    } catch (error) {
      console.error(`Failed to remove context ${contextName}:`, error);
      return false;
    }
  }

  /**
   * Get server information from current context
   * @param contextName - The uncloud context name
   * @param targetMachineName - Specific machine name to query
   * @param sshKeyPath - Path to SSH private key for authentication
   */
  static async getServerInfo(contextName?: string, targetMachineName?: string, sshKeyPath?: string): Promise<UncloudServerInfo | null> {
    try {
      // Switch context if specified
      if (contextName) {
        await this.switchContext(contextName);
      }
      
      // Get machine info via uncloud (v0.14.0 uses 'machine ls')
      const { stdout } = await execAsync('uc machine ls');
      
      // Parse the output
      // Example output:
      // NAME           STATE   ADDRESS         PUBLIC IP        WIREGUARD ENDPOINTS                                    MACHINE ID
      // machine-zvbx   Up      10.210.0.1/24   147.93.191.127   147.93.191.127:51820, [2605:a143:2288:5083::1]:51820   2532e32769dc7e16a5bfcf4e7c361737
      
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        console.warn('No machines found in Uncloud cluster');
        return null;
      }
      
      // Skip header line
      let dataLine: string | undefined;
      
      if (targetMachineName) {
        // Find specific machine
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts[0] === targetMachineName) {
            dataLine = lines[i];
            break;
          }
        }
        
        if (!dataLine) {
          console.warn(`Machine "${targetMachineName}" not found in cluster`);
          // Fallback to direct connection if we have the IP? 
          // For now, if we can't find it in the cluster list, we can't get its public IP from the cluster list.
          return null;
        }
      } else {
        // Default to first machine
        dataLine = lines[1];
      }
      
      const parts = dataLine.split(/\s+/);
      
      if (parts.length < 4) {
        console.warn('Could not parse machine info');
        return null;
      }
      
      const [name, _state, _address, publicIp] = parts;
      
      // Query actual system resources via SSH
      let cpuCount = 4; // Fallback
      let memoryTotal = '8GB'; // Fallback
      let diskSpace = '100GB'; // Fallback
      
      try {
        // SSH into machine to get actual specs
        // Command: nproc (CPU cores), free -g (memory in GB), df -h (disk space)
        const keyFlag = sshKeyPath ? `-i ${sshKeyPath}` : '';
        const { stdout: sshOutput } = await execAsync(
          `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 ${keyFlag} root@${publicIp} "nproc && free -g | grep Mem | awk '{print \\$2}' && df -h / | tail -1 | awk '{print \\$2}'"`
        );
        
        const sshLines = sshOutput.trim().split('\n');
        if (sshLines.length >= 3) {
          cpuCount = parseInt(sshLines[0], 10) || cpuCount;
          const memoryGb = parseInt(sshLines[1], 10) || 8;
          memoryTotal = `${memoryGb}GB`;
          diskSpace = sshLines[2].trim() || diskSpace;
        }
      } catch (sshError) {
        console.warn('Could not SSH to machine for specs, using defaults:', sshError);
      }
      
      const info: UncloudServerInfo = {
        hostname: name,
        ip: publicIp,
        cpuCount,
        memoryTotal,
        diskSpace,
        os: 'Linux' // Uncloud runs on Linux
      };
      
      return info;
    } catch (error) {
      console.error('Error getting server info:', error);
      return null;
    }
  }

  /**
   * List all services in cluster using `uc ls`
   */
  static async listServices(contextName?: string): Promise<UncloudAppInfo[]> {
    try {
      if (contextName) {
        await this.switchContext(contextName);
      }
      const { stdout } = await execAsync('uc ls');
      const lines = stdout.split('\n').filter(line => line.trim());
      const apps: UncloudAppInfo[] = [];
      for (const line of lines) {
        if (line.startsWith('NAME')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const name = parts[0];
          const mode = parts[1];
          const replicas = parseInt(parts[2], 10);
          const endpoints = parts.slice(3);
          
          apps.push({ 
            name, 
            mode,
            replicas,
            status: isNaN(replicas) ? 'unknown' : replicas > 0 ? 'running' : 'stopped', 
            ports: endpoints, 
            image: '' // Image is not available in uc ls output
          });
        }
      }
      return apps;
    } catch (error) {
      console.error('Error listing services:', error);
      return [];
    }
  }

  static async serviceInspect(params: { serviceName: string; context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc service inspect ${params.serviceName} ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async serviceScale(params: { serviceName: string; replicas: number; context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`echo "y" | uc service scale ${params.serviceName} ${params.replicas} ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async serviceExec(params: { serviceName: string; cmd: string; context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc service exec ${params.serviceName} -- ${params.cmd} ${contextFlag}`.trim(), { maxBuffer: 10 * 1024 * 1024 });
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async listVolumes(context?: string): Promise<{ success: boolean; volumes: string[]; error?: string }>{
    try {
      const contextFlag = context ? `-c ${context}` : '';
      const { stdout } = await execAsync(`uc volume ls ${contextFlag}`.trim());
      const lines = stdout.split('\n').filter(l => l.trim());
      
      // Filter out header lines and "No volumes" type messages
      const data = lines
        .filter(l => {
          const upper = l.toUpperCase();
          return !upper.includes('NAME') && 
                 !upper.startsWith('NO ') && 
                 !upper.includes('NO VOLUMES');
        })
        .map(l => l.trim().split(/\s+/)[0])
        .filter(Boolean);
      
      return { success: true, volumes: data };
    } catch (error: any) {
      return { success: false, volumes: [], error: error.stderr || error.message };
    }
  }

  static async inspectVolume(params: { volumeName: string; context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc volume inspect ${params.volumeName} ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async createVolume(params: { volumeName: string; context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc volume create ${params.volumeName} ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async dnsShow(context?: string): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = context ? `-c ${context}` : '';
      const { stdout, stderr } = await execAsync(`uc dns show ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async dnsReserve(params?: { context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      // `uc dns reserve` manages the cluster domain itself; no domain argument
      const contextFlag = params?.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc dns reserve ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async dnsRelease(params?: { context?: string }): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = params?.context ? `-c ${params.context}` : '';
      const { stdout, stderr } = await execAsync(`uc dns release ${contextFlag}`.trim());
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async listMachines(context?: string): Promise<{ success: boolean; machines: any[]; error?: string }>{
    try {
      const contextFlag = context ? `-c ${context}` : '';
      const { stdout } = await execAsync(`uc machine ls ${contextFlag}`.trim());
      
      // Parse the output
      // Example output:
      // NAME           STATE   ADDRESS         PUBLIC IP        WIREGUARD ENDPOINTS                                    MACHINE ID
      // machine-zvbx   Up      10.210.0.1/24   147.93.191.127   147.93.191.127:51820, [2605:a143:2288:5083::1]:51820   2532e32769dc7e16a5bfcf4e7c361737
      
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) {
        return { success: true, machines: [] };
      }
      
      // Skip header line
      const machines = lines.slice(1).map(line => {
        const parts = line.split(/\s+/);
        if (parts.length < 6) return null;
        
        const [name, state, address, publicIp] = parts;
        // The last part is machine ID, everything before that is WireGuard endpoints
        const machineId = parts[parts.length - 1];
        const endpoints = parts.slice(4, -1).join(' ');
        
        return {
          name,
          state,
          address,
          publicIp,
          wireguardEndpoints: endpoints,
          machineId
        };
      }).filter(Boolean);
      
      return { success: true, machines };
    } catch (error: any) {
      return { success: false, machines: [], error: error.stderr || error.message };
    }
  }

  static async renameMachine(params: {
    oldName: string;
    newName: string;
    context?: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const command = `uc machine rename ${params.oldName} ${params.newName} ${contextFlag}`.trim();

      console.log(`✏️ Renaming machine: ${params.oldName} -> ${params.newName}`);
      const { stdout, stderr } = await execAsync(command);
      console.log(`✅ Machine rename completed: ${params.oldName} -> ${params.newName}`);

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
      };
    } catch (error: any) {
      console.error(
        `Failed to rename machine ${params.oldName} -> ${params.newName}:`,
        error,
      );
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }

  static async removeMachine(params: {
    machineName: string;
    context?: string;
    noReset?: boolean;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const noResetFlag = params.noReset ? '--no-reset' : '';
      const command = `uc machine rm ${params.machineName} ${contextFlag} ${noResetFlag} -y`.trim();
      
      console.log(`🗑️ Removing machine: ${params.machineName}`);
      const { stdout, stderr } = await execAsync(command);
      
      console.log(`✅ Successfully removed machine: ${params.machineName}`);
      return {
        success: true,
        output: stdout,
        error: stderr || undefined
      };
    } catch (error: any) {
      console.error(`Failed to remove machine ${params.machineName}:`, error);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  static async caddyConfig(context?: string): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = context ? `-c ${context}` : '';
      const { stdout, stderr } = await execAsync(`uc caddy config ${contextFlag}`.trim(), { maxBuffer: 10 * 1024 * 1024 });
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  static async caddyDeploy(context?: string): Promise<{ success: boolean; output: string; error?: string }>{
    try {
      const contextFlag = context ? `-c ${context}` : '';
      const { stdout, stderr } = await execAsync(`uc caddy deploy ${contextFlag}`.trim(), { maxBuffer: 10 * 1024 * 1024 });
      return { success: true, output: stdout, error: stderr || undefined };
    } catch (error: any) {
      return { success: false, output: error.stdout || '', error: error.stderr || error.message };
    }
  }

  /**
   * Remove a service from the cluster using `uc service rm`
   * NOTE: This does NOT remove volumes automatically
   */
  static async removeService(params: {
    serviceName: string;
    context?: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      const command = `echo "y" | uc service rm ${params.serviceName} ${contextFlag}`.trim();
      
      console.log(`🗑️ Removing service: ${params.serviceName}`);
      const { stdout, stderr } = await execAsync(command);
      
      console.log(`✅ Successfully removed service: ${params.serviceName}`);
      return {
        success: true,
        output: stdout,
        error: stderr || undefined
      };
    } catch (error: any) {
      console.error(`Failed to remove service ${params.serviceName}:`, error);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Remove a volume from the cluster using `uc volume rm`
   * IMPORTANT: Volumes are NOT automatically deleted when services are removed
   */
  static async removeVolume(params: {
    volumeName: string;
    context?: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const contextFlag = params.context ? `-c ${params.context}` : '';
      // Add -f (force) and -y (yes) to bypass confirmation prompts and force removal
      const command = `uc volume rm ${params.volumeName} ${contextFlag} -f -y`.trim();
      
      console.log(`🗑️ Removing volume: ${params.volumeName}`);
      const { stdout, stderr } = await execAsync(command);
      
      console.log(`✅ Successfully removed volume: ${params.volumeName}`);
      return {
        success: true,
        output: stdout,
        error: stderr || undefined
      };
    } catch (error: any) {
      console.error(`Failed to remove volume ${params.volumeName}:`, error);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * Get service logs using `uc logs`
   */
  static async getServiceLogs(params: {
    serviceName: string;
    lines?: number;
    context?: string;
  }): Promise<{ success: boolean; logs: string; error?: string }> {
    try {
      const { serviceName, lines = 100, context } = params;
      const contextFlag = context ? `-c ${context}` : '';
      const command = `uc logs ${serviceName} --tail ${lines} ${contextFlag}`.trim();
      
      const { stdout } = await execAsync(command, {
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer for logs
      });
      
      return {
        success: true,
        logs: stdout
      };
    } catch (error: any) {
      console.error(`Failed to get logs for service ${params.serviceName}:`, error);
      return {
        success: false,
        logs: '',
        error: error.stderr || error.message
      };
    }
  }

  /**
   * NOTE: For start/stop/restart operations, use `uc deploy -f` with updated compose file
   * Uncloud uses declarative deployments - modify compose and redeploy for lifecycle changes
   */

  /**
   * Deploy services from a Docker Compose file using uncloud
   * Uses `uc deploy -f` with optional context and auto-confirm flags
   */
  static async deployFromCompose(params: {
    composeContent: string;
    context?: string;
    autoConfirm?: boolean;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    const { composeContent, context, autoConfirm } = params;
    const tempFile = `/tmp/compose-${Date.now()}.yaml`;

    try {
      // Write compose content to a temp file
      await fs.writeFile(tempFile, composeContent, 'utf8');

      const contextFlag = context ? `-c ${context}` : '';
      const yesFlag = autoConfirm ? '-y' : '';
      const command = `uc deploy -f ${tempFile} ${contextFlag} ${yesFlag}`.trim();

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 20 * 1024 * 1024,
      });

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
      };
    } catch (error: any) {
      console.error('Failed to deploy from compose:', error);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    } finally {
      // Best-effort cleanup of temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Initialize the first machine in a new uncloud cluster
   * Uses `uc machine init user@host -i key -n name [-c context]`
   * This should be used for the FIRST machine only
   */
  static async initFirstMachine(params: {
    machineName: string;
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
    contextName?: string;
  }): Promise<{ success: boolean; output: string; error?: string; clusterId?: string; clusterDomain?: string }> {
    const { machineName, sshHost, sshUser, sshKeyPath, contextName } = params;
    const contextFlag = contextName ? `-c ${contextName}` : '';
    const command = `uc machine init ${sshUser}@${sshHost} -i ${sshKeyPath} -n ${machineName} ${contextFlag}`.trim();

    try {
      console.log(`🔧 Initializing first machine: ${machineName}`);
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
      });

      // Parse cluster ID and domain from output
      const clusterIdMatch = stdout.match(/Cluster "([^"]+)" initialised/);
      const domainMatch = stdout.match(/Reserved cluster domain: ([^\s]+)/);

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
        clusterId: clusterIdMatch?.[1],
        clusterDomain: domainMatch?.[1],
      };
    } catch (error: any) {
      console.error(`Failed to initialize first machine ${machineName}:`, error);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }

  /**
   * Add a machine to an existing uncloud cluster
   * Uses `uc machine add user@host -i key -n name [-c context]`
   * This should be used for additional machines after the first one
   */
  static async addMachine(params: {
    machineName: string;
    sshHost: string;
    sshUser: string;
    sshKeyPath: string;
    context?: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    const { machineName, sshHost, sshUser, sshKeyPath, context } = params;
    const contextFlag = context ? `-c ${context}` : '';
    const command = `uc machine add ${sshUser}@${sshHost} -i ${sshKeyPath} -n ${machineName} ${contextFlag}`.trim();

    try {
      console.log(`➕ Adding machine to cluster: ${machineName}`);
      console.log(`   Command: ${command}`);
      console.log(`   This will install Docker, uncloud daemon, and WireGuard on the remote machine...`);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
      });

      console.log(`✅ Machine add completed`);
      console.log(`   Output:\n${stdout}`);
      if (stderr) {
        console.log(`   Stderr:\n${stderr}`);
      }

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
      };
    } catch (error: any) {
      console.error(`❌ Failed to add machine ${machineName}:`, error);
      console.error(`   Stdout: ${error.stdout || 'none'}`);
      console.error(`   Stderr: ${error.stderr || 'none'}`);
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }
}
