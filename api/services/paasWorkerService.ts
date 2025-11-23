/**
 * PaaS Worker Service
 * Manages PaaS worker nodes in the database and integrates with UncloudService
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { query, transaction } from '../lib/database.js';
import { UncloudService } from './uncloudService.js';

const execAsync = promisify(exec);

export interface PaaSWorkerNode {
  id: string;
  name: string;
  hostIp: string;
  sshPort: number;
  sshUser: string;
  sshKeyEncrypted?: string;
  sshKeyPath?: string;
  uncloudContext: string;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  cpuTotal?: number;
  memoryTotalGb?: number;
  diskTotalGb?: number;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkerParams {
  name: string;
  hostIp: string;
  sshPort?: number;
  sshUser: string;
  sshKeyPath?: string;
  createdBy?: string; // User ID
}

export interface UpdateWorkerParams {
  name?: string;
  status?: 'active' | 'inactive' | 'maintenance' | 'error';
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  cpuTotal?: number;
  memoryTotalGb?: number;
  diskTotalGb?: number;
}

export class PaaSWorkerService {
  /**
   * Create a new PaaS worker node
   */
  static async createWorker(
    params: CreateWorkerParams,
    options?: { log?: (line: string) => void }
  ): Promise<{ worker: PaaSWorkerNode; logs: string } | null> {
    const logs: string[] = [];
    const recordLog = (line: string) => {
      logs.push(line);
      options?.log?.(line);
    };

    const sshPort = params.sshPort || 22;
    const machineName = params.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let contextName: string | undefined;

    try {
      // Check if this is the first worker
      const existingWorkersResult = await query(
        'SELECT COUNT(*) as count FROM paas_worker_nodes WHERE status != $1',
        ['error']
      );
      const isFirstWorker = parseInt(existingWorkersResult.rows[0].count) === 0;

      // Discover existing contexts
      let contexts = [] as Awaited<ReturnType<typeof UncloudService.listContexts>>;
      try {
        contexts = await UncloudService.listContexts();
      } catch {
        console.log('Could not list existing uncloud contexts');
      }

      const clusterExists = contexts.length > 0;
      if (clusterExists) {
        const activeContext = contexts.find((ctx) => ctx.isActive) ?? contexts[0];
        contextName = activeContext?.name;
        console.log(`✓ Detected existing uncloud context: ${contextName}`);
        console.log(`  Available contexts: ${contexts.map((c) => c.name).join(', ')}`);
        recordLog(`✓ Detected existing cluster context: ${contextName}`);
      } else {
        console.log('ℹ️  No existing uncloud contexts found');
        recordLog('ℹ️  No existing uncloud contexts - will initialize new cluster');
      }

      if (!clusterExists && isFirstWorker) {
        console.log('🔧 Initializing first worker - creating new uncloud cluster');
        recordLog('🔧 Initializing first worker - creating new cluster...');
        const initResult = await UncloudService.initFirstMachine({
          machineName,
          sshHost: params.hostIp,
          sshUser: params.sshUser,
          sshKeyPath: params.sshKeyPath || '',
          contextName: undefined,
        });

        if (!initResult.success) {
          recordLog(`❌ Failed to initialize: ${initResult.error}`);
          throw new Error(`Failed to initialize first machine: ${initResult.error}`);
        }

        recordLog('✅ Cluster initialized successfully');
        if (initResult.output) {
          recordLog(`Output:\n${initResult.output}`);
        }

        console.log(`✅ Cluster initialized: ${initResult.clusterId || 'default'}`);
        if (initResult.clusterDomain) {
          console.log(`🌐 Cluster domain: ${initResult.clusterDomain}`);
        }

        try {
          const newContexts = await UncloudService.listContexts();
          const activeContext = newContexts.find((ctx) => ctx.isActive) ?? newContexts[0];
          contextName = activeContext?.name;
        } catch {
          contextName = contextName || 'default';
        }
      } else if (clusterExists) {
        console.log(
          `➕ Adding machine to existing cluster (context: ${contextName ?? 'current'})`
        );
        recordLog(`➕ Adding machine "${machineName}" to cluster...`);
        recordLog('   Installing Docker, uncloud daemon, and configuring WireGuard...');

        const addResult = await UncloudService.addMachine({
          machineName,
          sshHost: params.hostIp,
          sshUser: params.sshUser,
          sshKeyPath: params.sshKeyPath || '',
          context: contextName,
        });

        if (!addResult.success) {
          recordLog(`❌ Failed to add machine: ${addResult.error}`);
          throw new Error(`Failed to add machine to cluster: ${addResult.error}`);
        }

        recordLog('✅ Machine added successfully!');
        if (addResult.output) {
          recordLog(`\nInstallation output:\n${addResult.output}`);
        }

        if (!contextName) {
          try {
            const refreshedContexts = await UncloudService.listContexts();
            const activeContext = refreshedContexts.find((c) => c.isActive) ?? refreshedContexts[0];
            contextName = activeContext?.name || 'default';
          } catch {
            contextName = 'default';
          }
        }
      } else {
        throw new Error(
          'Cannot add worker: No uncloud cluster exists and this is not the first worker. ' +
            'Please initialize uncloud first with: uc machine init <user>@<host>'
        );
      }

      if (!params.sshKeyPath) {
        recordLog('⚠️  SSH key path missing - skipping post-install setup');
      } else {
        recordLog('🛠️ Running post-install setup on worker...');
        const postInstallResult = await PaaSWorkerService.runPostInstallSetup({
          hostIp: params.hostIp,
          sshPort,
          sshUser: params.sshUser,
          sshKeyPath: params.sshKeyPath,
          machineName,
        });

        if (!postInstallResult.success) {
          recordLog(`❌ Post-install setup failed: ${postInstallResult.error || 'Unknown error'}`);
          throw new Error(`Post-install setup failed: ${postInstallResult.error || 'Unknown error'}`);
        }

        if (postInstallResult.output?.trim()) {
          recordLog(`🔧 Post-install output:\n${postInstallResult.output.trim()}`);
        }
      }

      const serverInfo = await UncloudService.getServerInfo(contextName, machineName, params.sshKeyPath);
      console.log(`📊 Server info retrieved for context "${contextName}" machine "${machineName}":`, {
        cpuCount: serverInfo?.cpuCount,
        memoryTotal: serverInfo?.memoryTotal,
        diskSpace: serverInfo?.diskSpace,
      });

      const workerRecord = await transaction(async (client) => {
        const now = new Date();
        const result = await client.query(
          `INSERT INTO paas_worker_nodes (
            name, ssh_host, ssh_port, ssh_user, ssh_key_path,
            uncloud_context, uncloud_machine_name, status, health_status,
            cpu_cores, ram_mb, disk_gb,
            last_health_check, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *`,
          [
            params.name,
            params.hostIp,
            sshPort,
            params.sshUser,
            params.sshKeyPath,
            contextName,
            machineName,
            'active',
            serverInfo ? 'healthy' : 'degraded',
            serverInfo?.cpuCount,
            serverInfo ? parseFloat(serverInfo.memoryTotal) * 1024 : null,
            serverInfo ? parseFloat(serverInfo.diskSpace) : null,
            now,
            null,
            now,
            now,
          ]
        );

        const worker = result.rows[0];
        console.log(`✅ Created PaaS worker: ${params.name} (${contextName})`);
        recordLog(`✅ Worker registered in database: ${params.name}`);
        return this.mapRowToWorker(worker);
      });

      return {
        worker: workerRecord,
        logs: logs.join('\n'),
      };
    } catch (error: any) {
      console.error('Error creating PaaS worker:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        stderr: error?.stderr,
        stdout: error?.stdout,
      });
      return null;
    }
  }

  /**
   * Get all worker nodes
   */
  static async getAllWorkers(status?: string): Promise<PaaSWorkerNode[]> {
    try {
      let sql = 'SELECT * FROM paas_worker_nodes';
      const params: any[] = [];
      
      if (status) {
        sql += ' WHERE status = $1';
        params.push(status);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const result = await query(sql, params);
      return result.rows.map(row => this.mapRowToWorker(row));
    } catch (error) {
      console.error('Error getting workers:', error);
      return [];
    }
  }

  /**
   * Get a specific worker by ID
   */
  static async getWorkerById(workerId: string): Promise<PaaSWorkerNode | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_worker_nodes WHERE id = $1',
        [workerId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToWorker(result.rows[0]);
    } catch (error) {
      console.error('Error getting worker:', error);
      return null;
    }
  }

  /**
   * Get a worker by uncloud context name
   */
  static async getWorkerByContext(contextName: string): Promise<PaaSWorkerNode | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_worker_nodes WHERE uncloud_context = $1',
        [contextName]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToWorker(result.rows[0]);
    } catch (error) {
      console.error('Error getting worker by context:', error);
      return null;
    }
  }

  /**
   * Update worker node information
   */
  static async updateWorker(
    workerId: string,
    updates: UpdateWorkerParams
  ): Promise<PaaSWorkerNode | null> {
    try {
      const setStatements: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (updates.name !== undefined) {
        setStatements.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }
      
      if (updates.status !== undefined) {
        setStatements.push(`status = $${paramIndex++}`);
        params.push(updates.status);
      }
      
      if (updates.healthStatus !== undefined) {
        setStatements.push(`health_status = $${paramIndex++}`);
        params.push(updates.healthStatus);
      }
      
      if (updates.cpuTotal !== undefined) {
        setStatements.push(`cpu_cores = $${paramIndex++}`);
        params.push(updates.cpuTotal);
      }
      
      if (updates.memoryTotalGb !== undefined) {
        setStatements.push(`ram_mb = $${paramIndex++}`);
        params.push(updates.memoryTotalGb * 1024);
      }
      
      if (updates.diskTotalGb !== undefined) {
        setStatements.push(`disk_gb = $${paramIndex++}`);
        params.push(updates.diskTotalGb);
      }
      
      setStatements.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());
      
      params.push(workerId);
      
      const result = await query(
        `UPDATE paas_worker_nodes SET ${setStatements.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToWorker(result.rows[0]);
    } catch (error) {
      console.error('Error updating worker:', error);
      return null;
    }
  }

  /**
   * Perform health check on a worker
   */
  static async performHealthCheck(workerId: string): Promise<boolean> {
    try {
      const worker = await this.getWorkerById(workerId);
      if (!worker) {
        return false;
      }
      
      // Get server info from uncloud
      const machineName = worker.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const serverInfo = await UncloudService.getServerInfo(worker.uncloudContext, machineName, worker.sshKeyPath);
      
      const updates: UpdateWorkerParams = {
        healthStatus: serverInfo ? 'healthy' : 'unhealthy'
      };
      
      if (serverInfo) {
        updates.cpuTotal = serverInfo.cpuCount;
        updates.memoryTotalGb = parseFloat(serverInfo.memoryTotal);
        updates.diskTotalGb = parseFloat(serverInfo.diskSpace);
      }
      
      // Update last health check timestamp
      await query(
        'UPDATE paas_worker_nodes SET last_health_check = $1 WHERE id = $2',
        [new Date(), workerId]
      );
      
      const updated = await this.updateWorker(workerId, updates);
      
      console.log(`🏥 Health check completed for worker: ${worker.name} - ${updates.healthStatus}`);
      
      return updated !== null;
    } catch (error) {
      console.error('Error performing health check:', error);
      return false;
    }
  }

  /**
   * Delete a worker node
   */
  static async deleteWorker(workerId: string): Promise<boolean> {
    try {
      const worker = await this.getWorkerById(workerId);
      if (!worker) {
        return false;
      }
      
      // Remove the machine from the uncloud cluster (not the context)
      // Use machine name generated same way as during creation
      const machineName = worker.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      console.log(`🗑️ Removing machine "${machineName}" from cluster context "${worker.uncloudContext}"`);
      
      try {
        await UncloudService.removeMachine({
          machineName,
          context: worker.uncloudContext,
          noReset: false, // Reset the machine after removal
        });
        console.log(`✅ Machine removed from cluster`);
      } catch (error: any) {
        console.warn(`⚠️  Failed to remove machine from uncloud cluster:`, error?.message);
        console.warn(`   Continuing with database cleanup...`);
        // Continue with DB deletion even if uncloud removal fails
      }
      
      // Delete from database
      const result = await query(
        'DELETE FROM paas_worker_nodes WHERE id = $1',
        [workerId]
      );
      
      console.log(`✅ Deleted worker from database: ${worker.name}`);
      
      return result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting worker:', error);
      return false;
    }
  }

  /**
   * Get worker statistics
   */
  static async getWorkerStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    maintenance: number;
    error: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  }> {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
          COUNT(*) FILTER (WHERE status = 'error') as error,
          COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy,
          COUNT(*) FILTER (WHERE health_status = 'degraded') as degraded,
          COUNT(*) FILTER (WHERE health_status = 'unhealthy') as unhealthy
        FROM paas_worker_nodes
      `);
      
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total || '0'),
        active: parseInt(row.active || '0'),
        inactive: parseInt(row.inactive || '0'),
        maintenance: parseInt(row.maintenance || '0'),
        error: parseInt(row.error || '0'),
        healthy: parseInt(row.healthy || '0'),
        degraded: parseInt(row.degraded || '0'),
        unhealthy: parseInt(row.unhealthy || '0')
      };
    } catch (error) {
      console.error('Error getting worker stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        maintenance: 0,
        error: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      };
    }
  }

  /**
   * Auto-discover and register workers from existing uncloud contexts
   */
  static async discoverAndRegisterWorkers(): Promise<{ discovered: number; registered: number }> {
    try {
      console.log('🔍 Discovering uncloud workers...');
      
      // Get list of uncloud contexts
      let contextsList;
      try {
        contextsList = await UncloudService.listContexts();
      } catch {
        console.log('ℹ️  Uncloud not available or no contexts configured');
        return { discovered: 0, registered: 0 };
      }
      
      const contexts = contextsList.map(ctx => ctx.name);
      let discovered = 0;
      let registered = 0;
      const uniqueMachineIds = new Set<string>();

      for (const contextName of contexts) {
        try {
          // Get machines for this context
          // Try to get machine details using uc machine ls
          const { stdout: machinesList } = await execAsync(`uc machine ls -c ${contextName}`);
          const machineLines = machinesList.trim().split('\n').slice(1); // Skip header
          
          const machines: Array<{name: string; state: string; address: string; publicIp?: string; id: string}> = [];
          for (const line of machineLines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              machines.push({
                name: parts[0],
                state: parts[1],
                address: parts[2].split('/')[0], // Remove CIDR
                publicIp: parts[3],
                id: parts[parts.length - 1] // Last part is ID
              });
            }
          }
          
          // Count unique machines
          for (const machine of machines) {
            if (!uniqueMachineIds.has(machine.id)) {
              uniqueMachineIds.add(machine.id);
              discovered++;
            }
          }

          for (const machine of machines) {
            // Check if worker already exists (by name or by context+machine combo)
            const existing = await query(
              'SELECT id FROM paas_worker_nodes WHERE name = $1 OR (uncloud_context = $2 AND uncloud_machine_name = $3)',
              [machine.name, contextName, machine.name]
            );

            if (existing.rows.length > 0) {
              // Silent skip for duplicates in other contexts to avoid log spam
              // console.log(`  Worker already exists: ${contextName}/${machine.name}`);
              continue;
            }

            // Register new worker
            const sshKeyPath = process.env.SSH_KEY_PATH || '/root/.ssh/id_ed25519';
            
            await query(
              `INSERT INTO paas_worker_nodes 
               (name, ssh_host, ssh_port, ssh_user, ssh_key_path, uncloud_context, uncloud_machine_name, 
                public_ip, private_ip, is_control_plane, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
              [
                machine.name, // Use machine name as worker name (unique per cluster)
                machine.publicIp || machine.address,
                22,
                'root',
                sshKeyPath,
                contextName,
                machine.name,
                machine.publicIp,
                machine.address,
                true, // Assume control plane for now
                machine.state === 'Up' ? 'active' : 'pending'
              ]
            );

            registered++;
            console.log(`  ✅ Registered worker: ${contextName} (${machine.name})`);
          }
        } catch (error) {
          console.error(`  ❌ Error processing context ${contextName}:`, error);
        }
      }

      console.log(`✨ Discovery complete: ${discovered} unique worker(s) found, ${registered} newly registered`);
      return { discovered, registered };
    } catch (error) {
      console.error('Error discovering workers:', error);
      throw error;
    }
  }

  private static async runPostInstallSetup(params: {
    hostIp: string;
    sshPort: number;
    sshUser: string;
    sshKeyPath: string;
    machineName: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    const { hostIp, sshPort, sshUser, sshKeyPath, machineName } = params;
    const remoteScript = `set -eu
export DEBIAN_FRONTEND=noninteractive

log() {
  echo "[worker-setup:${machineName}] $1"
}

log "Starting post-install setup on ${machineName}"

if ! command -v curl >/dev/null 2>&1; then
  log "Installing curl"
  apt-get update -y >/dev/null 2>&1 || true
  apt-get install -y curl ca-certificates >/dev/null 2>&1
fi

if ! command -v docker >/dev/null 2>&1; then
  log "Docker missing - installing via get.docker.com"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker >/dev/null 2>&1 || true
  systemctl start docker >/dev/null 2>&1 || true
fi

log "Installing standalone uncloud CLI (uc)"
if curl -fsS https://get.uncloud.run/install.sh | sh; then
  log "✓ uc CLI installed"
else
  log "Failed to install uc CLI"
  exit 1
fi

if command -v uc >/dev/null 2>&1; then
  UC_BIN=$(command -v uc)
else
  UC_BIN="/usr/local/bin/uc"
fi

ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then
  COMPOSE_ARCH="x86_64"
  UNREG_ARCH="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  COMPOSE_ARCH="aarch64"
  UNREG_ARCH="arm64"
else
  log "Unsupported architecture: $ARCH"
  exit 1
fi

COMPOSE_VERSION="v2.29.1"
COMPOSE_TARGET="/usr/local/bin/docker-compose"
if ! command -v docker-compose >/dev/null 2>&1; then
  log "Installing docker-compose standalone (\${COMPOSE_VERSION})"
  curl -SL "https://github.com/docker/compose/releases/download/\${COMPOSE_VERSION}/docker-compose-linux-\${COMPOSE_ARCH}" -o "\${COMPOSE_TARGET}"
  chmod +x "\${COMPOSE_TARGET}"
fi

PLUGIN_DIR=""
for dir in /usr/lib/docker/cli-plugins /usr/local/lib/docker/cli-plugins "$HOME/.docker/cli-plugins"; do
  if mkdir -p "$dir" 2>/dev/null; then
    PLUGIN_DIR="$dir"
    break
  fi
done

if [ -n "\${PLUGIN_DIR}" ]; then
  if [ ! -f "\${PLUGIN_DIR}/docker-compose" ]; then
    log "Copying docker-compose plugin to \${PLUGIN_DIR}"
    cp "\${COMPOSE_TARGET}" "\${PLUGIN_DIR}/docker-compose" || ln -sf "\${COMPOSE_TARGET}" "\${PLUGIN_DIR}/docker-compose"
  fi
  chmod +x "\${PLUGIN_DIR}/docker-compose"
fi

if ! docker compose version >/dev/null 2>&1; then
  log "docker compose plugin not detected - linking to standalone binary"
  ln -sf "\${COMPOSE_TARGET}" /usr/bin/docker-compose 2>/dev/null || true
fi

CLI_PLUGINS_DIR="$HOME/.docker/cli-plugins"
mkdir -p "$CLI_PLUGINS_DIR"
if [ ! -f "\${CLI_PLUGINS_DIR}/docker-pussh" ]; then
  log "Installing unregistry (docker pussh)"
  curl -fsSL "https://raw.githubusercontent.com/psviderski/unregistry/main/docker-pussh" -o "\${CLI_PLUGINS_DIR}/docker-pussh"
  chmod +x "\${CLI_PLUGINS_DIR}/docker-pussh"
fi

log "Verifying installations"
$UC_BIN --version
docker-compose version
docker compose version
docker pussh --help | head -n 5 || true

log "Post-install setup complete"
`;

    const sshBase = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${sshPort} -i ${sshKeyPath}`;
    const command = `cat <<'SCRIPT' | ${sshBase} ${sshUser}@${hostIp} 'bash -s'
${remoteScript}
SCRIPT`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      return { success: true, output };
    } catch (error: any) {
      return {
        success: false,
        output: error?.stdout || '',
        error: error?.stderr || error?.message || 'Unknown error',
      };
    }
  }

  /**
   * Map database row to PaaSWorkerNode interface
   */
  private static mapRowToWorker(row: any): PaaSWorkerNode {
    return {
      id: row.id.toString(),
      name: row.name,
      hostIp: row.ssh_host,
      sshPort: row.ssh_port,
      sshUser: row.ssh_user,
      sshKeyEncrypted: row.ssh_key_encrypted,
      sshKeyPath: row.ssh_key_path,
      uncloudContext: row.uncloud_context,
      status: row.status,
      cpuTotal: row.cpu_cores,
      memoryTotalGb: row.ram_mb ? row.ram_mb / 1024 : undefined,
      diskTotalGb: row.disk_gb ? parseFloat(row.disk_gb) : undefined,
      lastHealthCheck: row.last_health_check ? new Date(row.last_health_check) : undefined,
      healthStatus: row.health_status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
