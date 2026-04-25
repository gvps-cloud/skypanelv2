import { config } from '../config/index.js';
import { query } from '../lib/database.js';
import { logActivity } from './activityLogger.js';

export interface EnhanceStatus {
  hardEnabled: boolean;
  envConfigured: boolean;
  missingEnv: string[];
  runtimeEnabled: boolean;
  effectiveEnabled: boolean;
  lastHealthCheckAt: string | null;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
}

export class EnhanceToggleService {
  static async getStatus(): Promise<EnhanceStatus> {
    const hardEnabled = config.ENHANCE_ENABLED;
    const missingEnv = this.getMissingEnvVars();
    const envConfigured = missingEnv.length === 0;

    const runtimeResult = await query(
      `SELECT enabled, last_health_check_at, last_health_status, last_health_message
       FROM platform_integrations WHERE slug = 'enhance'`
    );

    const runtimeRow = runtimeResult.rows[0];
    const runtimeEnabled = runtimeRow?.enabled === true;

    return {
      hardEnabled,
      envConfigured,
      missingEnv,
      runtimeEnabled,
      effectiveEnabled: hardEnabled && envConfigured && runtimeEnabled,
      lastHealthCheckAt: runtimeRow?.last_health_check_at ?? null,
      lastHealthStatus: runtimeRow?.last_health_status ?? null,
      lastHealthMessage: runtimeRow?.last_health_message ?? null,
    };
  }

  static async isEffectivelyEnabled(): Promise<boolean> {
    const status = await this.getStatus();
    return status.effectiveEnabled;
  }

  static async setRuntimeEnabled(enabled: boolean, actorUserId: string): Promise<void> {
    const hardEnabled = config.ENHANCE_ENABLED;
    const missingEnv = this.getMissingEnvVars();
    const envConfigured = missingEnv.length === 0;

    if (enabled && !hardEnabled) {
      throw new Error('Cannot enable Enhance when ENHANCE_ENABLED hard gate is false');
    }
    if (enabled && !envConfigured) {
      throw new Error(`Cannot enable Enhance: missing env vars: ${missingEnv.join(', ')}`);
    }

    await query(
      `UPDATE platform_integrations
       SET enabled = $1, updated_at = now()
       WHERE slug = 'enhance'`,
      [enabled]
    );

    await logActivity({
      userId: actorUserId,
      eventType: 'enhance.runtime_toggle',
      entityType: 'platform_integration',
      entityId: 'enhance',
      message: `Enhance runtime toggle set to ${enabled}`,
      status: 'success',
      metadata: { enabled, hardEnabled, envConfigured },
    });
  }

  static async runHealthCheck(actorUserId: string): Promise<{ success: boolean; message: string }> {
    const hardEnabled = config.ENHANCE_ENABLED;
    const missingEnv = this.getMissingEnvVars();
    const envConfigured = missingEnv.length === 0;

    if (!hardEnabled) {
      await this.persistHealthCheck('disabled', 'Hard gate (ENHANCE_ENABLED) is false');
      return { success: false, message: 'Hard gate is false' };
    }

    if (!envConfigured) {
      const msg = `Missing env vars: ${missingEnv.join(', ')}`;
      await this.persistHealthCheck('error', msg);
      return { success: false, message: msg };
    }

    try {
      // Basic connectivity check: attempt to reach the API root
      const response = await fetch(`${config.ENHANCE_API_URL}/orgs/${config.ENHANCE_MASTER_ORG_ID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.ENHANCE_API_KEY}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        await this.persistHealthCheck('healthy', 'API connectivity confirmed');
        await logActivity({
          userId: actorUserId,
          eventType: 'enhance.health_check',
          entityType: 'platform_integration',
          entityId: 'enhance',
          message: 'Enhance health check passed',
          status: 'success',
        });
        return { success: true, message: 'API connectivity confirmed' };
      }

      const msg = `API returned ${response.status}`;
      await this.persistHealthCheck('error', msg);
      await logActivity({
        userId: actorUserId,
        eventType: 'enhance.health_check',
        entityType: 'platform_integration',
        entityId: 'enhance',
        message: `Enhance health check failed: ${msg}`,
        status: 'error',
      });
      return { success: false, message: msg };
    } catch (error: any) {
      const msg = error?.message || 'Unknown error during health check';
      await this.persistHealthCheck('error', msg);
      await logActivity({
        userId: actorUserId,
        eventType: 'enhance.health_check',
        entityType: 'platform_integration',
        entityId: 'enhance',
        message: `Enhance health check failed: ${msg}`,
        status: 'error',
      });
      return { success: false, message: msg };
    }
  }

  static async invalidateCache(): Promise<void> {
    // No-op: config reads are dynamic via Proxy, and DB reads are fresh per call.
  }

  private static getMissingEnvVars(): string[] {
    const missing: string[] = [];
    if (!config.ENHANCE_API_URL) missing.push('ENHANCE_API_URL');
    if (!config.ENHANCE_MASTER_ORG_ID) missing.push('ENHANCE_MASTER_ORG_ID');
    if (!config.ENHANCE_API_KEY) missing.push('ENHANCE_API_KEY');
    return missing;
  }

  private static async persistHealthCheck(status: string, message: string): Promise<void> {
    await query(
      `UPDATE platform_integrations
       SET last_health_check_at = now(),
           last_health_status = $1,
           last_health_message = $2
       WHERE slug = 'enhance'`,
      [status, message]
    );
  }
}
