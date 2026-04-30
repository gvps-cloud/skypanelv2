import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogStackStep } from "./dialog-stack";
import { useState, useRef, useEffect } from "react";

interface MobileStepNavigationProps {
  steps: DialogStackStep[];
  activeStep: number;
  onStepChange?: (index: number) => void;
  touchOptimized?: boolean;
  showSwipeHint?: boolean;
}

export function MobileStepNavigation({
  steps,
  activeStep,
  onStepChange,
  touchOptimized = true,
  showSwipeHint = false,
}: MobileStepNavigationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampedIndex = Math.min(Math.max(activeStep, 0), steps.length - 1);

  // Handle touch events for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const deltaX = currentX - startX;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && clampedIndex > 0) {
        // Swipe right - go to previous step
        onStepChange?.(clampedIndex - 1);
      } else if (deltaX < 0 && clampedIndex < steps.length - 1) {
        // Swipe left - go to next step
        onStepChange?.(clampedIndex + 1);
      }
    }

    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  // Handle mouse events for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setCurrentX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentX(e.clientX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const deltaX = currentX - startX;
    const threshold = 50;

    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0 && clampedIndex > 0) {
        onStepChange?.(clampedIndex - 1);
      } else if (deltaX < 0 && clampedIndex < steps.length - 1) {
        onStepChange?.(clampedIndex + 1);
      }
    }

    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  // Prevent default touch behavior
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventScroll, { passive: false });
    return () => container.removeEventListener('touchmove', preventScroll);
  }, [isDragging]);

  return (
    <div className="space-y-3">
      {/* Navigation arrows for larger screens */}
      <div className="flex items-center justify-between sm:hidden">
        <button
          onClick={() => clampedIndex > 0 && onStepChange?.(clampedIndex - 1)}
          disabled={clampedIndex === 0}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border transition-all",
            touchOptimized && "min-w-[44px] min-h-[44px]",
            clampedIndex === 0 
              ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
              : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-sm font-medium text-muted-foreground">
          {clampedIndex + 1} of {steps.length}
        </span>

        <button
          onClick={() => clampedIndex < steps.length - 1 && onStepChange?.(clampedIndex + 1)}
          disabled={clampedIndex === steps.length - 1}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border transition-all",
            touchOptimized && "min-w-[44px] min-h-[44px]",
            clampedIndex === steps.length - 1
              ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
              : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Horizontal step indicators with swipe support */}
      <div
        ref={containerRef}
        className="flex items-center justify-between gap-2 select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          transform: isDragging ? `translateX(${(currentX - startX) * 0.1}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {steps.map((step, index) => {
          const isActive = index === clampedIndex;
          const isCompleted = index < clampedIndex;
          const indicator = isCompleted ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : index + 1;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange?.(index)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-0 flex-1 p-1 rounded-lg transition-all",
                touchOptimized && "min-h-[44px] min-w-[44px] justify-center",
                "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                  "sm:h-10 sm:w-10 sm:text-sm",
                  isActive && "border-primary bg-primary text-primary-foreground shadow-lg",
                  isCompleted && !isActive && "border-emerald-500 bg-emerald-500 text-white",
                  !isActive && !isCompleted && "border-border bg-muted text-muted-foreground"
                )}
              >
                {indicator}
              </div>
              <span className={cn(
                "text-xs font-medium truncate max-w-full text-center leading-tight",
                "sm:text-sm",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1 sm:h-2">
        <div 
          className="bg-primary h-1 sm:h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${((clampedIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Swipe hint */}
      {showSwipeHint && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Swipe left or right to navigate between steps
          </p>
        </div>
      )}
    </div>
  );
}