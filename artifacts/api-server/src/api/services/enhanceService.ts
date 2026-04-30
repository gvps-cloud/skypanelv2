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
    return config.ENHANCE_API_URL.replace(/\/$/, '') + '/api';
  }

  private static async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${config.ENHANCE_API_KEY.replace(/^Bearer\s+/i, '')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseText = await response.text();
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
    return this.request<any>(`/servers/groups`);
  }

  // ============================================================
  // Staging Domains
  // ============================================================
  static async setStagingDomain(orgId: string, domain: string): Promise<void> {
    await this.request<void>(`/orgs/${orgId}/staging-domain`, {
      method: 'POST',
      body: { domain },
    });
  }

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

  static async getPlans(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/plans`);
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

  static async createWebsite(orgId: string, data: any, kind?: string) {
    const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
    return this.request<any>(`/orgs/${orgId}/websites${qs}`, { method: 'POST', body: data });
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
      method: 'PUT',
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
      method: 'PUT',
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
      method: 'PUT',
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
      method: 'PUT',
      body: data,
    });
  }

  static async getWebsitePersistentAppLog(websiteId: string, appId: string) {
    return this.request<any>(`/websites/${websiteId}/apps/persistent/${appId}/log`);
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
    return this.request<any>(`/v2/domains/${domainId}/ssl/force_ssl`, { method: 'PUT', body: { enabled } });
  }
}
