import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

/** ASCII bar progress e.g. [████░░░░] 42% */
function ProgressAscii({
  value = 0,
  className,
  width = 12,
}: {
  value?: number;
  className?: string;
  width?: number;
}) {
  const v = Math.min(100, Math.max(0, value));
  const filled = Math.round((v / 100) * width);
  const empty = Math.max(0, width - filled);
  const bar = `${"█".repeat(filled)}${"░".repeat(empty)}`;

  return (
    <div
      className={cn("font-mono text-xs tabular-nums text-foreground flex items-center gap-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="text-muted-foreground select-none" aria-hidden="true">
        [
      </span>
      <span className="text-primary tracking-tighter" aria-hidden="true">
        {bar}
      </span>
      <span className="text-muted-foreground select-none" aria-hidden="true">
        ]
      </span>
      <span className="text-muted-foreground">{Math.round(v)}%</span>
    </div>
  );
}

export { Progress, ProgressAscii };
