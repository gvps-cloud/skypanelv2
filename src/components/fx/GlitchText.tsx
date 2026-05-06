import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface GlitchTextProps {
  children: ReactNode;
  className?: string;
  /** Glitch on interval (ms); omit for hover-only via .fx-glitch-hover parent or use trigger */
  intervalMs?: number;
  as?: "span" | "div" | "h1";
}

/**
 * RGB-split glitch effect; respects reduced motion (static text only).
 */
export function GlitchText({ children, className, intervalMs, as: Tag = "span" }: GlitchTextProps) {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return <Tag className={cn("font-mono", className)}>{children}</Tag>;
  }

  return (
    <Tag
      className={cn(
        "font-mono relative inline-block",
        intervalMs != null && "fx-glitch-continuous",
        intervalMs == null && "fx-glitch-hover",
        className,
      )}
      style={
        intervalMs != null
          ? ({ animationDuration: `${Math.max(400, intervalMs)}ms` } as CSSProperties)
          : undefined
      }
    >
      <span className="relative z-[1]">{children}</span>
      <span
        className="absolute inset-0 z-0 text-primary opacity-70 blur-[0.3px]"
        style={{ transform: "translate(1px,0)", clipPath: "inset(0 0 50% 0)" }}
        aria-hidden="true"
      >
        {children}
      </span>
      <span
        className="absolute inset-0 z-0 text-muted-foreground opacity-60 blur-[0.3px]"
        style={{ transform: "translate(-1px,0)", clipPath: "inset(50% 0 0 0)" }}
        aria-hidden="true"
      >
        {children}
      </span>
    </Tag>
  );
}
