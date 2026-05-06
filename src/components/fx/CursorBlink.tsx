import { cn } from "@/lib/utils";

export interface CursorBlinkProps {
  className?: string;
  char?: string;
}

export function CursorBlink({ className, char = "█" }: CursorBlinkProps) {
  return (
    <span className={cn("fx-caret font-mono align-baseline", className)} aria-hidden="true">
      {char}
    </span>
  );
}
