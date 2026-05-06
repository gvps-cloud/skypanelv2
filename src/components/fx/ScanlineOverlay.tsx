import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface ScanlineOverlayProps {
  className?: string;
  /** When false, scanlines are static (lighter). */
  animated?: boolean;
}

/**
 * CRT-style scanline overlay. Uses theme foreground for line color.
 */
export function ScanlineOverlay({ className, animated = true }: ScanlineOverlayProps) {
  const reduced = usePrefersReducedMotion();
  const animate = animated && !reduced;

  return (
    <div
      className={cn(
        "fx-scanlines",
        animate && "fx-scanlines--animated",
        className,
      )}
      aria-hidden="true"
    />
  );
}
