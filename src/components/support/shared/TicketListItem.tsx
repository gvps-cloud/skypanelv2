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
        "flex w-full flex-col gap-3 p-4 text-left transition-all hover:bg-muted/50 border-b border-border last:border-0",
        isSelected && "bg-primary/5 border-l-4 border-l-primary pl-3"
      )}
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon 
            className={cn(
              "h-4 w-4 flex-shrink-0",
              isSelected ? "text-primary" : "text-muted-foreground"
            )} 
          />
          <span className={cn(
            "font-medium text-sm truncate",
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

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {description}
      </p>
      
      {showCustomer && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground/80 line-clamp-1">
            {getCreatorDisplay(ticket)}
            {ticket.creator?.email && <span className="text-muted-foreground font-normal ml-1">({ticket.creator.email})</span>}
          </p>
          {(ticket.organization_name || ticket.organization_slug) && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground line-clamp-1">
              <Shield className="h-3 w-3 shrink-0" />
              <span>
                {ticket.organization_name || ticket.organization_slug}
                {ticket.organization_name && ticket.organization_slug && (
                  <span className="opacity-70"> · @{ticket.organization_slug}</span>
                )}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] h-5 px-1.5 font-normal",
            TICKET_STATUS_META[ticket.status].className
          )}
        >
          {TICKET_STATUS_META[ticket.status].label}
        </Badge>
        
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] h-5 px-1.5 font-normal",
            TICKET_PRIORITY_META[ticket.priority].className
          )}
        >
          {TICKET_PRIORITY_META[ticket.priority].label}
        </Badge>
        
        {ticket.vps_label && (
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-1.5 font-normal bg-muted text-muted-foreground max-w-[100px] truncate"
          >
            {ticket.vps_label}
          </Badge>
        )}
        
        <span className="text-[10px] capitalize opacity-70">
          {ticket.category.replace("_", " ")}
        </span>
      </div>
    </button>
  );
};
