import React, { useState } from "react";
import { 
  Calendar, 
  Copy,
  Clock, 
  CreditCard, 
  Hash, 
  Info, 
  MapPin, 
  Server, 
  User,
  Shield,
  Tag,
  ExternalLink,
  Terminal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SupportTicket } from "@/types/support";
import { TICKET_STATUS_META, TICKET_PRIORITY_META } from "./constants";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SSHTerminal } from "@/components/VPS/SSHTerminal";

interface TicketInfoSidebarProps {
  ticket: SupportTicket;
  walletBalance?: number | null;
  isAdmin?: boolean;
  showRequester?: boolean;
  clientName?: string;
  clientEmail?: string;
  className?: string;
}

export const TicketInfoSidebar: React.FC<TicketInfoSidebarProps> = ({
  ticket,
  walletBalance,
  isAdmin = false,
  showRequester = false,
  clientName,
  clientEmail,
  className,
}) => {
  const [isSSHOpen, setIsSSHOpen] = useState(false);
  const shouldShowRequester = isAdmin || showRequester;
  const requesterName = clientName || ticket.creator?.displayName || ticket.created_by || "Unknown User";
  const requesterEmail = clientEmail || ticket.creator?.email || undefined;
  const organizationLabel = ticket.organization_name || ticket.organization_slug || "Organization";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleSSHClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!ticket.vps_id) return;
    setIsSSHOpen(true);
  };

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(value);
        toast.success(`${label} copied to clipboard`);
        return;
      }

      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        toast.success(`${label} copied to clipboard`);
      } else {
        throw new Error("Copy command failed");
      }
    } catch (error) {
      console.error(`Failed to copy ${label.toLowerCase()}:`, error);
      toast.error("Unable to copy to clipboard. Please copy manually.");
    }
  };

  return (
    <>
      <div className={cn("w-80 border-l border-border bg-muted/10 flex flex-col h-full overflow-y-auto shrink-0", className)}>
      <div className="p-4 space-y-6">
        {/* Client Info Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            {isAdmin ? "Client Information" : shouldShowRequester ? "Requester & Account" : "My Account"}
          </h3>
          
          <div className="bg-background rounded-lg border border-border p-3 space-y-3 shadow-sm">
            {shouldShowRequester && (requesterName || requesterEmail) && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary/70" />
                  <span className="truncate">{requesterName}</span>
                </div>
                {requesterEmail && (
                  <div className="text-xs text-muted-foreground pl-6 truncate" title={requesterEmail}>
                    {requesterEmail}
                  </div>
                )}
                <Separator className="my-2" />
              </div>
            )}

            {shouldShowRequester && (ticket.organization_id || ticket.organization_name || ticket.organization_slug) && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 text-primary/70" />
                  <span className="truncate">
                    {organizationLabel}
                  </span>
                </div>
                {ticket.organization_id && (
                  <div className="pl-6 space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground block">
                      Organization ID
                    </span>
                    <div className="flex items-center gap-2">
                      <div
                        className="font-mono text-xs bg-muted/50 p-1.5 rounded truncate select-all flex-1 min-w-0"
                        title={ticket.organization_id}
                      >
                        {ticket.organization_id}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => void handleCopy(ticket.organization_id!, "Organization ID")}
                        aria-label="Copy organization ID"
                        title="Copy organization ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <Separator className="my-2" />
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Wallet Balance</span>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary/70" />
                <span className={cn(
                  "text-lg font-bold tabular-nums",
                  (walletBalance || 0) < 0 ? "text-destructive" : "text-foreground"
                )}>
                  {walletBalance !== undefined && walletBalance !== null 
                    ? formatCurrency(walletBalance) 
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Service Section */}
        {ticket.vps_id && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Server className="h-3.5 w-3.5" />
              Related Service
            </h3>
            
            <div className="bg-background rounded-lg border border-border p-3 space-y-3 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {ticket.vps_label || "Unknown VPS"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      ID: {ticket.vps_id}
                    </div>
                  </div>
                </div>
                
                {ticket.vps_label && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{ticket.vps_label}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full"
                    asChild
                  >
                    <Link to={`/vps/${ticket.vps_id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full"
                    onClick={handleSSHClick}
                  >
                    <Terminal className="h-3.5 w-3.5 mr-1.5" />
                    SSH
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ticket Details Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Info className="h-3.5 w-3.5" />
            Ticket Details
          </h3>
          
          <div className="bg-background rounded-lg border border-border p-3 space-y-3 shadow-sm text-sm">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
              <div className="col-span-2 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Ticket ID
                </span>
                <div className="font-mono text-xs bg-muted/50 p-1.5 rounded truncate select-all">
                  {ticket.id}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block">Status</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5 px-1.5 font-normal w-fit",
                    TICKET_STATUS_META[ticket.status].className
                  )}
                >
                  {TICKET_STATUS_META[ticket.status].label}
                </Badge>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block">Priority</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5 px-1.5 font-normal w-fit",
                    TICKET_PRIORITY_META[ticket.priority].className
                  )}
                >
                  {TICKET_PRIORITY_META[ticket.priority].label}
                </Badge>
              </div>
              
              <div className="col-span-2 space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Category
                </span>
                <div className="capitalize font-medium">
                  {ticket.category.replace("_", " ")}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Created
                </span>
                <span className="tabular-nums">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Last Updated
                </span>
                <span className="tabular-nums">
                  {new Date(ticket.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* SSH Console Dialog */}
    <Dialog open={isSSHOpen} onOpenChange={setIsSSHOpen}>
      <DialogContent className="max-w-[90vw] w-full h-[80vh] flex flex-col p-0 gap-0 bg-background border-border">
        <DialogHeader className="px-4 py-2 border-b border-border/20 bg-muted/10 shrink-0">
          <DialogTitle className="text-sm font-mono flex items-center gap-2 text-foreground">
            <Terminal className="h-4 w-4" />
            SSH Console{" "}
            {ticket.vps_id && (
              <span className="opacity-50">:: {ticket.vps_id}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden relative bg-background">
          {isSSHOpen && ticket.vps_id && (
            <SSHTerminal
              instanceId={ticket.vps_id}
              fitContainer={true}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};
