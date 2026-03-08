import {
  CheckCircle,
  Clock,
  Mail,
  MailOpen,
} from "lucide-react";
import { TicketPriority, TicketStatus } from "@/types/support";

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  open: {
    label: "Open",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Mail,
  },
  in_progress: {
    label: "In Progress",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle,
  },
  closed: {
    label: "Closed",
    className: "border-muted-foreground/15 bg-muted text-muted-foreground",
    icon: MailOpen,
  },
};

export const TICKET_PRIORITY_META: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "border-muted-foreground/15 bg-muted text-muted-foreground",
  },
  medium: {
    label: "Medium",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  high: {
    label: "High",
    className:
      "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  urgent: {
    label: "Urgent",
    className: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};
