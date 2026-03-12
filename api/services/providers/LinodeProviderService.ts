/**
 * Linode Provider Service Implementation
 * Wraps the existing linodeService with the IProviderService interface
 */

import { BaseProviderService } from './BaseProviderService.js';
import {
  ProviderInstance,
  ProviderPlan,
  ProviderImage,
  ProviderRegion,
  CreateInstanceParams,
} from './IProviderService.js';
import { linodeService } from '../linodeService.js';
import { normalizeLinodeError } from './errorNormalizer.js';
import { ProviderResourceCache } from '../providerResourceCache.js';
import type { LinodeInstance, LinodeType, LinodeImage, LinodeRegion } from '../linodeService.js';

export class LinodeProviderService extends BaseProviderService {
  private providerId: string;

  constructor(apiToken: string, providerId?: string) {
    super(apiToken, 'linode');
    this.providerId = providerId || 'linode-default';
  }

  /**
   * Override error handling to use Linode-specific normalization
   */
  protected handleApiError(error: any, context: string): never {
    console.error(`[linode] ${context}:`, error);
    const normalizedError = normalizeLinodeError(error, 'linode');
    throw normalizedError;
  }

  /**
   * Create a new Linode instance
   */
  async createInstance(params: CreateInstanceParams): Promise<ProviderInstance> {
    this.validateToken();

    try {
      const createRequest = {
        type: params.type,
        region: params.region,
        image: params.image,
        label: params.label,
        root_pass: params.rootPassword,
        authorized_keys: params.sshKeys,
        backups_enabled: params.backups,
        private_ip: params.privateIP,
        tags: params.tags,
        stackscript_id: params.stackscriptId,
        stackscript_data: params.stackscriptData,
      };

      const instance = await linodeService.createLinodeInstance(createRequest);
      return this.normalizeInstance(instance);
    } catch (error) {
      this.handleApiError(error, 'createInstance');
    }
  }

  /**
   * Get a specific Linode instance
   */
  async getInstance(instanceId: string): Promise<ProviderInstance> {
    this.validateToken();

    try {
      const instance = await linodeService.getLinodeInstance(Number(instanceId));
      return this.normalizeInstance(instance);
    } catch (error) {
      this.handleApiError(error, 'getInstance');
    }
  }

  /**
   * List all Linode instances
   */
  async listInstances(): Promise<ProviderInstance[]> {
    this.validateToken();

    try {
      const instances = await linodeService.getLinodeInstances();
      return instances.map(instance => this.normalizeInstance(instance));
    } catch (error) {
      this.handleApiError(error, 'listInstances');
    }
  }

  /**
   * Perform an action on a Linode instance
   */
  async performAction(instanceId: string, action: string, _params?: Record<string, any>): Promise<void> {
    this.validateToken();

    try {
      const id = Number(instanceId);

      switch (action) {
        case 'boot':
        case 'power_on':
          await linodeService.bootLinodeInstance(id);
          break;
        
        case 'shutdown':
        case 'power_off':
          await linodeService.shutdownLinodeInstance(id);
          break;
        
        case 'reboot':
          await linodeService.rebootLinodeInstance(id);
          break;
        
        case 'delete':
          await linodeService.deleteLinodeInstance(id);
          break;
        
        default:
          throw this.createError('INVALID_ACTION', `Unknown action: ${action}`);
      }
    } catch (error) {
      this.handleApiError(error, `performAction:${action}`);
    }
  }

  /**
   * Get available Linode plans
   */
  async getPlans(): Promise<ProviderPlan[]> {
    this.validateToken();

    // Check cache first
    const cached = ProviderResourceCache.getCachedPlans(this.providerId);
    if (cached) {
      return cached;
    }

    try {
      const types = await linodeService.getLinodeTypes();
      const plans = types.map(type => this.normalizePlan(type));
      
      // Cache the results
      ProviderResourceCache.setCachedPlans(this.providerId, plans);
      
      return plans;
    } catch (error) {
      this.handleApiError(error, 'getPlans');
    }
  }

