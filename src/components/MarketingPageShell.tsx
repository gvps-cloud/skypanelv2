import type { ReactNode } from "react";

import "@/styles/home.css";
import { ScanlineOverlay } from "@/components/fx/ScanlineOverlay";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNavbar from "@/components/MarketingNavbar";
import { cn } from "@/lib/utils";

export interface MarketingPageShellProps {
  children: ReactNode;
  /**
   * When omitted, scanlines are on for `default` density and off for `calm`
   * (docs/legal/blog readability).
   */
  showScanlines?: boolean;
  density?: "default" | "calm";
  /** Rendered below the navbar inside main (e.g. session divider). */
  topChrome?: ReactNode;
  className?: string;
}

/**
 * Shared marketing chrome: navbar, atmospheric background, optional CRT scanlines, footer.
 */
export default function MarketingPageShell({
  children,
  showScanlines,
  density = "default",
  topChrome,
  className,
}: MarketingPageShellProps) {
  const calm = density === "calm";
  const scanOn = showScanlines ?? !calm;

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col bg-background text-foreground",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_70%_at_50%_-15%,hsl(var(--primary)/0.16),transparent_52%)]" />
        <div
          className={cn(
            "absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] [background-size:32px_32px]",
            calm && "opacity-[0.22] [background-size:48px_48px]",
          )}
        />
      </div>

      {scanOn ? (
        <ScanlineOverlay
          className={cn("z-[1]", calm && "opacity-[0.025] dark:opacity-[0.03]")}
          animated={!calm}
        />
      ) : null}

      <MarketingNavbar />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {topChrome}
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}
