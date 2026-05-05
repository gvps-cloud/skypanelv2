import * as React from "react";
import { cn } from "@/lib/utils";

export interface TerminalPromptLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** Prompt glyph, default $ */
  prompt?: string;
}

/**
 * Prefix a label with a shell-style prompt character (decorative prompt is aria-hidden).
 */
export const TerminalPromptLabel = React.forwardRef<HTMLSpanElement, TerminalPromptLabelProps>(
  ({ className, children, prompt = "$", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn("inline-flex items-baseline gap-1.5 font-mono text-sm", className)}
        {...props}
      >
        <span className="select-none text-primary" aria-hidden="true">
          {prompt}
        </span>
        <span>{children}</span>
      </span>
    );
  },
);
TerminalPromptLabel.displayName = "TerminalPromptLabel";
