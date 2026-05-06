import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CursorBlink } from "./CursorBlink";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export interface TypewriterTextProps {
  text: string;
  className?: string;
  /** ms per character */
  speedMs?: number;
  /** Repeat after finishing */
  loop?: boolean;
  /** Pause before loop restart */
  loopDelayMs?: number;
  showCursor?: boolean;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  className,
  speedMs = 32,
  loop = false,
  loopDelayMs = 2000,
  showCursor = true,
  onComplete,
}: TypewriterTextProps) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(reduced ? text : "");
  const indexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      onCompleteRef.current?.();
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const run = () => {
      if (cancelled) return;
      indexRef.current += 1;
      const i = indexRef.current;
      if (i > text.length) {
        onCompleteRef.current?.();
        if (loop) {
          indexRef.current = 0;
          setDisplay("");
          timeout = setTimeout(run, loopDelayMs);
        }
        return;
      }
      setDisplay(text.slice(0, i));
      timeout = setTimeout(run, speedMs);
    };

    indexRef.current = 0;
    setDisplay("");
    timeout = setTimeout(run, speedMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [text, speedMs, loop, loopDelayMs, reduced]);

  return (
    <span className={cn("font-mono", className)}>
      {display}
      {showCursor ? <CursorBlink className="ml-px inline-block w-[0.5ch] text-center" /> : null}
    </span>
  );
}
