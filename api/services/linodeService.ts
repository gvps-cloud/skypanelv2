/**
 * Linode API Service for SkyPanelV2
 * Handles integration with Linode API for VPS management
 */

import { config } from '../config/index.js';

export interface LinodeType {
  id: string;
  label: string;
  disk: number;
  memory: number;
  vcpus: number;
  transfer: number;
  price: {
    hourly: number;
    monthly: number;
  };
  addons?: {
    backups?: {
      price?: {
        hourly: number;
        monthly: number;
      };
    };
  };
  network_out: number;
  type_class: string;
  successor?: string;
}

export interface LinodeRegion {
  id: string;
  label: string;
  country: string;
  capabilities: string[];
  status: string;
  site_type?: "core" | "distributed";
  resolvers: {
    ipv4: string;
    ipv6: string;
  };
}

export interface LinodeInstance {
  id: number;
  label: string;
  group: string;
  status: string;
  created: string;
  updated: string;
  type: string;
  ipv4: string[];
  ipv6: string;
  image: string;
  region: string;
  specs: {
    disk: number;
    memory: number;
    vcpus: number;
    gpus: number;
    transfer: number;
  };
  alerts: {
    cpu: number;
    network_in: number;
    network_out: number;
    transfer_quota: number;
    io: number;
  };
  backups: {
    enabled: boolean;
    available: boolean;
    schedule: {
      day: string;
      window: string;
    };
    last_successful: string;
  };
  hypervisor: string;
  watchdog_enabled: boolean;
  tags: string[];
  host_uuid: string;
  has_user_data: boolean;
}

export interface CreateLinodeRequest {
  type: string;
  region: string;
  image: string;
  label: string;
  root_pass: string;
  authorized_keys?: string[];
  backups_enabled?: boolean;
  private_ip?: boolean;
  tags?: string[];
  group?: string;
  stackscript_id?: number;
  stackscript_data?: Record<string, any>;
}

export interface RebuildLinodeRequest {
  /** Image ID to deploy the Linode Disk from (required). */
  image: string;
  /** Root user password for the newly created disk (required). */
  root_pass: string;
  /** Public SSH keys appended to root's ~/.ssh/authorized_keys. */
  authorized_keys?: string[];
  /** Linode usernames whose profile SSH keys are added automatically. */
  authorized_users?: string[];
  /** Whether to boot the Linode after rebuild. Defaults to true. */
  booted?: boolean;
  /** Disk encryption setting: 'enabled' or 'disabled'. */
  disk_encryption?: 'enabled' | 'disabled';
  /** Maintenance policy: 'linode/migrate' or 'linode/power_off_on'. */
  maintenance_policy?: 'linode/migrate' | 'linode/power_off_on';
  /** User-defined metadata relevant to the rebuild. */
  metadata?: Record<string, any>;
  /** StackScript ID to run during deployment. */
  stackscript_id?: number;
  /** User Defined Fields (UDF) data for the StackScript. */
  stackscript_data?: Record<string, any>;
  /** Linode type ID to resize to during rebuild. */
  type?: string;
}

export interface LinodeImage {
  id: string;
  label: string;
  description: string;
  created: string;
  type: string;
  is_public: boolean;
  vendor: string;
  size: number;
  deprecated: boolean;
  expiry: string | null;
  eol: string | null;
  status: string;
  capabilities: string[];
}

export interface LinodeStackScript {
  id: number;
  username: string;
  label: string;
  description?: string;
  images: string[];
  is_public: boolean;
  created: string;
  updated: string;
  rev_note: string;
  script: string;
  user_defined_fields: Array<{
    name: string;
    label: string;
    default: string;
    example: string;
    oneof: string;
  }>;
  deployments_active: number;
  deployments_total: number;
  mine?: boolean;
}

export interface CreateStackScriptRequest {
  label: string;
  script: string;
  images: string[];
  description?: string;
  is_public?: boolean; // default false
  rev_note?: string;
  user_defined_fields?: Array<{
    name: string;
    label: string;
    default?: string;
    example?: string;
    oneof?: string;
  }>;
}

export type LinodeMetricTuple = [number, number];

export interface LinodeInstanceStatsSeries {
  cpu?: LinodeMetricTuple[];
  io?: {
    io?: LinodeMetricTuple[];
    swap?: LinodeMetricTuple[];
  };
  netv4?: {
    in?: LinodeMetricTuple[];
    out?: LinodeMetricTuple[];
    private_in?: LinodeMetricTuple[];
    private_out?: LinodeMetricTuple[];
  };
  netv6?: {
    in?: LinodeMetricTuple[];
    out?: LinodeMetricTuple[];
    private_in?: LinodeMetricTuple[];
    private_out?: LinodeMetricTuple[];
  };
}

export interface LinodeInstanceStatsResponse extends LinodeInstanceStatsSeries {
  title?: string;
  data?: LinodeInstanceStatsSeries | null;
}

export type LinodeTransferUsage =
  | number
  | {
    total?: number;
    in?: number;
    out?: number;
    ingress?: number;
    egress?: number;
    inbound?: number;
    outbound?: number;
    bytes?: number;
    amount?: number;
    used?: number;
  };

export interface LinodeInstanceTransferResponse {
  used: LinodeTransferUsage;
  quota: number;
  billable: number;
}

const MARKETPLACE_CATEGORY_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  { regex: /(wordpress|ghost|drupal|joomla|cms)/i, category: 'CMS' },
  { regex: /(mysql|postgres|postgresql|mongodb|redis|mariadb|database)/i, category: 'Databases' },
  { regex: /(docker|kubernetes|jenkins|devops|ansible|terraform)/i, category: 'Developer Tools' },
  { regex: /(grafana|prometheus|monitor|logging|loki|elk|splunk)/i, category: 'Monitoring' },
  { regex: /(vpn|wireguard|openvpn|security|firewall)/i, category: 'Networking' },
  { regex: /(email|mail|smtp|mailserver)/i, category: 'Email' },
  { regex: /(cache|varnish|memcached)/i, category: 'Caching' },
  { regex: /(node|next|react|django|laravel|rails|flask|express|php|python|ruby)/i, category: 'Frameworks' },
  { regex: /(game|minecraft|valheim|terraria)/i, category: 'Gaming' },
];
const DEPRECATED_APP_REGEX = /\[\s*deprecated\s*\]/i;
const SECRET_FIELD_MATCHERS = [/linode api token/i];

export interface AccountTransferResponse {
  used: number;
  quota: number;
  billable: number;
  region_transfers?: Array<{
    id?: string;
    used?: number;
    quota?: number;
    billable?: number;
  }>;
}

export interface LinodeBackupDisk {
  label?: string;
  size?: number;
  filesystem?: string;
}

