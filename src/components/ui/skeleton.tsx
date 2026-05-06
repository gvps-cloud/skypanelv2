"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/fx/usePrefersReducedMotion";

const GLYPHS = "01#@$%&*+-=<>/\\";

function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const reduced = usePrefersReducedMotion();
  const [text, setText] = useState("");

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      const w = 12;
      let s = "";
      for (let i = 0; i < w; i++) {
        s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "";
      }
      setText(s);
    }, 120);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div
      className={cn(
        "rounded-sm bg-muted/80 overflow-hidden min-h-[1rem] flex items-center px-2 font-mono text-[10px] text-muted-foreground/50 select-none",
        !reduced && "animate-pulse",
        className,
      )}
      {...props}
    >
      {reduced ? null : <span className="truncate w-full">{text}</span>}
    </div>
  );
}

export { Skeleton };
