import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold } from '../lib/output.mjs';

export const platformCommands = {
  async maintenance(args) {
    const action = args[0];

    if (!action || !['on', 'off', 'status'].includes(action)) {
      console.log(error('Usage: skypanel platform maintenance <on|off|status>'));
      return;
    }

    if (action === 'status') {
      const result = await query(
        `SELECT value FROM platform_settings WHERE key = 'maintenance_mode'`,
      );
      const setting = result.rows[0]?.value;
      if (setting?.enabled) {
        console.log(warn('Maintenance mode is ON'));
        if (setting.message) console.log(dim(`  Message: ${setting.message}`));
      } else {
        console.log(success('Maintenance mode is OFF'));
      }
      return;
    }

    const enabled = action === 'on';

    const existing = await query(
      `SELECT id FROM platform_settings WHERE key = 'maintenance_mode'`,
    );

    if (existing.rows.length > 0) {
      await query(
        `UPDATE platform_settings SET value = jsonb_set(COALESCE(value, '{}'), '{enabled}', $1::jsonb), updated_at = NOW() WHERE key = 'maintenance_mode'`,
        [JSON.stringify(enabled)],
      );
    } else {
      await query(
        `INSERT INTO platform_settings (key, value, created_at, updated_at) VALUES ('maintenance_mode', $1, NOW(), NOW())`,
        [JSON.stringify({ enabled })],
      );
    }

    console.log(success(`Maintenance mode turned ${enabled ? 'ON' : 'OFF'}`));
  },

  async registration(args) {
    const action = args[0];

    if (!action || !['on', 'off', 'status'].includes(action)) {
      console.log(error('Usage: skypanel platform registration <on|off|status>'));
      return;
    }

    if (action === 'status') {
      const result = await query(
        `SELECT value FROM platform_settings WHERE key = 'registration_disabled'`,
      );
      const setting = result.rows[0]?.value;
      if (setting?.enabled) {
        console.log(warn('Registration is DISABLED'));
      } else {
        console.log(success('Registration is ENABLED'));
      }
      return;
    }

    const disabled = action === 'off';

    const existing = await query(
      `SELECT id FROM platform_settings WHERE key = 'registration_disabled'`,
    );

    if (existing.rows.length > 0) {
      await query(
        `UPDATE platform_settings SET value = jsonb_set(COALESCE(value, '{}'), '{enabled}', $1::jsonb), updated_at = NOW() WHERE key = 'registration_disabled'`,
        [JSON.stringify(disabled)],
      );
    } else {
      await query(
        `INSERT INTO platform_settings (key, value, created_at, updated_at) VALUES ('registration_disabled', $1, NOW(), NOW())`,
        [JSON.stringify({ enabled: disabled })],
      );
    }

    console.log(success(`Registration ${disabled ? 'DISABLED' : 'ENABLED'}`));
  },

  async settings() {
    const result = await query(
      `SELECT key, value, updated_at FROM platform_settings ORDER BY key`,
    );

    if (result.rows.length === 0) {
      console.log(dim('No platform settings found.'));
      return;
    }

    console.log(bold('\nPlatform Settings\n'));
    for (const row of result.rows) {
      const val = typeof row.value === 'object' ? JSON.stringify(row.value) : row.value;
      console.log(`  ${bold(row.key)}: ${val}`);
      if (row.updated_at) console.log(dim(`    Updated: ${new Date(row.updated_at).toLocaleString()}`));
    }
    console.log();
  },
};
