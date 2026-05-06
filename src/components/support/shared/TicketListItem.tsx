import React from "react";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SupportTicket } from "@/types/support";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "./constants";

interface TicketListItemProps {
  ticket: SupportTicket;
  isSelected: boolean;
  onClick: () => void;
  showCustomer?: boolean;
}

export const TicketListItem: React.FC<TicketListItemProps> = ({
  ticket,
  isSelected,
  onClick,
  showCustomer = false,
}) => {
  const StatusIcon = TICKET_STATUS_META[ticket.status].icon;
  const description = ticket.description || ticket.message || "";
  
  const getCreatorDisplay = (ticket: SupportTicket): string => {
    if (!ticket.creator) return ticket.created_by || "Unknown";
    return ticket.creator.displayName || ticket.creator.email || ticket.created_by || "Unknown";
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 max-w-full flex-col gap-2 border-b border-border p-3 text-left transition-colors last:border-0 hover:bg-muted/40 sm:gap-2.5 sm:p-3.5",
        isSelected && "border-l-4 border-l-primary bg-primary/5 pl-2.5 sm:pl-3",
      )}
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <StatusIcon 
            className={cn(
              "mt-0.5 h-4 w-4 flex-shrink-0",
              isSelected ? "text-primary" : "text-muted-foreground"
            )} 
          />
          <span className={cn(
            "min-w-0 flex-1 break-words text-sm font-medium leading-snug line-clamp-2",
            isSelected ? "text-primary" : "text-foreground"
          )}>
            {ticket.subject}
          </span>
        </div>
        
        {ticket.has_staff_reply && !showCustomer && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20 flex-shrink-0"
          >
            New Reply
          </Badge>
        )}
        
        <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
          {new Date(ticket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <p className="min-w-0 break-words line-clamp-2 text-left text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      
      {showCustomer && (
        <div className="min-w-0 space-y-0.5">
          <p className="min-w-0 break-words line-clamp-2 text-xs font-medium text-foreground/90">
            {getCreatorDisplay(ticket)}
            {ticket.creator?.email && (
              <span className="ml-1 font-normal text-muted-foreground">
                ({ticket.creator.email})
              </span>
            )}
          </p>
          {(ticket.organization_name || ticket.organization_slug) && (
            <p className="flex items-center gap-1 line-clamp-1 text-[11px] text-muted-foreground">
              <Shield className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">
                {ticket.organization_name || ticket.organization_slug}
                {ticket.organization_name && ticket.organization_slug && (
                  <span className="opacity-70"> · @{ticket.organization_slug}</span>
                )}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "h-[22px] px-1.5 text-[10px] font-normal leading-none",
            TICKET_STATUS_META[ticket.status].className
          )}
        >
          {TICKET_STATUS_META[ticket.status].label}
        </Badge>
        
        <Badge
          variant="outline"
          className={cn(
            "h-[22px] px-1.5 text-[10px] font-normal leading-none",
            TICKET_PRIORITY_META[ticket.priority].className
          )}
        >
          {TICKET_PRIORITY_META[ticket.priority].label}
        </Badge>
        
        {ticket.vps_label && (
          <Badge
            variant="secondary"
            className="h-[22px] max-w-[min(11rem,100%)] truncate bg-muted px-1.5 text-[10px] font-normal leading-none text-muted-foreground"
          >
            {ticket.vps_label}
          </Badge>
        )}
        
        <span className="min-w-0 max-w-full break-words text-[10px] capitalize text-muted-foreground/90">
          {ticket.category.replace("_", " ")}
        </span>
      </div>
    </button>
  );
};
