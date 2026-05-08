import React, { useState, lazy, Suspense } from "react";
import { 
  Calendar, 
  Copy,
  Clock, 
  CreditCard, 
  Globe,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const LazySSHTerminal = lazy(() =>
  import("@/components/VPS/SSHTerminal").then((m) => ({ default: m.SSHTerminal })),
);
import { formatTicketDateTimeLabel } from "@/lib/supportTicketDisplay";

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
  const canViewHosting =
    isAdmin === true &&
    Boolean(ticket.hosting_subscription_id) &&
    ticket.hosting_subscription_is_active === true &&
    ticket.hosting_plan_is_active === true;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
      console.error('Failed to copy ticket info field', {
        label: label.toLowerCase(),
      }, error);
      toast.error("Unable to copy to clipboard. Please copy manually.");
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-muted/10",
          className,
        )}
      >
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="box-border min-w-0 max-w-full space-y-6 p-4">
        {/* Client Info Section */}
        <div className="min-w-0 space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            {isAdmin ? "Client Information" : shouldShowRequester ? "Requester & Account" : "My Account"}
          </h3>
          
          <div className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3 shadow-sm">
            {shouldShowRequester && (requesterName || requesterEmail) && (
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="min-w-0 break-words">{requesterName}</span>
                </div>
                {requesterEmail && (
                  <div className="min-w-0 break-all pl-6 text-xs text-muted-foreground" title={requesterEmail}>
                    {requesterEmail}
                  </div>
                )}
                <Separator className="my-2" />
              </div>
            )}

            {shouldShowRequester && (ticket.organization_id || ticket.organization_name || ticket.organization_slug) && (
              <div className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4 shrink-0 text-primary/70" />
                  <span className="min-w-0 break-words">
                    {organizationLabel}
                  </span>
                </div>
                {ticket.organization_id && (
                  <div className="min-w-0 space-y-1 pl-6">
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Organization ID
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="min-w-0 flex-1 break-all rounded bg-muted/50 p-1.5 font-mono text-xs select-all"
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
          <div className="min-w-0 space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Server className="h-3.5 w-3.5 shrink-0" />
              Related Service
            </h3>
            
            <div className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3 shadow-sm">
              <div className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                    <Server className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium leading-snug line-clamp-2">
                      {ticket.vps_label || "Unknown VPS"}
                    </div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                      ID: {ticket.vps_id}
                    </div>
                  </div>
                </div>
                
                {ticket.vps_label && (
                  <div className="flex min-w-0 items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 break-words">{ticket.vps_label}</span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="flex min-w-0 flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full min-w-0 justify-center"
                    asChild
                  >
                    <Link to={`/vps/${ticket.vps_id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full min-w-0 justify-center"
                    onClick={handleSSHClick}
                  >
                    <Terminal className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    SSH
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {ticket.hosting_subscription_id && (
          <div className="min-w-0 space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              Related hosting
            </h3>

            <div className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3 shadow-sm">
              <div className="min-w-0 space-y-2">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-medium leading-snug line-clamp-3">
                      {[ticket.hosting_domain, ticket.hosting_plan_name]
                        .filter((part) => Boolean(part && String(part).trim()))
                        .join(" · ") || "Hosting subscription"}
                    </div>
                    <div className="break-all font-mono text-xs text-muted-foreground">
                      ID: {ticket.hosting_subscription_id}
                    </div>
                  </div>
                </div>

                {ticket.hosting_domain && (
                  <div className="flex min-w-0 items-center gap-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 break-words">{ticket.hosting_domain}</span>
                  </div>
                )}
              </div>

              {canViewHosting && (
                <Button variant="outline" size="sm" className="h-8 w-full min-w-0 justify-center" asChild>
                  <Link to={`/hosting/${ticket.hosting_subscription_id}`}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                    View hosting
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Ticket Details Section */}
        <div className="min-w-0 space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Ticket Details
          </h3>
          
          <div className="min-w-0 space-y-3 rounded-lg border border-border bg-background p-3 text-sm shadow-sm">
            <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-3">
              <div className="col-span-2 min-w-0 space-y-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Hash className="h-3 w-3 shrink-0" /> Ticket ID
                </span>
                <div className="select-all break-all rounded bg-muted/50 p-1.5 font-mono text-xs">
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
              
              <div className="col-span-2 min-w-0 space-y-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3 shrink-0" /> Category
                </span>
                <div className="break-words font-medium capitalize">
                  {ticket.category.replace("_", " ")}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-2 text-xs">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" /> Created
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums text-foreground">
                  {formatTicketDateTimeLabel(ticket.created_at)}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" /> Last updated
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums text-foreground">
                  {formatTicketDateTimeLabel(ticket.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </ScrollArea>
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
          <DialogDescription className="sr-only">
            Browser-based SSH terminal for the VPS linked to this support ticket.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden relative bg-background">
          {isSSHOpen && ticket.vps_id && (
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading terminal…</div>}>
              <LazySSHTerminal
                instanceId={ticket.vps_id}
                fitContainer={true}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
};
