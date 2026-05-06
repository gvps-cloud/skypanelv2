import { MatrixRain } from "@/components/fx/MatrixRain";
import { BootSequence } from "@/components/fx/BootSequence";
import { ScanlineOverlay } from "@/components/fx/ScanlineOverlay";
import { cn } from "@/lib/utils";

export interface TerminalLoadingScreenProps {
  className?: string;
  onBootComplete?: () => void;
}

/**
 * Full-viewport or card loading: matrix backdrop + boot log.
 */
export function TerminalLoadingScreen({ className, onBootComplete }: TerminalLoadingScreenProps) {
  return (
    <div className={cn("relative min-h-[200px] w-full overflow-hidden rounded-sm border border-border bg-card", className)}>
      <div className="absolute inset-0 opacity-40">
        <MatrixRain density="subdued" />
      </div>
      <ScanlineOverlay animated className="z-[2]" />
      <div className="relative z-[3] p-4 sm:p-6 bg-background/80 backdrop-blur-[2px]">
        <BootSequence onComplete={onBootComplete} lineDelayMs={100} />
      </div>
    </div>
  );
}
