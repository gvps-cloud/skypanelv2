import { pool } from '../lib/database.js';
import axios, { AxiosInstance } from 'axios';

// --- Types ---

export interface EnhanceConfig {
    id: string;
    name: string;
    api_url: string;
    org_id: string;
    api_key: string;
}

export interface EnhancePlan {
    id: string; // Internal DB ID
    enhance_plan_id: string;
    name: string;
    service_type: 'web' | 'email' | 'wordpress' | 'node';
    price_monthly: number;
}

export interface EnhanceInstance {
    id: string; // Internal DB Subscription ID
    enhance_website_id: string;
    domain: string;
    status: string;
}

export interface NodeApp {
    id: string;
    path: string;
    version: string;
    status: 'running' | 'stopped';
    env: Record<string, string>;
    startupFile: string;
}

export interface PhpSettings {
    version: string;
    displayErrors: boolean;
    memoryLimit: string;
    extensions: string[];
}

// --- Service Class ---

export class EnhanceService {
    private client: AxiosInstance | null = null;
    private config: EnhanceConfig | null = null;

    /**
     * Initialize or Refresh API Client from DB Config
     */
    private async getClient(): Promise<AxiosInstance> {
        if (this.client) return this.client;

        const res = await pool.query('SELECT * FROM enhance_config WHERE is_active = true LIMIT 1');
        if (res.rows.length === 0) throw new Error('Enhance integration not configured');

        this.config = res.rows[0];

        // Decrypt key if we implemented encryption (assuming raw for now as per migration)
        const apiKey = this.config!.api_key;

        this.client = axios.create({
            baseURL: this.config!.api_url,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        return this.client;
    }

    // --- Core Methods ---

    /**
     * Validate credentials by fetching the Organization profile
     */
    async validateCredentials(url: string, orgId: string, key: string): Promise<boolean> {
        try {
            const tempClient = axios.create({
                baseURL: url,
                headers: { 'Authorization': `Bearer ${key}` }
            });
            // Check Org Access
            await tempClient.get(`/orgs/${orgId}`);

            // Check Permissions (List Plans) - Ensure it's a Reseller/Admin key
            await tempClient.get(`/orgs/${orgId}/plans?limit=1`);

            return true;
        } catch (err) {
            console.error('Enhance Validation Failed:', err);
            return false;
        }
    }

    /**
     * Sync Plans from Enhance to DB
     */
    async syncPlans(): Promise<void> {
        const client = await this.getClient();
        const configId = this.config!.id;
        const orgId = this.config!.org_id;

        const { data: plans } = await client.get(`/orgs/${orgId}/plans`); // Verify endpoint

        // Simplistic sync: upsert
        for (const plan of plans.items || plans) {
            await pool.query(`
        INSERT INTO hosting_plans (enhance_plan_id, enhance_config_id, name, service_type)
        VALUES ($1, $2, $3, 'web') -- Defaulting to 'web', admin can categorized later
        ON CONFLICT (enhance_plan_id, enhance_config_id) 
        DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      `, [plan.id, configId, plan.name]);
        }
    }

    /**
     * Get available server groups from Enhance.
     */
    async getServerGroups(): Promise<any[]> {
        const client = await this.getClient();
        try {
            // Try fetching server groups. Note: Docs say Master Org only, but worth trying as Reseller usually has visibility of what they sell.
            // If this fails, we might need to rely on manual config or plan details.
            const res = await client.get('/servers/groups');
            // The response schema is { items: [...] } or []
            return res.data.items || res.data || [];
        } catch (err) {
            console.warn('Failed to fetch server groups (likely insufficient permissions):', err);
            return [];
        }
    }

    /**
     * Provision a new Subscription (Create Customer -> Create Subscription -> Create Website)
     */
    async provisionSubscription(userId: string, planId: string, domain: string, serverGroupId?: string): Promise<string> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;

        // 1. Get Plan Details
        const planRes = await pool.query('SELECT * FROM hosting_plans WHERE id = $1', [planId]);
        if (planRes.rows.length === 0) throw new Error('Invalid Plan');
        const plan = planRes.rows[0];

        // 2. Get User Details
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        // 3. Create/Find Customer in Enhance
        let customerId;
        try {
            // Try to find by email
            const search = await client.get(`/orgs/${orgId}/customers?search=${encodeURIComponent(user.email)}`);
            if (search.data.items && search.data.items.length > 0) {
                customerId = search.data.items[0].id;
            } else {
                const create = await client.post(`/orgs/${orgId}/customers`, {
                    email: user.email,
                    name: user.name,
                    password: 'GeneratedSecurePass123!', // Should be random or handled by email invite
                });
                customerId = create.data.id;
            }
        } catch (err) {
            console.error('Customer Prov Error', err);
            throw new Error('Failed to provision customer on hosting cluster');
        }

        // 4. Create Subscription
        let subscriptionId;
        try {
            const subRes = await client.post(`/orgs/${orgId}/customers/${customerId}/subscriptions`, {
                planId: parseInt(plan.enhance_plan_id), // Ensure integer
            });
            subscriptionId = subRes.data.id;
        } catch (err) {
            console.error('Subscription Prov Error', err);
            throw new Error('Failed to create subscription');
        }

        // 5. Create Website (Attached to Subscription)
        try {
            const payload: any = {
                domain: domain,
                subscriptionId: subscriptionId,
            };

            if (serverGroupId) {
                payload.serverGroupId = serverGroupId;
            }

            // Create website under the CUSTOMER'S organization context
            const webRes = await client.post(`/orgs/${customerId}/websites`, payload);

            const websiteId = webRes.data.id;

            // 6. Store in DB
            // Note: We authenticate as Reseller, so we own the customer & sub.
            // enhance_website_id is the website UUID.
            await pool.query(`
        INSERT INTO hosting_subscriptions 
        (user_id, organization_id, plan_id, enhance_website_id, enhance_customer_id, domain, status)
        VALUES ($1, (SELECT organization_id FROM organization_members WHERE user_id = $1 AND role = 'owner' LIMIT 1), $2, $3, $4, $5, 'active')
      `, [userId, planId, websiteId, customerId, domain]);

            return websiteId;

        } catch (err) {
            console.error('Website Prov Error', err);
            throw new Error('Failed to provision website');
        }
    }

    // --- Node.js Module ---

    async createNodeApp(websiteId: string, version: string, entryPoint: string): Promise<void> {
        const client = await this.getClient();
        // Assuming endpoint based on previous research: /websites/{id}/apps/node
        await client.post(`/websites/${websiteId}/apps/node`, {
            version: version,
            entryPoint: entryPoint,
            env: { "NODE_ENV": "production" }
        });
    }

    async getNodeApp(websiteId: string): Promise<any> {
        const client = await this.getClient();
        const res = await client.get(`/websites/${websiteId}/apps/node`);
        return res.data;
    }

    async restartNodeApp(websiteId: string): Promise<void> {
        const client = await this.getClient();
        await client.post(`/websites/${websiteId}/apps/node/restart`);
    }

    async runNpmInstall(websiteId: string): Promise<void> {
        const client = await this.getClient();
        await client.post(`/websites/${websiteId}/apps/node/npm_install`);
    }

    // --- PHP Module ---

    async getPhpSettings(websiteId: string): Promise<any> {
        const client = await this.getClient();
        const res = await client.get(`/websites/${websiteId}/lsphp_settings`);
        return res.data;
    }

    async updatePhpVersion(websiteId: string, version: string): Promise<void> {
        const client = await this.getClient();
        // Logic to update PHP version often involves getting current settings and patching one field
        // Or a specific endpoint exists. Assuming update endpoint:
        await client.put(`/websites/${websiteId}/lsphp_settings`, {
            phpVersion: version
        });
    }

    async restartPhp(websiteId: string): Promise<void> {
        const client = await this.getClient();
        await client.post(`/websites/${websiteId}/restart_php`);
    }

    // --- Email Module ---

    async listEmailAccounts(websiteId: string): Promise<any[]> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;
        // Endpoint: /orgs/{org_id}/websites/{website_id}/emails
        const res = await client.get(`/orgs/${orgId}/websites/${websiteId}/emails`);
        return res.data.items || res.data;
    }

