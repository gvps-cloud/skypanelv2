import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AsciiBoxProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

function repeatChar(n: number, ch: string): string {
  return n > 0 ? Array(n + 1).join(ch) : "";
}

/**
 * Terminal-style box using box-drawing characters.
 */
export function AsciiBox({ title, children, className }: AsciiBoxProps) {
  const innerW = Math.max(24, (title?.length ?? 0) + 4);
  const top = `┌${repeatChar(innerW, "─")}┐`;
  const mid = title
    ? `│ ${title}${repeatChar(Math.max(0, innerW - title.length - 3), " ")}│`
    : null;
  const sep = title ? `├${repeatChar(innerW, "─")}┤` : null;
  const bot = `└${repeatChar(innerW, "─")}┘`;

  return (
    <div className={cn("font-mono text-[11px] sm:text-xs text-foreground", className)}>
      <div className="text-muted-foreground select-none leading-none" aria-hidden="true">
        {top}
      </div>
      {mid ? (
        <div className="text-muted-foreground select-none leading-none" aria-hidden="true">
          {mid}
        </div>
      ) : null}
      {sep ? (
        <div className="text-muted-foreground select-none leading-none" aria-hidden="true">
          {sep}
        </div>
      ) : null}
      <div className="flex">
        <span className="text-muted-foreground select-none leading-none" aria-hidden="true">
          │
        </span>
        <div className="min-w-0 flex-1 px-2 py-1.5 bg-card/40 border-y border-border/50">
          {children}
        </div>
        <span className="text-muted-foreground select-none leading-none" aria-hidden="true">
          │
        </span>
      </div>
      <div className="text-muted-foreground select-none leading-none" aria-hidden="true">
        {bot}
      </div>
    </div>
  );
}
