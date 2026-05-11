import { query, closePool } from '../lib/database.mjs';
import { resetBruteForceByEmail, closeRedis } from '../lib/redis.mjs';
import { success, error, warn, info, dim, bold, formatTable } from '../lib/output.mjs';

export const adminCommands = {
  async list() {
    const result = await query(
      `SELECT id, email, name, status, two_factor_enabled, created_at, updated_at
       FROM users WHERE role = 'admin'
       ORDER BY created_at ASC`,
    );

    if (result.rows.length === 0) {
      console.log(warn('No admin users found.'));
      return;
    }

    const tableRows = result.rows.map(u => [
      u.id.slice(0, 8),
      u.email,
      u.name || '-',
      u.status || 'active',
      u.two_factor_enabled ? 'yes' : 'no',
      new Date(u.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nAdmin Users (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Email', 'Name', 'Status', '2FA', 'Created'], tableRows));
    console.log();
  },

  async protect() {
    console.log(bold('\nAdmin Protection Check\n'));

    const admins = await query(
      `SELECT id, email, name, status, status_reason FROM users WHERE role = 'admin'`,
    );

    if (admins.rows.length === 0) {
      console.log(warn('No admin users found!'));
      return;
    }

    let allGood = true;

    for (const admin of admins.rows) {
      if (admin.status && admin.status !== 'active') {
        console.log(error(`  ${admin.email}: status=${admin.status} ${admin.status_reason || ''}`));
        console.log(dim(`    Fixing: setting status to active...`));
        await query(
          `UPDATE users SET status = 'active', status_reason = NULL, status_updated_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [admin.id],
        );
        console.log(success(`    Fixed.`));
        allGood = false;
      } else {
        console.log(success(`  ${admin.email}: OK`));
      }

      // Clear any brute force lockout
      const { getBruteForceStatus } = await import('../lib/redis.mjs');
      const bfStatus = await getBruteForceStatus(admin.email);
      if (bfStatus.locked) {
        console.log(warn(`  ${admin.email}: locked out in brute force system (clearing...)`));
        await resetBruteForceByEmail(admin.email);
        console.log(success(`    Lockout cleared.`));
        allGood = false;
      }
    }

    if (allGood) {
      console.log(success('\nAll admins are protected and active.'));
    } else {
      console.log(success('\nProtection issues resolved.'));
    }
    console.log();
  },
};
