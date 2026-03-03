/**
 * Admin Support View - Inbox-style support ticket management
 * Uses shadcn sidebar pattern for a modern support interface
 */
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
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Send,
  Trash2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { buildApiUrl } from "@/lib/api";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface SupportTicket {
  id: string;
  organization_id: string;
  created_by: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  created_at: string;
  updated_at: string;
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
    icon: CheckCircle,
  },
  closed: {
    label: "Closed",
    className: "border-muted-foreground/15 bg-muted text-muted-foreground",
    icon: MailOpen,
  },
};

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
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [replyMessage, setReplyMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    fetchTickets();
  }, [fetchTickets]);

  const openTicket = useCallback(
    async (ticket: SupportTicket) => {
      setSelectedTicket({ ...ticket, messages: [] });
      try {
        const res = await fetch(
          buildApiUrl(`/api/admin/tickets/${ticket.id}/replies`),
          { headers: authHeader },
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
          prev ? { ...prev, messages: msgs } : prev,
        );
        setTimeout(scrollToBottom, 100);
      } catch (e: any) {
        toast.error(e.message || "Failed to load replies");
      }
    },
    [authHeader, scrollToBottom],
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

  const updateTicketStatus = useCallback(
    async (ticketId: string, status: TicketStatus) => {
      try {
        const res = await fetch(
          buildApiUrl(`/api/admin/tickets/${ticketId}/status`),
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update status");
        const updatedStatus = (data?.ticket?.status as TicketStatus) || status;

        toast.success(`Ticket marked as ${updatedStatus.replace("_", " ")}`);
        await fetchTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) =>
            prev ? { ...prev, status: updatedStatus } : prev,
          );
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to update ticket status");
      }
    },
    [authHeader, fetchTickets, selectedTicket],
  );

  const deleteTicket = useCallback(async () => {
    if (!deleteTicketId) return;

    try {
      const res = await fetch(
        buildApiUrl(`/api/admin/tickets/${deleteTicketId}`),
        {
          method: "DELETE",
          headers: authHeader,
        },
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

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
              <h2 className="text-lg font-semibold">Support Inbox</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchTickets}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
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
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm line-clamp-1">
                            {ticket.subject}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            TICKET_PRIORITY_META[ticket.priority].className,
                          )}
                        >
                          {TICKET_PRIORITY_META[ticket.priority].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {ticket.message}
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
                        <span>•</span>
                        <span className="capitalize">{ticket.category}</span>
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
                  Select a ticket from the list to view details and respond
                </p>
              </div>
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
                        {selectedTicket.category}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {new Date(selectedTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ADMIN_TICKET_STATUS_ACTIONS[selectedTicket.status].map(
                      (action) => {
                        const ActionIcon = action.icon;
                        return (
                          <Button
                            key={`${selectedTicket.status}-${action.status}`}
                            size="sm"
                            variant={action.primary ? "default" : "outline"}
                            onClick={() =>
                              updateTicketStatus(
                                selectedTicket.id,
                                action.status,
                              )
                            }
                          >
                            <ActionIcon className="mr-1 h-4 w-4" />
                            {action.label}
                          </Button>
                        );
                      },
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTicketId(selectedTicket.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Original Message */}
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Original Message
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedTicket.message}
                    </p>
                  </div>

                  <Separator />

                  {/* Replies */}
                  {selectedTicket.messages &&
                  selectedTicket.messages.length > 0 ? (
                    <div className="space-y-4">
                      {selectedTicket.messages.map((msg) => {
                        const isReopenRequest =
                          msg.sender_type === "user" &&
                          isReopenRequestMessage(msg.message);

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.sender_type === "admin"
                                ? "justify-end"
                                : "justify-start",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-2xl rounded-lg border p-4",
                                msg.sender_type === "admin"
                                  ? "border-primary/30 bg-primary text-primary-foreground"
                                  : "border-border bg-background",
                                isReopenRequest &&
                                  "border-amber-500/30 bg-amber-500/10",
                              )}
                            >
                              <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                                <span className="font-medium">
                                  {msg.sender_name}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(msg.created_at).toLocaleString()}
                                </span>
                              </div>
                              {isReopenRequest && (
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                  Re-open Request
                                </div>
                              )}
                              <p className="whitespace-pre-wrap text-sm">
                                {formatTicketMessage(msg.message)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No replies yet. Be the first to respond!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Box */}
              <div className="border-t border-border bg-muted/30 p-4">
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
                    placeholder="Type your response..."
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setReplyMessage("")}
                      disabled={!replyMessage.trim()}
                    >
                      Clear
                    </Button>
                    <Button onClick={sendReply} disabled={!replyMessage.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            </>
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
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
