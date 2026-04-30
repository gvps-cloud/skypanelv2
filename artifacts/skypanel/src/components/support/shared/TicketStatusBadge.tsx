import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TicketStatus } from "@/types/support";
import { TICKET_STATUS_META } from "./constants";

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
  showIcon?: boolean;
}

export const TicketStatusBadge: React.FC<TicketStatusBadgeProps> = ({
  status,
  className,
  showIcon = true,
}) => {
  const meta = TICKET_STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", meta.className, className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {meta.label}
    </Badge>
  );
};
