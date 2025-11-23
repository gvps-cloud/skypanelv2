/**
 * PaaS Marketplace Service
 * Manages application templates for one-click deployments
 */

import { query } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { PaaSApplicationService } from './paasApplicationService.js';
import { PaaSDeploymentService } from './paasDeploymentService.js';

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language?: string;
  framework?: string;
  logoUrl?: string;
  repositoryUrl: string;
  repositoryBranch: string;
  deploymentStrategy: 'buildpack' | 'dockerfile' | 'image';
  buildpackBuilder?: string;
  customBuildpacks?: string[];
  dockerfilePath?: string;
  imageUrl?: string;
  appPort: number;
  minCpuCores?: number;
  minMemoryMb?: number;
  environmentVariables?: Record<string, string>;
  requiredAddons?: string[];
  isActive: boolean;
  deployCount: number;
  createdBy?: string;
  createdAt: Date;
}

export interface CreateTemplateParams {
  name: string;
  description: string;
  category: string;
  language?: string;
  framework?: string;
  logoUrl?: string;
  repositoryUrl: string;
  repositoryBranch?: string;
  deploymentStrategy: 'buildpack' | 'dockerfile' | 'image';
  buildpackBuilder?: string;
  customBuildpacks?: string[];
  dockerfilePath?: string;
  imageUrl?: string;
  appPort: number;
  minCpuCores?: number;
  minMemoryMb?: number;
  environmentVariables?: Record<string, string>;
  requiredAddons?: string[];
  createdBy?: string;
}

export interface DeployFromTemplateParams {
  templateId: string;
  userId: string;
  applicationName: string;
  workerNodeId: string;
  environmentVariables?: Record<string, string>;
}

