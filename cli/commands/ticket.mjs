import { query, closePool } from '../lib/database.mjs';
import { success, error, warn, info, dim, bold, formatTable, truncate } from '../lib/output.mjs';

export const ticketCommands = {
  async list(args) {
    const statusFilter = args.find(a => a.startsWith('--status'))?.split('=')[1] || 'all';
    const limit = parseInt(args.find(a => a.startsWith('--limit'))?.split('=')[1] || '25');

    let sql = `SELECT st.id, st.subject, st.status, st.priority, st.category,
                      st.created_at, st.updated_at,
                      o.name AS org_name, u.email AS creator_email
               FROM support_tickets st
               LEFT JOIN organizations o ON o.id = st.organization_id
               LEFT JOIN users u ON u.id = st.created_by`;
    const params = [];

    if (statusFilter !== 'all') {
      params.push(statusFilter);
      sql += ` WHERE st.status = $${params.length}`;
    }

    sql += ` ORDER BY st.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      console.log(dim('No tickets found.'));
      return;
    }

    const tableRows = result.rows.map(t => [
      t.id.slice(0, 8),
      truncate(t.subject, 35),
      t.status,
      t.priority || '-',
      truncate(t.creator_email, 25),
      new Date(t.created_at).toLocaleDateString(),
    ]);

    console.log(bold(`\nTickets (${result.rows.length})\n`));
    console.log(formatTable(['ID', 'Subject', 'Status', 'Priority', 'Creator', 'Created'], tableRows));
    console.log();
  },

  async show(args) {
    const id = args[0];
    if (!id) {
      console.log(error('Usage: skypanel ticket show <id>'));
      return;
    }

    const result = await query(
      `SELECT st.*, o.name AS org_name, u.email AS creator_email
       FROM support_tickets st
       LEFT JOIN organizations o ON o.id = st.organization_id
       LEFT JOIN users u ON u.id = st.created_by
       WHERE st.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      console.log(error(`Ticket not found: ${id}`));
      return;
    }

    const t = result.rows[0];

    console.log(bold('\nTicket Details\n'));
    console.log(`  ${bold('ID:')}         ${t.id}`);
    console.log(`  ${bold('Subject:')}   ${t.subject}`);
    console.log(`  ${bold('Status:')}    ${t.status}`);
    console.log(`  ${bold('Priority:')}  ${t.priority || '-'}`);
    console.log(`  ${bold('Category:')}  ${t.category || '-'}`);
    console.log(`  ${bold('Creator:')}   ${t.creator_email || '-'}`);
    console.log(`  ${bold('Org:')}       ${t.org_name || '-'}`);
    console.log(`  ${bold('Created:')}   ${new Date(t.created_at).toLocaleString()}`);

    // Show replies
    try {
      const replies = await query(
        `SELECT sr.*, u.email AS sender_email
         FROM support_ticket_replies sr
         LEFT JOIN users u ON u.id = sr.user_id
         WHERE sr.ticket_id = $1
         ORDER BY sr.created_at ASC`,
        [id],
      );
      if (replies.rows.length > 0) {
        console.log();
        console.log(bold(`Replies (${replies.rows.length})`));
        for (const r of replies.rows) {
          console.log(`  ${dim(`[${new Date(r.created_at).toLocaleString()}]`)} ${r.sender_email || 'system'}`);
          console.log(`    ${truncate((r.message || '').replace(/\n/g, ' '), 80)}`);
        }
      }
    } catch {}

    console.log();
  },

  async close(args) {
    const id = args[0];
    if (!id) {
      console.log(error('Usage: skypanel ticket close <id>'));
      return;
    }

    const result = await query(
      `UPDATE support_tickets SET status = 'closed', updated_at = NOW() WHERE id = $1 AND status != 'closed' RETURNING id, subject`,
      [id],
    );

    if (result.rows.length === 0) {
      console.log(error(`Ticket not found or already closed: ${id}`));
      return;
    }

    console.log(success(`Ticket "${result.rows[0].subject}" closed.`));
  },
};
