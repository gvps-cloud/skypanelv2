import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle,
  Clock,
  Mail,
  MailOpen,
  RefreshCw,
  Send,
  Trash2,
  User,
  Ticket,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { buildApiUrl } from "@/lib/api";
import {
  SupportTicket,
  TicketMessage,
  TicketStatus,
} from "@/types/support";
import { TicketList } from "../support/shared/TicketList";
import { TicketDetailHeader } from "../support/shared/TicketDetailHeader";
import { MessageBubble } from "../support/shared/MessageBubble";
import { TicketInfoSidebar } from "../support/shared/TicketInfoSidebar";

const ADMIN_TICKET_STATUS_ACTIONS: Record<
  TicketStatus,
  Array<{
    status: TicketStatus;
    label: string;
    icon: React.ElementType;
    primary?: boolean;
  }>
> = {
  open: [
    {
      status: "in_progress",
      label: "Mark In Progress",
      icon: Clock,
      primary: true,
    },
    { status: "resolved", label: "Mark Resolved", icon: CheckCircle },
    { status: "closed", label: "Close Ticket", icon: MailOpen },
  ],
  in_progress: [
    {
      status: "resolved",
      label: "Mark Resolved",
      icon: CheckCircle,
      primary: true,
    },
    { status: "open", label: "Mark Open", icon: Mail },
    { status: "closed", label: "Close Ticket", icon: MailOpen },
  ],
  resolved: [
    { status: "closed", label: "Close Ticket", icon: MailOpen, primary: true },
    { status: "open", label: "Re-open", icon: RefreshCw },
    { status: "in_progress", label: "Mark In Progress", icon: Clock },
  ],
  closed: [
    { status: "open", label: "Re-open", icon: RefreshCw, primary: true },
  ],
};

interface AdminSupportViewProps {
  token: string;
  pendingFocusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
}

