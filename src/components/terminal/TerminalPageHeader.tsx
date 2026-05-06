import { cn } from "@/lib/utils";
import { TypewriterText } from "@/components/fx/TypewriterText";
import { usePrefersReducedMotion } from "@/components/fx/usePrefersReducedMotion";

export interface TerminalPageHeaderProps {
  /** e.g. "~/vps" */
  pathPrefix?: string;
  /** e.g. "list --running" */
  command: string;
  className?: string;
}

/**
 * Page title bar styled as a shell prompt with optional typewriter command.
 */
export function TerminalPageHeader({ pathPrefix = "~", command, className }: TerminalPageHeaderProps) {
  const reduced = usePrefersReducedMotion();
  const full = `${pathPrefix}$ ${command}`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-1 border-b border-border/80 pb-3 mb-4 font-mono text-sm",
        className,
      )}
    >
      <span className="text-muted-foreground select-none" aria-hidden="true">
        {pathPrefix}
      </span>
      <span className="text-primary select-none" aria-hidden="true">
        $
      </span>
      {reduced ? (
        <span className="text-foreground">{command}</span>
      ) : (
        <TypewriterText text={command} speedMs={22} showCursor className="text-foreground" />
      )}
      <span className="sr-only">{full}</span>
    </div>
  );
}
