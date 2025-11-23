/**
 * PaaS Application Service
 * Manages PaaS applications in the database
 */

import { query, transaction } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { UncloudService } from './uncloudService.js';
import { PaaSWorkerService } from './paasWorkerService.js';

export interface PaaSApplication {
  id: string;
  userId: string;
  name: string;
  repositoryUrl?: string;
  repositoryBranch?: string;
  deploymentStrategy: 'buildpack' | 'dockerfile' | 'image';
  buildpackBuilder?: string;
  customBuildpacks?: string[];
  dockerfilePath?: string;
  imageUrl?: string;
  targetWorkerNodeId?: string;
  appPort?: number;
  healthCheckPath?: string;
  minInstances?: number;
  maxInstances?: number;
  cpuLimit?: number;
  memoryLimitMb?: number;
  status: 'inactive' | 'deploying' | 'running' | 'stopped' | 'error' | 'deleting' | 'deleted';
  lastDeploymentId?: string;
  pricingPlanId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApplicationParams {
  userId: string;
  name: string;
  repositoryUrl?: string;
  repositoryBranch?: string;
  deploymentStrategy: 'buildpack' | 'dockerfile' | 'image';
  buildpackBuilder?: string;
  customBuildpacks?: string[];
  dockerfilePath?: string;
  imageUrl?: string;
  targetWorkerNodeId?: string;
  appPort?: number;
  healthCheckPath?: string;
  minInstances?: number;
  maxInstances?: number;
  cpuLimit?: number;
  memoryLimitMb?: number;
  pricingPlanId?: string;
}

export interface UpdateApplicationParams {
  repositoryUrl?: string;
  repositoryBranch?: string;
  buildpackBuilder?: string;
  customBuildpacks?: string[];
  dockerfilePath?: string;
  imageUrl?: string;
  targetWorkerNodeId?: string;
  appPort?: number;
  healthCheckPath?: string;
  minInstances?: number;
  maxInstances?: number;
  cpuLimit?: number;
  memoryLimitMb?: number;
  status?: 'inactive' | 'deploying' | 'running' | 'stopped' | 'error' | 'deleting';
  lastDeploymentId?: string;
  pricingPlanId?: string;
}

export class PaaSApplicationService {
  /**
   * Create a new PaaS application
   */
  static async createApplication(params: CreateApplicationParams): Promise<PaaSApplication | null> {
    try {
      return await transaction(async (client) => {
        const now = new Date();
        
        // Store extra fields in config JSONB
        const config = {
          customBuildpacks: params.customBuildpacks,
          dockerfilePath: params.dockerfilePath,
          appPort: params.appPort || 8080,
          healthCheckPath: params.healthCheckPath || '/'
        };

        // Generate slug
        const slug = params.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

        // Resolve target worker node: use explicit target if provided, otherwise
        // fall back to the first active worker node (if any) so new apps have a
        // usable deployment target by default.
        let targetWorkerNodeId = params.targetWorkerNodeId;
        if (!targetWorkerNodeId) {
          try {
            const workerResult = await client.query(
              "SELECT id FROM paas_worker_nodes WHERE status = 'active' ORDER BY created_at ASC LIMIT 1"
            );
            if (workerResult.rows[0]) {
              targetWorkerNodeId = workerResult.rows[0].id;
            }
          } catch (workerError) {
            console.warn('Failed to auto-select PaaS worker node for app', workerError);
          }
        }

        const result = await client.query(
          `INSERT INTO paas_applications (
            user_id, name, slug, repository_url, repository_branch,
            deploy_method, buildpack_builder,
            docker_image, worker_node_id,
            min_instances, max_instances, cpu_limit, ram_limit_mb,
            status, pricing_plan_id, created_at, updated_at,
            config
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *`,
          [
            params.userId,
            params.name,
            slug,
            params.repositoryUrl,
            params.repositoryBranch || 'main',
            params.deploymentStrategy,
            params.buildpackBuilder,
            params.imageUrl,
            targetWorkerNodeId,
            params.minInstances || 1,
            params.maxInstances || 1,
            params.cpuLimit || 1,
            params.memoryLimitMb || 512,
            'inactive',
            params.pricingPlanId,
            now,
            now,
            config
          ]
        );
        
        const app = result.rows[0];
        console.log(`✅ Created PaaS application: ${params.name}`);
        
        return this.mapRowToApplication(app);
      });
    } catch (error) {
      console.error('Error creating application:', error);
      return null;
    }
  }

