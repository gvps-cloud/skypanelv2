export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "technical" | "billing" | "general" | "feature_request";

export interface TicketCreator {
  id: string;
  name: string | null;
  email: string | null;
  displayName: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: "user" | "admin";
  sender_user_id?: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  description?: string; // Some API responses might map message to description
  message?: string; // Admin view uses message
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory | string;
  created_at: string;
  updated_at: string;
  has_staff_reply?: boolean;
  vps_id?: string;
  vps_label?: string;
  messages: TicketMessage[];
  
  // Admin specific fields
  organization_id?: string;
  organization_name?: string;
  organization_slug?: string;
  created_by?: string;
  creator?: TicketCreator;
}

export const REOPEN_REQUEST_PREFIX = "[REOPEN_REQUEST]";

export const isReopenRequestMessage = (message: string): boolean =>
  typeof message === "string" && message.startsWith(REOPEN_REQUEST_PREFIX);

export const formatTicketMessage = (message: string): string =>
  isReopenRequestMessage(message)
    ? message.replace(REOPEN_REQUEST_PREFIX, "").trim()
    : message;
