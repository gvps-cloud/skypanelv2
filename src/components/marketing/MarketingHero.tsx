import type { ReactNode } from "react";

import { AsciiBox } from "@/components/fx/AsciiBox";
import { usePrefersReducedMotion } from "@/components/fx/usePrefersReducedMotion";
import { TerminalPageHeader } from "@/components/terminal/TerminalPageHeader";
import { cn } from "@/lib/utils";

export interface MarketingHeroProps {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shell-style command line under the title block. */
  command?: string;
  pathPrefix?: string;
  /** Wrap content in an ASCII frame (stronger terminal cue). */
  framed?: boolean;
  asciiTitle?: string;
  className?: string;
}

/**
 * Marketing page hero: monospace headline (readable), optional static CRT text treatment, terminal command line.
 * Intentionally avoids continuous glitch animation on titles — it harms legibility on long lines.
 */
export function MarketingHero({
  eyebrow,
  title,
  subtitle,
  actions,
  command,
  pathPrefix = "~",
  framed = false,
  asciiTitle,
  className,
}: MarketingHeroProps) {
  const reduced = usePrefersReducedMotion();

  const titleBlock = (
    <h1
      className={cn(
        "text-balance font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl",
        !reduced && "fx-text-noise",
      )}
    >
      {title}
    </h1>
  );

  const inner = (
    <div className={cn("space-y-4", framed && "px-1 py-1")}>
      {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
      {titleBlock}
      {subtitle ? (
        <div className="max-w-3xl text-base text-muted-foreground sm:text-lg">{subtitle}</div>
      ) : null}
      {command ? (
        <TerminalPageHeader pathPrefix={pathPrefix} command={command} className="mb-0 pb-0 border-b-0" />
      ) : null}
      {actions ? <div className="flex flex-wrap gap-3 pt-1">{actions}</div> : null}
    </div>
  );

  return (
    <section className={cn("relative", className)}>
      {framed ? (
        <AsciiBox title={asciiTitle ?? "signal"} className="max-w-4xl">
          {inner}
        </AsciiBox>
      ) : (
        inner
      )}
    </section>
  );
}
