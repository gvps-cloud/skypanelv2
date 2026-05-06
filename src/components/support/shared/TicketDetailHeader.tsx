import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SupportTicket } from "@/types/support";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "./constants";
import { ArrowLeft, Clock, Globe, MapPin, Shield, User } from "lucide-react";

interface TicketDetailHeaderProps {
  ticket: SupportTicket;
  onBack: () => void;
  showCustomer?: boolean;
  /** When true, priority/category badges hide from lg breakpoint (e.g. shown in right rail). */
  relocateMetaToSidebar?: boolean;
  children?: React.ReactNode;
}

export const TicketDetailHeader: React.FC<TicketDetailHeaderProps> = ({
  ticket,
  onBack,
  showCustomer = false,
  relocateMetaToSidebar = false,
  children,
}) => {
  const getCreatorDisplay = (ticket: SupportTicket): string => {
    if (!ticket.creator) return ticket.created_by || "Unknown";
    return ticket.creator.displayName || ticket.creator.email || ticket.created_by || "Unknown";
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border bg-background p-4 sm:p-5 md:p-6">
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
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 break-words text-xl font-semibold leading-tight text-foreground">
            {ticket.subject}
          </h2>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto h-6 shrink-0 px-2.5 text-xs font-medium",
              TICKET_STATUS_META[ticket.status].className
            )}
          >
            {TICKET_STATUS_META[ticket.status].label}
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <User className="h-3.5 w-3.5 opacity-70" />
            <span className="min-w-0 truncate font-medium text-foreground">
              {showCustomer ? getCreatorDisplay(ticket) : "You"}
            </span>
            {showCustomer && ticket.creator?.email && (
              <span className="truncate opacity-70" title={ticket.creator.email}>
                ({ticket.creator.email})
              </span>
            )}
          </div>

          {showCustomer && (ticket.organization_name || ticket.organization_slug) && (
            <>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div className="flex min-w-0 items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 opacity-70" />
                <span className="min-w-0 truncate font-medium text-foreground">
                  {ticket.organization_name || ticket.organization_slug}
                </span>
                {ticket.organization_name && ticket.organization_slug && (
                  <span className="truncate opacity-70" title={ticket.organization_slug}>
                    @{ticket.organization_slug}
                  </span>
                )}
              </div>
            </>
          )}
          
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
              <div className="flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 opacity-70" />
                <span className="min-w-0 truncate font-medium text-foreground" title={ticket.vps_label}>
                  {ticket.vps_label}
                </span>
              </div>
            </>
          )}

          {ticket.hosting_subscription_id && (
            <>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 min-w-0">
                <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="font-medium text-foreground truncate">
                  {[ticket.hosting_domain, ticket.hosting_plan_name]
                    .filter((part) => Boolean(part && String(part).trim()))
                    .join(" · ") || "Hosting subscription"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-3">
        {children}
        <div
          className={cn(
            "flex flex-wrap gap-2",
            relocateMetaToSidebar && "lg:hidden",
          )}
        >
          <Badge
            variant="secondary"
            className={cn(
              "border bg-transparent text-xs font-normal",
              TICKET_PRIORITY_META[ticket.priority].className,
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
