/**
 * PaaS Location Service
 * Manages datacenter locations for PaaS worker nodes
 * 
 * This service provides CRUD operations for managing datacenter locations.
 * Each location represents a physical or logical datacenter with region, country,
 * and unique datacenter code information. Worker nodes can be assigned to locations
 * for better infrastructure organization and management.
 */

import { query, transaction } from '../lib/database.js';

/**
 * PaaS Location interface representing a datacenter location
 * Links to: paas_locations table in database
 * Used by: paas_worker_nodes to associate workers with specific datacenters
 */
export interface PaaSLocation {
  id: string;
  name: string;
  datacenterCode: string;
  region: string;
  country: string;
  description?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  workerCount?: number; // Number of worker nodes assigned to this location
}

/**
 * Parameters for creating a new PaaS location
 * All required fields must be provided when creating a location
 */
export interface CreateLocationParams {
  name: string;
  datacenterCode: string;
  region: string;
  country: string;
  description?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  createdBy?: number;
}

/**
 * Parameters for updating an existing PaaS location
 * All fields are optional to allow partial updates
 */
export interface UpdateLocationParams {
  name?: string;
  datacenterCode?: string;
  region?: string;
  country?: string;
  description?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Statistics about PaaS locations
 * Provides aggregate counts of locations and their statuses
 */
export interface LocationStats {
  total: number;
  active: number;
  inactive: number;
  workersCount: number; // Total workers across all locations
}

export class PaaSLocationService {
  /**
   * Create a new PaaS location
   * 
   * Creates a datacenter location that can be assigned to worker nodes.
   * The datacenter_code must be unique across all locations.
   * 
   * @param params - Location creation parameters
   * @returns The created location or null if creation fails
   * 
   * Example:
   * ```typescript
   * const location = await PaaSLocationService.createLocation({
   *   name: 'New York Datacenter 1',
   *   datacenterCode: 'us-nyc-01',
   *   region: 'us-east',
   *   country: 'United States',
   *   description: 'Primary datacenter in New York',
   *   createdBy: 1
   * });
   * ```
   */
  static async createLocation(params: CreateLocationParams): Promise<PaaSLocation | null> {
    try {
      return await transaction(async (client) => {
        const now = new Date();
        
        const result = await client.query(
          `INSERT INTO paas_locations (
            name, datacenter_code, region, country, description,
            metadata, is_active, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            params.name,
            params.datacenterCode,
            params.region,
            params.country,
            params.description || null,
            params.metadata ? JSON.stringify(params.metadata) : '{}',
            params.isActive !== undefined ? params.isActive : true,
            params.createdBy || null,
            now,
            now,
          ]
        );
        
        const location = result.rows[0];
        console.log(`✅ Created PaaS location: ${params.name} (${params.datacenterCode})`);
        
        return this.mapRowToLocation(location);
      });
    } catch (error: any) {
      console.error('Error creating PaaS location:', error);
      
      // Check for unique constraint violation on datacenter_code
      if (error.code === '23505' && error.constraint === 'paas_locations_datacenter_code_key') {
        throw new Error(`A location with datacenter code '${params.datacenterCode}' already exists`);
      }
      
      return null;
    }
  }

  /**
   * Get all PaaS locations
   * 
   * Retrieves all locations, optionally filtered by active status.
   * Results are ordered by creation date (newest first).
   * 
   * @param activeOnly - If true, only return active locations
   * @returns Array of locations
   * 
   * Example:
   * ```typescript
   * // Get all locations
   * const allLocations = await PaaSLocationService.getAllLocations();
   * 
   * // Get only active locations
   * const activeLocations = await PaaSLocationService.getAllLocations(true);
   * ```
   */
  static async getAllLocations(activeOnly: boolean = false): Promise<PaaSLocation[]> {
    try {
      let sql = `
        SELECT l.*, COUNT(w.id) AS worker_count
        FROM paas_locations l
        LEFT JOIN paas_worker_nodes w ON w.location_id = l.id
      `;
      const params: any[] = [];

      if (activeOnly) {
        sql += ' WHERE l.is_active = $1';
        params.push(true);
      }

      sql += ' GROUP BY l.id ORDER BY l.created_at DESC';

      const result = await query(sql, params);
      return result.rows.map(row => this.mapRowToLocation(row));
    } catch (error) {
      console.error('Error getting PaaS locations:', error);
      return [];
    }
  }

  /**
   * Get a specific location by ID
   * 
   * @param locationId - The location ID to retrieve
   * @returns The location or null if not found
   * 
   * Example:
   * ```typescript
   * const location = await PaaSLocationService.getLocationById('1');
   * if (location) {
   *   console.log(`Found location: ${location.name}`);
   * }
   * ```
   */
  static async getLocationById(locationId: string): Promise<PaaSLocation | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_locations WHERE id = $1',
        [locationId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('Error getting location by ID:', error);
      return null;
    }
  }

  /**
   * Get a location by its datacenter code
   * 
   * Datacenter codes are unique identifiers for locations.
   * 
   * @param datacenterCode - The datacenter code to search for
   * @returns The location or null if not found
   * 
   * Example:
   * ```typescript
   * const location = await PaaSLocationService.getLocationByDatacenterCode('us-nyc-01');
   * ```
   */
  static async getLocationByDatacenterCode(datacenterCode: string): Promise<PaaSLocation | null> {
    try {
      const result = await query(
        'SELECT * FROM paas_locations WHERE datacenter_code = $1',
        [datacenterCode]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToLocation(result.rows[0]);
    } catch (error) {
      console.error('Error getting location by datacenter code:', error);
      return null;
    }
  }

  /**
   * Update a PaaS location
   * 
   * Updates location information. Only provided fields are updated.
   * The datacenter_code must remain unique if changed.
   * 
   * @param locationId - The location ID to update
   * @param updates - Fields to update
   * @returns The updated location or null if update fails
   * 
   * Example:
   * ```typescript
   * const updated = await PaaSLocationService.updateLocation('1', {
   *   description: 'Updated description',
   *   isActive: false
   * });
   * ```
   */
  static async updateLocation(
    locationId: string,
    updates: UpdateLocationParams
  ): Promise<PaaSLocation | null> {
    try {
      const setStatements: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (updates.name !== undefined) {
        setStatements.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }
      
      if (updates.datacenterCode !== undefined) {
        setStatements.push(`datacenter_code = $${paramIndex++}`);
        params.push(updates.datacenterCode);
      }
      
      if (updates.region !== undefined) {
        setStatements.push(`region = $${paramIndex++}`);
        params.push(updates.region);
      }
      
      if (updates.country !== undefined) {
        setStatements.push(`country = $${paramIndex++}`);
        params.push(updates.country);
      }
      
      if (updates.description !== undefined) {
        setStatements.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }
      
      if (updates.metadata !== undefined) {
        setStatements.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(updates.metadata));
      }
      
      if (updates.isActive !== undefined) {
        setStatements.push(`is_active = $${paramIndex++}`);
        params.push(updates.isActive);
      }
      
      // Always update the updated_at timestamp
      setStatements.push(`updated_at = $${paramIndex++}`);
      params.push(new Date());
      
      params.push(locationId);
      
      const result = await query(
        `UPDATE paas_locations SET ${setStatements.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      console.log(`✅ Updated PaaS location: ${locationId}`);
      return this.mapRowToLocation(result.rows[0]);
    } catch (error: any) {
      console.error('Error updating PaaS location:', error);
      
      // Check for unique constraint violation on datacenter_code
      if (error.code === '23505' && error.constraint === 'paas_locations_datacenter_code_key') {
        throw new Error(`A location with datacenter code '${updates.datacenterCode}' already exists`);
      }
      
      return null;
    }
  }

  /**
   * Delete a PaaS location
   * 
   * Deletes a location from the database. If workers are assigned to this location,
   * their location_id will be set to NULL (due to ON DELETE SET NULL constraint).
   * 
   * @param locationId - The location ID to delete
   * @returns True if deleted successfully, false otherwise
   * 
   * Example:
   * ```typescript
   * const deleted = await PaaSLocationService.deleteLocation('1');
   * if (deleted) {
   *   console.log('Location deleted successfully');
   * }
   * ```
   */
  static async deleteLocation(locationId: string): Promise<boolean> {
    try {
      const location = await this.getLocationById(locationId);
      if (!location) {
        return false;
      }
      
      // Check how many workers are assigned to this location
      const workersResult = await query(
        'SELECT COUNT(*) as count FROM paas_worker_nodes WHERE location_id = $1',
        [locationId]
      );
      const workerCount = parseInt(workersResult.rows[0].count);
      
      if (workerCount > 0) {
        console.warn(`⚠️  Deleting location ${location.name} which has ${workerCount} worker(s) assigned`);
      }
      
      const result = await query(
        'DELETE FROM paas_locations WHERE id = $1',
        [locationId]
      );
      
      console.log(`✅ Deleted PaaS location: ${location.name} (${location.datacenterCode})`);
      
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting PaaS location:', error);
      return false;
    }
  }

  /**
   * Get statistics about PaaS locations
   * 
   * Returns aggregate counts of locations and associated workers.
   * 
   * @returns Location statistics
   * 
   * Example:
   * ```typescript
   * const stats = await PaaSLocationService.getLocationStats();
   * console.log(`Total locations: ${stats.total}`);
   * console.log(`Active locations: ${stats.active}`);
   * ```
   */
  static async getLocationStats(): Promise<LocationStats> {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE is_active = false) as inactive,
          (SELECT COUNT(*) FROM paas_worker_nodes WHERE location_id IS NOT NULL) as workers_count
        FROM paas_locations
      `);
      
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total || '0'),
        active: parseInt(row.active || '0'),
        inactive: parseInt(row.inactive || '0'),
        workersCount: parseInt(row.workers_count || '0'),
      };
    } catch (error) {
      console.error('Error getting location stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        workersCount: 0,
      };
    }
  }

  /**
   * Get all workers assigned to a specific location
   * 
   * @param locationId - The location ID
   * @returns Count of workers at this location
   * 
   * Example:
   * ```typescript
   * const count = await PaaSLocationService.getWorkerCountForLocation('1');
   * console.log(`${count} workers at this location`);
   * ```
   */
  static async getWorkerCountForLocation(locationId: string): Promise<number> {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM paas_worker_nodes WHERE location_id = $1',
        [locationId]
      );
      
      return parseInt(result.rows[0].count || '0');
    } catch (error) {
      console.error('Error getting worker count for location:', error);
      return 0;
    }
  }

  /**
   * Map database row to PaaSLocation interface
   * 
   * Converts snake_case database columns to camelCase TypeScript properties.
   * 
   * @param row - Database row from paas_locations table
   * @returns PaaSLocation object
   */
  private static mapRowToLocation(row: any): PaaSLocation {
    return {
      id: row.id.toString(),
      name: row.name,
      datacenterCode: row.datacenter_code,
      region: row.region,
      country: row.country,
      description: row.description,
      metadata: row.metadata || {},
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      workerCount:
        row.worker_count !== undefined && row.worker_count !== null
          ? parseInt(row.worker_count, 10)
          : undefined,
    };
  }
}
