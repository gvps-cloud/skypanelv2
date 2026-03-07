/**
 * User Support View - Inbox-style support ticket interface for users
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Clock,
  Inbox,
  Mail,
  MailOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildApiUrl } from "@/lib/api";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketCategory = "technical" | "billing" | "general" | "feature_request";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_at: string;
  updated_at: string;
  has_staff_reply: boolean;
  vps_id?: string;
  vps_label?: string;
  messages: TicketMessage[];
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: "user" | "admin";
  sender_name: string;
  message: string;
  created_at: string;
}

const REOPEN_REQUEST_PREFIX = "[REOPEN_REQUEST]";
const isReopenRequestMessage = (message: string): boolean =>
  typeof message === "string" && message.startsWith(REOPEN_REQUEST_PREFIX);
const formatTicketMessage = (message: string): string =>
  isReopenRequestMessage(message)
    ? message.replace(REOPEN_REQUEST_PREFIX, "").trim()
    : message;

const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  open: {
    label: "Open",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: Mail,
  },
  in_progress: {
    label: "In Progress",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: MailOpen,
  },
  closed: {
    label: "Closed",
    className: "border-muted-foreground/15 bg-muted text-muted-foreground",
    icon: MailOpen,
  },
};

const TICKET_PRIORITY_META: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "border-muted-foreground/15 bg-muted text-muted-foreground",
  },
  medium: {
    label: "Medium",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  high: {
    label: "High",
    className:
      "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  urgent: {
    label: "Urgent",
    className: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

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
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [replyMessage, setReplyMessage] = useState("");
  const [reopenRequestMessage, setReopenRequestMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketsInitialized, setTicketsInitialized] = useState(false);
  const [requestingReopen, setRequestingReopen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    priority: "medium" as TicketPriority,
    category: "general" as TicketCategory,
    vpsId: "none",
  });

  const [vpsInstances, setVpsInstances] = useState<
    Array<{ id: string; label: string }>
  >([]);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const fetchVpsInstances = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/vps"), {
        headers: authHeader,
      });
      const data = await res.json();
      if (res.ok && data.instances) {
        setVpsInstances(
          data.instances.map((i: any) => ({ id: i.id, label: i.label })),
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        description: t.message,
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
    setReplyMessage("");
    setReopenRequestMessage("");
  }, [selectedTicket?.id]);

  // Set up real-time updates for selected ticket
  useEffect(() => {
    if (!selectedTicket || !token) return;

    const es = new EventSource(
      buildApiUrl(
        `/api/support/tickets/${selectedTicket.id}/stream?token=${token}`,
      ),
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
            sender_name: data.is_staff_reply ? "Support Team" : "You",
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
              toast.success("New reply from support team");
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
                : t,
            ),
          );

          setTimeout(scrollToBottom, 100);
        }

        if (
          data.type === "ticket_status_change" &&
          data.ticket_id === selectedTicket.id
        ) {
          setSelectedTicket((prev) =>
            prev ? { ...prev, status: data.new_status } : prev,
          );
          setTickets((prev) =>
            prev.map((t) =>
              t.id === data.ticket_id ? { ...t, status: data.new_status } : t,
            ),
          );
          toast.info(
            `Ticket status updated to: ${data.new_status.replace("_", " ")}`,
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
  }, [selectedTicket, token, scrollToBottom]);

  const openTicket = useCallback(
    async (ticket: SupportTicket) => {
      setSelectedTicket({ ...ticket, messages: [] });
      try {
        const res = await fetch(
          buildApiUrl(`/api/support/tickets/${ticket.id}/replies`),
          { headers: authHeader },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load replies");
        const msgs: TicketMessage[] = (data.replies || []).map((m: any) => ({
          id: m.id,
          ticket_id: m.ticket_id,
          sender_type: m.sender_type,
          sender_name: m.sender_type === "admin" ? "Support Team" : "You",
          message: m.message,
          created_at: m.created_at,
        }));
        setSelectedTicket((prev) =>
          prev ? { ...prev, messages: msgs } : prev,
        );
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        toast.error(e.message || "Failed to load messages");
      }
    },
    [authHeader, scrollToBottom],
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
      (ticket) => ticket.id === pendingFocusTicketId,
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
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      toast.success("Reply sent successfully");
      setReplyMessage("");
      await openTicket(selectedTicket);
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
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request reopen");

      toast.success("Re-open request sent to support staff");
      setReopenRequestMessage("");
      await openTicket(selectedTicket);
      await fetchTickets();
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

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/support/tickets"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          subject: newTicket.subject.trim(),
          message: newTicket.description.trim(),
          priority: newTicket.priority,
          category: newTicket.category,
          vpsId: newTicket.vpsId === "none" ? undefined : newTicket.vpsId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");

      toast.success("Support ticket created successfully");
      setNewTicket({
        subject: "",
        description: "",
        priority: "medium",
        category: "general",
        vpsId: "none",
      });
      setIsCreateModalOpen(false);
      await fetchTickets();
    } catch (error: any) {
      toast.error(error.message || "Failed to create support ticket");
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <>
      <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-border bg-background relative">
        {/* Sidebar - Ticket List */}
        <div
          className={cn(
            "flex flex-col border-r border-border bg-muted/30 w-full md:w-80 shrink-0",
            selectedTicket ? "hidden md:flex" : "flex",
          )}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">My Tickets</h2>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchTickets}
                disabled={loading}
                className="h-8 w-8"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="border-b border-border p-3">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as typeof statusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Tickets ({ticketCounts.all})
                </SelectItem>
                <SelectItem value="open">Open ({ticketCounts.open})</SelectItem>
                <SelectItem value="in_progress">
                  In Progress ({ticketCounts.in_progress})
                </SelectItem>
                <SelectItem value="resolved">
                  Resolved ({ticketCounts.resolved})
                </SelectItem>
                <SelectItem value="closed">
                  Closed ({ticketCounts.closed})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ticket List */}
          <ScrollArea className="flex-1">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <Inbox className="mb-2 h-8 w-8 opacity-50" />
                <p>No tickets found</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2"
                >
                  Create your first ticket
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTickets.map((ticket) => {
                  const StatusIcon = TICKET_STATUS_META[ticket.status].icon;
                  const isSelected = selectedTicket?.id === ticket.id;

                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className={cn(
                        "flex w-full flex-col gap-2 p-4 text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <StatusIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium text-sm line-clamp-1">
                            {ticket.subject}
                          </span>
                        </div>
                        {ticket.has_staff_reply && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-primary/10 text-primary border-primary/20 flex-shrink-0"
                          >
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            TICKET_STATUS_META[ticket.status].className,
                          )}
                        >
                          {TICKET_STATUS_META[ticket.status].label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            TICKET_PRIORITY_META[ticket.priority].className,
                          )}
                        >
                          {TICKET_PRIORITY_META[ticket.priority].label}
                        </Badge>
                        <span>•</span>
                        <span>
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Content - Ticket Detail */}
        <div
          className={cn(
            "flex flex-1 flex-col",
            !selectedTicket ? "hidden md:flex" : "flex",
          )}
        >
          {!selectedTicket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Mail className="h-16 w-16 text-muted-foreground/40" />
              <div>
                <h3 className="text-lg font-semibold">No ticket selected</h3>
                <p className="text-sm text-muted-foreground">
                  Select a ticket from the list or create a new one
                </p>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Ticket
              </Button>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div className="border-b border-border bg-background px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 md:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTicket(null)}
                        className="h-auto p-0 text-sm text-primary hover:text-primary/80"
                      >
                        ← Back to Tickets
                      </Button>
                    </div>
                    <h2 className="text-xl font-semibold">
                      {selectedTicket.subject}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge
                        variant="outline"
                        className={cn(
                          TICKET_STATUS_META[selectedTicket.status].className,
                        )}
                      >
                        {TICKET_STATUS_META[selectedTicket.status].label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          TICKET_PRIORITY_META[selectedTicket.priority]
                            .className,
                        )}
                      >
                        {TICKET_PRIORITY_META[selectedTicket.priority].label}
                      </Badge>
                      <span className="text-muted-foreground">•</span>
                      <span className="capitalize text-muted-foreground">
                        {selectedTicket.category.replace("_", " ")}
                      </span>
                      {selectedTicket.vps_label && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <Badge
                            variant="outline"
                            className="text-xs bg-muted/50 font-normal"
                          >
                            VPS: {selectedTicket.vps_label}
                          </Badge>
                        </>
                      )}
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Original Message */}
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="font-medium">You</span>
                      <span>•</span>
                      <span>
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {selectedTicket.messages.length > 0 && <Separator />}

                  {/* Replies */}
                  {selectedTicket.messages.length > 0 && (
                    <div className="space-y-4">
                      {selectedTicket.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_type === "admin"
                              ? "justify-start"
                              : "justify-end",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-2xl rounded-lg border p-4",
                              msg.sender_type === "admin"
                                ? "border-primary/30 bg-primary/5"
                                : "border-border bg-background",
                            )}
                          >
                            <div className="mb-2 flex items-center gap-2 text-xs">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {msg.sender_name}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </div>
                            {msg.sender_type === "user" &&
                              isReopenRequestMessage(msg.message) && (
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                  Re-open Request
                                </div>
                              )}
                            <p className="whitespace-pre-wrap text-sm">
                              {formatTicketMessage(msg.message)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Box */}
              <div className="border-t border-border bg-muted/30 p-4">
                {selectedTicket.status === "closed" ? (
                  <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      This ticket has been closed. You can request a re-open for
                      this same thread or create a new ticket.
                    </p>
                    <Textarea
                      rows={3}
                      value={reopenRequestMessage}
                      onChange={(e) => setReopenRequestMessage(e.target.value)}
                      placeholder="Optional note for support staff"
                      className="resize-none bg-background"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreateModalOpen(true)}
                      >
                        Create New Ticket
                      </Button>
                      <Button
                        onClick={requestReopen}
                        disabled={requestingReopen}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {requestingReopen ? "Requesting..." : "Request Re-open"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label
                      htmlFor="reply-message"
                      className="text-sm font-medium"
                    >
                      Reply to ticket
                    </Label>
                    <Textarea
                      id="reply-message"
                      rows={4}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Press Ctrl+Enter to send
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setReplyMessage("")}
                          disabled={!replyMessage.trim()}
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={sendReply}
                          disabled={!replyMessage.trim()}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and our support team will get back to you as
              soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={newTicket.subject}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="Brief description of your issue"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(value) =>
                    setNewTicket((prev) => ({
                      ...prev,
                      category: value as TicketCategory,
                    }))
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature_request">
                      Feature Request
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(value) =>
                    setNewTicket((prev) => ({
                      ...prev,
                      priority: value as TicketPriority,
                    }))
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vps">Related VPS (Optional)</Label>
              <Select
                value={newTicket.vpsId}
                onValueChange={(value) =>
                  setNewTicket((prev) => ({
                    ...prev,
                    vpsId: value,
                  }))
                }
              >
                <SelectTrigger id="vps">
                  <SelectValue placeholder="Select a VPS instance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vpsInstances.map((vps) => (
                    <SelectItem key={vps.id} value={vps.id}>
                      {vps.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                rows={6}
                value={newTicket.description}
                onChange={(e) =>
                  setNewTicket((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Detailed description of your issue or question"
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={
                loading ||
                !newTicket.subject.trim() ||
                !newTicket.description.trim()
              }
            >
              {loading ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