export const AdminSupportView: React.FC<AdminSupportViewProps> = ({
  token,
  pendingFocusTicketId,
  onFocusTicketHandled,
}) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientBalance, setClientBalance] = useState<number | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const ticketStatusRef = useRef<TicketStatus | undefined>(undefined);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin/tickets"), {
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch tickets");
      setTickets(data.tickets || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    ticketStatusRef.current = selectedTicket?.status;
  }, [selectedTicket?.status]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const fetchClientBalance = async () => {
      if (!selectedTicket?.creator?.id) {
        setClientBalance(null);
        return;
      }
      try {
        const res = await fetch(
          buildApiUrl(`/api/admin/users/${selectedTicket.creator.id}/detail`),
          { headers: authHeader }
        );
        const data = await res.json();
        if (res.ok && data.billing) {
          setClientBalance(data.billing.wallet_balance);
        }
      } catch (err) {
        console.warn("Failed to fetch client balance", err);
      }
    };

    if (selectedTicket) {
      fetchClientBalance();
    }
  }, [selectedTicket?.creator?.id, authHeader]);

  // Set up real-time updates for selected ticket
  useEffect(() => {
    if (!selectedTicket || !token) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      buildApiUrl(
        `/api/admin/tickets/${selectedTicket.id}/stream?token=${token}`
      )
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "ticket_message" && data.ticket_id === selectedTicket.id) {
          const newMsg: TicketMessage = {
            id: data.message_id,
            ticket_id: data.ticket_id,
            sender_type: data.is_staff_reply ? "admin" : "user",
            sender_name: data.is_staff_reply ? "Support Team" : (data.sender_name || "User"),
            message: data.message,
            created_at: data.created_at,
          };

          setSelectedTicket((prev) => {
            if (!prev || prev.id !== data.ticket_id) return prev;
            if (prev.messages.some((m) => m.id === newMsg.id)) return prev;

            const updated = {
              ...prev,
              messages: [...prev.messages, newMsg],
              has_staff_reply: prev.has_staff_reply || data.is_staff_reply,
            };

            // Notify if it's a new message from the user (not staff)
            if (!data.is_staff_reply) {
              toast.info("New customer reply received");
            }

            return updated;
          });
          
          setTimeout(scrollToBottom, 100);
        }

        if (
          data.type === "ticket_status_change" &&
          data.ticket_id === selectedTicket.id
        ) {
          const newStatus = data.new_status;
          
          // Skip if we already have this status (e.g. we just updated it manually)
          if (newStatus === ticketStatusRef.current) return;

          setSelectedTicket((prev) =>
            prev ? { ...prev, status: newStatus } : prev
          );
          setTickets((prev) =>
            prev.map((t) =>
              t.id === data.ticket_id ? { ...t, status: newStatus } : t
            )
          );
          toast.info(
            `Ticket status updated to: ${newStatus.replace("_", " ")}`
          );
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [selectedTicket?.id, token, scrollToBottom]);

  const openTicket = useCallback(
    async (ticket: SupportTicket) => {
      if (selectedTicket?.id !== ticket.id) {
        setSelectedTicket({ ...ticket, messages: [] });
      }

      try {
        const res = await fetch(
          buildApiUrl(`/api/admin/tickets/${ticket.id}/replies`),
          { headers: authHeader }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load replies");
        
        const msgs: TicketMessage[] = (data.replies || []).map((m: any) => ({
          id: m.id,
          ticket_id: m.ticket_id,
          sender_type: m.sender_type,
          sender_name: m.sender_name,
          message: m.message,
          created_at: m.created_at,
        }));
        
        setSelectedTicket((prev) =>
          prev ? { ...prev, messages: msgs } : prev
        );
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        toast.error(e.message || "Failed to load replies");
      }
    },
    [authHeader, scrollToBottom, selectedTicket?.id]
  );

  // Handle pending focus ticket once the opener is ready
  useEffect(() => {
    if (pendingFocusTicketId && tickets.length > 0) {
      const ticket = tickets.find((t) => t.id === pendingFocusTicketId);
      if (ticket) {
        openTicket(ticket);
        onFocusTicketHandled?.();
      } else {
        onFocusTicketHandled?.();
      }
    }
  }, [pendingFocusTicketId, tickets, openTicket, onFocusTicketHandled]);

  const sendReply = useCallback(async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/tickets/${selectedTicket.id}/replies`),
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ message: replyMessage }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      toast.success("Reply sent successfully");
      setReplyMessage("");
      
      const newReply = data.reply;
      if (newReply) {
        const newMsg: TicketMessage = {
          id: newReply.id,
          ticket_id: newReply.ticket_id,
          sender_type: newReply.sender_type,
          sender_name: newReply.sender_name,
          message: newReply.message,
          created_at: newReply.created_at,
        };
        
        setSelectedTicket((prev) => {
          if (!prev || prev.id !== newReply.ticket_id) return prev;
          if (prev.messages.some(m => m.id === newMsg.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, newMsg]
          };
        });
        setTimeout(scrollToBottom, 100);
      } else {
        await openTicket(selectedTicket);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send reply");
    }
  }, [selectedTicket, replyMessage, authHeader, openTicket]);

  const updateTicketStatus = useCallback(
    async (ticketId: string, status: TicketStatus) => {
      try {
        const res = await fetch(
          buildApiUrl(`/api/admin/tickets/${ticketId}/status`),
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update status");
        const updatedStatus = (data?.ticket?.status as TicketStatus) || status;

        toast.success(`Ticket marked as ${updatedStatus.replace("_", " ")}`);
        await fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) =>
            prev ? { ...prev, status: updatedStatus } : prev
          );
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to update ticket status");
      }
    },
    [authHeader, fetchTickets, selectedTicket]
  );

  const deleteTicket = useCallback(async () => {
    if (!deleteTicketId) return;

    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/tickets/${deleteTicketId}`),
        {
          method: "DELETE",
          headers: authHeader,
        }
      );
      const raw = await res.text();
      let data: any;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch (parseError) {
          console.warn("Failed to parse delete ticket response", parseError);
        }
      }
      if (!res.ok)
        throw new Error(data?.error || raw || "Failed to delete ticket");

      toast.success("Ticket deleted successfully");
      if (selectedTicket?.id === deleteTicketId) {
        setSelectedTicket(null);
      }
      await fetchTickets();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete ticket");
    } finally {
      setDeleteTicketId(null);
    }
  }, [deleteTicketId, authHeader, selectedTicket, fetchTickets]);

  return (
    <>
      <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {/* Sidebar - Ticket List */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-muted/10 shrink-0 transition-all duration-300 ease-in-out",
            selectedTicket ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full md:w-80 lg:w-96"
          )}
        >
          <TicketList
            tickets={tickets}
            selectedTicketId={selectedTicket?.id || null}
            onSelectTicket={openTicket}
            isLoading={loading}
            isAdmin={true}
          />
        </div>

        {/* Main Content - Ticket Detail */}
        <div
          className={cn(
            "flex flex-1 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
            !selectedTicket ? "hidden md:flex" : "flex"
          )}
        >
          {!selectedTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center p-8 bg-muted/5">
              <div className="rounded-full bg-primary/5 p-6 ring-1 ring-primary/10">
                <Ticket className="h-12 w-12 text-primary/40" />
              </div>
              <div className="max-w-sm space-y-2">
                <h3 className="text-xl font-semibold tracking-tight">Select a ticket</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Choose a ticket from the list to view details, respond to customers, or update status.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 h-full overflow-hidden">
              <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Ticket Header */}
                <TicketDetailHeader
                  ticket={selectedTicket}
                  onBack={() => setSelectedTicket(null)}
                  showCustomer={true}
              >
                {/* Action buttons - responsive layout */}
                <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                  {/* Info button for mobile only */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="lg:hidden h-8 border-dashed border-primary/20 text-primary hover:bg-primary/5" 
                    onClick={() => setIsInfoOpen(true)}
                  >
                    <Info className="mr-1.5 h-3.5 w-3.5" />
                    Info
                  </Button>

                  {/* View Customer button */}
                  {selectedTicket.creator?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        navigate(`/admin/user/${selectedTicket.creator?.id}`)
                      }
                    >
                      <User className="mr-1.5 h-3.5 w-3.5" />
                      View Customer
                    </Button>
                  )}
                  
                  {/* Status action buttons */}
                  {ADMIN_TICKET_STATUS_ACTIONS[selectedTicket.status].map(
                    (action) => {
                      const ActionIcon = action.icon;
                      return (
                        <Button
                          key={`${selectedTicket.status}-${action.status}`}
                          size="sm"
                          variant={action.primary ? "default" : "outline"}
                          className="h-8"
                          onClick={() =>
                            updateTicketStatus(
                              selectedTicket.id,
                              action.status,
                            )
                          }
                        >
                          <ActionIcon className="mr-1.5 h-3.5 w-3.5" />
                          {action.label}
                        </Button>
                      );
                    }
                  )}
                  
                  {/* Delete button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    onClick={() => setDeleteTicketId(selectedTicket.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </TicketDetailHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6 bg-muted/5">
                <div className="space-y-6 max-w-4xl mx-auto">
                  {/* Original Message */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Original Request
                      </span>
                    </div>
                  </div>
                  
                  <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs">
                        User
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {selectedTicket.creator?.displayName || selectedTicket.creator?.email || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(selectedTicket.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* Replies */}
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    <div className="space-y-6 pt-4">
                      {selectedTicket.messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isCurrentUser={msg.sender_type === "admin"}
                          showSenderName={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground mt-4 bg-muted/20">
                      No replies yet. Be the first to respond!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Box */}
              <div className="border-t border-border bg-background p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-3">
                  <div className="relative">
                    <Textarea
                      rows={4}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your response..."
                      className="resize-none pr-12 min-h-[100px] shadow-sm focus-visible:ring-primary/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={sendReply} 
                        disabled={!replyMessage.trim()}
                        className="h-8 w-8 p-0 rounded-full"
                        title="Send Reply (Ctrl+Enter)"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end items-center text-xs text-muted-foreground px-1">
                    <span>Press Ctrl+Enter to send</span>
                  </div>
                </div>
              </div>
              </div>
              <TicketInfoSidebar 
                ticket={selectedTicket}
                walletBalance={clientBalance}
                isAdmin={true}
                clientName={selectedTicket.creator?.displayName}
                clientEmail={selectedTicket.creator?.email || undefined}
                className="hidden lg:flex w-80 shrink-0"
              />

              <Sheet open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <SheetContent side="right" className="p-0 sm:max-w-md w-full border-l border-border">
                  <SheetHeader className="px-6 py-4 border-b border-border">
                    <SheetTitle>Ticket Details</SheetTitle>
                  </SheetHeader>
                  <TicketInfoSidebar 
                    ticket={selectedTicket}
                    walletBalance={clientBalance}
                    isAdmin={true}
                    clientName={selectedTicket.creator?.displayName}
                    clientEmail={selectedTicket.creator?.email || undefined}
                    className="w-full border-none bg-background"
                  />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTicketId}
        onOpenChange={() => setDeleteTicketId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ticket? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTicket}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
