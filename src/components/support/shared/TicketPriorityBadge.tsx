import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TicketPriority } from "@/types/support";
import { TICKET_PRIORITY_META } from "./constants";

interface TicketPriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

export const TicketPriorityBadge: React.FC<TicketPriorityBadgeProps> = ({
  priority,
  className,
}) => {
  const meta = TICKET_PRIORITY_META[priority];

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
};
