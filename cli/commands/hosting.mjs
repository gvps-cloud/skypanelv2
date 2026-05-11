import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold, formatTable, truncate } from '../lib/output.mjs';

export const hostingCommands = {
  async list(args) {
    const limit = parseInt(args.find(a => a.startsWith('--limit'))?.split('=')[1] || '25');

    const result = await query(
      `SELECT hs.id, hs.domain, hs.status, hs.billing_cycle,
              o.name AS org_name, hs.created_at
       FROM hosting_subscriptions hs
       LEFT JOIN organizations o ON o.id = hs.organization_id
       ORDER BY hs.created_at DESC
       LIMIT $1`,
      [limit],
    );

    if (result.rows.length === 0) {
      console.log(dim('No hosting subscriptions found.'));
      return;
    }

    const tableRows = result.rows.map(h => [
      h.id.slice(0, 8),
      truncate(h.domain, 35),
      h.status,
      h.billing_cycle || '-',
      truncate(h.org_name, 20),
      new Date(h.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nHosting Subscriptions (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Domain', 'Status', 'Billing', 'Org', 'Created'], tableRows));
    console.log();
  },

  async info(args) {
    const id = args[0];
    if (!id) {
      console.log(error('Usage: skypanel hosting info <id>'));
      return;
    }

    const result = await query(
      `SELECT hs.*, o.name AS org_name
       FROM hosting_subscriptions hs
       LEFT JOIN organizations o ON o.id = hs.organization_id
       WHERE hs.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      console.log(error(`Hosting subscription not found: ${id}`));
      return;
    }

    const h = result.rows[0];

    console.log(bold('\nHosting Details\n'));
    console.log(`  ${bold('ID:')}         ${h.id}`);
    console.log(`  ${bold('Domain:')}    ${h.domain || '-'}`);
    console.log(`  ${bold('Status:')}    ${h.status}`);
    console.log(`  ${bold('Plan:')}      ${h.plan_name || h.plan_id || '-'}`);
    console.log(`  ${bold('Billing:')}   ${h.billing_cycle || '-'}`);
    console.log(`  ${bold('Org:')}       ${h.org_name || '-'}`);
    console.log(`  ${bold('Created:')}   ${new Date(h.created_at).toLocaleString()}`);
    console.log();
  },
};