    async createEmailAccount(websiteId: string, address: string, password: string, quota: number = 1024): Promise<void> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;
        await client.post(`/orgs/${orgId}/websites/${websiteId}/emails`, {
            email: address, // full address or local part depending on API, assuming full
            password: password,
            quota: quota // MB
        });
    }

    async deleteEmailAccount(websiteId: string, address: string): Promise<void> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;
        await client.delete(`/orgs/${orgId}/websites/${websiteId}/emails/${encodeURIComponent(address)}`);
    }

    // --- DNS Module ---

    async getZoneRecords(websiteId: string): Promise<any[]> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;
        // We need domain_id first usually.
        // For now assuming we list domains then get records, OR user provides domainId.
        // Let's implement a helper to get primary domain ID for a website.
        // SIMPLIFICATION: Assuming single domain per website for MVP
        const domains = await client.get(`/orgs/${orgId}/websites/${websiteId}/domains`);
        if (!domains.data.items?.length) return [];

        const domainId = domains.data.items[0].id;

        // /orgs/{org_id}/websites/{website_id}/domains/{domain_id}/dns-zone/records
        const res = await client.get(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records`);
        return res.data.items || res.data;
    }

    async addDnsRecord(websiteId: string, record: any): Promise<void> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;

        const domains = await client.get(`/orgs/${orgId}/websites/${websiteId}/domains`);
        if (!domains.data.items?.length) throw new Error('No domain found');
        const domainId = domains.data.items[0].id;

        await client.post(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records`, record);
    }

    async deleteDnsRecord(websiteId: string, recordId: string): Promise<void> {
        const client = await this.getClient();
        const orgId = this.config!.org_id;

        const domains = await client.get(`/orgs/${orgId}/websites/${websiteId}/domains`);
        const domainId = domains.data.items[0].id;

        await client.delete(`/orgs/${orgId}/websites/${websiteId}/domains/${domainId}/dns-zone/records/${recordId}`);
    }

    // --- Wordpress Module ---

    async installWordpress(websiteId: string, title: string, adminUser: string): Promise<void> {
        const client = await this.getClient();
        // Endpoint likely /websites/{id}/apps/wordpress/install or similar.
        // Based on previous grep: /websites/{website_id}/apps/wordpress
        await client.post(`/websites/${websiteId}/apps/wordpress`, {
            title: title,
            admin_user: adminUser,
        });
    }

    async getWordpressSso(websiteId: string): Promise<string> {
        const client = await this.getClient();
        // Need App ID. 
        const apps = await client.get(`/websites/${websiteId}/apps/wordpress`);
        if (!apps.data.items?.length) throw new Error('WP not installed');

        const appId = apps.data.items[0].id;
        const orgId = this.config!.org_id;
        const userRes = await client.get(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users`);
        const userId = userRes.data.items[0].id; // First user

        const res = await client.get(`/orgs/${orgId}/websites/${websiteId}/apps/${appId}/wordpress/users/${userId}/sso`);
        return res.data.url;
    }
}

export const enhanceService = new EnhanceService();

