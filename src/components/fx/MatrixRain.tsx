import { useEffect, useState } from "react";
import DataStreamCanvas from "@/components/home/DataStreamCanvas";
import CyberRainCanvas from "@/components/fx/CyberRainCanvas";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type MatrixRainDensity = "subdued" | "normal" | "dense";
export type MatrixRainMode = "mask" | "rain";

const CELL_BY_DENSITY: Record<MatrixRainDensity, number> = {
  subdued: 18,
  normal: 14,
  dense: 10,
};

export interface MatrixRainProps {
  className?: string;
  density?: MatrixRainDensity;
  /** Optional hue override (0–360); otherwise follows --primary */
  hue?: number;
  /** When true, the glyph logo follows the mouse cursor. */
  followCursor?: boolean;
  /** Animation mode: "mask" for icon-mask cycling, "rain" for cyber rain columns. */
  mode?: MatrixRainMode;
}

/**
 * Theme-aware glyph rain wrapper around DataStreamCanvas.
 */
export function MatrixRain({ className, density = "normal", hue, followCursor, mode = "mask" }: MatrixRainProps) {
  const reduced = usePrefersReducedMotion();
  const [narrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setNarrowViewport(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cellSize = CELL_BY_DENSITY[density];
  const effectiveReduced = reduced || narrowViewport;

  const canvas = mode === "rain"
    ? (
      <CyberRainCanvas
        className="absolute inset-0"
        cellSize={cellSize}
        reducedMotion={effectiveReduced}
        followCursor={followCursor}
        {...(typeof hue === "number" ? { hue } : {})}
      />
    )
    : (
      <DataStreamCanvas
        className="absolute inset-0"
        cellSize={cellSize}
        reducedMotion={effectiveReduced}
        pauseWhenOffscreen
        followCursor={followCursor}
        {...(typeof hue === "number" ? { hue } : {})}
      />
    );

  return (
    <div className={cn("relative w-full h-full min-h-[4rem] overflow-hidden", className)}>
      {canvas}
    </div>
  );
}
