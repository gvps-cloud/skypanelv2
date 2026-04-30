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
  ProviderIPAddress,
  ProviderIPv6Range,
  ProviderIPv6Pool,
  ProviderVLAN,
  ProviderAllocateIPRequest,
  ProviderAssignIPsRequest,
  ProviderShareIPsRequest,
  ProviderCreateIPv6RangeRequest,
  ProviderFirewall,
  FirewallRules,
  FirewallDevice,
  FirewallSettings,
  FirewallTemplate,
  FirewallStatus,
  CreateFirewallParams,
  ProviderDisk,
  CreateDiskParams,
  UpdateDiskParams,
  ProviderVolume,
  CreateVolumeParams,
  ProviderVolumeType,
} from './IProviderService.js';
import { linodeService } from '../linodeService.js';
import { normalizeLinodeError } from './errorNormalizer.js';
import { ProviderResourceCache } from '../providerResourceCache.js';
import type { LinodeInstance, LinodeType, LinodeImage, LinodeRegion, LinodeVolume, LinodeVolumeType } from '../linodeService.js';

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
    // Log only safe error properties to prevent token exfiltration
    const safeError = {
      code: error?.code,
      message: error?.message,
      statusCode: error?.statusCode,
      status: error?.status,
      url: error?.url,
      method: error?.method,
    };
    console.error('[linode] Provider API error:', { context, safeError });
    const normalizedError = normalizeLinodeError(safeError, 'linode');
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

        case 'rebuild':
          if (!_params?.image || !_params?.root_pass) {
            throw this.createError('MISSING_PARAMS', 'Rebuild requires image and root_pass parameters');
          }
          await linodeService.rebuildLinodeInstance(id, {
            image: _params.image,
            root_pass: _params.root_pass,
            authorized_keys: _params.authorized_keys,
            authorized_users: _params.authorized_users,
            booted: _params.booted,
            disk_encryption: _params.disk_encryption,
            maintenance_policy: _params.maintenance_policy,
            metadata: _params.metadata,
            stackscript_id: _params.stackscript_id,
            stackscript_data: _params.stackscript_data,
            type: _params.type,
          });
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

  // ── IP Address Management ──

  async listIPs(page?: number, pageSize?: number): Promise<{ data: ProviderIPAddress[]; pages: number; total: number }> {
    this.validateToken();

    try {
      const result = await linodeService.listAllIPs(page ?? 1, pageSize ?? 100);
      return {
        data: result.data.map(ip => this.normalizeIPAddress(ip)),
        pages: result.pages,
        total: result.results,
      };
    } catch (error) {
      this.handleApiError(error, 'listIPs');
    }
  }

  async getIPAddress(address: string): Promise<ProviderIPAddress> {
    this.validateToken();

    try {
      const ip = await linodeService.getIPAddress(address);
      return this.normalizeIPAddress(ip);
    } catch (error) {
      this.handleApiError(error, 'getIPAddress');
    }
  }

  async allocateIP(request: ProviderAllocateIPRequest): Promise<ProviderIPAddress> {
    this.validateToken();

    try {
      const ip = await linodeService.allocateIP({
        linode_id: Number(request.instanceId),
        public: request.public,
        type: request.type,
      });
      return this.normalizeIPAddress(ip);
    } catch (error) {
      this.handleApiError(error, 'allocateIP');
    }
  }

  async deleteIPAddress(instanceId: string, address: string): Promise<void> {
    this.validateToken();

    try {
      await linodeService.deleteIPAddress(Number(instanceId), address);
    } catch (error) {
      this.handleApiError(error, 'deleteIPAddress');
    }
  }

  async assignIPs(request: ProviderAssignIPsRequest): Promise<void> {
    this.validateToken();

    try {
      await linodeService.assignIPs({
        assignments: request.assignments.map(a => ({
          address: a.address,
          linode_id: Number(a.instanceId),
        })),
        region: request.region,
      });
    } catch (error) {
      this.handleApiError(error, 'assignIPs');
    }
  }

  async shareIPs(request: ProviderShareIPsRequest): Promise<void> {
    this.validateToken();

    try {
      await linodeService.shareIPs({
        linode_id: Number(request.instanceId),
        ips: request.ips,
      });
    } catch (error) {
      this.handleApiError(error, 'shareIPs');
    }
  }

  async updateIPReverseDNS(address: string, rdns: string | null): Promise<ProviderIPAddress> {
    this.validateToken();

    try {
      const ip = await linodeService.updateIPAddressReverseDNS(address, rdns);
      return this.normalizeIPAddress(ip);
    } catch (error) {
      this.handleApiError(error, 'updateIPReverseDNS');
    }
  }

  // ── IPv6 Management ──

  async listIPv6Pools(): Promise<ProviderIPv6Pool[]> {
    this.validateToken();

    try {
      const pools = await linodeService.listIPv6Pools();
      return pools.map(pool => ({
        range: pool.range,
        instanceId: null,
        region: pool.region,
        prefixLength: pool.prefix,
      }));
    } catch (error) {
      this.handleApiError(error, 'listIPv6Pools');
    }
  }

  async listIPv6Ranges(): Promise<ProviderIPv6Range[]> {
    this.validateToken();

    try {
      const ranges = await linodeService.listIPv6Ranges();
      const enriched = await Promise.all(
        ranges.map(async (range) => {
          try {
            const detail = await linodeService.getIPv6Range(range.range);
            return this.normalizeIPv6Range(range, detail);
          } catch (error) {
            console.warn('Failed to enrich provider IPv6 range:', {
              range: range.range,
              error,
            });
            return this.normalizeIPv6Range(range);
          }
        })
      );

      return enriched;
    } catch (error) {
      this.handleApiError(error, 'listIPv6Ranges');
    }
  }

  async createIPv6Range(request: ProviderCreateIPv6RangeRequest): Promise<{ range: string; routeTarget: string }> {
    this.validateToken();

    try {
      const result = await linodeService.createIPv6Range({
        linode_id: request.instanceId ? Number(request.instanceId) : undefined,
        route_target: request.routeTarget,
        prefix_length: request.prefixLength,
      });
      return {
        range: result.range,
        routeTarget: result.route_target,
      };
    } catch (error) {
      this.handleApiError(error, 'createIPv6Range');
    }
  }

  async deleteIPv6Range(range: string): Promise<void> {
    this.validateToken();

    try {
      await linodeService.deleteIPv6Range(range);
    } catch (error) {
      this.handleApiError(error, 'deleteIPv6Range');
    }
  }

  // ── VLAN Management ──

  async listVLANs(): Promise<ProviderVLAN[]> {
    this.validateToken();

    try {
      const vlans = await linodeService.listVLANs();
      return vlans.map(vlan => ({
        label: vlan.label,
        region: vlan.region,
        instanceIds: vlan.linodes.map(String),
        created: vlan.created,
      }));
    } catch (error) {
      this.handleApiError(error, 'listVLANs');
    }
  }

  async deleteVLAN(regionId: string, label: string): Promise<void> {
    this.validateToken();

    try {
      await linodeService.deleteVLAN(regionId, label);
    } catch (error) {
      this.handleApiError(error, 'deleteVLAN');
    }
  }

  // ── Firewall Management ──

  async listFirewalls(): Promise<{ data: ProviderFirewall[]; pages: number; total: number }> {
    this.validateToken();

    try {
      const results = await linodeService.listFirewalls();
      const data = results.map((fw: any) => this.normalizeFirewall(fw));
      return { data, pages: 1, total: data.length };
    } catch (error) {
      this.handleApiError(error, 'listFirewalls');
    }
  }

  async createFirewall(params: CreateFirewallParams): Promise<ProviderFirewall> {
    this.validateToken();

    try {
      const fw = await linodeService.createFirewall(params.label, params.rules, params.tags);
      return this.normalizeFirewall(fw);
    } catch (error) {
      this.handleApiError(error, 'createFirewall');
    }
  }

  async getFirewall(firewallId: number): Promise<ProviderFirewall> {
    this.validateToken();

    try {
      const fw = await linodeService.getFirewall(firewallId);
      return this.normalizeFirewall(fw);
    } catch (error) {
      this.handleApiError(error, 'getFirewall');
    }
  }

  async updateFirewall(firewallId: number, updates: { label?: string; status?: FirewallStatus; tags?: string[] }): Promise<ProviderFirewall> {
    this.validateToken();

    try {
      const fw = await linodeService.updateFirewall(firewallId, updates);
      return this.normalizeFirewall(fw);
    } catch (error) {
      this.handleApiError(error, 'updateFirewall');
    }
  }

  async deleteFirewall(firewallId: number): Promise<void> {
    this.validateToken();

    try {
      await linodeService.deleteFirewall(firewallId);
    } catch (error) {
      this.handleApiError(error, 'deleteFirewall');
    }
  }

  async getFirewallRules(firewallId: number): Promise<FirewallRules> {
    this.validateToken();

    try {
      const rules = await linodeService.getFirewallRules(firewallId);
      return rules as unknown as FirewallRules;
    } catch (error) {
      this.handleApiError(error, 'getFirewallRules');
    }
  }

  async updateFirewallRules(firewallId: number, rules: FirewallRules): Promise<FirewallRules> {
    this.validateToken();

    try {
      const result = await linodeService.updateFirewallRules(firewallId, rules);
      return result as unknown as FirewallRules;
    } catch (error) {
      this.handleApiError(error, 'updateFirewallRules');
    }
  }

  async getFirewallDevices(firewallId: number): Promise<FirewallDevice[]> {
    this.validateToken();

    try {
      const devices = await linodeService.getFirewallDevices(firewallId);
      return devices.map((d: any) => ({
        id: d.id,
        entity: {
          id: d.entity?.id ?? 0,
          type: d.entity?.type ?? 'linode',
          label: d.entity?.label ?? '',
          url: d.entity?.url ?? '',
        },
        created: d.created,
        updated: d.updated,
      }));
    } catch (error) {
      this.handleApiError(error, 'getFirewallDevices');
    }
  }

  async attachFirewallDevice(firewallId: number, type: string, entityId: number): Promise<FirewallDevice> {
    this.validateToken();

    try {
      await linodeService.attachFirewallToLinode(firewallId, entityId);
      // Return a minimal device object — the API doesn't return the created device directly
      return {
        id: 0,
        entity: { id: entityId, type: type as any, label: '', url: `/v4/linode/instances/${entityId}` },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
    } catch (error) {
      this.handleApiError(error, 'attachFirewallDevice');
    }
  }

  async detachFirewallDevice(firewallId: number, deviceId: number): Promise<void> {
    this.validateToken();

    try {
      await linodeService.detachFirewallFromLinode(firewallId, deviceId);
    } catch (error) {
      this.handleApiError(error, 'detachFirewallDevice');
    }
  }

  async getFirewallSettings(): Promise<FirewallSettings> {
    this.validateToken();

    try {
      const settings = await linodeService.getFirewallSettings();
      return settings as unknown as FirewallSettings;
    } catch (error) {
      this.handleApiError(error, 'getFirewallSettings');
    }
  }

  async updateFirewallSettings(settings: FirewallSettings): Promise<FirewallSettings> {
    this.validateToken();

    try {
      const result = await linodeService.updateFirewallSettings(settings as unknown as Record<string, unknown>);
      return result as unknown as FirewallSettings;
    } catch (error) {
      this.handleApiError(error, 'updateFirewallSettings');
    }
  }

  async listFirewallTemplates(): Promise<FirewallTemplate[]> {
    this.validateToken();

    try {
      const templates = await linodeService.listFirewallTemplates();
      return templates as unknown as FirewallTemplate[];
    } catch (error) {
      this.handleApiError(error, 'listFirewallTemplates');
    }
  }

  async getFirewallTemplate(slug: string): Promise<FirewallTemplate> {
    this.validateToken();

    try {
      const template = await linodeService.getFirewallTemplate(slug);
      return template as unknown as FirewallTemplate;
    } catch (error) {
      this.handleApiError(error, 'getFirewallTemplate');
    }
  }

  private normalizeFirewall(fw: any): ProviderFirewall {
    return {
      id: fw.id,
      label: fw.label,
      status: fw.status,
      rules: {
        inbound: fw.rules?.inbound ?? [],
        outbound: fw.rules?.outbound ?? [],
        inbound_policy: fw.rules?.inbound_policy ?? 'DROP',
        outbound_policy: fw.rules?.outbound_policy ?? 'ACCEPT',
      },
      entities: (fw.entities ?? []).map((e: any) => ({
        id: e.id,
        type: e.type,
        label: e.label ?? '',
        url: e.url ?? '',
      })),
      tags: fw.tags ?? [],
      created: fw.created,
      updated: fw.updated,
    };
  }

  /**
   * Normalize Linode IP address to common format
   */
  private normalizeIPAddress(ip: any): ProviderIPAddress {
    return {
      address: ip.address,
      gateway: ip.gateway,
      subnetMask: ip.subnet_mask,
      prefix: ip.prefix,
      type: ip.type,
      public: ip.public,
      rdns: ip.rdns ?? null,
      instanceId: ip.linode_id != null ? String(ip.linode_id) : null,
      region: ip.region,
    };
  }

  private normalizeIPv6Range(collectionRange: any, detailRange?: any): ProviderIPv6Range {
    const instanceIds = Array.isArray(detailRange?.linodes)
      ? detailRange.linodes.map(String)
      : Array.isArray(collectionRange?.linodes)
        ? collectionRange.linodes.map(String)
        : [];

    return {
      range: collectionRange?.range ?? detailRange?.range ?? '',
      instanceId: instanceIds[0] ?? null,
      instanceIds,
      routeTarget: collectionRange?.route_target ?? detailRange?.route_target ?? null,
      region: collectionRange?.region ?? detailRange?.region ?? '',
      prefixLength: collectionRange?.prefix ?? detailRange?.prefix ?? 64,
      created: collectionRange?.created ?? detailRange?.created ?? '',
    };
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

  // ── Disk Management ──

  async listDisks(instanceId: string): Promise<ProviderDisk[]> {
    this.validateToken();
    try {
      const disks = await linodeService.listDisks(Number(instanceId));
      return disks.map((d: any) => this.normalizeDisk(d));
    } catch (error) {
      this.handleApiError(error, 'listDisks');
    }
  }

  async getDisk(instanceId: string, diskId: number): Promise<ProviderDisk> {
    this.validateToken();
    try {
      const disk = await linodeService.getDisk(Number(instanceId), diskId);
      return this.normalizeDisk(disk);
    } catch (error) {
      this.handleApiError(error, 'getDisk');
    }
  }

  async createDisk(instanceId: string, params: CreateDiskParams): Promise<ProviderDisk> {
    this.validateToken();
    try {
      const disk = await linodeService.createDisk(Number(instanceId), {
        label: params.label,
        size: params.size,
        filesystem: params.filesystem,
        image: params.image,
        root_pass: params.rootPassword,
        authorized_keys: params.authorizedKeys,
        stackscript_id: params.stackscriptId,
        stackscript_data: params.stackscriptData,
      });
      return this.normalizeDisk(disk);
    } catch (error) {
      this.handleApiError(error, 'createDisk');
    }
  }

  async updateDisk(instanceId: string, diskId: number, params: UpdateDiskParams): Promise<ProviderDisk> {
    this.validateToken();
    try {
      const disk = await linodeService.updateDisk(Number(instanceId), diskId, {
        label: params.label,
        filesystem: params.filesystem,
      });
      return this.normalizeDisk(disk);
    } catch (error) {
      this.handleApiError(error, 'updateDisk');
    }
  }

  async resizeDisk(instanceId: string, diskId: number, size: number): Promise<void> {
    this.validateToken();
    try {
      await linodeService.resizeDisk(Number(instanceId), diskId, size);
    } catch (error) {
      this.handleApiError(error, 'resizeDisk');
    }
  }

  async cloneDisk(instanceId: string, diskId: number): Promise<ProviderDisk> {
    this.validateToken();
    try {
      const disk = await linodeService.cloneDisk(Number(instanceId), diskId);
      return this.normalizeDisk(disk);
    } catch (error) {
      this.handleApiError(error, 'cloneDisk');
    }
  }

  async resetDiskPassword(instanceId: string, diskId: number, password: string): Promise<void> {
    this.validateToken();
    try {
      await linodeService.resetDiskPassword(Number(instanceId), diskId, password);
    } catch (error) {
      this.handleApiError(error, 'resetDiskPassword');
    }
  }

  async deleteDisk(instanceId: string, diskId: number): Promise<void> {
    this.validateToken();
    try {
      await linodeService.deleteDisk(Number(instanceId), diskId);
    } catch (error) {
      this.handleApiError(error, 'deleteDisk');
    }
  }

  private normalizeDisk(d: any): ProviderDisk {
    return {
      id: d.id,
      label: d.label,
      status: d.status,
      size: d.size,
      filesystem: d.filesystem,
      created: d.created,
      updated: d.updated,
    };
  }

  // ── Volume Management ──

  async listVolumes(page?: number, pageSize?: number): Promise<{ data: ProviderVolume[]; pages: number; total: number }> {
    this.validateToken();
    try {
      const result = await linodeService.listVolumes(page, pageSize);
      return {
        data: result.data.map(v => this.normalizeVolume(v)),
        pages: result.pages,
        total: result.results,
      };
    } catch (error) {
      this.handleApiError(error, 'listVolumes');
    }
  }

  async createVolume(params: CreateVolumeParams): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.createVolume(params);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'createVolume');
    }
  }

  async getVolume(volumeId: number): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.getVolume(volumeId);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'getVolume');
    }
  }

  async updateVolume(volumeId: number, params: { label?: string; tags?: string[] }): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.updateVolume(volumeId, params);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'updateVolume');
    }
  }

  async deleteVolume(volumeId: number): Promise<void> {
    this.validateToken();
    try {
      await linodeService.deleteVolume(volumeId);
    } catch (error) {
      this.handleApiError(error, 'deleteVolume');
    }
  }

  async attachVolume(volumeId: number, linodeId: number): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.attachVolume(volumeId, linodeId);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'attachVolume');
    }
  }

  async detachVolume(volumeId: number): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.detachVolume(volumeId);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'detachVolume');
    }
  }

  async resizeVolume(volumeId: number, size: number): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.resizeVolume(volumeId, size);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'resizeVolume');
    }
  }

  async cloneVolume(volumeId: number, label: string): Promise<ProviderVolume> {
    this.validateToken();
    try {
      const volume = await linodeService.cloneVolume(volumeId, label);
      return this.normalizeVolume(volume);
    } catch (error) {
      this.handleApiError(error, 'cloneVolume');
    }
  }

  async listVolumeTypes(): Promise<ProviderVolumeType[]> {
    this.validateToken();
    try {
      const types = await linodeService.listVolumeTypes();
      return types.map(t => this.normalizeVolumeType(t));
    } catch (error) {
      this.handleApiError(error, 'listVolumeTypes');
    }
  }

  private normalizeVolume(v: LinodeVolume): ProviderVolume {
    return {
      id: v.id,
      label: v.label,
      status: v.status,
      size: v.size,
      region: v.region,
      linode_id: v.linode_id,
      linode_label: v.linode_label,
      filesystem_path: v.filesystem_path,
      created: v.created,
      updated: v.updated,
      encryption: v.encryption,
      hardware_type: v.hardware_type,
      io_ready: v.io_ready,
      tags: v.tags ?? [],
    };
  }

  private normalizeVolumeType(t: LinodeVolumeType): ProviderVolumeType {
    return {
      id: t.id,
      label: t.label,
      description: t.description,
      storage_bytes: t.storage_bytes,
      price: t.price,
      capabilities: t.capabilities ?? [],
    };
  }
}