export interface LinodeBackupSummary {
  id?: number;
  label?: string | null;
  type?: string;
  status?: string;
  created?: string;
  updated?: string;
  finished?: string | null;
  available?: boolean;
  configs?: string[];
  disks?: LinodeBackupDisk[];
}

export interface LinodeSnapshotCollection {
  current?: LinodeBackupSummary | null;
  in_progress?: LinodeBackupSummary | null;
}

export interface LinodeInstanceBackupsResponse {
  automatic?: LinodeBackupSummary[];
  snapshot?: LinodeSnapshotCollection | null;
}

export interface LinodeIPsResponse {
  ipv4?: Record<string, any[]>;
  ipv6?: Record<string, any>;
}

export interface LinodeFirewallsResponse {
  data?: any[];
}

export interface LinodeInstanceConfigsResponse {
  data?: any[];
}

export interface LinodeEventsResponse {
  data?: any[];
}

export interface LinodeIPAddress {
  address: string;
  gateway: string;
  subnet_mask: string;
  prefix: number;
  type: 'ipv4' | 'ipv6' | 'ipv6/pool' | 'ipv6/range';
  public: boolean;
  rdns: string | null;
  linode_id: number | null;
  region: string;
  interface_id: number | null;
}

export interface LinodeListIPsResponse {
  data: LinodeIPAddress[];
  page: number;
  pages: number;
  results: number;
}

export interface LinodeAllocateIPRequest {
  linode_id: number;
  public: boolean;
  type: 'ipv4' | 'ipv6';
}

export interface LinodeAssignIPsRequest {
  assignments: Array<{ address: string; linode_id: number }>;
  region: string;
}

export interface LinodeShareIPsRequest {
  linode_id: number;
  ips: string[];
}

export interface LinodeIPv6Range {
  range: string;
  prefix: number;
  region: string;
  route_target: string | null;
  is_bgp: boolean;
  linodes: number[];
  created: string;
}

export interface LinodeIPv6Pool {
  range: string;
  prefix: number;
  region: string;
  route_target: string | null;
}

export interface LinodeVLAN {
  label: string;
  region: string;
  linodes: number[];
  created: string;
}

export interface LinodeCreateIPv6RangeRequest {
  linode_id?: number;
  route_target?: string;
  prefix_length: number;
}

class LinodeService {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.linode.com/v4';
  private marketplaceAppsEndpointAvailable: boolean | null = null;

  private static isDeprecatedAppName(name?: string): boolean {
    if (!name) return false;
    return DEPRECATED_APP_REGEX.test(name);
  }

  private static shouldAutofillLinodeToken(field: any): boolean {
    const combined = `${field?.name ?? ''} ${field?.label ?? ''}`.toLowerCase();
    if (!combined.trim()) {
      return false;
    }
    return SECRET_FIELD_MATCHERS.some((regex) => regex.test(combined));
  }

  private static partitionUserDefinedFields(fields: any[]): {
    visible: any[];
    secret: Array<{ name: string; type: 'linode_api_token' }>;
  } {
    const visible: any[] = [];
    const secret: Array<{ name: string; type: 'linode_api_token' }> = [];
    if (!Array.isArray(fields)) {
      return { visible, secret };
    }

    for (const field of fields) {
      if (this.shouldAutofillLinodeToken(field)) {
        const name = field?.name || field?.label;
        if (typeof name === 'string' && name.trim().length > 0) {
          secret.push({ name: name.trim(), type: 'linode_api_token' });
        }
        continue;
      }
      visible.push(field);
    }

    return { visible, secret };
  }

