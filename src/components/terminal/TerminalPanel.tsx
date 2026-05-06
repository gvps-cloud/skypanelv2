import * as React from "react";
import { cn } from "@/lib/utils";

export type TerminalPanelTone = "default" | "subdued" | "alert" | "success";

export interface TerminalPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Screen reader label for the pane (defaults to title) */
  titleId?: string;
  /** Classes for the body region below the title bar */
  bodyClassName?: string;
  tone?: TerminalPanelTone;
  /** Show red/yellow/green dots in title bar */
  traffic?: boolean;
  /** Prefix in title bar (e.g. $) */
  prompt?: string;
  /** Soft halo on left border */
  glow?: boolean;
}

const toneBorder: Record<TerminalPanelTone, string> = {
  default: "border-l-primary/50",
  subdued: "border-l-muted-foreground/35",
  alert: "border-l-[hsl(var(--destructive)/0.65)]",
  success: "border-l-[hsl(var(--success)/0.65)]",
};

const toneHeader: Record<TerminalPanelTone, string> = {
  default: "bg-muted/30",
  subdued: "bg-muted/20",
  alert: "bg-destructive/10",
  success: "bg-[hsl(var(--success)/0.08)]",
};

/**
 * Terminal-style window: bracketed title bar + flat body. Colors come from theme CSS variables.
 */
export const TerminalPanel = React.forwardRef<HTMLDivElement, TerminalPanelProps>(
  (
    {
      className,
      title,
      titleId,
      bodyClassName,
      children,
      tone = "default",
      traffic = false,
      prompt,
      glow = false,
      ...props
    },
    ref,
  ) => {
    const headingId = titleId ?? `terminal-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <section
        ref={ref}
        role="region"
        aria-labelledby={headingId}
        className={cn(
          "flex flex-col border border-border bg-card text-card-foreground shadow-none",
          toneBorder[tone],
          "border-l-2",
          glow && "fx-glow shadow-[0_0_24px_-8px_hsl(var(--primary)/0.35)]",
          className,
        )}
        {...props}
      >
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5",
            toneHeader[tone],
          )}
        >
          <h2
            id={headingId}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1 min-w-0"
          >
            {prompt ? (
              <span className="text-primary shrink-0" aria-hidden="true">
                {prompt}
              </span>
            ) : null}
            <span className="text-primary shrink-0" aria-hidden="true">
              [
            </span>
            <span className="px-1 text-foreground truncate">{title}</span>
            <span className="text-primary shrink-0" aria-hidden="true">
              ]
            </span>
          </h2>
          {traffic ? (
            <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--destructive))] opacity-90" />
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))] opacity-90" />
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))] opacity-90" />
            </div>
          ) : null}
        </header>
        <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
      </section>
    );
  },
);
TerminalPanel.displayName = "TerminalPanel";
