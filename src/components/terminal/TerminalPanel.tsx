import * as React from "react";
import { cn } from "@/lib/utils";

export interface TerminalPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Screen reader label for the pane (defaults to title) */
  titleId?: string;
  /** Classes for the body region below the title bar */
  bodyClassName?: string;
}

/**
 * Terminal-style window: bracketed title bar + flat body. Colors come from theme CSS variables.
 */
export const TerminalPanel = React.forwardRef<HTMLDivElement, TerminalPanelProps>(
  ({ className, title, titleId, bodyClassName, children, ...props }, ref) => {
    const headingId = titleId ?? `terminal-panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <section
        ref={ref}
        role="region"
        aria-labelledby={headingId}
        className={cn(
          "flex flex-col border border-border bg-card text-card-foreground shadow-none",
          "border-l-2 border-l-primary/50",
          className,
        )}
        {...props}
      >
        <header className="flex shrink-0 items-center border-b border-border bg-muted/30 px-3 py-1.5">
          <h2
            id={headingId}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <span className="text-primary" aria-hidden="true">
              [
            </span>
            <span className="px-1 text-foreground">{title}</span>
            <span className="text-primary" aria-hidden="true">
              ]
            </span>
          </h2>
        </header>
        <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
      </section>
    );
  },
);
TerminalPanel.displayName = "TerminalPanel";