  constructor() {
    // Read directly from process.env first to avoid any timing issues
    this.apiToken = process.env.LINODE_API_TOKEN || config.LINODE_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('LINODE_API_TOKEN not configured');
    }
  }

  /**
   * Test API connection with provided credentials
   */
  async testConnection(apiToken?: string): Promise<{ success: boolean; message: string }> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        return { success: false, message: 'API token not provided' };
      }

      // Test the connection by fetching account info
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const _errorText = await response.text().catch(() => '');
        return {
          success: false,
          message: `API authentication failed: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Connected successfully to account: ${data.email || 'Unknown'}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection test failed'
      };
    }
  }

  /**
   * Fetch Linode Marketplace apps. Optionally filter by slug list.
   * Falls back to StackScript discovery when the official apps endpoint
   * is unavailable (e.g., older API deployments returning 404).
   */
  async listMarketplaceApps(slugs?: string[]): Promise<any[]> {
    if (!this.apiToken) {
      throw new Error('Linode API token not configured');
    }

    const slugFilter = this.buildMarketplaceSlugFilter(slugs);
    const shouldUseOfficialEndpoint = this.marketplaceAppsEndpointAvailable !== false;

    if (shouldUseOfficialEndpoint) {
      try {
        const apps = await this.fetchMarketplaceAppsFromOfficialEndpoint(slugFilter);
        this.marketplaceAppsEndpointAvailable = true;
        return apps;
      } catch (error) {
        if (this.shouldFallbackToStackScripts(error)) {
          this.marketplaceAppsEndpointAvailable = false;
          console.warn(
            'Linode Marketplace apps endpoint unavailable (404). Falling back to StackScript discovery.'
          );
        } else {
          console.error('Error fetching Linode Marketplace apps:', error);
          throw error;
        }
      }
    }

    return this.fetchMarketplaceAppsFromStackScripts(slugFilter);
  }

  private shouldFallbackToStackScripts(error: any): boolean {
    if (!error) return false;
    if (typeof error?.status === 'number' && error.status === 404) {
      return true;
    }
    const message = String(error?.message || '').toLowerCase();
    return message.includes('404') || message.includes('not found');
  }

  private buildMarketplaceSlugFilter(slugs?: string[]): Set<string> | null {
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return null;
    }
    const normalized = slugs
      .map((value) => this.normalizeMarketplaceSlug(value))
      .filter((value) => value.length > 0);
    return normalized.length > 0 ? new Set(normalized) : null;
  }

  private filterAppsBySlug(apps: any[], slugFilter?: Set<string> | null): any[] {
    if (!slugFilter || slugFilter.size === 0) {
      return apps;
    }
    return apps.filter((app) => {
      const candidates = new Set<string>();
      const pushCandidate = (value: string | undefined | null) => {
        const normalized = this.normalizeMarketplaceSlug(value);
        if (normalized) {
          candidates.add(normalized);
        }
      };

      pushCandidate(app?.slug);
      pushCandidate(app?.name);
      pushCandidate(app?.display_name);
      pushCandidate(app?.provider_name);

      const primary = this.normalizeMarketplaceSlug(app?.slug || app?.name || app?.display_name);
      if (primary) {
        const trimmed = primary.replace(/-on-.+$/, '');
        if (trimmed && trimmed !== primary) {
          candidates.add(trimmed);
        }
      }

      for (const candidate of candidates) {
        if (slugFilter.has(candidate)) {
          return true;
        }
      }
      return false;
    });
  }

  private async fetchMarketplaceAppsFromOfficialEndpoint(slugFilter?: Set<string> | null): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/linode/apps`, { headers: this.getHeaders() });
    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      const err: any = new Error(`Linode API error: ${response.status} ${response.statusText} ${txt}`);
      err.status = response.status;
      err.body = txt;
      throw err;
    }
    const data = await response.json();
    const apps: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];

    const enriched = await this.attachStackScriptFields(apps);
    const filtered = enriched.filter(
      (app) => !LinodeService.isDeprecatedAppName(app?.display_name || app?.name || '')
    );
    return this.filterAppsBySlug(filtered, slugFilter);
  }

  private async fetchMarketplaceAppsFromStackScripts(slugFilter?: Set<string> | null): Promise<any[]> {
    const scripts = await this.getLinodeStackScripts({
      filter: { username: 'linode', is_public: true },
      pageSize: 500,
    });
    const apps = scripts
      .map((script) => this.mapStackScriptToMarketplaceApp(script))
      .filter((app): app is any => Boolean(app));
    return this.filterAppsBySlug(apps, slugFilter);
  }

  private async attachStackScriptFields(apps: any[]): Promise<any[]> {
    return Promise.all(
      apps.map(async (app) => {
        try {
          if (app.stackscript_id) {
            const stackscript = await this.getStackScript(app.stackscript_id);
            const partitioned = LinodeService.partitionUserDefinedFields(
              stackscript?.user_defined_fields || []
            );
            return {
              ...app,
              user_defined_fields: partitioned.visible,
              secret_fields: partitioned.secret,
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch StackScript ${app.stackscript_id} for app ${app.slug}:`, error);
        }
        const partitioned = LinodeService.partitionUserDefinedFields(
          Array.isArray(app?.user_defined_fields) ? app.user_defined_fields : []
        );
        return {
          ...app,
          user_defined_fields: partitioned.visible,
          secret_fields: partitioned.secret,
        };
      })
    );
  }

  private mapStackScriptToMarketplaceApp(script: LinodeStackScript): any {
    const slug = this.normalizeMarketplaceSlug(script.label) || `stackscript-${script.id}`;
    if (LinodeService.isDeprecatedAppName(script.label)) {
      return null;
    }
    const partitioned = LinodeService.partitionUserDefinedFields(script.user_defined_fields || []);
    return {
      slug,
      name: script.label,
      display_name: script.label,
      provider_name: script.label,
      category: this.deriveMarketplaceCategory(`${script.label} ${script.description ?? ''}`),
      description: script.description,
      summary: script.rev_note || script.description,
      stackscript_id: script.id,
      user_defined_fields: partitioned.visible,
      secret_fields: partitioned.secret,
      images: script.images,
      deployments_active: script.deployments_active,
      deployments_total: script.deployments_total,
    };
  }

  private normalizeMarketplaceSlug(value: string | undefined | null): string {
    if (!value) {
      return '';
    }
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private deriveMarketplaceCategory(text: string): string {
    if (!text) return 'Applications';
    for (const { regex, category } of MARKETPLACE_CATEGORY_PATTERNS) {
      if (regex.test(text)) {
        return category;
      }
    }
    return 'Applications';
  }

  /**
   * Fetch a single Marketplace app by slug.
   */
  async getMarketplaceApp(slug: string): Promise<any | null> {
    const apps = await this.listMarketplaceApps([slug]);
    return apps[0] || null;
  }

  /**
   * Create instance using a Marketplace app (uses app's underlying StackScript)
   */
  async createInstanceWithMarketplaceApp(params: {
    label: string;
    type: string;
    region: string;
    image: string;
    rootPassword: string;
    sshKeys?: string[];
    backups?: boolean;
    privateIP?: boolean;
    appSlug: string;
    appData: Record<string, any>;
  }): Promise<LinodeInstance> {
    const {
      label,
      type,
      region,
      image,
      rootPassword,
      sshKeys = [],
      backups = false,
      privateIP = false,
      appSlug,
      appData
    } = params;

    const app = await this.getMarketplaceApp(appSlug);
    if (!app) throw new Error(`Marketplace app not found: ${appSlug}`);

    const allowedImages: string[] = Array.isArray(app?.images) ? app.images : [];
    if (allowedImages.length > 0 && !allowedImages.includes(image)) {
      throw new Error('Selected image is not compatible with the chosen Marketplace app');
    }

    const udfs: any[] = Array.isArray(app?.user_defined_fields) ? app.user_defined_fields : [];
    const secretFields: Array<{ name: string; type: string }> = Array.isArray(app?.secret_fields)
      ? app.secret_fields
      : [];
    const secretNames = new Set(
      secretFields
        .map((field) => (typeof field?.name === 'string' ? field.name : null))
        .filter((name): name is string => Boolean(name))
    );

    const resolvedAppData: Record<string, any> = { ...(appData || {}) };
    for (const secret of secretFields) {
      if (secret.type === 'linode_api_token') {
        if (!this.apiToken) {
          throw new Error('Linode API token not configured for marketplace deployment');
        }
        resolvedAppData[secret.name] = this.apiToken;
      }
    }

    const missing = udfs.filter(f => {
      const name = f?.name;
      if (!name) return false;
      const required = Boolean(f?.required) || String(f?.label || '').toLowerCase().includes('(required)');
      if (!required) return false;
      if (secretNames.has(name)) {
        return false;
      }
      const val = resolvedAppData[name];
      return val === undefined || val === null || String(val).trim() === '';
    });
    if (missing.length > 0) {
      const first = missing[0];
      throw new Error(`Missing required app field: ${first?.label || first?.name}`);
    }

    const createReq: CreateLinodeRequest = {
      type,
      region,
      image,
      label,
      root_pass: rootPassword,
      authorized_keys: sshKeys,
      backups_enabled: backups,
      private_ip: privateIP,
      stackscript_id: Number(app?.stackscript_id),
      stackscript_data: resolvedAppData
    };

    return this.createLinodeInstance(createReq);
  }

  private getHeaders(apiToken?: string): HeadersInit {
    const token = apiToken || this.apiToken;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get Linode profile for current token (to determine username)
   */
  async getLinodeProfile(): Promise<{ username: string }> {
    try {
      if (!this.apiToken) throw new Error('Linode API token not configured');
      const response = await fetch(`${this.baseUrl}/profile`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`Linode API error (profile): ${response.status} ${response.statusText} ${txt}`);
      }
      const data = await response.json();
      return { username: String(data.username || '') };
    } catch (error) {
      console.error('Error fetching Linode profile:', error);
      throw error;
    }
  }

  /**
   * Fetch all available Linode types (plans)
   */
  async getLinodeTypes(): Promise<LinodeType[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }
      const isDebug = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production'
      if (isDebug) {
        console.log('Fetching Linode types')
      }
      const response = await fetch(`${this.baseUrl}/linode/types`, {
        headers: this.getHeaders(),
      });
      if (isDebug) {
        console.log('Linode API response status:', response.status)
      }
      if (!response.ok) {
        if (isDebug) {
          const errorText = await response.text()
          console.error('Linode API error response:', errorText)
        }
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (isDebug) {
        console.log('Fetched Linode types:', data.data.length)
      }

      // Map Linode type_class values to standardized categories
      // Use exact values from Linode API to match frontend filtering
      const TYPE_CLASS_MAP: Record<string, string> = {
        'nanode': 'nanode',
        'standard': 'standard',
        'dedicated': 'dedicated',
        'highmem': 'highmem',
        'premium': 'premium',
        'gpu': 'gpu',
        'accelerated': 'accelerated',
      };

      return data.data.map((type: any) => {
        const rawTypeClass = (type.class || type.type_class || '').toLowerCase().trim();
        const mappedTypeClass = TYPE_CLASS_MAP[rawTypeClass] || 'standard';

        // Log warning for unmapped type classes
        if (!TYPE_CLASS_MAP[rawTypeClass] && rawTypeClass) {
          console.warn(`Unmapped Linode type class: "${type.class || type.type_class}" for plan "${type.id}"`);
        }

        return {
          id: type.id,
          label: type.label,
          disk: type.disk,
          memory: type.memory,
          vcpus: type.vcpus,
          transfer: type.transfer,
          price: type.price,
          addons: type.addons, // Include addons for backup pricing
          network_out: type.network_out || 0,
          type_class: mappedTypeClass,
          successor: type.successor,
        };
      });
    } catch (error) {
      console.error('Error fetching Linode types:', error);
      throw error;
    }
  }

  /**
   * Fetch all available Linode images
   */
  async getLinodeImages(apiToken?: string): Promise<LinodeImage[]> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }
      const isDebug = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production'
      if (isDebug) {
        console.log('Fetching Linode images')
      }
      const response = await fetch(`${this.baseUrl}/images`, {
        headers: this.getHeaders(token),
      });
      if (isDebug) {
        console.log('Linode API response status:', response.status)
      }
      if (!response.ok) {
        if (isDebug) {
          const errorText = await response.text()
          console.error('Linode API error response:', errorText)
        }
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const allImages = Array.isArray(data?.data) ? data.data : [];
      const filtered = allImages.filter((image: any) => {
        const label = String(image?.label || '');
        const vendor = String(image?.vendor || '');
        const isPublic = Boolean(image?.is_public);

        if (!isPublic) {
          return false;
        }

        if (!vendor.trim()) {
          return false;
        }

        if (/recovery|rescue/i.test(label) || /recovery|rescue/i.test(vendor)) {
          return false;
        }

        return true;
      });

      if (isDebug) {
        console.log('Fetched Linode images:', allImages.length, 'filtered to', filtered.length)
      }

      return filtered.map((image: any) => ({
        id: image.id,
        label: image.label,
        description: image.description,
        created: image.created,
        type: image.type,
        is_public: image.is_public,
        vendor: image.vendor,
        size: image.size,
        deprecated: image.deprecated,
        expiry: image.expiry,
        eol: image.eol,
        status: image.status,
        capabilities: image.capabilities,
      }));
    } catch (error) {
      console.error('Error fetching Linode images:', error);
      throw error;
    }
  }

  /**
   * Fetch Linode StackScripts.
   * When mineOnly is true, use X-Filter to return only scripts owned by the account.
   * Additional filters can be provided via the options parameter.
   */
  async getLinodeStackScripts(options: { mineOnly?: boolean; filter?: Record<string, any>; pageSize?: number } = {}): Promise<LinodeStackScript[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }
      const isDebug = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production';
      if (isDebug) {
        console.log('Fetching Linode stack scripts');
      }

      const headers: Record<string, string> = {
        ...(this.getHeaders() as Record<string, string>),
      };

      const filter: Record<string, any> = { ...(options.filter || {}) };
      if (options.mineOnly) {
        filter.mine = true;
      }
      if (Object.keys(filter).length > 0) {
        headers['X-Filter'] = JSON.stringify(filter);
      }

      const pageSize = options.pageSize ?? 500;
      let page = 1;
      const scripts: LinodeStackScript[] = [];

      while (true) {
        const response = await fetch(`${this.baseUrl}/linode/stackscripts?page=${page}&page_size=${pageSize}`, {
          headers,
        });
        if (isDebug) {
          console.log('Linode API response status:', response.status, 'for StackScripts page', page);
        }
        if (!response.ok) {
          if (isDebug) {
            const errorText = await response.text();
            console.error('Linode API error response:', errorText);
          }
          throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const rows: any[] = Array.isArray(data?.data) ? data.data : [];
        if (isDebug) {
          console.log(`Fetched ${rows.length} StackScripts on page ${data?.page ?? page} of ${data?.pages ?? '?'}`);
        }

        scripts.push(
          ...rows.map((stackscript: any) => ({
            id: stackscript.id,
            username: stackscript.username,
            label: stackscript.label,
            description: stackscript.description,
            images: stackscript.images,
            is_public: stackscript.is_public,
            created: stackscript.created,
            updated: stackscript.updated,
            rev_note: stackscript.rev_note,
            script: stackscript.script,
            user_defined_fields: stackscript.user_defined_fields || [],
            deployments_active: stackscript.deployments_active,
            deployments_total: stackscript.deployments_total,
            mine: stackscript.mine === true,
          }))
        );

        const currentPage = Number(data?.page ?? page);
        const totalPages = Number(data?.pages ?? currentPage);
        if (!rows.length || currentPage >= totalPages) {
          break;
        }
        page += 1;
      }

      return scripts;
    } catch (error) {
      console.error('Error fetching Linode stack scripts:', error);
      throw error;
    }
  }

  /**
   * Create a new StackScript
   */
  async createStackScript(req: CreateStackScriptRequest): Promise<LinodeStackScript> {
    try {
      if (!this.apiToken) throw new Error('Linode API token not configured');
      const body: any = {
        label: req.label,
        script: req.script,
        images: req.images,
        is_public: req.is_public ?? false,
        rev_note: req.rev_note ?? `Initial version created via ${config.COMPANY_BRAND_NAME}`,
        description: req.description ?? req.label,
        user_defined_fields: req.user_defined_fields ?? [],
      };
      const response = await fetch(`${this.baseUrl}/linode/stackscripts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`Linode API error (create StackScript): ${response.status} ${response.statusText} ${txt}`);
      }
      const data = await response.json();
      return data as LinodeStackScript;
    } catch (error) {
      console.error('Error creating Linode StackScript:', error);
      throw error;
    }
  }

  /**
   * Update an existing StackScript by id
   */
  async updateStackScript(id: number, req: Partial<CreateStackScriptRequest>): Promise<LinodeStackScript> {
    try {
      if (!this.apiToken) throw new Error('Linode API token not configured');
      const body: any = { ...req };
      const response = await fetch(`${this.baseUrl}/linode/stackscripts/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`Linode API error (update StackScript): ${response.status} ${response.statusText} ${txt}`);
      }
      const data = await response.json();
      return data as LinodeStackScript;
    } catch (error) {
      console.error('Error updating Linode StackScript:', error);
      throw error;
    }
  }

  /**
   * Find a StackScript by label (exact match)
   */
  async findStackScriptByLabel(label: string): Promise<LinodeStackScript | null> {
    const scripts = await this.getLinodeStackScripts();
    const match = scripts.find(s => String(s.label).trim().toLowerCase() === String(label).trim().toLowerCase());
    return match || null;
  }

  /**
   * Fetch a single StackScript by ID
   */
  async getStackScript(stackscriptId: number): Promise<LinodeStackScript | null> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }
      const response = await fetch(`${this.baseUrl}/linode/stackscripts/${stackscriptId}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const txt = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${txt}`);
      }

      const stackscript = await response.json();
      return {
        id: stackscript.id,
        username: stackscript.username,
        label: stackscript.label,
        description: stackscript.description,
        images: stackscript.images,
        is_public: stackscript.is_public,
        created: stackscript.created,
        updated: stackscript.updated,
        rev_note: stackscript.rev_note,
        script: stackscript.script,
        user_defined_fields: stackscript.user_defined_fields || [],
        deployments_active: stackscript.deployments_active,
        deployments_total: stackscript.deployments_total,
      };
    } catch (error) {
      console.error(`Error fetching StackScript ${stackscriptId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all available Linode regions
   */
  async getLinodeRegions(): Promise<LinodeRegion[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }
      const isDebug = process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production'
      if (isDebug) {
        console.log('Fetching Linode regions')
      }
      const response = await fetch(`${this.baseUrl}/regions`, {
        headers: this.getHeaders(),
      });
      if (isDebug) {
        console.log('Linode API response status:', response.status)
      }
      if (!response.ok) {
        if (isDebug) {
          const errorText = await response.text()
          console.error('Linode API error response:', errorText)
        }
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (isDebug) {
        console.log('Fetched Linode regions:', data.data.length)
      }
      return data.data.map((region: any) => ({
        id: region.id,
        label: region.label,
        country: region.country,
        capabilities: region.capabilities,
        status: region.status,
        resolvers: region.resolvers,
      }));
    } catch (error) {
      console.error('Error fetching Linode regions:', error);
      throw error;
    }
  }

  /**
   * Fetch all Linode instances for the account
   */
  async getLinodeInstances(): Promise<LinodeInstance[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching Linode instances:', error);
      throw error;
    }
  }

  /**
   * Create a new Linode instance
   */
  async createLinodeInstance(
    createRequest: CreateLinodeRequest,
    apiToken?: string,
  ): Promise<LinodeInstance> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(createRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Linode API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating Linode instance:', error);
      throw error;
    }
  }

  /**
   * Get a specific Linode instance
   */
  async getLinodeInstance(instanceId: number): Promise<LinodeInstance> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Linode instance:', error);
      throw error;
    }
  }

  /**
   * Update a Linode instance (e.g., label/hostname)
   */
  async updateLinodeInstance(instanceId: number, updateData: { label?: string;[key: string]: any }): Promise<LinodeInstance> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Linode API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating Linode instance:', error);
      throw error;
    }
  }

  /**
   * Fetch runtime statistics for a specific instance (last 24 hours)
   */
  async getLinodeInstanceStats(instanceId: number): Promise<LinodeInstanceStatsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/stats`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeInstanceStatsResponse;
    } catch (error) {
      console.error('Error fetching Linode instance stats:', error);
      throw error;
    }
  }

  /**
   * Fetch current-month transfer usage for an instance
   */
  async getLinodeInstanceTransfer(instanceId: number): Promise<LinodeInstanceTransferResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/transfer`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeInstanceTransferResponse;
    } catch (error) {
      console.error('Error fetching Linode transfer usage:', error);
      throw error;
    }
  }

  async getAccountTransfer(): Promise<AccountTransferResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/account/transfer`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as AccountTransferResponse;
    } catch (error) {
      console.error('Error fetching Linode account transfer usage:', error);
      throw error;
    }
  }

  /**
   * Fetch available backups for an instance
   */
  async getLinodeInstanceBackups(instanceId: number): Promise<LinodeInstanceBackupsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/backups`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeInstanceBackupsResponse;
    } catch (error) {
      console.error('Error fetching Linode backups:', error);
      throw error;
    }
  }

  async enableLinodeBackups(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/backups/enable`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');

        // Parse the response to check for specific error conditions
        let errorMessage = `API error: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(text);
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorReasons = errorData.errors.map((err: any) => err.reason || '').join(' ');

            // Check for the 24-hour waiting period error and replace with generic message
            if (errorReasons.includes('Please wait 24 hours before reactivating backups')) {
              throw new Error('Please wait 24 hours before reactivating backups for this VPS instance');
            }

            // Remove any Linode branding from other error messages
            const sanitizedReasons = errorReasons.replace(/\bLinode\b/gi, 'VPS instance');
            if (sanitizedReasons.trim()) {
              errorMessage = sanitizedReasons;
            }
          }
        } catch {
          // If we can't parse the JSON, fall back to sanitizing the raw text
          const sanitizedText = text.replace(/\bLinode\b/gi, 'VPS instance');
          if (sanitizedText.trim()) {
            errorMessage += ` ${sanitizedText}`;
          }
        }

        throw new Error(errorMessage.trim());
      }
    } catch (error) {
      console.error('Error enabling backups:', error);
      throw error;
    }
  }

  async cancelLinodeBackups(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/backups/cancel`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');

        // Parse the response to check for specific error conditions
        let errorMessage = `API error: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(text);
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorReasons = errorData.errors.map((err: any) => err.reason || '').join(' ');

            // Remove any Linode branding from error messages
            const sanitizedReasons = errorReasons.replace(/\bLinode\b/gi, 'VPS instance');
            if (sanitizedReasons.trim()) {
              errorMessage = sanitizedReasons;
            }
          }
        } catch {
          // If we can't parse the JSON, fall back to sanitizing the raw text
          const sanitizedText = text.replace(/\bLinode\b/gi, 'VPS instance');
          if (sanitizedText.trim()) {
            errorMessage += ` ${sanitizedText}`;
          }
        }

        throw new Error(errorMessage.trim());
      }
    } catch (error) {
      console.error('Error disabling backups:', error);
      throw error;
    }
  }

  async updateLinodeBackupSchedule(
    instanceId: number,
    schedule: { day?: string | null; window?: string | null }
  ): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const scheduleFields: Record<string, unknown> = {};

      if (schedule.day !== undefined) {
        scheduleFields.day = schedule.day ?? null;
      }
      if (schedule.window !== undefined) {
        scheduleFields.window = schedule.window ?? null;
      }

      if (Object.keys(scheduleFields).length === 0) {
        return;
      }

      const payload = { backups: { schedule: scheduleFields } };

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error('Error updating Linode backup schedule:', error);
      throw error;
    }
  }

  async createLinodeBackup(instanceId: number, label?: string): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/backups`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(label ? { label } : {}),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json().catch(() => ({}));
      return data as Record<string, unknown>;
    } catch (error) {
      console.error('Error creating Linode backup snapshot:', error);
      throw error;
    }
  }

  async restoreLinodeBackup(
    instanceId: number,
    backupId: number,
    options: { overwrite?: boolean; targetInstanceId?: number } = {}
  ): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const targetInstanceId = options.targetInstanceId ?? instanceId;
      const payload: Record<string, unknown> = {
        linode_id: targetInstanceId,
      };

      if (options.overwrite !== undefined) {
        payload.overwrite = Boolean(options.overwrite);
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/backups/${backupId}/restore`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error('Error restoring Linode backup:', error);
      throw error;
    }
  }

  async getLinodeInstanceIPs(instanceId: number): Promise<LinodeIPsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/ips`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeIPsResponse;
    } catch (error) {
      console.error('Error fetching Linode IP assignments:', error);
      throw error;
    }
  }

  async getLinodeInstanceFirewalls(instanceId: number): Promise<LinodeFirewallsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/firewalls`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeFirewallsResponse;
    } catch (error) {
      console.error('Error fetching Linode firewalls:', error);
      throw error;
    }
  }

  async listFirewalls(): Promise<Record<string, unknown>[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const pageSize = 100;
      let page = 1;
      let totalPages = 1;
      const results: Record<string, unknown>[] = [];

      while (page <= totalPages) {
        const response = await fetch(`${this.baseUrl}/networking/firewalls?page=${page}&page_size=${pageSize}`, {
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
        }

        const payload = await response.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        results.push(...(data as Record<string, unknown>[]));
        const pages = Number(payload?.pages ?? 1);
        totalPages = Number.isFinite(pages) && pages > 0 ? pages : 1;
        page += 1;
      }

      return results;
    } catch (error) {
      console.error('Error listing firewalls:', error);
      throw error;
    }
  }

  async getLinodeInstanceConfigs(instanceId: number): Promise<LinodeInstanceConfigsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/configs`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeInstanceConfigsResponse;
    } catch (error) {
      console.error('Error fetching Linode configuration profiles:', error);
      throw error;
    }
  }

  async getFirewallDevices(firewallId: number): Promise<Record<string, unknown>[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/devices`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const payload = await response.json();
      const devices = Array.isArray(payload?.data) ? payload.data : [];
      return devices as Record<string, unknown>[];
    } catch (error) {
      console.error(`Error fetching devices for firewall ${firewallId}:`, error);
      throw error;
    }
  }

  async attachFirewallToLinode(firewallId: number, instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/devices`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ type: 'linode', id: instanceId }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error attaching firewall ${firewallId} to Linode ${instanceId}:`, error);
      throw error;
    }
  }

  async detachFirewallFromLinode(firewallId: number, deviceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error detaching firewall ${firewallId} device ${deviceId}:`, error);
      throw error;
    }
  }

  async createFirewall(label: string, rules: {
    inbound_policy: 'ACCEPT' | 'DROP';
    outbound_policy: 'ACCEPT' | 'DROP';
    inbound?: Array<{ protocol: string; ports?: string; addresses: { ipv4?: string[]; ipv6?: string[] }; action: 'ACCEPT' | 'DROP'; label?: string; description?: string }>;
    outbound?: Array<{ protocol: string; ports?: string; addresses: { ipv4?: string[]; ipv6?: string[] }; action: 'ACCEPT' | 'DROP'; label?: string; description?: string }>;
  }, tags?: string[]): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const body: Record<string, unknown> = { label, rules };
      if (tags) body.tags = tags;

      const response = await fetch(`${this.baseUrl}/networking/firewalls`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating firewall:', error);
      throw error;
    }
  }

  async getFirewall(firewallId: number): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching firewall ${firewallId}:`, error);
      throw error;
    }
  }

  async updateFirewall(firewallId: number, updates: { label?: string; status?: 'enabled' | 'disabled'; tags?: string[] }): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error(`Error updating firewall ${firewallId}:`, error);
      throw error;
    }
  }

  async deleteFirewall(firewallId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error deleting firewall ${firewallId}:`, error);
      throw error;
    }
  }

  async getFirewallRules(firewallId: number): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/rules`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching firewall rules for ${firewallId}:`, error);
      throw error;
    }
  }

  async updateFirewallRules(firewallId: number, rules: {
    inbound_policy: 'ACCEPT' | 'DROP';
    outbound_policy: 'ACCEPT' | 'DROP';
    inbound?: Array<{ protocol: string; ports?: string; addresses: { ipv4?: string[]; ipv6?: string[] }; action: 'ACCEPT' | 'DROP'; label?: string; description?: string }>;
    outbound?: Array<{ protocol: string; ports?: string; addresses: { ipv4?: string[]; ipv6?: string[] }; action: 'ACCEPT' | 'DROP'; label?: string; description?: string }>;
  }): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/rules`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(rules),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error(`Error updating firewall rules for ${firewallId}:`, error);
      throw error;
    }
  }

  async getFirewallHistory(firewallId: number): Promise<Record<string, unknown>[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/${firewallId}/history`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return Array.isArray(data?.data) ? data.data : [];
    } catch (error) {
      console.error(`Error fetching firewall history for ${firewallId}:`, error);
      throw error;
    }
  }

  async getFirewallSettings(): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/settings`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching firewall settings:', error);
      throw error;
    }
  }

  async updateFirewallSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/settings`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating firewall settings:', error);
      throw error;
    }
  }

  async listFirewallTemplates(): Promise<Record<string, unknown>[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/templates`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return Array.isArray(data?.data) ? data.data : [];
    } catch (error) {
      console.error('Error listing firewall templates:', error);
      throw error;
    }
  }

  async getFirewallTemplate(slug: string): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/firewalls/templates/${encodeURIComponent(slug)}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching firewall template ${slug}:`, error);
      throw error;
    }
  }

  async getLinodeInstanceEvents(instanceId: number, params: { page?: number; pageSize?: number } = {}): Promise<LinodeEventsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const page = params.page && params.page > 0 ? params.page : 1;
      const pageSize = params.pageSize && params.pageSize >= 25 ? Math.min(params.pageSize, 100) : 25;

      const search = new URLSearchParams();
      search.set('page', String(page));
      search.set('page_size', String(pageSize));

      const filter = {
        '+order': 'desc',
        '+order_by': 'created',
        'entity.type': 'linode',
        'entity.id': instanceId,
      };

      const headers = {
        ...this.getHeaders(),
        'X-Filter': JSON.stringify(filter),
      };

      const response = await fetch(`${this.baseUrl}/account/events?${search.toString()}`, {
        headers,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const data = await response.json();
      return data as LinodeEventsResponse;
    } catch (error) {
      console.error('Error fetching Linode events:', error);
      throw error;
    }
  }

  async getAccountNetworkingIPs(): Promise<{ data: Array<{ address: string; rdns: string | null; type: string }> }> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }
      const response = await fetch(`${this.baseUrl}/networking/ips?page_size=500`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
      const data = await response.json();
      return data as { data: Array<{ address: string; rdns: string | null; type: string }> };
    } catch (error) {
      console.error('Error fetching account networking IPs:', error);
      throw error;
    }
  }

  async updateIPAddressReverseDNS(address: string, rdns: string | null): Promise<Record<string, unknown>> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/ips/${encodeURIComponent(address)}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ rdns }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        // Try to parse Linode's error structure for a clearer message
        try {
          const data = JSON.parse(text);
          if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            const reason = data.errors.map((e: any) => e?.reason || '').join(' ').trim();
            const sanitized = reason.replace(/\bLinode\b/gi, 'VPS provider');
            if (sanitized) {
              throw new Error(sanitized);
            }
          }
        } catch {
          // fall through to generic error below
        }
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json().catch(() => ({}));
      return payload as Record<string, unknown>;
    } catch (error) {
      console.error(`Error updating rDNS for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Boot a Linode instance
   */
  async bootLinodeInstance(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/boot`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error booting Linode instance:', error);
      throw error;
    }
  }

  /**
   * Shutdown a Linode instance
   */
  async shutdownLinodeInstance(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/shutdown`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error shutting down Linode instance:', error);
      throw error;
    }
  }

  /**
   * Reboot a Linode instance
   */
  async rebootLinodeInstance(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/reboot`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error rebooting Linode instance:', error);
      throw error;
    }
  }

  /**
   * Delete a Linode instance
   */
  async deleteLinodeInstance(instanceId: number): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Linode API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting Linode instance:', error);
      throw error;
    }
  }

  /**
   * Rebuild a Linode instance with a new image
   * This wipes all disks and configs, then deploys the specified image.
   * Linode API: POST /linode/instances/{linodeId}/rebuild
   */
  async rebuildLinodeInstance(
    instanceId: number,
    rebuildRequest: RebuildLinodeRequest,
    apiToken?: string,
  ): Promise<LinodeInstance> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/linode/instances/${instanceId}/rebuild`, {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(rebuildRequest),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Linode API error: ${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
            errorMessage = parsed.errors.map((e: any) => e.reason || e.message || JSON.stringify(e)).join('; ');
          }
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      return await response.json() as LinodeInstance;
    } catch (error) {
      console.error('Error rebuilding Linode instance:', error);
      throw error;
    }
  }

  /**
   * Get all SSH keys for the account
   */
  async getSSHKeys(apiToken: string): Promise<Array<{ id: number; label: string; ssh_key: string; created: string }>> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/profile/sshkeys`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${errorText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching Linode SSH keys:', error);
      throw error;
    }
  }

  /**
   * Create a new SSH key
   */
  async createSSHKey(apiToken: string, label: string, publicKey: string): Promise<{ id: number; label: string; ssh_key: string }> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/profile/sshkeys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          label,
          ssh_key: publicKey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating Linode SSH key:', error);
      throw error;
    }
  }

  /**
   * Delete an SSH key
   */
  async deleteSSHKey(apiToken: string, keyId: string): Promise<void> {
    try {
      const token = apiToken || this.apiToken;
      if (!token) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/profile/sshkeys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting Linode SSH key:', error);
      throw error;
    }
  }

  /**
   * Set up custom rDNS for a newly created VPS instance (DEPRECATED - use setupCustomRDNSAsync)
   * This will set the rDNS to use the configured rDNS domain domain instead of linodeusercontent.com
   */
  async setupCustomRDNS(instanceId: number): Promise<void> {
    console.warn('setupCustomRDNS is deprecated, use setupCustomRDNSAsync instead');
    return this.setupCustomRDNSAsync(instanceId, `instance-${instanceId}`);
  }

  /**
   * Set up custom rDNS for a newly created VPS instance (Async Background Version)
   * This will set the rDNS to use the configured rDNS domain domain instead of linodeusercontent.com
   * This method is designed to run in the background without blocking VPS creation
   */
  async setupCustomRDNSAsync(instanceId: number, label: string = `instance-${instanceId}`, baseDomain: string = config.RDNS_BASE_DOMAIN): Promise<void> {
    const logPrefix = `[rDNS-${instanceId}]`;

    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      console.log(`${logPrefix} Starting background rDNS setup for VPS ${label}`);

      // Wait until the instance has an IPv4 assigned (state doesn't need to be running)
      const maxStatusAttempts = 20; // up to ~10 minutes
      const statusIntervalMs = 30000; // 30 seconds
      let instance: LinodeInstance | null = null;
      for (let attempt = 1; attempt <= maxStatusAttempts; attempt++) {
        try {
          instance = await this.getLinodeInstance(instanceId);
          const hasIPv4 = Array.isArray(instance.ipv4) && instance.ipv4.length > 0;
          console.log(`${logPrefix} VPS check ${attempt}/${maxStatusAttempts}: status=${instance.status}, hasIPv4=${hasIPv4}`);
          if (hasIPv4) {
            break;
          }
          await new Promise(res => setTimeout(res, statusIntervalMs));
        } catch (statusErr) {
          console.warn(`${logPrefix} Failed to fetch VPS detail (attempt ${attempt}):`, statusErr);
          if (attempt === maxStatusAttempts) {
            throw new Error('VPS detail fetch failed after maximum attempts');
          }
          await new Promise(res => setTimeout(res, statusIntervalMs));
        }
      }

      if (!instance || !Array.isArray(instance.ipv4) || instance.ipv4.length === 0) {
        console.warn(`${logPrefix} No IPv4 assigned after maximum attempts, skipping rDNS setup`);
        return;
      }

      // Get the primary public IPv4 address (first in the array)
      const primaryIPv4 = instance.ipv4[0];

      // Create the custom rDNS hostname: a-b-c-d.<baseDomain> (hyphenated, not reversed)
      const hyphenatedIP = primaryIPv4.replace(/\./g, '-');
      // Normalize base domain, strip leading/trailing dots
      const normalizedBase = String(baseDomain || '').trim().replace(/^\.+|\.+$/g, '');
      const customRDNS = `${hyphenatedIP}.${normalizedBase}`;

      console.log(`${logPrefix} Setting up custom rDNS for ${primaryIPv4}: ${customRDNS}`);

      // Directly update the rDNS (same approach as manual editing)
      // No forward DNS check needed - Linode API handles this internally
      await this.updateIPAddressReverseDNS(primaryIPv4, customRDNS);

      console.log(`${logPrefix} Successfully set custom rDNS for VPS ${label} (${primaryIPv4}) to ${customRDNS}`);
    } catch (error) {
      console.error(`${logPrefix} Error setting up custom rDNS for VPS ${label}:`, error);
      // Don't throw the error - we don't want rDNS setup failure to affect anything else
      // The VPS is still functional without custom rDNS
    }
  }

  // ── IP Address Management ──

  async listAllIPs(page: number = 1, pageSize: number = 100): Promise<LinodeListIPsResponse> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/networking/ips?page=${page}&page_size=${pageSize}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return (await response.json()) as LinodeListIPsResponse;
    } catch (error) {
      console.error('Error listing IPs:', error);
      throw error;
    }
  }

  async getIPAddress(address: string): Promise<LinodeIPAddress> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/networking/ips/${encodeURIComponent(address)}`,
        { headers: this.getHeaders() }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return (await response.json()) as LinodeIPAddress;
    } catch (error) {
      console.error(`Error getting IP ${address}:`, error);
      throw error;
    }
  }

  async allocateIP(request: LinodeAllocateIPRequest): Promise<LinodeIPAddress> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/ips`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return (await response.json()) as LinodeIPAddress;
    } catch (error) {
      console.error('Error allocating IP:', error);
      throw error;
    }
  }

  async deleteIPAddress(instanceId: number, address: string): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/linode/instances/${instanceId}/ips/${encodeURIComponent(address)}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error deleting IP ${address}:`, error);
      throw error;
    }
  }

  async assignIPs(request: LinodeAssignIPsRequest): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/ips/assign`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error('Error assigning IPs:', error);
      throw error;
    }
  }

  async shareIPs(request: LinodeShareIPsRequest): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/ips/share`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error('Error sharing IPs:', error);
      throw error;
    }
  }

  // ── IPv6 Management ──

  async listIPv6Pools(): Promise<LinodeIPv6Pool[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const all: LinodeIPv6Pool[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await fetch(
          `${this.baseUrl}/networking/ipv6/pools?page=${page}&page_size=100`,
          { headers: this.getHeaders() }
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
        }

        const payload = await response.json();
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        all.push(...rows.map((r: any) => ({
          range: r.range,
          prefix: r.prefix ?? 0,
          region: r.region,
          route_target: r.route_target ?? null,
        })));

        totalPages = Number(payload?.pages ?? 1);
        if (!rows.length || page >= totalPages) break;
        page += 1;
      }

      return all;
    } catch (error) {
      console.error('Error listing IPv6 pools:', error);
      throw error;
    }
  }

  async listIPv6Ranges(): Promise<LinodeIPv6Range[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const all: LinodeIPv6Range[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await fetch(
          `${this.baseUrl}/networking/ipv6/ranges?page=${page}&page_size=100`,
          { headers: this.getHeaders() }
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
        }

        const payload = await response.json();
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        all.push(...rows.map((r: any) => ({
          range: r.range,
          prefix: r.prefix ?? 64,
          region: r.region,
          route_target: r.route_target ?? null,
          is_bgp: r.is_bgp ?? false,
          linodes: Array.isArray(r.linodes) ? r.linodes : [],
          created: r.created ?? '',
        })));

        totalPages = Number(payload?.pages ?? 1);
        if (!rows.length || page >= totalPages) break;
        page += 1;
      }

      return all;
    } catch (error) {
      console.error('Error listing IPv6 ranges:', error);
      throw error;
    }
  }

  async createIPv6Range(request: LinodeCreateIPv6RangeRequest): Promise<{ range: string; route_target: string }> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(`${this.baseUrl}/networking/ipv6/ranges`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }

      return (await response.json()) as { range: string; route_target: string };
    } catch (error) {
      console.error('Error creating IPv6 range:', error);
      throw error;
    }
  }

  async deleteIPv6Range(range: string): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/networking/ipv6/ranges/${encodeURIComponent(range)}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error deleting IPv6 range ${range}:`, error);
      throw error;
    }
  }

  // ── VLAN Management ──

  async listVLANs(): Promise<LinodeVLAN[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const all: LinodeVLAN[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await fetch(
          `${this.baseUrl}/networking/vlans?page=${page}&page_size=100`,
          { headers: this.getHeaders() }
        );

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
        }

        const payload = await response.json();
        const rows: any[] = Array.isArray(payload?.data) ? payload.data : [];
        all.push(...rows.map((r: any) => ({
          label: r.label,
          region: r.region,
          linodes: Array.isArray(r.linodes) ? r.linodes : [],
          created: r.created ?? '',
        })));

        totalPages = Number(payload?.pages ?? 1);
        if (!rows.length || page >= totalPages) break;
        page += 1;
      }

      return all;
    } catch (error) {
      console.error('Error listing VLANs:', error);
      throw error;
    }
  }

  async deleteVLAN(regionId: string, label: string): Promise<void> {
    try {
      if (!this.apiToken) {
        throw new Error('Linode API token not configured');
      }

      const response = await fetch(
        `${this.baseUrl}/networking/vlans/${encodeURIComponent(regionId)}/${encodeURIComponent(label)}`,
        { method: 'DELETE', headers: this.getHeaders() }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Linode API error: ${response.status} ${response.statusText} ${text}`.trim());
      }
    } catch (error) {
      console.error(`Error deleting VLAN ${label}:`, error);
      throw error;
    }
  }
}

export const linodeService = new LinodeService();
