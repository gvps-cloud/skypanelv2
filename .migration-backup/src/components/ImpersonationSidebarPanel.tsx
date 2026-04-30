import * as React from "react";
import { AlertTriangle, Loader2, LogOut, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface ImpersonationSidebarPanelProps {
  impersonatedUser: {
    id: string;
    name: string;
    email: string;
  };
  onExitImpersonation: () => void;
  isExiting?: boolean;
  collapsed?: boolean;
  mobile?: boolean;
}

export function ImpersonationSidebarPanel({
  impersonatedUser,
  onExitImpersonation,
  isExiting = false,
  collapsed = false,
  mobile = false,
}: ImpersonationSidebarPanelProps) {
  const handleExitClick = React.useCallback(() => {
    void Promise.resolve(onExitImpersonation()).catch((error) => {
      console.error("Error during impersonation exit:", error);
    });
  }, [onExitImpersonation]);

  const content = (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sidebar-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-amber-500/15 p-2 text-amber-500">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="border border-amber-500/20 bg-amber-500/15 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200"
            >
              Admin Mode
            </Badge>
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-sidebar-foreground/65">
            Acting as
          </p>
          <div className="mt-1 flex items-start gap-2">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/70" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {impersonatedUser.name}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {impersonatedUser.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={handleExitClick}
        disabled={isExiting}
        className={cn(
          "mt-3 w-full justify-center border border-amber-500/20 bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-100",
          isExiting && "cursor-not-allowed opacity-75",
        )}
      >
        {isExiting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exiting...
          </>
        ) : (
          <>
            <LogOut className="mr-2 h-4 w-4" />
            Exit Impersonation
          </>
        )}
      </Button>
    </div>
  );

  if (collapsed && !mobile) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Popover>
            <PopoverTrigger asChild>
              <SidebarMenuButton
                tooltip="Impersonation active"
                aria-label={`Impersonation active. Acting as ${impersonatedUser.name}`}
                className="border border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800 dark:text-amber-100 dark:hover:text-amber-50"
              >
                <AlertTriangle />
                <span>Impersonation active</span>
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              sideOffset={10}
              className="w-80 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              {content}
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return content;
}
