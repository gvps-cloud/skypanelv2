import * as React from "react";
import { cn } from "@/lib/utils";

export interface TerminalRuleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional centered label between rule segments */
  label?: string;
}

/**
 * Horizontal rule with optional tty-style label (decorative segments are aria-hidden).
 */
export const TerminalRule = React.forwardRef<HTMLDivElement, TerminalRuleProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="separator"
        className={cn("flex items-center gap-2 py-2", className)}
        {...props}
      >
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        {label ? (
          <>
            <span
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              aria-hidden="true"
            >
              {label}
            </span>
            <span className="sr-only">{label}</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </>
        ) : (
          <span className="h-px flex-[2] bg-border" aria-hidden="true" />
        )}
      </div>
    );
  },
);
TerminalRule.displayName = "TerminalRule";
