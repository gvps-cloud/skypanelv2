import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AsciiArt } from "@/components/fx/AsciiArt";
import { ASCII_LOGO_SMALL } from "@/components/fx/ascii/logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TerminalEmptyStateProps {
  title: string;
  description?: string;
  /** Suggested command links: label + href */
  suggestions?: Array<{ label: string; href: string }>;
  art?: string;
  className?: string;
  children?: ReactNode;
}

export function TerminalEmptyState({
  title,
  description,
  suggestions,
  art = ASCII_LOGO_SMALL,
  className,
  children,
}: TerminalEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border rounded-sm bg-card/30",
        className,
      )}
    >
      <AsciiArt art={art} className="mb-4 opacity-80 max-w-full" />
      <h3 className="font-mono text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description ? (
        <p className="text-xs text-muted-foreground max-w-md mb-4">{description}</p>
      ) : null}
      {suggestions && suggestions.length > 0 ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center mb-4">
          {suggestions.map((s) => (
            <Button key={s.href} variant="outline" size="sm" className="font-mono text-xs rounded-sm" asChild>
              <Link to={s.href}>
                <span className="text-primary mr-1" aria-hidden="true">
                  $
                </span>
                {s.label}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}
