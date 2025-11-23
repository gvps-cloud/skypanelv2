/**
 * PaaS Addon Service
 * Manages application addons (databases, caching, storage, etc.)
 */

import { query, transaction } from '../lib/database.js';
import { v4 as uuidv4 } from 'uuid';
import { UncloudService } from './uncloudService.js';

export interface PaaSAddon {
  id: string;
  applicationId: string;
  addonType: 'postgres' | 'mysql' | 'redis' | 'mongodb' | 'elasticsearch' | 'rabbitmq' | 's3';
  name: string;
  status: 'provisioning' | 'available' | 'error' | 'deleting';
  connectionString?: string;
  config?: any;
  pricingPlanId?: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface CreateAddonParams {
  applicationId: string;
  addonType: 'postgres' | 'mysql' | 'redis' | 'mongodb' | 'elasticsearch' | 'rabbitmq' | 's3';
  name: string;
  pricingPlanId?: string;
  config?: any;
}

export class PaaSAddonService {
  /**
   * Create a new addon
   */
  static async createAddon(params: CreateAddonParams): Promise<PaaSAddon | null> {
    try {
      const addonId = uuidv4();
      const now = new Date();
      
      const result = await query(
        `INSERT INTO paas_addons (
          id, application_id, addon_type, name, status, config, pricing_plan_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          addonId,
          params.applicationId,
          params.addonType,
          params.name,
          'provisioning',
          params.config ? JSON.stringify(params.config) : null,
          params.pricingPlanId,
          now
        ]
      );
      
      console.log(`✅ Created addon: ${params.name} (${params.addonType})`);
      
      // Provision addon asynchronously
      this.provisionAddon(result.rows[0]).catch(err => {
        console.error(`Error provisioning addon ${params.name}:`, err);
      });
      
      return this.mapRowToAddon(result.rows[0]);
    } catch (error) {
      console.error('Error creating addon:', error);
      return null;
    }
  }

  /**
   * Provision an addon (deploy the actual service)
   */
  private static async provisionAddon(addonRow: any): Promise<void> {
    try {
      const addon = this.mapRowToAddon(addonRow);
      
      // Get application to determine worker node
      const appResult = await query(
        'SELECT target_worker_node_id FROM paas_applications WHERE id = $1',
        [addon.applicationId]
      );
      
      if (appResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      const workerNodeId = appResult.rows[0].target_worker_node_id;
      if (!workerNodeId) {
        throw new Error('No worker node assigned to application');
      }
      
      // Get worker context
      const workerResult = await query(
        'SELECT uncloud_context FROM paas_worker_nodes WHERE id = $1',
        [workerNodeId]
      );
      
      if (workerResult.rows.length === 0) {
        throw new Error('Worker node not found');
      }
      
      const uncloudContext = workerResult.rows[0].uncloud_context;
      
      // Generate connection string and config based on addon type
      let connectionString = '';
      let config: any = {};
      
      switch (addon.addonType) {
        case 'postgres':
          connectionString = await this.provisionPostgres(addon, uncloudContext);
          config = this.parsePostgresConfig(connectionString);
          break;
        
        case 'redis':
          connectionString = await this.provisionRedis(addon, uncloudContext);
          config = this.parseRedisConfig(connectionString);
          break;
        
        case 'mysql':
          connectionString = await this.provisionMySQL(addon, uncloudContext);
          config = this.parseMySQLConfig(connectionString);
          break;
        
        case 'mongodb':
          connectionString = await this.provisionMongoDB(addon, uncloudContext);
          config = this.parseMongoDBConfig(connectionString);
          break;
        
        default:
          throw new Error(`Unsupported addon type: ${addon.addonType}`);
      }
      
      // Update addon with connection info
      await query(
        'UPDATE paas_addons SET status = $1, connection_string = $2, config = $3 WHERE id = $4',
        ['available', connectionString, JSON.stringify(config), addon.id]
      );
      
      console.log(`✅ Provisioned addon: ${addon.name}`);
    } catch (error) {
      console.error('Error provisioning addon:', error);
      
      // Update status to error
      await query(
        'UPDATE paas_addons SET status = $1 WHERE id = $2',
        ['error', addonRow.id]
      );
    }
  }

  /**
   * Provision PostgreSQL addon
   */
  private static async provisionPostgres(addon: PaaSAddon, context: string): Promise<string> {
    const dbName = addon.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const username = `user_${dbName}`;
    const password = this.generatePassword();
    const serviceName = `${addon.name}-postgres`;
    
    // Generate compose file for PostgreSQL
    const composeContent = `
version: '3.8'
services:
  ${serviceName}:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: "${dbName}"
      POSTGRES_USER: "${username}"
      POSTGRES_PASSWORD: "${password}"
    volumes:
      - ${serviceName}-data:/var/lib/postgresql/data
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  ${serviceName}-data:
`.trim();
    
    // Deploy PostgreSQL container using uncloud
    const deployResult = await UncloudService.deployFromCompose({
      composeContent,
      context,
      autoConfirm: true
    });
    
    if (!deployResult.success) {
      throw new Error(`Failed to deploy PostgreSQL: ${deployResult.error}`);
    }
    
    // Return connection string
    return `postgresql://${username}:${password}@${serviceName}:5432/${dbName}`;
  }

  /**
   * Provision Redis addon
   */
  private static async provisionRedis(addon: PaaSAddon, context: string): Promise<string> {
    const password = this.generatePassword();
    const serviceName = `${addon.name}-redis`;
    
    // Generate compose file for Redis
    const composeContent = `
version: '3.8'
services:
  ${serviceName}:
    image: redis:7-alpine
    command: redis-server --requirepass ${password}
    volumes:
      - ${serviceName}-data:/data
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  ${serviceName}-data:
`.trim();
    
    // Deploy Redis container
    const deployResult = await UncloudService.deployFromCompose({
      composeContent,
      context,
      autoConfirm: true
    });
    
    if (!deployResult.success) {
      throw new Error(`Failed to deploy Redis: ${deployResult.error}`);
    }
    
    return `redis://:${password}@${serviceName}:6379`;
  }

  /**
   * Provision MySQL addon
   */
  private static async provisionMySQL(addon: PaaSAddon, context: string): Promise<string> {
    const dbName = addon.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const username = `user_${dbName}`;
    const password = this.generatePassword();
    const rootPassword = this.generatePassword();
    const serviceName = `${addon.name}-mysql`;
    
    // Generate compose file for MySQL
    const composeContent = `
version: '3.8'
services:
  ${serviceName}:
    image: mysql:8
    environment:
      MYSQL_DATABASE: "${dbName}"
      MYSQL_USER: "${username}"
      MYSQL_PASSWORD: "${password}"
      MYSQL_ROOT_PASSWORD: "${rootPassword}"
    volumes:
      - ${serviceName}-data:/var/lib/mysql
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  ${serviceName}-data:
`.trim();
    
    // Deploy MySQL container
    const deployResult = await UncloudService.deployFromCompose({
      composeContent,
      context,
      autoConfirm: true
    });
    
    if (!deployResult.success) {
      throw new Error(`Failed to deploy MySQL: ${deployResult.error}`);
    }
    
    return `mysql://${username}:${password}@${serviceName}:3306/${dbName}`;
  }

  /**
   * Provision MongoDB addon
   */
  private static async provisionMongoDB(addon: PaaSAddon, context: string): Promise<string> {
    const dbName = addon.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const username = `user_${dbName}`;
    const password = this.generatePassword();
    const serviceName = `${addon.name}-mongodb`;
    
    // Generate compose file for MongoDB
    const composeContent = `
version: '3.8'
services:
  ${serviceName}:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: "${username}"
      MONGO_INITDB_ROOT_PASSWORD: "${password}"
      MONGO_INITDB_DATABASE: "${dbName}"
    volumes:
      - ${serviceName}-data:/data/db
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  ${serviceName}-data:
`.trim();
    
    // Deploy MongoDB container
    const deployResult = await UncloudService.deployFromCompose({
      composeContent,
      context,
      autoConfirm: true
    });
    
    if (!deployResult.success) {
      throw new Error(`Failed to deploy MongoDB: ${deployResult.error}`);
    }
    
    return `mongodb://${username}:${password}@${serviceName}:27017/${dbName}`;
  }

  /**
   * Get addon by ID
   */
  static async getAddonById(addonId: string): Promise<PaaSAddon | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_addons WHERE id = $1',
        [addonId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToAddon(result.rows[0]);
    } catch (error) {
      console.error('Error getting addon:', error);
      return null;
    }
  }

  /**
   * Get addons for an application
   */
  static async getAddonsByApplication(applicationId: string): Promise<PaaSAddon[]> {
    try {
      const result = await query(
        'SELECT * FROM paas_addons WHERE application_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
        [applicationId]
      );
      
      return result.rows.map(row => this.mapRowToAddon(row));
    } catch (error) {
      console.error('Error getting addons:', error);
      return [];
    }
  }

  /**
   * Delete an addon
   */
  static async deleteAddon(addonId: string): Promise<boolean> {
    try {
      const addon = await this.getAddonById(addonId);
      if (!addon) {
        return false;
      }
      
      // Soft delete
      await query(
        'UPDATE paas_addons SET status = $1, deleted_at = $2 WHERE id = $3',
        ['deleting', new Date(), addonId]
      );
      
      // TODO: Actually remove the deployed service via uncloud
      
      console.log(`🗑️ Deleted addon: ${addon.name}`);
      return true;
    } catch (error) {
      console.error('Error deleting addon:', error);
      return false;
    }
  }

  /**
   * Generate a secure random password
   */
  private static generatePassword(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Parse connection string configurations
   */
  private static parsePostgresConfig(connectionString: string): any {
    const match = connectionString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) return {};
    
    return {
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
      username: match[1],
      password: match[2]
    };
  }

  private static parseRedisConfig(connectionString: string): any {
    const match = connectionString.match(/redis:\/\/:([^@]+)@([^:]+):(\d+)/);
    if (!match) return {};
    
    return {
      host: match[2],
      port: parseInt(match[3]),
      password: match[1]
    };
  }

  private static parseMySQLConfig(connectionString: string): any {
    const match = connectionString.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) return {};
    
    return {
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
      username: match[1],
      password: match[2]
    };
  }

  private static parseMongoDBConfig(connectionString: string): any {
    const match = connectionString.match(/mongodb:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) return {};
    
    return {
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
      username: match[1],
      password: match[2]
    };
  }

  /**
   * Map database row to PaaSAddon interface
   */
  private static mapRowToAddon(row: any): PaaSAddon {
    return {
      id: row.id,
      applicationId: row.application_id,
      addonType: row.addon_type,
      name: row.name,
      status: row.status,
      connectionString: row.connection_string,
      config: row.config ? JSON.parse(row.config) : undefined,
      pricingPlanId: row.pricing_plan_id,
      createdAt: new Date(row.created_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }
}
