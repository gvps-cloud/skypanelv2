import { config } from '../config/index.js';
import { query } from '../lib/database.js';
import { logActivity } from './activityLogger.js';

export interface LinodeIntegrationStatus {
  hardEnabled: boolean;
  envConfigured: boolean;
  missingEnv: string[];
  runtimeEnabled: boolean;
  effectiveEnabled: boolean;
}

export class LinodeToggleService {
  static async getStatus(): Promise<LinodeIntegrationStatus> {
    const hardEnabled = Boolean(config.LINODE_API_TOKEN?.trim());
    const missingEnv = this.getMissingEnvVars();
    const envConfigured = missingEnv.length === 0;

    await this.ensureLinodeIntegrationRow();

    const runtimeResult = await query(
      `SELECT enabled FROM platform_integrations WHERE slug = 'linode'`,
    );

    const runtimeRow = runtimeResult.rows[0];
    const runtimeEnabled = runtimeRow?.enabled === true;

    return {
      hardEnabled,
      envConfigured,
      missingEnv,
      runtimeEnabled,
      effectiveEnabled: hardEnabled && envConfigured && runtimeEnabled,
    };
  }

  static async isEffectivelyEnabled(): Promise<boolean> {
    const status = await this.getStatus();
    return status.effectiveEnabled;
  }

  static async setRuntimeEnabled(enabled: boolean, actorUserId: string): Promise<void> {
    const hardEnabled = Boolean(config.LINODE_API_TOKEN?.trim());
    const missingEnv = this.getMissingEnvVars();
    const envConfigured = missingEnv.length === 0;

    if (enabled && !hardEnabled) {
      throw new Error('Cannot enable VPS/Linode when LINODE_API_TOKEN is not set');
    }
    if (enabled && !envConfigured) {
      throw new Error(`Cannot enable VPS/Linode: missing env vars: ${missingEnv.join(', ')}`);
    }

    await this.ensureLinodeIntegrationRow();

    const updateResult = await query(
      `UPDATE platform_integrations
       SET enabled = $1, updated_at = now()
       WHERE slug = 'linode'`,
      [enabled],
    );

    if (updateResult.rowCount !== 1) {
      throw new Error(
        `Linode/VPS runtime toggle update affected ${updateResult.rowCount ?? 0} row(s); expected 1`,
      );
    }

    await logActivity({
      userId: actorUserId,
      eventType: 'linode.runtime_toggle',
      entityType: 'platform_integration',
      entityId: 'linode',
      message: `Linode/VPS runtime toggle set to ${enabled}`,
      status: 'success',
      metadata: { enabled, hardEnabled, envConfigured },
    });
  }

  private static getMissingEnvVars(): string[] {
    const missing: string[] = [];
    if (!config.LINODE_API_TOKEN?.trim()) missing.push('LINODE_API_TOKEN');
    return missing;
  }

  /** Matches migration 072; safe to run repeatedly (ON CONFLICT DO NOTHING). */
  private static async ensureLinodeIntegrationRow(): Promise<void> {
    await query(
      `INSERT INTO platform_integrations (slug, display_name, description, enabled, env_required)
       VALUES (
         'linode',
         'VPS / Linode Compute',
         'Linode-backed virtual private servers: provisioning, power, networking, and SSH access.',
         true,
         ARRAY['LINODE_API_TOKEN']::text[]
       )
       ON CONFLICT (slug) DO NOTHING`,
    );
  }
}
