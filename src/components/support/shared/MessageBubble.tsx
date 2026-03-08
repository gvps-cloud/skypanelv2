import React from "react";
import { cn } from "@/lib/utils";
import { TicketMessage, isReopenRequestMessage, formatTicketMessage } from "@/types/support";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, ShieldCheck } from "lucide-react";

interface MessageBubbleProps {
  message: TicketMessage;
  isCurrentUser: boolean; // Determines if the message is from the current viewer (User view: user msg is current; Admin view: admin msg is current)
  showSenderName?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  showSenderName = true,
}) => {
  const isReopenRequest = isReopenRequestMessage(message.message);
  const formattedMessage = formatTicketMessage(message.message);
  
  const initials = message.sender_name
    ? message.sender_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <div
      className={cn(
        "flex w-full gap-3 py-2 group",
        isCurrentUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8 mt-1 border border-border shadow-sm bg-muted">
        <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
          {message.sender_type === "admin" ? <ShieldCheck className="h-4 w-4" /> : initials}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col max-w-[80%]", isCurrentUser ? "items-end" : "items-start")}>
        {showSenderName && (
          <div className="flex items-center gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-foreground/80">
              {message.sender_name}
            </span>
            <span className="text-[10px] text-muted-foreground opacity-70">
              {new Date(message.created_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm shadow-sm relative",
            isCurrentUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/50 border border-border rounded-tl-sm text-foreground",
            isReopenRequest && "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/20"
          )}
        >
          {isReopenRequest && (
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wider opacity-80 border-b border-amber-500/20 pb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Re-open Request
            </div>
          )}
          <div className="whitespace-pre-wrap leading-relaxed break-words">
            {formattedMessage}
          </div>
        </div>
        
        <div className="text-[10px] text-muted-foreground mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {new Date(message.created_at).toLocaleDateString(undefined, {
             weekday: 'short', month: 'short', day: 'numeric'
          })}
        </div>
      </div>
    </div>
  );
};
