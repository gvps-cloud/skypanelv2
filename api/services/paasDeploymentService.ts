/**
 * PaaS Deployment Service
 * Manages application deployments and orchestrates build/deploy processes
 */

import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { UncloudService } from './uncloudService.js';
import { BuildpackService } from './buildpackService.js';
import { PaaSApplicationService } from './paasApplicationService.js';
import { PaaSWorkerService } from './paasWorkerService.js';
import { UnregistryService } from './unregistryService.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface PaaSDeployment {
  id: string;
  applicationId: string;
  version: string;
  gitCommitSha?: string;
  gitBranch?: string;
  triggerType: 'manual' | 'webhook' | 'scheduled' | 'rollback';
  triggeredBy?: string;
  status: 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled';
  buildLogs?: string;
  deployLogs?: string;
  errorMessage?: string;
  imageName?: string;
  imageTag?: string;
  buildDuration?: number;
  deployDuration?: number;
  configSnapshot?: any;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateDeploymentParams {
  applicationId: string;
  version?: string;
  gitCommitSha?: string;
  gitBranch?: string;
  triggerType?: 'manual' | 'webhook' | 'scheduled' | 'rollback';
  triggeredBy?: string;
}

export class PaaSDeploymentService {
  /**
   * Create a new deployment record
   */
  static async createDeployment(params: CreateDeploymentParams): Promise<PaaSDeployment | null> {
    try {
      const deploymentId = uuidv4();
      const now = new Date();
      
      // Get application details
      const app = await PaaSApplicationService.getApplicationById(params.applicationId);
      if (!app) {
        throw new Error('Application not found');
      }
      
      // Generate version if not provided
      const version = params.version || this.generateVersion();
      
      // Create config snapshot
      const configSnapshot = {
        deploymentStrategy: app.deploymentStrategy,
        buildpackBuilder: app.buildpackBuilder,
        customBuildpacks: app.customBuildpacks,
        dockerfilePath: app.dockerfilePath,
        imageUrl: app.imageUrl,
        appPort: app.appPort,
        minInstances: app.minInstances,
        maxInstances: app.maxInstances,
        cpuLimit: app.cpuLimit,
        memoryLimitMb: app.memoryLimitMb,
        repositoryUrl: app.repositoryUrl,
        repositoryBranch: params.gitBranch || app.repositoryBranch
      };
      
      const result = await query(
        `INSERT INTO paas_deployments (
          id, application_id, version, git_commit_sha, git_branch,
          trigger_type, triggered_by, status, config_snapshot, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          deploymentId,
          params.applicationId,
          version,
          params.gitCommitSha,
          params.gitBranch || app.repositoryBranch,
          params.triggerType || 'manual',
          params.triggeredBy,
          'queued',
          JSON.stringify(configSnapshot),
          now
        ]
      );
      
      console.log(`✅ Created deployment record: ${version} for app ${app.name}`);
      
      return this.mapRowToDeployment(result.rows[0]);
    } catch (error) {
      console.error('Error creating deployment:', error);
      return null;
    }
  }

  /**
   * Execute a deployment (build + deploy)
   */
  static async executeDeployment(deploymentId: string): Promise<boolean> {
    try {
      const deployment = await this.getDeploymentById(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }
      
      const app = await PaaSApplicationService.getApplicationById(deployment.applicationId);
      if (!app) {
        throw new Error('Application not found');
      }
      
      // Update status to building
      await this.updateDeploymentStatus(deploymentId, 'building');
      await PaaSApplicationService.updateApplication(app.id, { status: 'building' });
      
      console.log(`🚀 Starting deployment ${deployment.version} for ${app.name}`);
      
      // Execute build based on deployment strategy
      let buildSuccess = false;
      let buildLogs = '';
      let imageName = '';
      let imageTag = deployment.version;
      const buildStartTime = Date.now();
      
      try {
        switch (app.deploymentStrategy) {
          case 'buildpack': {
            const buildResult = await this.buildWithBuildpack(app, deployment);
            buildSuccess = buildResult.success;
            buildLogs = buildResult.logs;
            imageName = buildResult.imageName;
            imageTag = buildResult.imageTag;
            break;
          }
          
          case 'dockerfile': {
            const dockerBuildResult = await this.buildWithDockerfile(app, deployment);
            buildSuccess = dockerBuildResult.success;
            buildLogs = dockerBuildResult.logs;
            imageName = dockerBuildResult.imageName;
            imageTag = dockerBuildResult.imageTag;
            break;
          }
          
          case 'image':
            // No build needed, use provided image
            buildSuccess = true;
            buildLogs = 'Using pre-built image';
            imageName = app.imageUrl || '';
            break;
        }
        
        const buildDuration = Date.now() - buildStartTime;
        
        // Update deployment with build results
        await query(
          `UPDATE paas_deployments SET build_logs = $1, build_duration = $2, image_name = $3, image_tag = $4 WHERE id = $5`,
          [buildLogs, buildDuration, imageName, imageTag, deploymentId]
        );
        
        if (!buildSuccess) {
          throw new Error('Build failed');
        }
        
        // Deploy to worker node
        await this.updateDeploymentStatus(deploymentId, 'deploying');
        await PaaSApplicationService.updateApplication(app.id, { status: 'deploying' });
        
        const deployStartTime = Date.now();
        const deployResult = await this.deployToWorker(app, deployment, imageName, imageTag);
        const deployDuration = Date.now() - deployStartTime;
        
        // Update deployment with deploy results
        await query(
          `UPDATE paas_deployments SET deploy_logs = $1, deploy_duration = $2, completed_at = $3 WHERE id = $4`,
          [deployResult.logs, deployDuration, new Date(), deploymentId]
        );
        
        if (!deployResult.success) {
          throw new Error('Deployment to worker failed');
        }
        
        // Mark deployment as successful
        await this.updateDeploymentStatus(deploymentId, 'success');
        await PaaSApplicationService.updateApplication(app.id, {
          status: 'running',
          lastDeploymentId: deploymentId
        });
        
        console.log(`✅ Deployment ${deployment.version} completed successfully`);
        return true;
        
      } catch (buildDeployError: any) {
        const buildDuration = Date.now() - buildStartTime;
        const errorMessage = buildDeployError.message || 'Unknown error';
        
        // Mark deployment as failed
        await query(
          `UPDATE paas_deployments 
           SET status = $1, error_message = $2, build_logs = $3, build_duration = $4, completed_at = $5 
           WHERE id = $6`,
          ['failed', errorMessage, buildLogs, buildDuration, new Date(), deploymentId]
        );
        
        await PaaSApplicationService.updateApplication(app.id, { status: 'failed' });
        
        console.error(`❌ Deployment ${deployment.version} failed:`, errorMessage);
        return false;
      }
    } catch (error) {
      console.error('Error executing deployment:', error);
      return false;
    }
  }

  /**
   * Build application using buildpack
   */
  private static async buildWithBuildpack(
    app: any,
    deployment: PaaSDeployment
  ): Promise<{ success: boolean; logs: string; imageName: string; imageTag: string }> {
    try {
      // Clone repository to temp directory
      const tempDir = await this.cloneRepository(app.repositoryUrl, deployment.gitBranch || app.repositoryBranch);
      
      // Build image using buildpack
      const imageName = `paas-${app.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const imageTag = deployment.version;
      
      const buildResult = await BuildpackService.buildImage({
        projectPath: tempDir,
        imageName,
        imageTag,
        builder: app.buildpackBuilder,
        buildpacks: app.customBuildpacks,
        clearCache: false
      });
      
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return {
        success: buildResult.success,
        logs: buildResult.buildLogs,
        imageName,
        imageTag
      };
    } catch (error: any) {
      return {
        success: false,
        logs: error.message || 'Build failed',
        imageName: '',
        imageTag: ''
      };
    }
  }

  /**
   * Build application using Dockerfile
   */
  private static async buildWithDockerfile(
    app: any,
    deployment: PaaSDeployment
  ): Promise<{ success: boolean; logs: string; imageName: string; imageTag: string }> {
    try {
      // Clone repository
      const tempDir = await this.cloneRepository(app.repositoryUrl, deployment.gitBranch || app.repositoryBranch);
      
      // Build with Docker
      const imageName = `paas-${app.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const imageTag = deployment.version;
      const dockerfilePath = app.dockerfilePath || 'Dockerfile';
      
      const { stdout, stderr } = await execAsync(
        `docker build -t ${imageName}:${imageTag} -f ${dockerfilePath} .`,
        {
          cwd: tempDir,
          maxBuffer: 50 * 1024 * 1024
        }
      );
      
      const logs = stdout + (stderr ? `\n${stderr}` : '');
      
      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return {
        success: true,
        logs,
        imageName,
        imageTag
      };
    } catch (error: any) {
      return {
        success: false,
        logs: error.stdout || error.stderr || error.message,
        imageName: '',
        imageTag: ''
      };
    }
  }

  /**
   * Deploy image to worker node using Docker Compose + uncloud x-ports/x-machines
   */
  private static async deployToWorker(
    app: any,
    deployment: PaaSDeployment,
    imageName: string,
    imageTag: string
  ): Promise<{ success: boolean; logs: string }> {
    try {
      if (!app.targetWorkerNodeId) {
        throw new Error('No target worker node specified');
      }

      const worker = await PaaSWorkerService.getWorkerById(app.targetWorkerNodeId);
      if (!worker) {
        throw new Error('Worker node not found');
      }

      // Get environment variables for compose
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

      // Get port mappings for x-ports
      const portsResult = await query(
        `SELECT container_port, protocol, custom_domain, is_primary, is_internal_only,
                host_port, host_ip, target_machine, enable_ssl
           FROM paas_app_ports
          WHERE application_id = $1
          ORDER BY container_port ASC, id ASC`,
        [app.id]
      );

      type PortMapping = {
        containerPort: number;
        protocol: string;
        domain?: string;
        hostPort?: number;
        hostIp?: string;
        targetMachine?: string;
        isPrimary?: boolean;
        isInternalOnly?: boolean;
        enableSsl?: boolean;
      };

      const ports: PortMapping[] = portsResult.rows.map((row: any) => ({
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

      // If no explicit ports configured, default to app.appPort
      if (ports.length === 0 && app.appPort) {
        ports.push({
          containerPort: app.appPort,
          protocol: 'https',
        });
      }

      // Determine target instances
      const targetInstances =
        typeof app.minInstances === 'number' && app.minInstances > 0
          ? app.minInstances
          : 1;

      // Collect worker machine hints from port mappings (for x-machines)
      const workerMachines = Array.from(
        new Set<string>(
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
        console.warn('organization_members lookup failed for PaaS deployment tenant resolution');
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
          console.warn('organizations lookup failed for PaaS deployment tenant resolution');
        }
      }

      const tenantId = organizationId || `user-${app.userId}`;
      const safeTenantId = String(tenantId).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const tenantNetworkName = `tenant_${safeTenantId}_network`;

      const labels: Record<string, string> = {
        'tenant.id': String(tenantId),
        'app.id': String(app.id),
        'app.name': String(app.name),
        'app.user_id': String(app.userId),
        'deployment.id': String(deployment.id),
        'deployment.version': String(deployment.version),
        'managed.by': 'skypanelv2',
      };
      if (organizationId) {
        labels['tenant.organization_id'] = String(organizationId);
      }
      if (app.pricingPlanId) {
        labels['pricing.plan'] = String(app.pricingPlanId);
      }

      const cpuLimit =
        typeof app.cpuLimit === 'number' && app.cpuLimit > 0 ? app.cpuLimit : undefined;
      const memoryLimitMb =
        typeof app.memoryLimitMb === 'number' && app.memoryLimitMb > 0
          ? app.memoryLimitMb
          : undefined;

      // Push image to target worker(s) before deploy
      const targets = workerMachines.length > 0 ? workerMachines : [worker.name];
      const pushLogs: string[] = [];
      for (const machineName of targets) {
        const w = worker; // using selected worker context; extend to map names to hosts if needed
        const pushResult = await UnregistryService.pushImagePussh({
          imageName,
          imageTag,
          sshUser: w.sshUser || 'root',
          sshHost: w.hostIp,
          sshKeyPath: w.sshKeyPath,
          sshPort: w.sshPort,
        });
        pushLogs.push(`pussh ${machineName}: ${pushResult.success ? 'ok' : pushResult.error}`);
        if (!pushResult.success) {
          throw new Error(`image push failed: ${pushResult.error}`);
        }
      }

      // Generate Docker Compose content
      const composeContent = await (PaaSApplicationService as any).generateDockerCompose({
        appName: app.name,
        imageName,
        imageTag,
        ports,
        envVars: envVarsForCompose,
        targetInstances,
        workerMachines: workerMachines.length > 0 ? workerMachines : undefined,
        tenantNetworkName,
        labels,
        tenantId: String(tenantId),
        cpuLimit,
        memoryLimitMb,
      });

      // Deploy via uncloud using the compose file
      const deployResult = await UncloudService.deployFromCompose({
        composeContent,
        context: worker.uncloudContext,
        autoConfirm: true,
      });

      return {
        success: deployResult.success,
        logs:
          pushLogs.join('\n') +
          '\n' +
          deployResult.output +
          (deployResult.error ? `\nErrors: ${deployResult.error}` : ''),
      };
    } catch (error: any) {
      return {
        success: false,
        logs: error.message || 'Deployment failed',
      };
    }
  }

  /**
   * Clone a Git repository
   */
  private static async cloneRepository(repoUrl: string, branch: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `paas-build-${uuidv4()}`);
    
    try {
      await fs.mkdir(tempDir, { recursive: true });
      await execAsync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${tempDir}`);
      return tempDir;
    } catch (error) {
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Generate a version string
   */
  private static generateVersion(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    return `v${timestamp}`;
  }

  /**
   * Get deployment by ID
   */
  static async getDeploymentById(deploymentId: string): Promise<PaaSDeployment | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_deployments WHERE id = $1',
        [deploymentId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToDeployment(result.rows[0]);
    } catch (error) {
      console.error('Error getting deployment:', error);
      return null;
    }
  }

  /**
   * Get deployments for an application
   */
  static async getDeploymentsByApplication(applicationId: string, limit: number = 50): Promise<PaaSDeployment[]> {
    try {
      const result = await query(
        'SELECT * FROM paas_deployments WHERE application_id = $1 ORDER BY created_at DESC LIMIT $2',
        [applicationId, limit]
      );
      
      return result.rows.map(row => this.mapRowToDeployment(row));
    } catch (error) {
      console.error('Error getting deployments:', error);
      return [];
    }
  }

  /**
   * Update deployment status
   */
  static async updateDeploymentStatus(
    deploymentId: string,
    status: 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'cancelled'
  ): Promise<boolean> {
    try {
      const result = await query(
        'UPDATE paas_deployments SET status = $1 WHERE id = $2',
        [status, deploymentId]
      );
      
      return result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error updating deployment status:', error);
      return false;
    }
  }

  /**
   * Cancel a deployment
   */
  static async cancelDeployment(deploymentId: string): Promise<boolean> {
    try {
      const result = await query(
        'UPDATE paas_deployments SET status = $1, completed_at = $2 WHERE id = $3 AND status IN ($4, $5)',
        ['cancelled', new Date(), deploymentId, 'queued', 'building']
      );
      
      return result.rowCount && result.rowCount > 0;
    } catch (error) {
      console.error('Error cancelling deployment:', error);
      return false;
    }
  }

  /**
   * Get deployment statistics for an application
   */
  static async getDeploymentStats(applicationId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageBuildTime: number;
    averageDeployTime: number;
  }> {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'success') as successful,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(build_duration) FILTER (WHERE build_duration IS NOT NULL) as avg_build_time,
          AVG(deploy_duration) FILTER (WHERE deploy_duration IS NOT NULL) as avg_deploy_time
        FROM paas_deployments
        WHERE application_id = $1`,
        [applicationId]
      );
      
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total || '0'),
        successful: parseInt(row.successful || '0'),
        failed: parseInt(row.failed || '0'),
        averageBuildTime: parseFloat(row.avg_build_time || '0'),
        averageDeployTime: parseFloat(row.avg_deploy_time || '0')
      };
    } catch (error) {
      console.error('Error getting deployment stats:', error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        averageBuildTime: 0,
        averageDeployTime: 0
      };
    }
  }

  /**
   * Map database row to PaaSDeployment interface
   */
  private static mapRowToDeployment(row: any): PaaSDeployment {
    return {
      id: row.id,
      applicationId: row.application_id,
      version: row.version,
      gitCommitSha: row.git_commit_sha,
      gitBranch: row.git_branch,
      triggerType: row.trigger_type,
      triggeredBy: row.triggered_by,
      status: row.status,
      buildLogs: row.build_logs,
      deployLogs: row.deploy_logs,
      errorMessage: row.error_message,
      imageName: row.image_name,
      imageTag: row.image_tag,
      buildDuration: row.build_duration,
      deployDuration: row.deploy_duration,
      configSnapshot: row.config_snapshot ? JSON.parse(row.config_snapshot) : undefined,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  }
}
