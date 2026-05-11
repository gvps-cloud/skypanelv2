import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold, formatTable, truncate } from '../lib/output.mjs';

export const orgCommands = {
  async list(args) {
    const limit = parseInt(args.find(a => a.startsWith('--limit'))?.split('=')[1] || '25');

    const result = await query(
      `SELECT o.id, o.name, o.slug,
              (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count,
              o.created_at
       FROM organizations o
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit],
    );

    if (result.rows.length === 0) {
      console.log(dim('No organizations found.'));
      return;
    }

    const tableRows = result.rows.map(o => [
      o.id.slice(0, 8),
      truncate(o.name, 35),
      truncate(o.slug, 25),
      parseInt(o.member_count),
      new Date(o.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nOrganizations (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Name', 'Slug', 'Members', 'Created'], tableRows));
    console.log();
  },

  async info(args) {
    const identifier = args[0];
    if (!identifier) {
      console.log(error('Usage: skypanel org info <id|slug>'));
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(identifier);
    const where = isUuid ? 'o.id = $1' : 'o.slug = $1';

    const orgResult = await query(
      `SELECT o.* FROM organizations o WHERE ${where}`,
      [identifier],
    );

    if (orgResult.rows.length === 0) {
      console.log(error(`Organization not found: ${identifier}`));
      return;
    }

    const org = orgResult.rows[0];

    const members = await query(
      `SELECT u.id, u.email, u.name, u.role AS user_role, om.role AS org_role
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.created_at ASC`,
      [org.id],
    );

    console.log(bold('\nOrganization Details\n'));
    console.log(`  ${bold('ID:')}      ${org.id}`);
    console.log(`  ${bold('Name:')}    ${org.name}`);
    console.log(`  ${bold('Slug:')}    ${org.slug}`);
    console.log(`  ${bold('Owner:')}   ${org.owner_id}`);
    console.log(`  ${bold('Created:')} ${new Date(org.created_at).toLocaleString()}`);

    if (members.rows.length > 0) {
      console.log();
      console.log(bold(`Members (${members.rows.length})`));
      for (const m of members.rows) {
        const roleLabel = m.user_role === 'admin' ? ' [admin]' : '';
        console.log(`  ${dim('-')} ${m.email} ${dim(`(${m.org_role})${roleLabel}`)}`);
      }
    }
    console.log();
  },
};
