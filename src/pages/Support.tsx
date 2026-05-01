/**
 * Support Tickets Page - Inbox-style support interface
 * Real-time messaging with support team
 */

import React, { useCallback, useMemo } from "react";
import { Ticket } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { UserSupportView } from "@/components/support/UserSupportView";

const Support: React.FC = () => {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const clearSearchParam = useCallback(
    (paramName: string) => {
      const searchParams = new URLSearchParams(location.search);
      if (!searchParams.has(paramName)) {
        return;
      }

      searchParams.delete(paramName);
      const nextSearch = searchParams.toString();

      navigate(
        {
          pathname: "/support",
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
    },
    [location.search, navigate],
  );

  const pendingFocusTicketId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const ticketId = searchParams.get("ticketId");
    return ticketId && ticketId.trim().length > 0 ? ticketId : null;
  }, [location.search]);

  const pendingCreateTicket = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("create") === "1";
  }, [location.search]);

  const prefilledTicket = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const subject = searchParams.get("subject");
    const description = searchParams.get("description");
    const category = searchParams.get("category");
    const hostingSubscriptionId = searchParams.get("hostingSubscriptionId");

    if (!subject && !description && !hostingSubscriptionId) return undefined;

    return {
      subject: subject || "",
      description: description || "",
      category: category || "general",
      hostingSubscriptionId: hostingSubscriptionId || undefined,
    };
  }, [location.search]);

  const handleFocusTicketHandled = useCallback(() => {
    clearSearchParam("ticketId");
  }, [clearSearchParam]);

  const handleCreateTicketHandled = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete("create");
    searchParams.delete("subject");
    searchParams.delete("description");
    searchParams.delete("category");
    searchParams.delete("hostingSubscriptionId");
    const nextSearch = searchParams.toString();
    navigate(
      { pathname: "/support", search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true },
    );
  }, [location.search, navigate]);

  if (!token) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
          <Ticket className="h-8 w-8" />
          Support Tickets
        </h1>
      </div>
      <div className="flex-1 p-6">
        <UserSupportView
          token={token}
          pendingFocusTicketId={pendingFocusTicketId}
          onFocusTicketHandled={handleFocusTicketHandled}
          pendingCreateTicket={pendingCreateTicket}
          onCreateTicketHandled={handleCreateTicketHandled}
          prefilledTicket={prefilledTicket}
        />
      </div>
    </div>
  );
};

export default Support;
