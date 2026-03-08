import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SupportTicket } from "@/types/support";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "./constants";
import { ArrowLeft, Clock, MapPin, User } from "lucide-react";

interface TicketDetailHeaderProps {
  ticket: SupportTicket;
  onBack: () => void;
  showCustomer?: boolean;
  children?: React.ReactNode;
}

export const TicketDetailHeader: React.FC<TicketDetailHeaderProps> = ({
  ticket,
  onBack,
  showCustomer = false,
  children,
}) => {
  const getCreatorDisplay = (ticket: SupportTicket): string => {
    if (!ticket.creator) return ticket.created_by || "Unknown";
    return ticket.creator.displayName || ticket.creator.email || ticket.created_by || "Unknown";
  };

  return (
    <div className="flex flex-col border-b border-border bg-background p-6 gap-4">
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold leading-tight text-foreground">
            {ticket.subject}
          </h2>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-xs h-6 px-2.5 font-medium",
              TICKET_STATUS_META[ticket.status].className
            )}
          >
            {TICKET_STATUS_META[ticket.status].label}
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-1">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 opacity-70" />
            <span className="font-medium text-foreground">
              {showCustomer ? getCreatorDisplay(ticket) : "You"}
            </span>
            {showCustomer && ticket.creator?.email && (
              <span className="opacity-70">({ticket.creator.email})</span>
            )}
          </div>
          
          <div className="h-1 w-1 rounded-full bg-border" />
          
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 opacity-70" />
            <span>
              {new Date(ticket.created_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {ticket.vps_label && (
            <>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 opacity-70" />
                <span className="font-medium text-foreground">{ticket.vps_label}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {children}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
          className={cn(
            "text-xs font-normal border bg-transparent",
            TICKET_PRIORITY_META[ticket.priority].className
          )}
        >
          Priority: {TICKET_PRIORITY_META[ticket.priority].label}
        </Badge>
        
        <Badge variant="outline" className="text-xs font-normal capitalize">
          Category: {ticket.category.replace("_", " ")}
        </Badge>
      </div>
    </div>
  </div>
  );
};
