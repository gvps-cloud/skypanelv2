import { Link } from "react-router-dom";
import { AsciiArt } from "@/components/fx/AsciiArt";
import { ASCII_404 } from "@/components/fx/ascii/logo";
import { GlitchText } from "@/components/fx/GlitchText";
import { MatrixRain } from "@/components/fx/MatrixRain";
import { ScanlineOverlay } from "@/components/fx/ScanlineOverlay";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TerminalErrorScreenProps {
  code?: string | number;
  title?: string;
  message?: string;
  className?: string;
}

/**
 * Kernel-panic style error / 404 view.
 */
export function TerminalErrorScreen({
  code = "404",
  title = "NOT_FOUND",
  message = "The requested resource could not be located on this host.",
  className,
}: TerminalErrorScreenProps) {
  return (
    <div
      className={cn(
        "min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <MatrixRain density="subdued" />
      </div>
      <ScanlineOverlay animated className="z-[1]" />
      <div className="relative z-[2] max-w-lg w-full border border-border bg-card/90 p-6 rounded-sm fx-crt">
        <p className="font-mono text-[10px] text-destructive mb-2">KERNEL PANIC: {code}</p>
        <AsciiArt
          art={ASCII_404}
          className="text-muted-foreground mb-4 hidden sm:block w-fit mx-auto pt-1 text-[0.62rem] sm:text-[0.74rem] leading-[1.05]"
        />
        <GlitchText as="h1" className="text-lg font-bold text-foreground mb-2">
          {title}
        </GlitchText>
        <p className="text-sm text-muted-foreground font-mono mb-6">{message}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-sm font-mono">
            <Link to="/">cd ~</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-sm font-mono">
            <Link to="/dashboard">open dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