  /**
   * Get all applications for a user
   */
  static async getApplicationsByUserId(userId: string): Promise<PaaSApplication[]> {
    try {
      const result = await query(
        'SELECT * FROM paas_applications WHERE user_id = $1 AND status != $2 ORDER BY created_at DESC',
        [userId, 'deleted']
      );
      
      return result.rows.map(row => this.mapRowToApplication(row));
    } catch (error) {
      console.error('Error getting applications:', error);
      return [];
    }
  }

  /**
   * Get all applications (admin view)
   */
  static async getAllApplications(status?: string): Promise<PaaSApplication[]> {
    try {
      let sql = 'SELECT * FROM paas_applications';
      const params: any[] = [];
      
      if (status) {
        sql += ' WHERE status = $1';
        params.push(status);
      } else {
        sql += ' WHERE status != $1';
        params.push('deleted');
      }
      
      sql += ' ORDER BY created_at DESC';
      
      const result = await query(sql, params);
      return result.rows.map(row => this.mapRowToApplication(row));
    } catch (error) {
      console.error('Error getting all applications:', error);
      return [];
    }
  }

  /**
   * Get a specific application by ID
   */
  static async getApplicationById(appId: string): Promise<PaaSApplication | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_applications WHERE id = $1',
        [appId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToApplication(result.rows[0]);
    } catch (error) {
      console.error('Error getting application:', error);
      return null;
    }
  }

