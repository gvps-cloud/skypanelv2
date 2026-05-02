import { config } from '../config/index.js';

export class EnhanceApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: any
  ) {
    super(message);
    this.name = 'EnhanceApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export class EnhanceService {
  private static baseUrl(): string {
    const url = config.ENHANCE_API_URL.replace(/\/$/, '');
    return url.endsWith('/api') ? url : `${url}/api`;
  }

  private static async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const method = options.method || 'GET';

    if (config.NODE_ENV !== 'production') {
      console.log(`[EnhanceAPI] ${method} ${url}`);
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${config.ENHANCE_API_KEY.replace(/^Bearer\s+/i, '')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const responseText = await response.text();

    if (config.NODE_ENV !== 'production') {
      const bodyPreview = responseText.trim().slice(0, 500);
      console.log(`[EnhanceAPI] ${method} ${url} → ${response.status} (body ${responseText.length} chars)`);
      if (bodyPreview) {
        console.log(`[EnhanceAPI] Response preview:`, bodyPreview);
      }
    }

    const parseBody = () => {
      if (!responseText.trim()) return undefined;
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText;
      }
    };

    if (!response.ok) {
      const body = parseBody();
      throw new EnhanceApiError(
        `Enhance API error: ${response.status} ${response.statusText}`,
        response.status,
        body
      );
    }

    if (response.status === 204 || !responseText.trim()) {
      return undefined as T;
    }

    return parseBody() as T;
  }

  // ============================================================
  // Connectivity / Org
  // ============================================================
  static async getOrg(orgId: string) {
    return this.request<any>(`/orgs/${orgId}`);
  }

  static async getOrgLogins(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/logins`);
  }

  static async getOrgMembers(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/members`);
  }

  static async createOrgMember(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/members`, {
      method: 'POST',
      body: data,
    });
  }

  static async updateOrgOwner(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/owner`, {
      method: 'PUT',
      body: data,
    });
  }

  static async getServerGroups(_orgId?: string) {
    // Enhance API: /servers/groups is a global endpoint (not org-scoped)
    const response = await this.request<any>(`/servers/groups`);
    return Array.isArray(response) ? response : (response?.items ?? []);
  }

  // ============================================================
  // DNS Nameservers
  // ============================================================

  /**
   * Get DNS nameserver info: returns the DNS pool IPs (from /v2/servers/dns_pool)
   * and server hostnames/IPs for servers with the DNS role (from /servers).
   */
  static async getDnsNameservers(): Promise<{ ips: string[]; servers: { hostname: string; ips: string[] }[] }> {
    // Fetch both in parallel
    const [dnsPoolIps, serversResponse] = await Promise.all([
      this.request<string[]>(`/v2/servers/dns_pool`).catch(() => []),
      this.request<{ items?: any[]; total?: number } | any[]>(`/servers`),
    ]);

    const ips: string[] = Array.isArray(dnsPoolIps) ? dnsPoolIps : [];

    // Normalize servers response
    const serverList = Array.isArray(serversResponse)
      ? serversResponse
      : serversResponse?.items ?? [];

    // Filter to servers that have the DNS role enabled
    const dnsServers = serverList
      .filter((s: any) => s.roles?.dns === 'enabled' || s.roles?.dns?.state === 'enabled')
      .map((s: any) => ({
        hostname: s.hostname || '',
        ips: (Array.isArray(s.ips) ? s.ips : [])
          .filter((ip: any) => ip.isPrimary || true) // include all IPs
          .map((ip: any) => typeof ip === 'string' ? ip : ip.ip),
      }));

    return { ips, servers: dnsServers };
  }

  // ============================================================
  // Staging Domains
  // ============================================================
  static async getStagingDomain(orgId: string): Promise<string | null> {
    try {
      const result = await this.request<{ domain?: string }>(`/orgs/${orgId}/staging-domain`);
      return typeof result?.domain === 'string' && result.domain.trim().length > 0
        ? result.domain.trim()
        : null;
    } catch (error) {
      // 404 means staging domain has not been set
      if (error instanceof EnhanceApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ============================================================
  // Logins
  // ============================================================
  static async getLogins(options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (typeof options?.limit === 'number') {
      params.set('limit', String(options.limit));
    }
    if (typeof options?.offset === 'number') {
      params.set('offset', String(options.offset));
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/logins${suffix}`);
  }

  static async createLogin(orgId: string, data: any) {
    const params = new URLSearchParams({ orgId });
    return this.request<any>(`/logins?${params.toString()}`, {
      method: 'POST',
      body: data,
    });
  }

  static async getPlans(orgId: string, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (typeof options?.limit === 'number') {
      params.set('limit', String(options.limit));
    }
    if (typeof options?.offset === 'number') {
      params.set('offset', String(options.offset));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/orgs/${orgId}/plans${suffix}`);
  }

  static async getAllPlans(orgId: string): Promise<any[]> {
    const allPlans: any[] = [];
    const limit = 100;
    let offset = 0;

    while (true) {
      const response = await this.getPlans(orgId, { limit, offset });
      const items = Array.isArray(response) ? response : response?.items || [];
      allPlans.push(...items);

      const total = typeof response?.total === 'number' ? response.total : items.length;
      offset += items.length;

      if (items.length === 0 || offset >= total) {
        break;
      }
    }

    return allPlans;
  }

  // ============================================================
  // Customers
  // ============================================================
  static async getOrgCustomers(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/customers`);
  }

  static async createCustomer(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/customers`, { method: 'POST', body: data });
  }

  // ============================================================
  // Customer Subscriptions
  // ============================================================
  static async getCustomerSubscriptions(orgId: string, customerOrgId: string) {
    return this.request<any>(`/orgs/${orgId}/customers/${customerOrgId}/subscriptions`);
  }

  static async createCustomerSubscription(orgId: string, customerOrgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/customers/${customerOrgId}/subscriptions`, {
      method: 'POST',
      body: data,
    });
  }

  static async getSubscription(orgId: string, subscriptionId: string) {
    return this.request<any>(`/orgs/${orgId}/subscriptions/${subscriptionId}`);
  }

  static async updateSubscription(orgId: string, subscriptionId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: data,
    });
  }

  static async deleteSubscription(orgId: string, subscriptionId: string) {
    return this.request<void>(`/orgs/${orgId}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // Website Lifecycle
  // ============================================================
  static async getWebsites(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/websites`);
  }

  static async createWebsite(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites`, { method: 'POST', body: data });
  }

  static async getWebsite(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}`);
  }

  static async updateWebsite(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteWebsite(orgId: string, websiteId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}`, { method: 'DELETE' });
  }

  static async getInstallableApps(orgId: string, subscriptionId: string | number) {
    return this.request<any>(`/orgs/${orgId}/subscriptions/${subscriptionId}/installable-apps`);
  }

  // ============================================================
  // Domain Mappings
  // ============================================================
  static async getWebsiteDomainMappings(orgId: string, websiteId: string, options?: { withSsl?: boolean }) {
    const params = options?.withSsl ? '?withSsl=true' : '';
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains${params}`);
  }

  static async createWebsiteMappedDomain(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains`, {
      method: 'POST',
      body: data,
    });
  }

  static async getWebsiteDomainMapping(orgId: string, websiteId: string, domainId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}`);
  }

  static async updateWebsiteDomainMapping(orgId: string, websiteId: string, domainId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteWebsiteDomainMapping(orgId: string, websiteId: string, domainId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}`, {
      method: 'DELETE',
    });
  }

  static async updateWebsitePrimaryDomain(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/primary`, {
      method: 'PUT',
      body: data,
    });
  }

  // ============================================================
  // DNS
  // ============================================================
  static async getWebsiteDomainDnsZone(orgId: string, websiteId: string, domainId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone`);
  }

  static async updateWebsiteDomainDnsZone(orgId: string, websiteId: string, domainId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async createWebsiteDomainDnsZoneRecord(orgId: string, websiteId: string, domainId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records`, {
      method: 'POST',
      body: data,
    });
  }

  static async updateWebsiteDomainDnsZoneRecord(orgId: string, websiteId: string, domainId: string, recordId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records/${recordId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteWebsiteDomainDnsZoneRecord(orgId: string, websiteId: string, domainId: string, recordId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records/${recordId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // Email
  // ============================================================
  static async getWebsiteEmails(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails`);
  }

  static async createWebsiteEmail(orgId: string, websiteId: string, domainId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/emails`, {
      method: 'POST',
      body: data,
    });
  }

  static async getWebsiteEmail(orgId: string, websiteId: string, emailAddress: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}`);
  }

  static async updateWebsiteEmail(orgId: string, websiteId: string, emailAddress: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteWebsiteEmail(orgId: string, websiteId: string, emailAddress: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}`, {
      method: 'DELETE',
    });
  }

  static async getWebsiteEmailClientConf(orgId: string, websiteId: string, emailAddress: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}/client-conf`);
  }

  static async createWebsiteEmailAutoresponder(orgId: string, websiteId: string, emailAddress: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}/autoresponder`, {
      method: 'POST',
      body: data,
    });
  }

  static async deleteWebsiteEmailAutoresponder(orgId: string, websiteId: string, emailAddress: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}/autoresponder`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // PHP
  // ============================================================
  static async getWebsiteLsphpSettings(websiteId: string) {
    return this.request<any>(`/websites/${websiteId}/lsphp_settings`);
  }

  static async setWebsiteLsphpSettings(websiteId: string, data: any) {
    return this.request<any>(`/websites/${websiteId}/lsphp_settings`, {
      method: 'PUT',
      body: data,
    });
  }

  static async restartWebsitePhp(websiteId: string) {
    return this.request<any>(`/v2/websites/${websiteId}/restart_php`, {
      method: 'POST',
    });
  }

  static async getWebsitePhpErrorLog(websiteId: string) {
    return this.request<string>(`/websites/${websiteId}/php_error_log`);
  }

  static async getWebsiteEnabledPhpExtensions(websiteId: string) {
    return this.request<string[]>(`/websites/${websiteId}/php_extensions`);
  }

  static async getWebsiteAvailablePhpExtensions(websiteId: string) {
    return this.request<string[]>(`/websites/${websiteId}/available_php_extensions`);
  }

  static async getBuiltInPhpExtensions(websiteId: string) {
    return this.request<string[]>(`/websites/${websiteId}/built_in_php_extensions`);
  }

  static async enableWebsitePhpExtension(websiteId: string, name: string) {
    return this.request<any>(`/websites/${websiteId}/php_extensions`, {
      method: 'POST',
      body: name,
    });
  }

  static async disableWebsitePhpExtension(websiteId: string, name: string) {
    return this.request<any>(`/websites/${websiteId}/php_extensions`, {
      method: 'DELETE',
      body: name,
    });
  }

  static async getWebsiteSetting(orgId: string, websiteId: string, kind: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/settings/${kind}`);
  }

  static async setWebsiteSetting(orgId: string, websiteId: string, kind: string, key: string, value: any) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/settings/${kind}/${key}`, {
      method: 'PUT',
      body: value,
    });
  }

  static async deleteWebsiteSetting(orgId: string, websiteId: string, kind: string, key: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/settings/${kind}/${key}`, {
      method: 'DELETE',
    });
  }

  static async getWebsiteIoncubeStatus(websiteId: string) {
    return this.request<boolean>(`/v2/websites/${websiteId}/ioncube`);
  }

  static async setWebsiteIoncubeStatus(websiteId: string, enabled: boolean) {
    return this.request<any>(`/v2/websites/${websiteId}/ioncube`, {
      method: 'PUT',
      body: enabled,
    });
  }

  static async getWebsiteRedisState(websiteId: string) {
    return this.request<boolean>(`/v2/websites/${websiteId}/redis`);
  }

  static async setWebsiteRedisState(websiteId: string, enabled: boolean) {
    return this.request<any>(`/v2/websites/${websiteId}/redis`, {
      method: 'PUT',
      body: enabled,
    });
  }

  static async getWebsiteMetrics(orgId: string, websiteId: string, params?: { start?: string; end?: string; granularity?: string }) {
    const qs = new URLSearchParams();
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    if (params?.granularity) qs.set('granularity', params.granularity);
    const query = qs.toString();
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/metrics${query ? '?' + query : ''}`);
  }

  static async getDomainNginxFastCgi(domainId: string) {
    return this.request<boolean>(`/v2/domains/${domainId}/nginx_fastcgi`);
  }

  static async setDomainNginxFastCgi(domainId: string, enabled: boolean) {
    return this.request<any>(`/v2/domains/${domainId}/nginx_fastcgi`, {
      method: 'PUT',
      body: enabled,
    });
  }

  static async clearDomainNginxFastCgi(domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/nginx_fastcgi`, {
      method: 'DELETE',
    });
  }

  static async getDomainNginxFastCgiExcludedPaths(domainId: string) {
    return this.request<string[]>(`/v2/domains/${domainId}/nginx_fastcgi_excluded_paths`);
  }

  static async addDomainNginxFastCgiExcludedPath(domainId: string, path: string) {
    return this.request<any>(`/v2/domains/${domainId}/nginx_fastcgi_excluded_paths`, {
      method: 'POST',
      body: path,
    });
  }

  static async deleteDomainNginxFastCgiExcludedPath(domainId: string, path: string) {
    return this.request<any>(`/v2/domains/${domainId}/nginx_fastcgi_excluded_paths?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  }

  static async getWebsiteHtaccessRewrites(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/htaccess`);
  }

  static async updateWebsiteHtaccessRewrites(orgId: string, websiteId: string, data: any) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/htaccess`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async getWebsiteHtaccessIpsRule(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/htaccess/ips`);
  }

  static async updateWebsiteHtaccessIpsRule(orgId: string, websiteId: string, data: any) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/htaccess/ips`, {
      method: 'PUT',
      body: data,
    });
  }

  static async getDomainWebserverRewrites(domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/webserver_rewrites`);
  }

  static async setDomainWebserverRewrite(domainId: string, data: any) {
    return this.request<any>(`/v2/domains/${domainId}/webserver_rewrites`, {
      method: 'PUT',
      body: data,
    });
  }

  static async deleteDomainWebserverRewrite(domainId: string, path: string) {
    return this.request<any>(`/v2/domains/${domainId}/webserver_rewrites?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // Node / Apps
  // ============================================================
  static async getWebsiteApps(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps`);
  }

  static async createWebsiteApp(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps`, {
      method: 'POST',
      body: data,
    });
  }

  static async deleteWebsiteApp(orgId: string, websiteId: string, appId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}`, {
      method: 'DELETE',
    });
  }

  static async createWebsitePersistentApp(websiteId: string, data: any) {
    return this.request<any>(`/websites/${websiteId}/apps/persistent`, {
      method: 'POST',
      body: data,
    });
  }

  static async getWebsitePersistentApps(websiteId: string) {
    return this.request<any>(`/websites/${websiteId}/apps/persistent`);
  }

  static async updateWebsitePersistentApp(websiteId: string, appId: string, data: any) {
    return this.request<any>(`/websites/${websiteId}/apps/persistent/${appId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async getWebsitePersistentAppLog(websiteId: string, appId: string) {
    return this.request<any>(`/websites/${websiteId}/apps/persistent/${appId}`);
  }

  static async deleteWebsitePersistentApp(websiteId: string, appId: string) {
    return this.request<void>(`/websites/${websiteId}/apps/persistent/${appId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // WordPress
  // ============================================================
  static async getWordpressInstallations(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/wordpress`);
  }

  static async getWordpressSettings(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress`);
  }

  static async updateWordpressSettings(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async updateWordpressAppVersion(orgId: string, websiteId: string, appId: string, _data?: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/version`, {
      method: 'PATCH',
    });
  }

  static async getWordpressAppVersion(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/version`);
  }

  static async getWordpressUsers(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users`);
  }

  static async createWordpressUser(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users`, {
      method: 'POST',
      body: data,
    });
  }

  static async updateWordpressUser(orgId: string, websiteId: string, appId: string, userId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users/${userId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteWordpressUser(orgId: string, websiteId: string, appId: string, userId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users/${userId}`, {
      method: 'DELETE',
    });
  }

  static async getWordpressUserSsoUrl(orgId: string, websiteId: string, appId: string, userId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users/${userId}/sso`);
  }

  static async getWordpressConfig(orgId: string, websiteId: string, appId: string, wpOption: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/wp-config/${encodeURIComponent(wpOption)}`);
  }

  static async setWordpressConfig(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/wp-config`, {
      method: 'PUT',
      body: data,
    });
  }

  static async getWordpressPlugins(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/plugins`);
  }

  static async installWordpressPlugin(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/plugins`, {
      method: 'POST',
      body: data,
    });
  }

  static async deleteWordpressPlugin(orgId: string, websiteId: string, appId: string, pluginId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/plugins/${pluginId}`, {
      method: 'DELETE',
    });
  }

  static async getWordpressThemes(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes`);
  }

  static async installWordpressTheme(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes`, {
      method: 'POST',
      body: data,
    });
  }

  static async deleteWordpressTheme(orgId: string, websiteId: string, appId: string, themeId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes/${themeId}`, {
      method: 'DELETE',
    });
  }

  static async updateWordpressTheme(orgId: string, websiteId: string, appId: string, themeId: string, _data?: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes/${encodeURIComponent(themeId)}/update`, {
      method: 'POST',
    });
  }

  static async activateWordpressTheme(orgId: string, websiteId: string, appId: string, themeId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes/${themeId}/activate`, {
      method: 'POST',
    });
  }

  // ============================================================
  // MySQL
  // ============================================================
  static async getWebsiteMysqlDbs(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs`);
  }

  static async createWebsiteMysqlDb(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs`, { method: 'POST', body: data });
  }

  static async getWebsiteMysqlDb(orgId: string, websiteId: string, dbName: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs/${encodeURIComponent(dbName)}`);
  }

  static async deleteWebsiteMysqlDb(orgId: string, websiteId: string, dbName: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs/${encodeURIComponent(dbName)}`, { method: 'DELETE' });
  }

  static async getWebsiteMysqlDbSso(orgId: string, websiteId: string, dbName: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs/${encodeURIComponent(dbName)}/sso`);
  }

  static async downloadWebsiteMysqlSql(orgId: string, websiteId: string, dbName: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-dbs/${encodeURIComponent(dbName)}/sql`);
  }

  static async getWebsiteMysqlUsers(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-users`);
  }

  static async createWebsiteMysqlUser(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-users`, { method: 'POST', body: data });
  }

  static async updateWebsiteMysqlUser(orgId: string, websiteId: string, username: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-users/${encodeURIComponent(username)}`, { method: 'PUT', body: data });
  }

  static async deleteWebsiteMysqlUser(orgId: string, websiteId: string, username: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/mysql-users/${encodeURIComponent(username)}`, { method: 'DELETE' });
  }

  static async updateWebsiteMysqlUserPrivileges(orgId: string, websiteId: string, username: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-users/${encodeURIComponent(username)}/privileges`, { method: 'PUT', body: data });
  }

  static async createWebsiteMysqlUserAccessHosts(orgId: string, websiteId: string, username: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/mysql-users/${encodeURIComponent(username)}/access-hosts`, { method: 'POST', body: data });
  }

  static async deleteWebsiteMysqlUserAccessHosts(orgId: string, websiteId: string, username: string, data: any) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/mysql-users/${encodeURIComponent(username)}/access-hosts`, { method: 'DELETE', body: data });
  }

  // ============================================================
  // FTP
  // ============================================================
  static async getWebsiteFtpUsers(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ftp/users`);
  }

  static async createWebsiteFtpUser(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ftp/users`, { method: 'POST', body: data });
  }

  static async getWebsiteFtpUser(orgId: string, websiteId: string, username: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ftp/users/${encodeURIComponent(username)}`);
  }

  static async updateWebsiteFtpUser(orgId: string, websiteId: string, username: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ftp/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: data });
  }

  static async deleteWebsiteFtpUser(orgId: string, websiteId: string, username: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/ftp/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
  }

  // ============================================================
  // SSL
  // ============================================================
  static async createWebsiteDomainLetsencryptCerts(_orgId: string, _websiteId: string, domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/letsencrypt`, { method: 'POST' });
  }

  static async createWebsiteMailDomainLetsencryptCerts(_orgId: string, _websiteId: string, domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/letsencrypt_mail`, { method: 'POST' });
  }

  static async getWebsiteDomainSsl(_orgId: string, _websiteId: string, domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/ssl`);
  }

  static async uploadWebsiteDomainSsl(_orgId: string, _websiteId: string, domainId: string, data: any) {
    return this.request<any>(`/v2/domains/${domainId}/ssl`, { method: 'POST', body: data });
  }

  static async getWebsiteDomainMailSsl(_orgId: string, _websiteId: string, domainId: string) {
    return this.request<any>(`/v2/domains/${domainId}/mail_ssl`);
  }

  static async setWebsiteDomainForceSsl(_orgId: string, _websiteId: string, domainId: string, enabled: boolean) {
    return this.request<any>(`/v2/domains/${domainId}/ssl/force_ssl`, { method: 'PUT', body: enabled });
  }

  // ============================================================
  // SSO
  // ============================================================
  static async getMemberSsoLink(orgId: string, memberId: string) {
    return this.request<string>(`/orgs/${orgId}/members/${memberId}/sso`, { method: 'GET' });
  }

  // ============================================================
  // Backups
  // ============================================================
  static async getWebsiteBackups(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/backups`);
  }

  static async backupWebsite(orgId: string, websiteId: string, data?: { includeEmails?: boolean; [key: string]: any }) {
    const { includeEmails, ...body } = data ?? {};
    const params = typeof includeEmails === 'boolean' ? `?includeEmails=${includeEmails ? 'true' : 'false'}` : '';
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/backups${params}`, {
      method: 'POST',
      body,
    });
  }

  static async getWebsiteBackup(orgId: string, websiteId: string, backupId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/backups/${backupId}`);
  }

  static async restoreWebsiteBackup(orgId: string, websiteId: string, backupId: string, data?: any) {
    const { includeEmails, ...body } = data ?? {};
    const params = typeof includeEmails === 'boolean' ? `?includeEmails=${includeEmails ? 'true' : 'false'}` : '';
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/backups/${backupId}${params}`, {
      method: 'PUT',
      body,
    });
  }

  static async deleteWebsiteBackup(orgId: string, websiteId: string, backupId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/backups/${backupId}`, {
      method: 'DELETE',
    });
  }

  static async getWebsiteBackupStatus(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/status/backup`);
  }

  static async getBackupsDisabled(websiteId: string) {
    return this.request<any>(`/websites/${websiteId}/backups_disabled`);
  }

  static async setBackupsDisabled(websiteId: string, disabled: boolean) {
    return this.request<any>(`/websites/${websiteId}/backups_disabled`, {
      method: 'PUT',
      body: disabled,
    });
  }

  // ============================================================
  // Cron
  // ============================================================
  static async getCrontab(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/crontab`);
  }

  static async updateCrontab(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/crontab`, {
      method: 'PATCH',
      body: data,
    });
  }

  static async deleteCrontab(orgId: string, websiteId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/crontab`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // SSH Keys (per-website)
  // ============================================================
  static async getWebsiteSshKeys(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ssh/keys`);
  }

  static async createWebsiteSshKey(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/ssh/keys`, {
      method: 'POST',
      body: data,
    });
  }

  static async deleteWebsiteSshKey(orgId: string, websiteId: string, keyId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}/ssh/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================
  // Bandwidth
  // ============================================================
  static async getSubscriptionBandwidth(orgId: string, subscriptionId: string | number) {
    return this.request<any>(`/orgs/${orgId}/subscriptions/${subscriptionId}/bandwidth`);
  }

  // ============================================================
  // Org Verification
  // ============================================================
  static async orgExists(orgId: string): Promise<boolean> {
    try {
      await this.getOrg(orgId);
      return true;
    } catch (error) {
      if (error instanceof EnhanceApiError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
