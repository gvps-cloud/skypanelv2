import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Ticket,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  isReopenRequestMessage,
  formatTicketMessage,
} from "@/types/support";
import { TicketList } from "./shared/TicketList";
import { TicketDetailHeader } from "./shared/TicketDetailHeader";
import { MessageBubble } from "./shared/MessageBubble";
import { CreateTicketDialog, CreateTicketData } from "./shared/CreateTicketDialog";
import { TicketInfoSidebar } from "./shared/TicketInfoSidebar";

import { useAuth } from "@/contexts/AuthContext";

interface UserSupportViewProps {
  token: string;
  pendingFocusTicketId?: string | null;
  onFocusTicketHandled?: () => void;
}

export const UserSupportView: React.FC<UserSupportViewProps> = ({
  token,
  pendingFocusTicketId,
  onFocusTicketHandled,
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [reopenRequestMessage, setReopenRequestMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketsInitialized, setTicketsInitialized] = useState(false);
  const [requestingReopen, setRequestingReopen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const ticketStatusRef = useRef<TicketStatus | undefined>(undefined);

  const [vpsInstances, setVpsInstances] = useState<
    Array<{ id: string; label: string }>
  >([]);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const fetchWalletBalance = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/payments/wallet/balance"), {
        headers: authHeader,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWalletBalance(data.balance);
      }
    } catch (err) {
      console.warn("Failed to fetch wallet balance", err);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const fetchVpsInstances = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/vps"), {
        headers: authHeader,
      });
      const data = await res.json();
      if (res.ok && data.instances) {
        setVpsInstances(
          data.instances.map((i: any) => ({ id: i.id, label: i.label }))
        );
      }
    } catch (err) {
      console.warn("Failed to fetch VPS instances for ticket creation", err);
    }
  }, [authHeader]);

  useEffect(() => {
    if (isCreateModalOpen) {
      fetchVpsInstances();
    }
  }, [isCreateModalOpen, fetchVpsInstances]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/support/tickets"), {
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch tickets");

      const mapped: SupportTicket[] = (data.tickets || []).map((t: any) => ({
        id: t.id,
        subject: t.subject,
        description: t.message, // Map message to description for list view
        message: t.message,
        status: t.status,
        priority: t.priority,
        category: t.category,
        created_at: t.created_at,
        updated_at: t.updated_at,
        has_staff_reply: t.has_staff_reply || false,
        vps_id: t.vps_id,
        vps_label: t.vps_label,
        messages: [],
      }));

      setTickets(mapped);
    } catch (error: any) {
      toast.error(error.message || "Failed to load tickets");
    } finally {
      setLoading(false);
      setTicketsInitialized(true);
    }
  }, [authHeader]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    ticketStatusRef.current = selectedTicket?.status;
  }, [selectedTicket?.status]);

  useEffect(() => {
    setReplyMessage("");
    setReopenRequestMessage("");
  }, [selectedTicket?.id]);

  // Set up real-time updates for selected ticket
  useEffect(() => {
    if (!selectedTicket || !token) return;

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      buildApiUrl(
        `/api/support/tickets/${selectedTicket.id}/stream?token=${token}`
      )
    );
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          data.type === "ticket_message" &&
          data.ticket_id === selectedTicket.id
        ) {
          const newMsg: TicketMessage = {
            id: data.message_id,
            ticket_id: data.ticket_id,
            sender_type: data.is_staff_reply ? "admin" : "user",
            sender_name: data.is_staff_reply 
              ? "Support Team" 
              : (data.sender_name || (user ? `${user.firstName} ${user.lastName}`.trim() : "You")),
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

            if (data.is_staff_reply) {
              toast.info("New reply received");
            }

            return updated;
          });

          setTickets((prev) =>
            prev.map((t) =>
              t.id === data.ticket_id
                ? {
                    ...t,
                    has_staff_reply: t.has_staff_reply || data.is_staff_reply,
                  }
                : t
            )
          );

          setTimeout(scrollToBottom, 100);
        }

        if (
          data.type === "ticket_status_change" &&
          data.ticket_id === selectedTicket.id
        ) {
          // Skip if we already have this status
          if (data.new_status === ticketStatusRef.current) return;

          setSelectedTicket((prev) =>
            prev ? { ...prev, status: data.new_status } : prev
          );
          setTickets((prev) =>
            prev.map((t) =>
              t.id === data.ticket_id ? { ...t, status: data.new_status } : t
            )
          );
          toast.info(
            `Ticket status updated to: ${data.new_status.replace("_", " ")}`
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
      // Don't reload if already selected (optional optimization, but good for avoiding flicker)
      // But we do want to load messages if they aren't loaded.
      // For now, let's just set it.
      
      if (selectedTicket?.id !== ticket.id) {
        setSelectedTicket({ ...ticket, messages: [] });
      }
      
      try {
        const res = await fetch(
          buildApiUrl(`/api/support/tickets/${ticket.id}/replies`),
          { headers: authHeader }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load replies");
        
        const msgs: TicketMessage[] = (data.replies || []).map((m: any) => ({
          id: m.id,
          ticket_id: m.ticket_id,
          sender_type: m.sender_type,
          sender_name: m.sender_type === "admin" 
            ? "Support Team" 
            : (user ? `${user.firstName} ${user.lastName}`.trim() : "You"),
          message: m.message,
          created_at: m.created_at,
        }));
        
        setSelectedTicket((prev) =>
          prev ? { ...prev, messages: msgs } : prev
        );
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        toast.error(e.message || "Failed to load messages");
      }
    },
    [authHeader, scrollToBottom, selectedTicket?.id, user]
  );

  useEffect(() => {
    if (!pendingFocusTicketId) {
      return;
    }

    if (tickets.length === 0) {
      if (ticketsInitialized) {
        onFocusTicketHandled?.();
      }
      return;
    }

    const matchingTicket = tickets.find(
      (ticket) => ticket.id === pendingFocusTicketId
    );
    if (!matchingTicket) {
      onFocusTicketHandled?.();
      return;
    }

    void openTicket(matchingTicket);
    onFocusTicketHandled?.();
  }, [
    pendingFocusTicketId,
    tickets,
    openTicket,
    onFocusTicketHandled,
    ticketsInitialized,
  ]);

  const sendReply = useCallback(async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    if (selectedTicket.status === "closed") {
      toast.error("This ticket is closed. Request a reopen to continue.");
      return;
    }

    try {
      const res = await fetch(
        buildApiUrl(`/api/support/tickets/${selectedTicket.id}/replies`),
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

  const requestReopen = useCallback(async () => {
    if (!selectedTicket) return;
    if (selectedTicket.status !== "closed") {
      toast.error("Only closed tickets can be reopened.");
      return;
    }

    setRequestingReopen(true);
    try {
      const note = reopenRequestMessage.trim();
      const payload = note ? { message: note } : {};
      const res = await fetch(
        buildApiUrl(`/api/support/tickets/${selectedTicket.id}/reopen-request`),
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request reopen");

      toast.success("Re-open request sent to support staff");
      setReopenRequestMessage("");
      
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
            status: "open", // Reopen request usually reopens or updates status
            messages: [...prev.messages, newMsg]
          };
        });
        setTimeout(scrollToBottom, 100);
      } else {
        await openTicket(selectedTicket);
      }
      await fetchTickets(); // Still need to refresh list status
    } catch (error: any) {
      toast.error(error.message || "Failed to request reopen");
    } finally {
      setRequestingReopen(false);
    }
  }, [
    selectedTicket,
    reopenRequestMessage,
    authHeader,
    openTicket,
    fetchTickets,
  ]);

  const handleCreateTicket = async (data: CreateTicketData) => {
    try {
      const res = await fetch(buildApiUrl("/api/support/tickets"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create ticket");

      toast.success("Support ticket created successfully");
      setIsCreateModalOpen(false);
      await fetchTickets();
    } catch (error: any) {
      toast.error(error.message || "Failed to create support ticket");
      throw error; // Re-throw for dialog to handle state
    }
  };

  return (
    <>
      <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {/* Sidebar - Ticket List */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-muted/10 w-full md:w-80 lg:w-96 shrink-0 transition-all duration-300 ease-in-out",
            selectedTicket ? "hidden md:flex" : "flex"
          )}
        >
          <TicketList
            tickets={tickets}
            selectedTicketId={selectedTicket?.id || null}
            onSelectTicket={openTicket}
            onCreateTicket={() => setIsCreateModalOpen(true)}
            isLoading={loading}
          />
        </div>

        {/* Main Content - Ticket Detail */}
        <div
          className={cn(
            "flex flex-1 flex-col bg-background transition-all duration-300 ease-in-out",
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
                  Choose a ticket from the list to view details and respond, or create a new one to get help.
                </p>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Ticket
              </Button>
            </div>
          ) : (
            <div className="flex flex-1 h-full overflow-hidden">
              <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Ticket Header */}
                <TicketDetailHeader
                  ticket={selectedTicket}
                  onBack={() => setSelectedTicket(null)}
                >
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="lg:hidden w-full mb-2 border-dashed border-primary/20 text-primary hover:bg-primary/5" 
                    onClick={() => setIsInfoOpen(true)}
                  >
                    <Info className="mr-2 h-4 w-4" /> View Ticket Details & Balance
                  </Button>
                </TicketDetailHeader>

                {/* Messages */}
              <ScrollArea className="flex-1 p-6 bg-muted/5">
                <div className="space-y-6 max-w-5xl mx-auto w-full px-4 md:px-8">
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
                  
                  <div className="rounded-xl border border-border bg-background p-5 shadow-sm max-w-3xl mx-auto w-full">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                        You
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">You</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(selectedTicket.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {selectedTicket.description || selectedTicket.message}
                    </p>
                  </div>

                  {/* Replies */}
                  {selectedTicket.messages.length > 0 && (
                    <div className="space-y-6 pt-4 max-w-3xl mx-auto w-full">
                      {selectedTicket.messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isCurrentUser={msg.sender_type === "user"}
                        />
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Box */}
              <div className="border-t border-border bg-background p-4 md:p-6">
                <div className="max-w-3xl mx-auto w-full">
                  {selectedTicket.status === "closed" ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This ticket is closed. You can request to re-open it or create a new ticket.
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center max-w-xl mx-auto w-full">
                        <Textarea
                          rows={2}
                          value={reopenRequestMessage}
                          onChange={(e) => setReopenRequestMessage(e.target.value)}
                          placeholder="Optional reason for re-opening..."
                          className="resize-none flex-1 min-h-[80px]"
                        />
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <Button
                            onClick={requestReopen}
                            disabled={requestingReopen}
                            className="w-full whitespace-nowrap"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {requestingReopen ? "Requesting..." : "Re-open Ticket"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full"
                          >
                            New Ticket
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Textarea
                          rows={4}
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type your reply here..."
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
                      <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                        <span>Markdown supported</span>
                        <span>Press Ctrl+Enter to send</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
              <TicketInfoSidebar 
                ticket={selectedTicket}
                walletBalance={walletBalance}
                className="hidden lg:flex w-80 shrink-0"
              />

              <Sheet open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <SheetContent side="right" className="p-0 sm:max-w-md w-full border-l border-border">
                  <SheetHeader className="px-6 py-4 border-b border-border">
                    <SheetTitle>Ticket Details</SheetTitle>
                  </SheetHeader>
                  <TicketInfoSidebar 
                    ticket={selectedTicket}
                    walletBalance={walletBalance}
                    className="w-full border-none bg-background"
                  />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>

      <CreateTicketDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateTicket}
        vpsInstances={vpsInstances}
      />
    </>
  );
};
