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
    return config.ENHANCE_API_URL.replace(/\/$/, '');
  }

  private static async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${config.ENHANCE_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let body: any;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      throw new EnhanceApiError(
        `Enhance API error: ${response.status} ${response.statusText}`,
        response.status,
        body
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // ============================================================
  // Connectivity / Org
  // ============================================================
  static async getOrg(orgId: string) {
    return this.request<any>(`/orgs/${orgId}`);
  }

  static async getServerGroups(orgId: string) {
    return this.request<any>(`/orgs/${orgId}/servers/groups`);
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

  static async createWebsite(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites`, { method: 'POST', body: data });
  }

  static async getWebsite(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}`);
  }

  static async updateWebsite(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}`, {
      method: 'PUT',
      body: data,
    });
  }

  static async deleteWebsite(orgId: string, websiteId: string) {
    return this.request<void>(`/orgs/${orgId}/websites/${websiteId}`, { method: 'DELETE' });
  }

  // ============================================================
  // Domain Mappings
  // ============================================================
  static async getWebsiteDomainMappings(orgId: string, websiteId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/domains`);
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

  static async createWebsiteEmail(orgId: string, websiteId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails`, {
      method: 'POST',
      body: data,
    });
  }

  static async getWebsiteEmail(orgId: string, websiteId: string, emailAddress: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}`);
  }

  static async updateWebsiteEmail(orgId: string, websiteId: string, emailAddress: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(emailAddress)}`, {
      method: 'PUT',
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
      method: 'PUT',
      body: data,
    });
  }

  static async updateWordpressAppVersion(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/version`, {
      method: 'PUT',
      body: data,
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
      method: 'PUT',
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

  static async getWordpressConfig(orgId: string, websiteId: string, appId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/config`);
  }

  static async setWordpressConfig(orgId: string, websiteId: string, appId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/config`, {
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

  static async updateWordpressTheme(orgId: string, websiteId: string, appId: string, themeId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes/${themeId}`, {
      method: 'PUT',
      body: data,
    });
  }

  static async activateWordpressTheme(orgId: string, websiteId: string, appId: string, themeId: string) {
    return this.request<any>(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/themes/${themeId}/activate`, {
      method: 'POST',
    });
  }
}