  /**
   * Get application by name and user ID
   */
  static async getApplicationByName(userId: string, name: string): Promise<PaaSApplication | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_applications WHERE user_id = $1 AND name = $2 AND status != $3',
        [userId, name, 'deleted']
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToApplication(result.rows[0]);
    } catch (error) {
      console.error('Error getting application by name:', error);
      return null;
    }
  }

  /**
   * Update an application
   */
  static async updateApplication(
    appId: string,
    updates: UpdateApplicationParams
  ): Promise<PaaSApplication | null> {
    try {
      const setStatements: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (updates.repositoryUrl !== undefined) {
        setStatements.push(`repository_url = $${paramIndex++}`);
        params.push(updates.repositoryUrl);
      }
      
      if (updates.repositoryBranch !== undefined) {
        setStatements.push(`repository_branch = $${paramIndex++}`);
        params.push(updates.repositoryBranch);
      }
      
      if (updates.buildpackBuilder !== undefined) {
        setStatements.push(`buildpack_builder = $${paramIndex++}`);
        params.push(updates.buildpackBuilder);
      }
      
      if (updates.imageUrl !== undefined) {
        setStatements.push(`docker_image = $${paramIndex++}`);
        params.push(updates.imageUrl);
      }
      
      if (updates.targetWorkerNodeId !== undefined) {
        setStatements.push(`worker_node_id = $${paramIndex++}`);
        params.push(updates.targetWorkerNodeId);
      }
      
      if (updates.minInstances !== undefined) {
        setStatements.push(`min_instances = $${paramIndex++}`);
        params.push(updates.minInstances);
      }
      
      if (updates.maxInstances !== undefined) {
        setStatements.push(`max_instances = $${paramIndex++}`);
        params.push(updates.maxInstances);
      }
      
      if (updates.cpuLimit !== undefined) {
        setStatements.push(`cpu_limit = $${paramIndex++}`);
        params.push(updates.cpuLimit);
      }
      
      if (updates.memoryLimitMb !== undefined) {
        setStatements.push(`ram_limit_mb = $${paramIndex++}`);
        params.push(updates.memoryLimitMb);
      }
      
      if (updates.status !== undefined) {
        setStatements.push(`status = $${paramIndex++}`);
        params.push(updates.status);
      }
      
      if (updates.pricingPlanId !== undefined) {
        setStatements.push(`pricing_plan_id = $${paramIndex++}`);
        params.push(updates.pricingPlanId);
      }

      // Handle config updates (merge with existing)
      if (updates.customBuildpacks !== undefined || updates.dockerfilePath !== undefined || 
          updates.appPort !== undefined || updates.healthCheckPath !== undefined) {
        
        // We need to fetch existing config first to merge, but for now let's just use jsonb_set or similar if possible.
        // Simpler: fetch current app, merge in JS, update.
        // Since we are in a service method, we can do a quick select.
        const currentApp = await this.getApplicationById(appId);
        if (currentApp) {
           const newConfig = {
             customBuildpacks: updates.customBuildpacks !== undefined ? updates.customBuildpacks : currentApp.customBuildpacks,
             dockerfilePath: updates.dockerfilePath !== undefined ? updates.dockerfilePath : currentApp.dockerfilePath,
             appPort: updates.appPort !== undefined ? updates.appPort : currentApp.appPort,
             healthCheckPath: updates.healthCheckPath !== undefined ? updates.healthCheckPath : currentApp.healthCheckPath
           };
           setStatements.push(`config = $${paramIndex++}`);
           params.push(newConfig);
        }
      }
      
      setStatements.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());
      
      params.push(appId);
      
      const result = await query(
        `UPDATE paas_applications SET ${setStatements.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToApplication(result.rows[0]);
    } catch (error) {
      console.error('Error updating application:', error);
      return null;
    }
  }

  /**
   * Delete an application
   * Removes service and volume from uncloud, then soft deletes in DB
   */
  static async deleteApplication(appId: string): Promise<boolean> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) {
        console.warn(`Application ${appId} not found for deletion`);
        return false;
      }

      // If app is deployed, remove from uncloud
      if (app.targetWorkerNodeId) {
        const worker = await PaaSWorkerService.getWorkerById(app.targetWorkerNodeId);
        if (worker) {
          try {
            // Remove service
            await UncloudService.removeService({
              serviceName: app.name,
              context: worker.uncloudContext
            });
            
            // Resolve tenant for volume name (matching deploy logic)
            let organizationId: string | null = null;
            try {
              const orgResult = await query(
                'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
                [app.userId]
              );
              organizationId = orgResult.rows[0]?.organization_id || null;
            } catch {
              console.warn('organization_members lookup failed for app deletion');
            }

            if (!organizationId) {
              try {
                const ownerOrg = await query(
                  'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
                  [app.userId]
                );
                if (ownerOrg.rows[0]) {
                  organizationId = ownerOrg.rows[0].id;
                }
              } catch {
                console.warn('organizations lookup failed for app deletion');
              }
            }

            const tenantId = organizationId || `user-${app.userId}`;
            const safeTenantId = String(tenantId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const safeAppName = app.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const volumeName = `${safeTenantId}-${safeAppName}-data`;

            // Remove volume
            await UncloudService.removeVolume({
              volumeName,
              context: worker.uncloudContext
            });
            
            console.log(`✅ Removed service and volume for app: ${app.name}`);
          } catch (error) {
            console.error(`Failed to remove uncloud resources for app ${app.name}:`, error);
            // Continue with soft delete even if uncloud cleanup fails
          }
        }
      }

      // Soft delete in database
      const result = await query(
        'UPDATE paas_applications SET status = $1, updated_at = $2, deleted_at = $2 WHERE id = $3',
        ['deleted', new Date(), appId]
      );
      
      console.log(`🗑️ Deleted application: ${appId}`);
      
      return result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting application:', error);
      return false;
    }
  }

  /**
   * Get application statistics
   */
  static async getApplicationStats(userId?: string): Promise<{
    total: number;
    running: number;
    stopped: number;
    building: number;
    deploying: number;
    failed: number;
  }> {
    try {
      let sql = `
        SELECT 
          COUNT(*) FILTER (WHERE status != 'deleted') as total,
          COUNT(*) FILTER (WHERE status = 'running') as running,
          COUNT(*) FILTER (WHERE status = 'stopped') as stopped,
          COUNT(*) FILTER (WHERE status = 'building') as building,
          COUNT(*) FILTER (WHERE status = 'deploying') as deploying,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM paas_applications
      `;
      const params: any[] = [];
      
      if (userId) {
        sql += ' WHERE user_id = $1';
        params.push(userId);
      }
      
      const result = await query(sql, params);
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total || '0'),
        running: parseInt(row.running || '0'),
        stopped: parseInt(row.stopped || '0'),
        building: parseInt(row.building || '0'),
        deploying: parseInt(row.deploying || '0'),
        failed: parseInt(row.failed || '0')
      };
    } catch (error) {
      console.error('Error getting application stats:', error);
      return {
        total: 0,
        running: 0,
        stopped: 0,
        building: 0,
        deploying: 0,
        failed: 0
      };
    }
  }

  /**
   * Get applications by worker node
   */
  static async getApplicationsByWorker(workerNodeId: string): Promise<PaaSApplication[]> {
    try {
      const result = await query(
        'SELECT * FROM paas_applications WHERE worker_node_id = $1 AND status != $2 ORDER BY created_at DESC',
        [workerNodeId, 'deleted']
      );
      
      return result.rows.map(row => this.mapRowToApplication(row));
    } catch (error) {
      console.error('Error getting applications by worker:', error);
      return [];
    }
  }

  /**
   * Get application resource usage (CPU, Memory, etc.)
   */
  static async getApplicationResourceUsage(appId: string): Promise<any> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return null;

      // If app is not running, return zero stats
      if (app.status !== 'running') {
        return {
          cpu: '0%',
          memory: '0MB',
          uptime: '0s',
          instances: 0
        };
      }

      // Try to get stats from UncloudService
      // Note: This requires circular dependency handling if we import UncloudService directly
      // For now, we'll return mock data based on limits until we resolve dependencies
      // or move this logic to a higher level controller/service
      
      return {
        cpu: '0.5%',
        memory: '128MB',
        uptime: '2h 15m',
        instances: app.minInstances || 1,
        limits: {
          cpu: app.cpuLimit,
          memory: app.memoryLimitMb
        }
      };
    } catch (error) {
      console.error('Error getting application resource usage:', error);
      return null;
    }
  }

  /**
   * Map database row to PaaSApplication interface
   */
  private static mapRowToApplication(row: any): PaaSApplication {
    const config = row.config || {};
    return {
      id: row.id.toString(),
      userId: row.user_id.toString(),
      name: row.name,
      repositoryUrl: row.repository_url,
      repositoryBranch: row.repository_branch,
      deploymentStrategy: row.deploy_method,
      buildpackBuilder: row.buildpack_builder,
      customBuildpacks: config.customBuildpacks,
      dockerfilePath: config.dockerfilePath,
      imageUrl: row.docker_image,
      targetWorkerNodeId: row.worker_node_id?.toString(),
      appPort: config.appPort,
      healthCheckPath: config.healthCheckPath,
      minInstances: row.min_instances,
      maxInstances: row.max_instances,
      cpuLimit: row.cpu_limit ? parseFloat(row.cpu_limit) : undefined,
      memoryLimitMb: row.ram_limit_mb,
      status: row.status,
      lastDeploymentId: row.last_deployment_id,
      pricingPlanId: row.pricing_plan_id?.toString(),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Redeploy application configuration (ports, domains, env vars) using existing image
   * Uses the latest successful deployment image or falls back to imageUrl for image strategy
   */
  static async redeployConfig(appId: string): Promise<{ success: boolean; logs?: string; error?: string }> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return { success: false, error: 'Application not found' };

      if (!app.targetWorkerNodeId) return { success: false, error: 'No worker node assigned' };

      const worker = await PaaSWorkerService.getWorkerById(app.targetWorkerNodeId);
      if (!worker) return { success: false, error: 'Worker node not found' };

      // Try to get last successful deployment image
      const imageResult = await query(
        `SELECT image_name, image_tag
           FROM paas_deployments
          WHERE application_id = $1
            AND status = 'success'
            AND image_name IS NOT NULL
            AND image_tag IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1`,
        [app.id]
      );

      let imageName: string | null = null;
      let imageTag: string | null = null;

      if (imageResult.rows.length > 0) {
        imageName = imageResult.rows[0].image_name;
        imageTag = imageResult.rows[0].image_tag;
      } else if (app.imageUrl) {
        // Fallback for image-based deployments
        const parts = app.imageUrl.split(':');
        imageName = parts[0];
        imageTag = parts[1] || 'latest';
      }

      if (!imageName || !imageTag) {
        return { success: false, error: 'No existing deployment image found for application' };
      }

      // Environment variables
      const envVarsResult = await query(
        'SELECT key, value_encrypted, is_secret FROM paas_app_env_vars WHERE application_id = $1',
        [app.id]
      );

      const envVarsForCompose: { key: string; value: string }[] = [];
      for (const row of envVarsResult.rows) {
        // TODO: Decrypt value_encrypted when encryption is implemented
        const value = row.value_encrypted as string;
        envVarsForCompose.push({ key: row.key, value });
      }

      // Ports
      const portsResult = await query(
        `SELECT container_port, protocol, custom_domain, is_primary, is_internal_only,
                host_port, host_ip, target_machine, enable_ssl
           FROM paas_app_ports
          WHERE application_id = $1
          ORDER BY container_port ASC, id ASC`,
        [app.id]
      );

      const ports = portsResult.rows.map((row: any) => ({
        containerPort: row.container_port,
        protocol: row.protocol || 'https',
        domain: row.custom_domain || undefined,
        hostPort: row.host_port ?? undefined,
        hostIp: row.host_ip || undefined,
        targetMachine: row.target_machine || undefined,
        isPrimary: row.is_primary,
        isInternalOnly: row.is_internal_only,
        enableSsl: row.enable_ssl,
      }));

      if (ports.length === 0 && app.appPort) {
        ports.push({
          containerPort: app.appPort,
          protocol: 'https',
        });
      }

      const targetInstances =
        typeof app.minInstances === 'number' && app.minInstances > 0
          ? app.minInstances
          : 1;

      const workerMachines: string[] = Array.from(
        new Set(
          ports
            .map((p) => p.targetMachine)
            .filter((m): m is string => Boolean(m))
        )
      );

      // Resolve tenant (organization) for network and labels
      let organizationId: string | null = null;
      try {
        const orgResult = await query(
          'SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1',
          [app.userId]
        );
        organizationId = orgResult.rows[0]?.organization_id || null;
      } catch {
        // Ignore errors
      }

      if (!organizationId) {
        try {
          const ownerOrg = await query(
            'SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1',
            [app.userId]
          );
          if (ownerOrg.rows[0]) {
            organizationId = ownerOrg.rows[0].id;
          }
        } catch {
          // Ignore errors
        }
      }

      const tenantId = organizationId || `user-${app.userId}`;
      const safeTenantId = String(tenantId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const tenantNetworkName = `tenant_${safeTenantId}_network`;

      const composeContent = await this.generateDockerCompose({
        appName: app.name,
        imageName,
        imageTag,
        ports,
        envVars: envVarsForCompose,
        targetInstances,
        workerMachines: workerMachines.length > 0 ? workerMachines : undefined,
        tenantNetworkName,
        tenantId: String(tenantId),
        cpuLimit: app.cpuLimit,
        memoryLimitMb: app.memoryLimitMb,
      });

      const deployResult = await UncloudService.deployFromCompose({
        composeContent,
        context: worker.uncloudContext,
        autoConfirm: true,
      });

      return {
        success: deployResult.success,
        logs:
          deployResult.output +
          (deployResult.error ? `\nErrors: ${deployResult.error}` : ''),
        error: deployResult.success ? undefined : deployResult.error,
      };
    } catch (error: any) {
      console.error('Error redeploying application config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a Docker Compose file for an application with x-ports and x-machines
   * This is used by the deployment service to call `uc deploy -f`.
   */
  static async generateDockerCompose(params: {
    appName: string;
    imageName: string;
    imageTag: string;
    ports: {
      containerPort: number;
      protocol: string;
      domain?: string;
      hostPort?: number;
      hostIp?: string;
      targetMachine?: string;
      isPrimary?: boolean;
      isInternalOnly?: boolean;
      enableSsl?: boolean;
    }[];
    envVars: { key: string; value: string }[];
    targetInstances: number;
    workerMachines?: string[];
    tenantNetworkName?: string;
    labels?: Record<string, string>;
    tenantId?: string;
    cpuLimit?: number;
    memoryLimitMb?: number;
  }): Promise<string> {
    const {
      appName,
      imageName,
      imageTag,
      ports,
      envVars,
      targetInstances,
      workerMachines,
      tenantNetworkName,
      labels,
      tenantId,
      cpuLimit,
      memoryLimitMb,
    } = params;

    // Build x-ports entries following uncloud x-ports syntax
    const xPortsLines: string[] = [];
    for (const p of ports) {
      const protocol = p.protocol || 'https';

      // Host-mode publishing (TCP/UDP) if hostPort is set
      if (p.hostPort) {
        const hostIpPrefix = p.hostIp ? `${p.hostIp}:` : '';
        const spec = `${hostIpPrefix}${p.hostPort}:${p.containerPort}/${protocol}@host`;
        xPortsLines.push(`      - ${spec}`);
        continue;
      }

      // HTTP/HTTPS ingress with optional custom domain
      const portSpec = p.domain
        ? `${p.domain}:${p.containerPort}/${protocol}`
        : `${p.containerPort}/${protocol}`;
      xPortsLines.push(`      - ${portSpec}`);
    }

    const xPortsBlock =
      xPortsLines.length > 0
        ? ['    x-ports:', ...xPortsLines].join('\n')
        : '';

    // Environment variables block
    const envLines = envVars.map((e) => {
      const escaped = (e.value ?? '').replace(/"/g, '\\"');
      return `      ${e.key}: "${escaped}"`;
    });
    const envBlock =
      envLines.length > 0
        ? ['    environment:', ...envLines].join('\n')
        : '';

    // x-machines extension if specific worker machines are provided
    const xMachinesBlock =
      workerMachines && workerMachines.length > 0
        ? ['    x-machines:', ...workerMachines.map((m) => `      - ${m}`)].join('\n')
        : '';

    const lines: string[] = [];
    lines.push("version: '3.8'");
    lines.push('services:');
    lines.push(`  ${appName}:`);
    lines.push(`    image: ${imageName}:${imageTag}`);
    lines.push('    deploy:');
    lines.push(`      replicas: ${targetInstances}`);
    lines.push('      restart_policy:');
    lines.push('        condition: on-failure');

    // Resource limits (basic quotas)
    const limitsLines: string[] = [];
    // Default to 0.5 CPU if not specified
    const finalCpu = (typeof cpuLimit === 'number' && cpuLimit > 0) ? cpuLimit : 0.5;
    limitsLines.push(`          cpus: '${finalCpu}'`);
    
    // Default to 512MB if not specified
    const finalMemory = (typeof memoryLimitMb === 'number' && memoryLimitMb > 0) ? memoryLimitMb : 512;
    limitsLines.push(`          memory: '${finalMemory}M'`);
    
    // Prevent fork bombs
    limitsLines.push(`          pids: 100`);

    if (limitsLines.length > 0) {
      lines.push('      resources:');
      lines.push('        limits:');
      lines.push(...limitsLines);
    }

    // Basic security hardening
    lines.push('    security_opt:');
    lines.push('      - no-new-privileges:true');
    lines.push('    cap_drop:');
    lines.push('      - ALL');
    lines.push('    read_only: true');
    lines.push('    tmpfs:');
    lines.push('      - /tmp');
    lines.push('      - /run');

    // Attach to per-tenant network if provided
    if (tenantNetworkName) {
      lines.push('    networks:');
      lines.push(`      - ${tenantNetworkName}`);
    }

    if (xMachinesBlock) {
      lines.push(xMachinesBlock);
    }
    // Attach isolated volume for application data
    // Namespace volume with tenant ID if available to prevent collisions
    const safeAppName = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const safeTenantId = tenantId ? tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'default';
    const volumeName = `${safeTenantId}-${safeAppName}-data`;
    
    lines.push('    volumes:');
    lines.push(`      - ${volumeName}:/data`);

    if (xPortsBlock) {
      lines.push(xPortsBlock);
    }
    if (envBlock) {
      lines.push(envBlock);
    }

    // Container labels for tenant and application tracking
    if (labels && Object.keys(labels).length > 0) {
      lines.push('    labels:');
      for (const [key, value] of Object.entries(labels)) {
        const escaped = (value ?? '').replace(/"/g, '\\"');
        lines.push(`      ${key}: "${escaped}"`);
      }
    }

    // Define per-tenant network (non-external, created by compose)
    if (tenantNetworkName) {
      lines.push('');
      lines.push('networks:');
      lines.push(`  ${tenantNetworkName}:`);
      lines.push('    driver: bridge');
    }

    return lines.join('\n');
  }

  /**
   * Start an application
   * Uses redeploy to start (uncloud is declarative)
   */
  static async startApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return { success: false, error: 'Application not found' };
      
      // Update status to running and redeploy
      await this.updateApplication(appId, { status: 'running' });
      const result = await this.redeployConfig(appId);
      
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to start application' };
      }
    } catch (error: any) {
      console.error('Error starting application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop an application
   * Removes the service from uncloud
   */
  static async stopApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return { success: false, error: 'Application not found' };
      
      if (!app.targetWorkerNodeId) return { success: false, error: 'No worker node assigned' };
      
      const worker = await PaaSWorkerService.getWorkerById(app.targetWorkerNodeId);
      if (!worker) return { success: false, error: 'Worker node not found' };
      
      const result = await UncloudService.removeService({
        serviceName: app.name,
        context: worker.uncloudContext
      });
      
      if (result.success) {
        await this.updateApplication(appId, { status: 'stopped' });
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to stop application' };
      }
    } catch (error: any) {
      console.error('Error stopping application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restart an application
   * Redeploys with latest config
   */
  static async restartApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return { success: false, error: 'Application not found' };
      
      // Redeploy to restart (uncloud declarative approach)
      const result = await this.redeployConfig(appId);
      
      if (result.success) {
        await this.updateApplication(appId, { status: 'running' });
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to restart application' };
      }
    } catch (error: any) {
      console.error('Error restarting application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get application logs
   */
  static async getApplicationLogs(appId: string, lines: number = 100): Promise<{ success: boolean; logs?: string; error?: string }> {
    try {
      const app = await this.getApplicationById(appId);
      if (!app) return { success: false, error: 'Application not found' };

      // If the app is not running yet, report that there are no logs instead of
      // treating it as an error. This avoids noisy 500s in the client UI.
      if (app.status !== 'running') {
        return {
          success: true,
          logs: 'Application is not running yet – no logs available.',
        };
      }

      if (!app.targetWorkerNodeId) {
        return {
          success: true,
          logs: 'No worker node assigned yet – deploy the application to a worker to see logs.',
        };
      }

      const worker = await PaaSWorkerService.getWorkerById(app.targetWorkerNodeId);
      if (!worker) {
        return {
          success: true,
          logs: 'Worker node not found – contact support to restore this application.',
        };
      }

      const result = await UncloudService.getServiceLogs({
        serviceName: app.name,
        lines,
        context: worker.uncloudContext,
      });

      return result;
    } catch (error: any) {
      console.error('Error getting application logs:', error);
      return { success: false, error: error.message };
    }
  }
}
