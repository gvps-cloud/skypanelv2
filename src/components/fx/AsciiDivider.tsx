import { cn } from "@/lib/utils";

export interface AsciiDividerProps {
  className?: string;
  label?: string;
}

export function AsciiDivider({ className, label }: AsciiDividerProps) {
  const line = label
    ? `───[ ${label} ]${"─".repeat(Math.max(4, 32 - label.length))}`
    : "─".repeat(40);

  return (
    <div
      className={cn(
        "font-mono text-[10px] text-muted-foreground/70 truncate select-none",
        className,
      )}
      role="separator"
      aria-hidden={!label}
    >
      {line}
    </div>
  );
}
