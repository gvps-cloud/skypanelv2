import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface StatusHeartbeatProps {
  className?: string;
  /** Optional series 0..1; if omitted, synthetic animation */
  values?: number[];
  height?: number;
  /** Phase offset (0..2π) for unique wave timing per instance */
  phaseOffset?: number;
}

function parsePrimaryHue(): number {
  if (typeof document === "undefined") return 160;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  const parts = raw.split(/\s+/);
  const h = Number.parseFloat(parts[0] ?? "");
  return Number.isFinite(h) ? h : 160;
}

/**
 * Small canvas sparkline; pauses when off-screen.
 */
export function StatusHeartbeat({ className, values, height = 36, phaseOffset = 0 }: StatusHeartbeatProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const rafRef = useRef<number>(0);
  const visibleRef = useRef(true);

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, data: number[], hue: number) => {
    ctx.clearRect(0, 0, w, h);
    const isDark = document.documentElement.classList.contains("dark");
    ctx.strokeStyle = isDark ? `hsla(${hue}, 50%, 55%, 0.9)` : `hsla(${hue}, 30%, 35%, 0.85)`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    const n = data.length;
    for (let i = 0; i < n; i++) {
      const x = (i / Math.max(1, n - 1)) * (w - 4) + 2;
      const y = h - 4 - data[i]! * (h - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        visibleRef.current = e ? e.isIntersecting : true;
      },
      { threshold: 0.05 },
    );
    obs.observe(canvas);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const hue = parsePrimaryHue();

    const synth = (len: number, t: number, offset: number): number[] => {
      const out: number[] = [];
      for (let i = 0; i < len; i++) {
        const phase = (i * 0.35 + t * 0.002 + offset) % (Math.PI * 2);
        out.push(0.35 + 0.35 * Math.sin(phase) + 0.15 * Math.sin(i * 0.8 + t * 0.01 + offset));
      }
      return out.map((v) => Math.min(1, Math.max(0, v)));
    };

    const staticValues = values && values.length > 1;

    const paint = (ts: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width / (window.devicePixelRatio || 1);
      const hh = canvas.height / (window.devicePixelRatio || 1);
      let data: number[];
      if (staticValues) {
        data = values!;
      } else {
        data = synth(48, reduced ? 0 : ts, phaseOffset);
      }
      draw(ctx, w, hh, data, hue);
    };

    const loop = (ts: number) => {
      if (visibleRef.current && !staticValues && !reduced) {
        paint(ts);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    paint(0);

    if (!staticValues && !reduced) {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, height, phaseOffset, reduced, values]);

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />
    </div>
  );
}
