import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ReactNode, useMemo, startTransition } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOrientation } from "@/hooks/use-orientation";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";
import { useMobileAnimations } from "@/hooks/use-mobile-animations";
import { MobileStepNavigation } from "./mobile-step-navigation";

export interface DialogStackStep {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  footer?: ReactNode;
}

export interface ResponsiveDialogStackProps {
  mobileLayout?: "fullscreen" | "sheet" | "adaptive";
  touchOptimized?: boolean;
}

interface DialogStackProps extends ResponsiveDialogStackProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: DialogStackStep[];
  activeStep: number;
  onStepChange?: (index: number) => void;
  title?: string;
  description?: string;
  footer?: ReactNode;
}

function stepIndexLabel(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function DialogStack({
  open,
  onOpenChange,
  steps,
  activeStep,
  onStepChange,
  title,
  description,
  footer,
  mobileLayout = "adaptive",
  touchOptimized = true,
}: DialogStackProps) {
  const isMobile = useIsMobile();
  const { orientation, isChanging } = useOrientation();
  const virtualKeyboard = useVirtualKeyboard();
  const {
    getAnimationClasses,
    getModalAnimationClasses,
    getTouchFeedbackClasses,
    getScrollOptimizationClasses,
  } = useMobileAnimations();

  const clampedIndex = useMemo(() => {
    if (steps.length === 0) return 0;
    return Math.min(Math.max(activeStep, 0), steps.length - 1);
  }, [activeStep, steps.length]);

  const currentStep = steps[clampedIndex];
  const upcoming = steps.slice(clampedIndex + 1, clampedIndex + 3);

  const contentStyle = useMemo(() => {
    if (!isMobile || !virtualKeyboard.isVisible) return {};

    return {
      maxHeight: `calc(100vh - ${virtualKeyboard.height}px)`,
      paddingBottom: "0px",
    };
  }, [isMobile, virtualKeyboard.isVisible, virtualKeyboard.height]);

  if (isMobile) {
    const layoutClass =
      mobileLayout === "fullscreen"
        ? "!w-[100vw] !h-[100vh] !max-w-[100vw] !max-h-[100vh] !left-0 !top-0 !transform-none !m-0"
        : mobileLayout === "sheet"
          ? "!w-[95vw] !max-w-[95vw] !h-[90vh] !max-h-[90vh] !left-[2.5vw] !top-[5vh] !transform-none !m-0"
          : "!w-[95vw] !max-w-[95vw] !h-[95vh] !max-h-[95vh] !left-[2.5vw] !top-[2.5vh] !transform-none !m-0";

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "!border-none !bg-transparent !p-0 !shadow-none !gap-0",
            layoutClass,
            mobileLayout === "fullscreen" && "!rounded-none",
            mobileLayout === "sheet" && "!rounded-t-sm !rounded-b-none",
            mobileLayout === "adaptive" && "!rounded-sm",
            isChanging && getAnimationClasses("transition-all duration-300 ease-in-out"),
            open && getModalAnimationClasses(true),
          )}
          hideCloseButton={mobileLayout === "fullscreen"}
          style={contentStyle}
        >
          <DialogTitle className="sr-only">{title || "Dialog"}</DialogTitle>
          <DialogDescription className="sr-only">
            {description || "Multi-step dialog for guided workflows"}
          </DialogDescription>
          <div
            className={cn(
              "flex h-full w-full flex-col overflow-hidden bg-background font-mono",
              orientation === "landscape" && "min-h-0",
              virtualKeyboard.isVisible && "pb-0",
            )}
          >
            <div
              className={cn(
                "flex-shrink-0 border-b border-border bg-background",
                orientation === "portrait" ? "p-4" : "p-2 px-4",
                virtualKeyboard.isVisible && "py-2",
              )}
            >
              {(title || description) && (
                <div className={cn(orientation === "portrait" ? "mb-4" : "mb-2")}>
                  {title && (
                    <h2
                      className={cn(
                        "font-semibold text-foreground",
                        orientation === "portrait"
                          ? "text-lg md:text-xl"
                          : "text-base md:text-lg",
                      )}
                    >
                      {title}
                    </h2>
                  )}
                  {description && !virtualKeyboard.isVisible && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              )}

              <MobileStepNavigation
                steps={steps}
                activeStep={clampedIndex}
                onStepChange={onStepChange}
                touchOptimized={touchOptimized}
                showSwipeHint={false}
              />
            </div>

            <div
              className={cn(
                "flex-1 overflow-auto",
                virtualKeyboard.isVisible && "scroll-smooth",
                getScrollOptimizationClasses(),
              )}
            >
              {currentStep && (
                <div
                  className={cn(
                    orientation === "portrait" && !virtualKeyboard.isVisible
                      ? "p-4 sm:p-6"
                      : "p-3 sm:p-4",
                    virtualKeyboard.isVisible && "pb-2",
                  )}
                >
                  <div
                    className={cn(
                      orientation === "portrait" && !virtualKeyboard.isVisible
                        ? "mb-4 sm:mb-6"
                        : "mb-3 sm:mb-4",
                    )}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-foreground",
                        orientation === "portrait" && !virtualKeyboard.isVisible
                          ? "text-xl sm:text-2xl"
                          : "text-lg sm:text-xl",
                      )}
                    >
                      {currentStep.title}
                    </h3>
                    {currentStep.description && !virtualKeyboard.isVisible && (
                      <p
                        className={cn(
                          "mt-1 text-muted-foreground sm:mt-2",
                          orientation === "portrait"
                            ? "text-sm sm:text-base"
                            : "text-xs sm:text-sm",
                        )}
                      >
                        {currentStep.description}
                      </p>
                    )}
                    <span
                      className={cn(
                        "mt-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground",
                        orientation === "portrait" ? "text-xs sm:text-sm" : "text-xs",
                      )}
                    >
                      step {stepIndexLabel(clampedIndex)} / {stepIndexLabel(steps.length - 1)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      orientation === "portrait" && !virtualKeyboard.isVisible
                        ? "space-y-4 sm:space-y-6"
                        : "space-y-3 sm:space-y-4",
                    )}
                  >
                    {currentStep.content}
                  </div>
                </div>
              )}
            </div>

            {(currentStep?.footer || footer) && (
              <div
                className={cn(
                  "flex-shrink-0 border-t border-border bg-background",
                  orientation === "portrait" && !virtualKeyboard.isVisible
                    ? "p-4 sm:p-6"
                    : "p-3 sm:p-4",
                  virtualKeyboard.isVisible && "px-4 py-2",
                )}
              >
                {currentStep?.footer || footer}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[90vw] max-w-sm rounded-sm border-none bg-transparent p-0 font-mono shadow-none sm:max-w-2xl md:max-w-4xl lg:max-w-5xl",
          isChanging && getAnimationClasses("transition-all duration-300 ease-in-out"),
        )}
        style={contentStyle}
      >
        <DialogTitle className="sr-only">{title || "Dialog"}</DialogTitle>
        <DialogDescription className="sr-only">
          {description || "Multi-step dialog for guided workflows"}
        </DialogDescription>
        <div
          className={cn(
            "rounded-sm border border-border bg-background shadow-none",
            orientation === "portrait" ? "p-3 sm:p-6 md:p-8" : "p-2 sm:p-4 md:p-6",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-4 sm:grid sm:gap-6 lg:gap-8",
              orientation === "portrait"
                ? "sm:grid-cols-[200px,1fr] md:grid-cols-[250px,1fr]"
                : "sm:grid-cols-[180px,1fr] md:grid-cols-[220px,1fr]",
            )}
          >
            <aside className="space-y-4 sm:space-y-5">
              {(title || description) && (
                <div className="space-y-1 border-b border-border pb-3">
                  {title && (
                    <h2 className="text-base font-semibold text-foreground sm:text-lg">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
                  )}
                </div>
              )}
              <nav className="relative flex flex-col gap-1.5 sm:gap-2">
                {steps.map((step, index) => {
                  const isActive = index === clampedIndex;
                  const isCompleted = index < clampedIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          onStepChange?.(index);
                        });
                      }}
                      className={cn(
                        "relative text-left",
                        getAnimationClasses("transition-colors"),
                        getTouchFeedbackClasses(),
                        touchOptimized && "min-h-[44px]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-sm border p-2 sm:gap-3 sm:p-2.5",
                          isActive &&
                            "border-primary bg-muted/30 border-l-2 border-l-primary bg-primary/5",
                          isCompleted && !isActive && "border-primary/35 bg-muted/20",
                          !isActive && !isCompleted && "border-border hover:border-primary/40",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border text-[10px] font-semibold tabular-nums sm:h-8 sm:w-8 sm:text-xs",
                            isActive && "border-primary bg-primary text-primary-foreground",
                            isCompleted &&
                              !isActive &&
                              "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
                            !isActive &&
                              !isCompleted &&
                              "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {isCompleted ? (
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            stepIndexLabel(index)
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p
                            className={cn(
                              "truncate text-xs font-medium sm:text-sm",
                              isActive ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {step.title}
                          </p>
                          {step.description && (
                            <p className="truncate text-[10px] text-muted-foreground/90 sm:text-xs">
                              {step.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="relative">
              {upcoming.map((step, index) => (
                <div
                  key={step.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-sm border border-dashed border-border/50 bg-muted/10"
                  style={{
                    transform: `translate(${(index + 1) * 6}px, ${(index + 1) * 6}px)`,
                    zIndex: index,
                    opacity: 0.45 - index * 0.12,
                  }}
                />
              ))}
              {currentStep && (
                <div
                  className="relative z-20 flex max-h-[calc(100vh-200px)] flex-col rounded-sm border border-border border-l-2 border-l-primary/50 bg-card"
                >
                  <div className="flex flex-shrink-0 flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold sm:text-lg">{currentStep.title}</h3>
                      {currentStep.description && (
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {currentStep.description}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      step {stepIndexLabel(clampedIndex)} / {stepIndexLabel(steps.length - 1)}
                    </span>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-6 sm:p-4">
                    {currentStep.content}
                  </div>
                  {currentStep.footer && (
                    <div className="flex-shrink-0 border-t border-border bg-muted/10 px-3 py-3 sm:px-4 sm:py-4">
                      {currentStep.footer}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
          {footer && (
            <div className="mt-4 border-t border-border pt-3 sm:mt-5 sm:pt-4">
              {footer}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