  /**
   * Get available Linode images
   */
  async getImages(): Promise<ProviderImage[]> {
    this.validateToken();

    // Check cache first
    const cached = ProviderResourceCache.getCachedImages(this.providerId);
    if (cached) {
      return cached;
    }

    try {
      const images = await linodeService.getLinodeImages();
      const normalizedImages = images.map(image => this.normalizeImage(image));
      
      // Cache the results
      ProviderResourceCache.setCachedImages(this.providerId, normalizedImages);
      
      return normalizedImages;
    } catch (error) {
      this.handleApiError(error, 'getImages');
    }
  }

  /**
   * Get available Linode regions
   */
  async getRegions(): Promise<ProviderRegion[]> {
    this.validateToken();

    // Check cache first
    const cached = ProviderResourceCache.getCachedRegions(this.providerId);
    if (cached) {
      return cached;
    }

    try {
      const regions = await linodeService.getLinodeRegions();
      const normalizedRegions = regions.map(region => this.normalizeRegion(region));
      
      // Cache the results
      ProviderResourceCache.setCachedRegions(this.providerId, normalizedRegions);
      
      return normalizedRegions;
    } catch (error) {
      this.handleApiError(error, 'getRegions');
    }
  }

  /**
   * Validate Linode API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      this.validateToken();
      await linodeService.getLinodeProfile();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize Linode instance to common format
   */
  private normalizeInstance(instance: LinodeInstance): ProviderInstance {
    return {
      id: String(instance.id),
      label: instance.label,
      status: this.normalizeStatus(instance.status),
      ipv4: instance.ipv4 || [],
      ipv6: instance.ipv6,
      region: instance.region,
      specs: {
        vcpus: instance.specs.vcpus,
        memory: instance.specs.memory,
        disk: instance.specs.disk,
        transfer: instance.specs.transfer,
      },
      created: instance.created,
      image: instance.image,
      tags: instance.tags,
    };
  }

  /**
   * Normalize Linode plan to common format
   */
  private normalizePlan(type: LinodeType): ProviderPlan {
    return {
      id: type.id,
      label: type.label,
      vcpus: type.vcpus,
      memory: type.memory,
      disk: type.disk,
      transfer: type.transfer,
      price: {
        hourly: type.price.hourly,
        monthly: type.price.monthly,
      },
      regions: [], // Linode types are available in all regions
      network_out: type.network_out || 0,
      type_class: type.type_class,
    };
  }

  /**
   * Normalize Linode image to common format
   */
  private normalizeImage(image: LinodeImage): ProviderImage {
    return {
      id: image.id,
      slug: image.id,
      label: image.label,
      description: image.description,
      distribution: image.vendor,
      public: image.is_public,
      minDiskSize: image.size,
    };
  }

  /**
   * Normalize Linode region to common format
   */
  private normalizeRegion(region: LinodeRegion): ProviderRegion {
    return {
      id: region.id,
      label: region.label,
      country: region.country,
      available: region.status === 'ok',
      capabilities: region.capabilities,
    };
  }

  /**
   * Normalize Linode status to common format
   */
  private normalizeStatus(status: string): 'running' | 'stopped' | 'provisioning' | 'rebooting' | 'error' | 'unknown' {
    const statusMap: Record<string, 'running' | 'stopped' | 'provisioning' | 'rebooting' | 'error' | 'unknown'> = {
      'running': 'running',
      'offline': 'stopped',
      'booting': 'provisioning',
      'rebooting': 'rebooting',
      'shutting_down': 'stopped',
      'provisioning': 'provisioning',
      'deleting': 'error',
      'migrating': 'provisioning',
      'rebuilding': 'provisioning',
      'cloning': 'provisioning',
      'restoring': 'provisioning',
    };

    return statusMap[status.toLowerCase()] || 'unknown';
  }
}
