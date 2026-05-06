import type { SupportTicket, TicketMessage } from "@/types/support";

/** Normalize list rows from GET /admin/tickets */
export function normalizeAdminListTicket(
  ticket: SupportTicket,
): SupportTicket {
  const hasUpdated =
    typeof ticket.updated_at === "string" &&
    ticket.updated_at.trim() !== "";

  return {
    ...ticket,
    updated_at: hasUpdated ? ticket.updated_at : ticket.created_at,
    messages: ticket.messages ?? [],
    hosting_subscription_is_active:
      typeof ticket.hosting_subscription_is_active === "boolean"
        ? ticket.hosting_subscription_is_active
        : false,
    hosting_plan_is_active:
      typeof ticket.hosting_plan_is_active === "boolean"
        ? ticket.hosting_plan_is_active
        : false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTicketStatus(value: unknown): value is TicketMessage["sender_type"] {
  return value === "user" || value === "admin";
}

/** Map GET /admin/tickets/:id/replies rows to TicketMessage */
export function mapAdminReplyRow(row: unknown): TicketMessage | null {
  if (!isRecord(row)) return null;
  const id = row.id;
  const ticket_id = row.ticket_id;
  const sender_type = row.sender_type;
  const sender_name = row.sender_name;
  const message = row.message;
  const created_at = row.created_at;
  if (
    typeof id !== "string" ||
    typeof ticket_id !== "string" ||
    !isTicketStatus(sender_type) ||
    typeof sender_name !== "string" ||
    typeof message !== "string" ||
    typeof created_at !== "string"
  ) {
    return null;
  }
  return {
    id,
    ticket_id,
    sender_type,
    sender_name,
    message,
    created_at,
  };
}

export function mapAdminReplyRows(rows: unknown): TicketMessage[] {
  if (!Array.isArray(rows)) return [];
  const out: TicketMessage[] = [];
  for (const row of rows) {
    const msg = mapAdminReplyRow(row);
    if (msg) out.push(msg);
  }
  return out;
}
