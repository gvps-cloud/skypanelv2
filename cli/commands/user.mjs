import { query, closePool } from '../lib/database.mjs';
import { resetBruteForceByEmail, getBruteForceStatus, closeRedis } from '../lib/redis.mjs';
import { success, error, warn, info, dim, bold, formatTable, formatJson, truncate } from '../lib/output.mjs';

export const userCommands = {
  async list(args) {
    const statusFilter = getFlag(args, '--status', 'all');
    const limit = parseInt(getFlag(args, '--limit', '50'));

    let sql = `SELECT id, email, name, role, status, status_reason, created_at FROM users`;
    const params = [];
    const conditions = [];

    if (statusFilter !== 'all') {
      params.push(statusFilter);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log(dim('No users found.'));
      return;
    }

    const tableRows = rows.map(u => [
      truncate(u.id, 8),
      truncate(u.email, 35),
      truncate(u.name, 25),
      u.role,
      u.status || 'active',
      u.status_reason ? truncate(u.status_reason, 20) : '-',
      new Date(u.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nUsers (${rows.length})\n`));
    console.log(formatTable(['ID', 'Email', 'Name', 'Role', 'Status', 'Reason', 'Created'], tableRows));
    console.log();
  },

  async info(args) {
    const identifier = args[0];
    if (!identifier) {
      console.log(error('Usage: skypanel user info <email|id>'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'id = $1' : 'LOWER(email) = LOWER($1)';

    const userResult = await query(
      `SELECT id, email, name, role, status, status_reason, status_updated_at,
              phone, timezone, two_factor_enabled, preferences, created_at, updated_at
       FROM users WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const u = userResult.rows[0];

    const bfStatus = await getBruteForceStatus(u.email);

    console.log(bold(`\nUser Details\n`));
    console.log(`  ${bold('ID:')}         ${u.id}`);
    console.log(`  ${bold('Email:')}      ${u.email}`);
    console.log(`  ${bold('Name:')}       ${u.name}`);
    console.log(`  ${bold('Role:')}       ${u.role === 'admin' ? success(u.role) : u.role}`);
    console.log(`  ${bold('Status:')}     ${u.status === 'suspended' ? error(u.status) : (u.status === 'inactive' ? warn(u.status) : success(u.status || 'active'))}`);
    if (u.status_reason) console.log(`  ${bold('Reason:')}     ${u.status_reason}`);
    if (u.status_updated_at) console.log(`  ${bold('Status At:')}  ${new Date(u.status_updated_at).toLocaleString()}`);
    console.log(`  ${bold('Phone:')}      ${u.phone || '-'}`);
    console.log(`  ${bold('Timezone:')}   ${u.timezone || '-'}`);
    console.log(`  ${bold('2FA:')}        ${u.two_factor_enabled ? success('enabled') : 'disabled'}`);
    console.log(`  ${bold('Created:')}    ${new Date(u.created_at).toLocaleString()}`);
    console.log(`  ${bold('Updated:')}    ${new Date(u.updated_at).toLocaleString()}`);

    console.log();
    console.log(bold('Lockout Status'));
    if (bfStatus.locked) {
      console.log(`  ${error('LOCKED')} - ${bfStatus.attempts} failed attempts, locked until ${new Date(bfStatus.lockedUntil).toLocaleString()}`);
    } else if (bfStatus.attempts > 0) {
      console.log(`  ${warn(`${bfStatus.attempts} failed attempts on record`)}`);
    } else {
      console.log(`  ${success('Not locked')}`);
    }

    // Show org memberships
    try {
      const orgs = await query(
        `SELECT om.organization_id, o.name, om.role, om.created_at
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = $1
         ORDER BY om.created_at ASC`,
        [u.id],
      );
      if (orgs.rows.length > 0) {
        console.log();
        console.log(bold(`Organizations (${orgs.rows.length})`));
        for (const org of orgs.rows) {
          console.log(`  ${dim('-')} ${truncate(org.name, 40)} ${dim(`(${org.role})`)} ${dim(org.organization_id.slice(0, 8))}`);
        }
      }
    } catch {}

    console.log();
  },

  async unlock(args) {
    const identifier = args[0];
    if (!identifier) {
      console.log(error('Usage: skypanel user unlock <email|id>'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'id = $1' : 'LOWER(email) = LOWER($1)';

    const userResult = await query(
      `SELECT id, email, role FROM users WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const user = userResult.rows[0];

    // Check current lockout status
    const bfStatus = await getBruteForceStatus(user.email);
    if (!bfStatus.locked && bfStatus.attempts === 0) {
      console.log(info(`User ${user.email} is not locked out.`));
      return;
    }

    // Reset brute force
    const result = await resetBruteForceByEmail(user.email);
    if (result.cleared > 0) {
      console.log(success(`Lockout cleared for ${user.email}`));
    } else if (result.storage === 'unavailable') {
      console.log(warn('Redis not available. Lockout data is in-memory on the running server.'));
      console.log(dim('Restart the server to clear in-memory lockout data, or configure REDIS_URL in .env'));
    } else {
      console.log(info(`No active lockout found in Redis for ${user.email}`));
    }
  },

  async suspend(args) {
    const identifier = args[0];
    const reason = getFlag(args, '--reason', null);

    if (!identifier) {
      console.log(error('Usage: skypanel user suspend <email|id> [--reason "reason"]'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'id = $1' : 'LOWER(email) = LOWER($1)';

    const userResult = await query(
      `SELECT id, email, name, role, status FROM users WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const user = userResult.rows[0];

    if (user.role === 'admin') {
      console.log(error('Cannot suspend admin users. Admins are protected from suspension.'));
      return;
    }

    if (user.status === 'suspended') {
      console.log(warn(`User ${user.email} is already suspended.`));
      return;
    }

    await query(
      `UPDATE users SET status = 'suspended', status_reason = $1, status_updated_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [reason || null, user.id],
    );

    console.log(success(`User ${user.email} has been suspended.`));
    if (reason) console.log(dim(`  Reason: ${reason}`));
  },

  async activate(args) {
    const identifier = args[0];
    if (!identifier) {
      console.log(error('Usage: skypanel user activate <email|id>'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'id = $1' : 'LOWER(email) = LOWER($1)';

    const userResult = await query(
      `SELECT id, email, name, role, status FROM users WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const user = userResult.rows[0];

    if (user.status === 'active' || (!user.status || user.status === null)) {
      console.log(info(`User ${user.email} is already active.`));
      return;
    }

    await query(
      `UPDATE users SET status = 'active', status_reason = NULL, status_updated_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id],
    );

    console.log(success(`User ${user.email} has been activated.`));
  },

  async role(args) {
    const identifier = args[0];
    const newRole = args[1];

    if (!identifier || !newRole) {
      console.log(error('Usage: skypanel user role <email|id> <admin|user>'));
      return;
    }

    if (!['admin', 'user'].includes(newRole)) {
      console.log(error('Role must be "admin" or "user"'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'id = $1' : 'LOWER(email) = LOWER($1)';

    const userResult = await query(
      `SELECT id, email, name, role FROM users WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const user = userResult.rows[0];

    if (user.role === newRole) {
      console.log(info(`User ${user.email} already has role "${newRole}".`));
      return;
    }

    await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      [newRole, user.id],
    );

    console.log(success(`User ${user.email} role changed from "${user.role}" to "${newRole}".`));
  },

  async search(args) {
    const searchTerm = args[0];
    if (!searchTerm) {
      console.log(error('Usage: skypanel user search <query>'));
      return;
    }

    const result = await query(
      `SELECT id, email, name, role, status, created_at
       FROM users
       WHERE LOWER(email) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($1)
       ORDER BY created_at DESC LIMIT 20`,
      [`%${searchTerm}%`],
    );

    if (result.rows.length === 0) {
      console.log(dim(`No users matching "${searchTerm}".`));
      return;
    }

    const tableRows = result.rows.map(u => [
      truncate(u.id, 8),
      truncate(u.email, 35),
      truncate(u.name, 25),
      u.role,
      u.status || 'active',
      new Date(u.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nSearch Results (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Email', 'Name', 'Role', 'Status', 'Created'], tableRows));
    console.log();
  },
};

function getFlag(args, flagName, defaultVal) {
  const idx = args.indexOf(flagName);
  if (idx === -1) return defaultVal;
  if (idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return defaultVal;
}
