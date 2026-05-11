import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold, formatTable, truncate } from '../lib/output.mjs';

export const billingCommands = {
  async balance(args) {
    const identifier = args[0];
    if (!identifier) {
      console.log(error('Usage: skypanel billing balance <email|id>'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'u.id = $1' : 'LOWER(u.email) = LOWER($1)';

    const result = await query(
      `SELECT u.email, u.name, w.balance, w.currency, o.name AS org_name, o.id AS org_id
       FROM users u
       JOIN organization_members om ON om.user_id = u.id
       JOIN organizations o ON o.id = om.organization_id
       LEFT JOIN wallets w ON w.organization_id = o.id
       WHERE ${where}`,
      [identifier],
    );

    if (result.rows.length === 0) {
      console.log(error(`No wallet data found for: ${identifier}`));
      return;
    }

    console.log(bold('\nWallet Balances\n'));
    for (const row of result.rows) {
      const balance = parseFloat(row.balance || 0).toFixed(2);
      const colored = parseFloat(balance) < 0 ? error(balance) : success(balance);
      console.log(`  ${bold(row.org_name || row.org_id)}: ${colored} ${row.currency || 'USD'}`);
    }
    console.log();
  },

  async credit(args) {
    const identifier = args[0];
    const amount = parseFloat(args[1]);

    if (!identifier || isNaN(amount)) {
      console.log(error('Usage: skypanel billing credit <email|id> <amount>'));
      return;
    }

    if (amount <= 0) {
      console.log(error('Amount must be positive.'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'u.id = $1' : 'LOWER(u.email) = LOWER($1)';

    const userResult = await query(
      `SELECT u.id, u.email, u.name FROM users u WHERE ${where}`,
      [identifier],
    );

    if (userResult.rows.length === 0) {
      console.log(error(`User not found: ${identifier}`));
      return;
    }

    const user = userResult.rows[0];

    const orgResult = await query(
      `SELECT om.organization_id, o.name FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY om.created_at ASC LIMIT 1`,
      [user.id],
    );

    if (orgResult.rows.length === 0) {
      console.log(error('User has no organization.'));
      return;
    }

    const org = orgResult.rows[0];

    const walletResult = await query(
      `SELECT id FROM wallets WHERE organization_id = $1`,
      [org.organization_id],
    );

    if (walletResult.rows.length === 0) {
      await query(
        `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at) VALUES ($1, $2, 'USD', NOW(), NOW())`,
        [org.organization_id, amount],
      );
    } else {
      await query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE organization_id = $2`,
        [amount, org.organization_id],
      );
    }

    await query(
      `INSERT INTO payment_transactions (organization_id, amount, status, payment_method, description, created_at)
       VALUES ($1, $2, 'completed', 'admin_credit', $3, NOW())`,
      [org.organization_id, amount, `Admin credit via CLI for ${user.email}`],
    );

    console.log(success(`Credited $${amount.toFixed(2)} to ${org.name} (${user.email})`));
  },
};
