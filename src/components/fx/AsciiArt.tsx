import { cn } from "@/lib/utils";

export interface AsciiArtProps {
  /** Raw multiline ASCII string */
  art: string;
  className?: string;
}

export function AsciiArt({ art, className }: AsciiArtProps) {
  return (
    <pre
      className={cn(
        "font-mono text-[0.55rem] sm:text-[0.65rem] leading-none text-muted-foreground whitespace-pre select-none max-w-full overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      {art}
    </pre>
  );
}
