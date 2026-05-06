import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface BootLine {
  text: string;
  /** ok | warn | err | info */
  kind?: "ok" | "warn" | "err" | "info";
}

const DEFAULT_LINES: BootLine[] = [
  { text: "[    0.000000] skypanel: kernel boot — secure boot OK", kind: "ok" },
  { text: "[    0.142891] init: mounting namespaces…", kind: "info" },
  { text: "[    0.256004] net: bringing up interfaces (v4/v6)…", kind: "info" },
  { text: "[    0.401112] auth: verifying session material…", kind: "info" },
  { text: "[    0.512003] workspace: loading tenant context…", kind: "ok" },
  { text: "[    0.600000] done.", kind: "ok" },
];

function lineClass(kind: BootLine["kind"]): string {
  switch (kind) {
    case "ok":
      return "text-[hsl(var(--success))]";
    case "warn":
      return "text-[hsl(var(--warning))]";
    case "err":
      return "text-[hsl(var(--destructive))]";
    default:
      return "text-muted-foreground";
  }
}

export interface BootSequenceProps {
  lines?: BootLine[];
  className?: string;
  /** ms between lines */
  lineDelayMs?: number;
  onComplete?: () => void;
}

export function BootSequence({
  lines = DEFAULT_LINES,
  className,
  lineDelayMs = 120,
  onComplete,
}: BootSequenceProps) {
  const reduced = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reduced ? lines.length : 0);
  const firedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reduced) {
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    if (visible >= lines.length) {
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    const t = setTimeout(() => setVisible((v) => v + 1), lineDelayMs);
    return () => clearTimeout(t);
  }, [visible, lines.length, lineDelayMs, reduced]);

  const slice = lines.slice(0, visible);

  return (
    <div
      className={cn(
        "font-mono text-[10px] sm:text-[11px] leading-relaxed space-y-0.5",
        className,
      )}
      role="log"
      aria-live="polite"
    >
      {slice.map((line, i) => (
        <div key={`${i}-${line.text}`} className={cn("whitespace-pre-wrap break-all", lineClass(line.kind))}>
          {line.text}
        </div>
      ))}
      {visible < lines.length && !reduced ? (
        <div className="text-primary animate-pulse" aria-hidden="true">
          _
        </div>
      ) : null}
    </div>
  );
}
