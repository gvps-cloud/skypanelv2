import React, { useState } from "react";
import { Search, Plus, Filter, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportTicket, TicketStatus } from "@/types/support";
import { TicketListItem } from "./TicketListItem";
import { cn } from "@/lib/utils";
import { TICKET_STATUS_META } from "./constants";

interface TicketListProps {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticket: SupportTicket) => void;
  onCreateTicket?: () => void;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  selectedTicketId,
  onSelectTicket,
  onCreateTicket,
  isLoading = false,
  isAdmin = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const filteredTickets = tickets
    .filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const searchLower = searchQuery.toLowerCase();
      
      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchLower) ||
        (ticket.description || ticket.message || "").toLowerCase().includes(searchLower) ||
        ticket.category.toLowerCase().includes(searchLower) ||
        (isAdmin && (
          (ticket.creator?.displayName || "").toLowerCase().includes(searchLower) ||
          (ticket.creator?.email || "").toLowerCase().includes(searchLower) ||
          (ticket.organization_name || "").toLowerCase().includes(searchLower) ||
          (ticket.organization_slug || "").toLowerCase().includes(searchLower)
        ));

      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-muted/10 w-full md:w-80 lg:w-96 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            {isAdmin ? "Support Inbox" : "My Tickets"}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={`Sort by ${sortOrder === "newest" ? "oldest" : "newest"}`}
            >
              {sortOrder === "newest" ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
            </Button>
            {onCreateTicket && (
              <Button onClick={onCreateTicket} size="sm" className="h-8 gap-1.5 px-3">
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:inline-block">New</span>
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-background/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="w-full">
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as "all" | TicketStatus)}
          >
            <SelectTrigger className="w-full h-9 bg-background/50 focus:bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Tickets <span className="opacity-70 ml-1">({ticketCounts.all})</span>
              </SelectItem>
              {(Object.keys(TICKET_STATUS_META) as TicketStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {TICKET_STATUS_META[status].label} <span className="opacity-70 ml-1">({ticketCounts[status]})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 p-6 text-center text-muted-foreground">
            <Filter className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium">No tickets found</p>
            <p className="text-xs opacity-70 mt-1">
              Try adjusting your filters or search query
            </p>
            {onCreateTicket && (
              <Button
                variant="link"
                size="sm"
                onClick={onCreateTicket}
                className="mt-2 text-primary"
              >
                Create a new ticket
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredTickets.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onClick={() => onSelectTicket(ticket)}
                showCustomer={isAdmin}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
