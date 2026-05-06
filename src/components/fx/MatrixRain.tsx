import { useEffect, useState } from "react";
import DataStreamCanvas from "@/components/home/DataStreamCanvas";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type MatrixRainDensity = "subdued" | "normal" | "dense";

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
}

/**
 * Theme-aware glyph rain wrapper around DataStreamCanvas.
 */
export function MatrixRain({ className, density = "normal", hue }: MatrixRainProps) {
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

  return (
    <div className={cn("relative w-full h-full min-h-[4rem] overflow-hidden", className)}>
      <DataStreamCanvas
        className="absolute inset-0"
        cellSize={cellSize}
        reducedMotion={effectiveReduced}
        pauseWhenOffscreen
        {...(typeof hue === "number" ? { hue } : {})}
      />
    </div>
  );
}