export class PaaSMarketplaceService {
  /**
   * Create a new marketplace template
   */
  static async createTemplate(params: CreateTemplateParams): Promise<MarketplaceTemplate | null> {
    try {
      const templateId = uuidv4();
      const now = new Date();
      
      const result = await query(
        `INSERT INTO paas_marketplace_templates (
          id, name, description, category, language, framework, logo_url,
          repository_url, repository_branch, deployment_strategy,
          buildpack_builder, custom_buildpacks, dockerfile_path, image_url,
          app_port, min_cpu_cores, min_memory_mb, environment_variables,
          required_addons, is_active, deploy_count, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *`,
        [
          templateId,
          params.name,
          params.description,
          params.category,
          params.language,
          params.framework,
          params.logoUrl,
          params.repositoryUrl,
          params.repositoryBranch || 'main',
          params.deploymentStrategy,
          params.buildpackBuilder,
          params.customBuildpacks,
          params.dockerfilePath,
          params.imageUrl,
          params.appPort,
          params.minCpuCores,
          params.minMemoryMb,
          params.environmentVariables ? JSON.stringify(params.environmentVariables) : null,
          params.requiredAddons,
          true, // is_active
          0, // deploy_count
          params.createdBy,
          now
        ]
      );
      
      console.log(`✅ Created marketplace template: ${params.name}`);
      
      return this.mapRowToTemplate(result.rows[0]);
    } catch (error) {
      console.error('Error creating template:', error);
      return null;
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(templateId: string): Promise<MarketplaceTemplate | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_marketplace_templates WHERE id = $1',
        [templateId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToTemplate(result.rows[0]);
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  /**
   * List all active templates
   */
  static async listTemplates(category?: string): Promise<MarketplaceTemplate[]> {
    try {
      let queryText = 'SELECT * FROM paas_marketplace_templates WHERE is_active = true';
      const params: any[] = [];
      
      if (category) {
        queryText += ' AND category = $1';
        params.push(category);
      }
      
      queryText += ' ORDER BY deploy_count DESC, created_at DESC';
      
      const result = await query(queryText, params);
      
      return result.rows.map(row => this.mapRowToTemplate(row));
    } catch (error) {
      console.error('Error listing templates:', error);
      return [];
    }
  }

  /**
   * Get template categories
   */
  static async getCategories(): Promise<string[]> {
    try {
      const result = await query(
        'SELECT DISTINCT category FROM paas_marketplace_templates WHERE is_active = true ORDER BY category'
      );
      
      return result.rows.map(row => row.category);
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  /**
   * Deploy an application from a template
   */
  static async deployFromTemplate(params: DeployFromTemplateParams): Promise<{
    success: boolean;
    applicationId?: string;
    deploymentId?: string;
    error?: string;
  }> {
    try {
      const template = await this.getTemplateById(params.templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }
      
      // Merge environment variables (template defaults + user overrides)
      const envVars = {
        ...(template.environmentVariables || {}),
        ...(params.environmentVariables || {})
      };
      
      // Create application from template
      const app = await PaaSApplicationService.createApplication({
        userId: params.userId,
        name: params.applicationName,
        repositoryUrl: template.repositoryUrl,
        repositoryBranch: template.repositoryBranch,
        deploymentStrategy: template.deploymentStrategy,
        buildpackBuilder: template.buildpackBuilder,
        customBuildpacks: template.customBuildpacks,
        dockerfilePath: template.dockerfilePath,
        imageUrl: template.imageUrl,
        appPort: template.appPort,
        targetWorkerNodeId: params.workerNodeId,
        cpuLimit: template.minCpuCores,
        memoryLimitMb: template.minMemoryMb
      });
      
      if (!app) {
        return { success: false, error: 'Failed to create application' };
      }
      
      // Set environment variables
      for (const [key, value] of Object.entries(envVars)) {
        await query(
          `INSERT INTO paas_app_env_vars (application_id, key, value_encrypted, is_secret, created_at, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [app.id, key, value, false, new Date(), params.userId]
        );
      }
      
      // Create initial deployment
      const deployment = await PaaSDeploymentService.createDeployment({
        applicationId: app.id,
        triggerType: 'manual',
        triggeredBy: params.userId,
        gitBranch: template.repositoryBranch
      });
      
      if (!deployment) {
        return { success: false, error: 'Failed to create deployment', applicationId: app.id };
      }
      
      // Increment deploy count
      await query(
        'UPDATE paas_marketplace_templates SET deploy_count = deploy_count + 1 WHERE id = $1',
        [params.templateId]
      );
      
      // Execute the deployment asynchronously
      PaaSDeploymentService.executeDeployment(deployment.id).catch(err => {
        console.error(`Error executing template deployment:`, err);
      });
      
      console.log(`✅ Deployed application from template: ${template.name} -> ${params.applicationName}`);
      
      return {
        success: true,
        applicationId: app.id,
        deploymentId: deployment.id
      };
    } catch (error: any) {
      console.error('Error deploying from template:', error);
      return { success: false, error: error.message || 'Deployment failed' };
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(
    templateId: string,
    updates: Partial<CreateTemplateParams>
  ): Promise<boolean> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;
      
      const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        category: 'category',
        language: 'language',
        framework: 'framework',
        logoUrl: 'logo_url',
        repositoryUrl: 'repository_url',
        repositoryBranch: 'repository_branch',
        deploymentStrategy: 'deployment_strategy',
        buildpackBuilder: 'buildpack_builder',
        customBuildpacks: 'custom_buildpacks',
        dockerfilePath: 'dockerfile_path',
        imageUrl: 'image_url',
        appPort: 'app_port',
        minCpuCores: 'min_cpu_cores',
        minMemoryMb: 'min_memory_mb'
      };
      
      for (const [key, dbColumn] of Object.entries(fieldMap)) {
        if (updates[key as keyof CreateTemplateParams] !== undefined) {
          setParts.push(`${dbColumn} = $${valueIndex}`);
          values.push(updates[key as keyof CreateTemplateParams]);
          valueIndex++;
        }
      }
      
      if (updates.environmentVariables !== undefined) {
        setParts.push(`environment_variables = $${valueIndex}`);
        values.push(JSON.stringify(updates.environmentVariables));
        valueIndex++;
      }
      
      if (updates.requiredAddons !== undefined) {
        setParts.push(`required_addons = $${valueIndex}`);
        values.push(updates.requiredAddons);
        valueIndex++;
      }
      
      if (setParts.length === 0) {
        return true;
      }
      
      values.push(templateId);
      
      const result = await query(
        `UPDATE paas_marketplace_templates SET ${setParts.join(', ')} WHERE id = $${valueIndex}`,
        values
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating template:', error);
      return false;
    }
  }

  /**
   * Activate/deactivate template
   */
  static async setTemplateActive(templateId: string, isActive: boolean): Promise<boolean> {
    try {
      const result = await query(
        'UPDATE paas_marketplace_templates SET is_active = $1 WHERE id = $2',
        [isActive, templateId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error updating template status:', error);
      return false;
    }
  }

  /**
   * Map database row to MarketplaceTemplate interface
   */
  private static mapRowToTemplate(row: any): MarketplaceTemplate {
    let environmentVariables: Record<string, string> | undefined;

    if (row.environment_variables != null) {
      if (typeof row.environment_variables === 'string') {
        try {
          environmentVariables = JSON.parse(row.environment_variables);
        } catch (error) {
          console.error(
            'Failed to parse environment_variables for marketplace template',
            row.id,
            error
          );
          environmentVariables = undefined;
        }
      } else {
        // Already a parsed JSON object (e.g. when pg JSON/JSONB is auto-parsed)
        environmentVariables = row.environment_variables;
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      language: row.language,
      framework: row.framework,
      logoUrl: row.logo_url,
      repositoryUrl: row.repository_url,
      repositoryBranch: row.repository_branch,
      deploymentStrategy: row.deployment_strategy,
      buildpackBuilder: row.buildpack_builder,
      customBuildpacks: row.custom_buildpacks,
      dockerfilePath: row.dockerfile_path,
      imageUrl: row.image_url,
      appPort: row.app_port,
      minCpuCores: row.min_cpu_cores,
      minMemoryMb: row.min_memory_mb,
      environmentVariables,
      requiredAddons: row.required_addons,
      isActive: row.is_active,
      deployCount: row.deploy_count,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Delete a marketplace template
   */
  static async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const result = await query(
        'DELETE FROM paas_marketplace_templates WHERE id = $1',
        [templateId]
      );
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }
}
