import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold, formatTable, truncate } from '../lib/output.mjs';

export const vpsCommands = {
  async list(args) {
    const orgId = args.find(a => a.startsWith('--org-id'))?.split('=')[1];
    const limit = parseInt(args.find(a => a.startsWith('--limit'))?.split('=')[1] || '25');

    let sql = `SELECT v.id, v.label, v.status, v.ip_address, v.provider_type,
                      o.name AS org_name, v.created_at
               FROM vps_instances v
               LEFT JOIN organizations o ON o.id = v.organization_id`;
    const params = [];

    if (orgId) {
      params.push(orgId);
      sql += ` WHERE v.organization_id = $${params.length}`;
    }

    sql += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      console.log(dim('No VPS instances found.'));
      return;
    }

    const tableRows = result.rows.map(v => [
      v.id.slice(0, 8),
      truncate(v.label, 25),
      v.status,
      v.ip_address || '-',
      v.provider_type || '-',
      truncate(v.org_name, 20),
      new Date(v.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nVPS Instances (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Label', 'Status', 'IP', 'Provider', 'Org', 'Created'], tableRows));
    console.log();
  },

  async info(args) {
    const id = args[0];
    if (!id) {
      console.log(error('Usage: skypanel vps info <id>'));
      return;
    }

    const result = await query(
      `SELECT v.*, o.name AS org_name
       FROM vps_instances v
       LEFT JOIN organizations o ON o.id = v.organization_id
       WHERE v.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      console.log(error(`VPS not found: ${id}`));
      return;
    }

    const v = result.rows[0];

    console.log(bold('\nVPS Details\n'));
    console.log(`  ${bold('ID:')}         ${v.id}`);
    console.log(`  ${bold('Label:')}     ${v.label}`);
    console.log(`  ${bold('Status:')}    ${v.status}`);
    console.log(`  ${bold('IP:')}        ${v.ip_address || '-'}`);
    console.log(`  ${bold('Provider:')}  ${v.provider_type || '-'}`);
    console.log(`  ${bold('Org:')}       ${v.org_name || '-'}`);
    console.log(`  ${bold('Plan:')}      ${v.plan_id || '-'}`);
    console.log(`  ${bold('Region:')}    ${v.configuration?.region || '-'}`);
    console.log(`  ${bold('Created:')}   ${new Date(v.created_at).toLocaleString()}`);
    console.log(`  ${bold('Updated:')}   ${new Date(v.updated_at).toLocaleString()}`);
    console.log();
  },
};
