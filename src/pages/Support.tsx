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

  const pendingFocusTicketId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const ticketId = searchParams.get("ticketId");
    return ticketId && ticketId.trim().length > 0 ? ticketId : null;
  }, [location.search]);

  const handleFocusTicketHandled = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    if (!searchParams.has("ticketId")) {
      return;
    }

    navigate({ pathname: "/support" }, { replace: true });
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
        />
      </div>
    </div>
  );
};

export default Support;
