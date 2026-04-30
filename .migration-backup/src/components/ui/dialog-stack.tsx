import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  mobileLayout?: 'fullscreen' | 'sheet' | 'adaptive';
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

export function DialogStack({
  open,
  onOpenChange,
  steps,
  activeStep,
  onStepChange,
  title,
  description,
  footer,
  mobileLayout = 'adaptive',
  touchOptimized = true,
}: DialogStackProps) {
  const isMobile = useIsMobile();
  const { orientation, isChanging } = useOrientation();
  const virtualKeyboard = useVirtualKeyboard();
  const {
    getAnimationClasses,
    getBackdropClasses,
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

  // Calculate dynamic height adjustments for virtual keyboard
  const contentStyle = useMemo(() => {
    if (!isMobile || !virtualKeyboard.isVisible) return {};
    
    return {
      maxHeight: `calc(100vh - ${virtualKeyboard.height}px)`,
      paddingBottom: '0px', // Remove bottom padding when keyboard is visible
    };
  }, [isMobile, virtualKeyboard.isVisible, virtualKeyboard.height]);

  // Render mobile layout for small screens
  if (isMobile) {
    const layoutClass = mobileLayout === 'fullscreen' 
      ? "!w-[100vw] !h-[100vh] !max-w-[100vw] !max-h-[100vh] !left-0 !top-0 !transform-none !m-0" 
      : mobileLayout === 'sheet'
      ? "!w-[95vw] !max-w-[95vw] !h-[90vh] !max-h-[90vh] !left-[2.5vw] !top-[5vh] !transform-none !m-0"
      : "!w-[95vw] !max-w-[95vw] !h-[95vh] !max-h-[95vh] !left-[2.5vw] !top-[2.5vh] !transform-none !m-0";

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className={cn(
            "!border-none !bg-transparent !p-0 !shadow-none !gap-0",
            layoutClass,
            mobileLayout === 'fullscreen' && "!rounded-none",
            mobileLayout === 'sheet' && "!rounded-t-lg !rounded-b-none",
            mobileLayout === 'adaptive' && "!rounded-lg",
            // Add optimized transition classes for orientation changes
            isChanging && getAnimationClasses("transition-all duration-300 ease-in-out"),
            // Add mobile modal animation classes
            open && getModalAnimationClasses(true)
          )}
          hideCloseButton={mobileLayout === 'fullscreen'}
          style={contentStyle}
        >
          <DialogTitle className="sr-only">{title || "Dialog"}</DialogTitle>
          <DialogDescription className="sr-only">
            {description || "Multi-step dialog for guided workflows"}
          </DialogDescription>
          <div 
            className={cn(
              "h-full w-full bg-background flex flex-col overflow-hidden",
              // Adjust layout based on orientation
              orientation === 'landscape' && "min-h-0",
              // Handle virtual keyboard visibility
              virtualKeyboard.isVisible && "pb-0",
              // Add backdrop optimization
              getBackdropClasses()
            )}
          >
            {/* Mobile header with step indicators */}
            <div 
              className={cn(
                "flex-shrink-0 border-b border-border/70 bg-background/95",
                getBackdropClasses(),
                // Reduce padding in landscape mode for more content space
                orientation === 'portrait' ? "p-4" : "p-2 px-4",
                // Compact header when virtual keyboard is visible
                virtualKeyboard.isVisible && "py-2"
              )}
            >
              {(title || description) && (
                <div className={cn(
                  orientation === 'portrait' ? "mb-4" : "mb-2"
                )}>
                  {title && (
                    <h2 className={cn(
                      "font-semibold text-foreground",
                      orientation === 'portrait' ? "text-lg md:text-xl" : "text-base md:text-lg"
                    )}>
                      {title}
                    </h2>
                  )}
                  {description && !virtualKeyboard.isVisible && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              )}
              
              {/* Mobile step navigation with swipe support */}
              <MobileStepNavigation
                steps={steps}
                activeStep={clampedIndex}
                onStepChange={onStepChange}
                touchOptimized={touchOptimized}
                showSwipeHint={false}
              />
            </div>

            {/* Mobile content area */}
            <div 
              className={cn(
                "flex-1 overflow-auto",
                // Adjust scrolling behavior for virtual keyboard
                virtualKeyboard.isVisible && "scroll-smooth",
                // Add scroll optimization for mobile
                getScrollOptimizationClasses()
              )}
            >
              {currentStep && (
                <div className={cn(
                  // Adjust padding based on orientation and keyboard state
                  orientation === 'portrait' && !virtualKeyboard.isVisible ? "p-4 sm:p-6" : "p-3 sm:p-4",
                  virtualKeyboard.isVisible && "pb-2"
                )}>
                  <div className={cn(
                    orientation === 'portrait' && !virtualKeyboard.isVisible ? "mb-4 sm:mb-6" : "mb-3 sm:mb-4"
                  )}>
                    <h3 className={cn(
                      "font-semibold text-foreground",
                      orientation === 'portrait' && !virtualKeyboard.isVisible 
                        ? "text-xl sm:text-2xl" 
                        : "text-lg sm:text-xl"
                    )}>
                      {currentStep.title}
                    </h3>
                    {currentStep.description && !virtualKeyboard.isVisible && (
                      <p className={cn(
                        "text-muted-foreground mt-1 sm:mt-2",
                        orientation === 'portrait' ? "text-sm sm:text-base" : "text-xs sm:text-sm"
                      )}>
                        {currentStep.description}
                      </p>
                    )}
                    <span className={cn(
                      "font-medium uppercase tracking-wide text-muted-foreground mt-2 block",
                      orientation === 'portrait' ? "text-xs sm:text-sm" : "text-xs"
                    )}>
                      Step {clampedIndex + 1} of {steps.length}
                    </span>
                  </div>
                  <div className={cn(
                    orientation === 'portrait' && !virtualKeyboard.isVisible ? "space-y-4 sm:space-y-6" : "space-y-3 sm:space-y-4"
                  )}>
                    {currentStep.content}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile footer */}
            {(currentStep?.footer || footer) && (
              <div 
                className={cn(
                  "flex-shrink-0 border-t border-border/70 bg-background/95",
                  getBackdropClasses(),
                  // Adjust footer padding based on orientation and keyboard state
                  orientation === 'portrait' && !virtualKeyboard.isVisible ? "p-4 sm:p-6" : "p-3 sm:p-4",
                  virtualKeyboard.isVisible && "py-2 px-4"
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

  // Desktop/tablet layout with responsive enhancements
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "w-[90vw] max-w-sm border-none bg-transparent p-0 shadow-none rounded-lg sm:max-w-2xl md:max-w-4xl lg:max-w-5xl sm:rounded-[32px]",
          // Add optimized transition for orientation changes on tablets
          isChanging && getAnimationClasses("transition-all duration-300 ease-in-out")
        )}
        style={contentStyle}
      >
        <DialogTitle className="sr-only">{title || "Dialog"}</DialogTitle>
        <DialogDescription className="sr-only">
          {description || "Multi-step dialog for guided workflows"}
        </DialogDescription>
        <div className={cn(
          "rounded-lg border border-border/70 bg-background/95 shadow-xl sm:rounded-[28px]",
          getBackdropClasses(),
          // Adjust padding based on orientation for tablets
          orientation === 'portrait' ? "p-3 sm:p-6 md:p-8" : "p-2 sm:p-4 md:p-6"
        )}>
          <div className={cn(
            "flex flex-col gap-4 sm:grid sm:gap-6 lg:gap-10",
            // Adjust grid layout based on orientation
            orientation === 'portrait' 
              ? "sm:grid-cols-[200px,1fr] md:grid-cols-[250px,1fr]" 
              : "sm:grid-cols-[180px,1fr] md:grid-cols-[200px,1fr]"
          )}>
            <aside className="space-y-4 sm:space-y-6">
              {(title || description) && (
                <div className="space-y-1">
                  {title && <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>}
                  {description && (
                    <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
                  )}
                </div>
              )}
              <nav className="relative flex flex-col gap-2 sm:gap-3">
                {steps.map((step, index) => {
                  const isActive = index === clampedIndex;
                  const isCompleted = index < clampedIndex;
                  const indicator = isCompleted ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : index + 1;
                  const offset = Math.max(0, index - clampedIndex);

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
                        getAnimationClasses("transition-all"),
                        getTouchFeedbackClasses(),
                        isActive ? "z-20" : "z-10",
                        !isActive && "hover:z-20",
                        touchOptimized && "min-h-[44px]"
                      )}
                      style={{ transform: `translateY(${offset * 4}px)` }}
                    >
                      <Card
                        className={cn(
                          "flex items-center gap-2 rounded-xl border bg-card/70 p-2 sm:gap-3 sm:rounded-2xl sm:p-3",
                          getBackdropClasses(),
                          getAnimationClasses("transition-all"),
                          isActive && "border-primary shadow-lg ring-2 ring-primary/20",
                          isCompleted && !isActive && "border-primary/40",
                          !isActive && !isCompleted && "border-border hover:border-primary/40"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold sm:h-8 sm:w-8",
                            isActive && "border-primary bg-primary text-primary-foreground",
                            isCompleted && !isActive && "border-emerald-500 bg-emerald-500 text-white",
                            !isActive && !isCompleted && "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          {indicator}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className={cn(
                            "text-xs font-medium truncate sm:text-sm",
                            isActive ? "text-foreground" : "text-muted-foreground"
                          )}
                          >
                            {step.title}
                          </p>
                          {step.description && (
                            <p className="text-xs text-muted-foreground/80 truncate">
                              {step.description}
                            </p>
                          )}
                        </div>
                      </Card>
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
                  className="pointer-events-none absolute inset-0 rounded-lg border border-border/40 bg-card/70 sm:rounded-[26px]"
                  style={{
                    transform: `translate(${(index + 1) * 8}px, ${(index + 1) * 8}px)`,
                    zIndex: index,
                    opacity: 0.6 - index * 0.2,
                  }}
                />
              ))}
              {currentStep && (
                <Card className="relative z-20 rounded-lg border border-border/80 bg-card/95 shadow-2xl sm:rounded-[26px] flex flex-col max-h-[calc(100vh-200px)]">
                  <CardHeader className="gap-2 flex-col items-start sm:gap-3 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
                    <div className="space-y-1">
                      <CardTitle className="text-base sm:text-lg">{currentStep.title}</CardTitle>
                      {currentStep.description && (
                        <CardDescription className="text-xs sm:text-sm">{currentStep.description}</CardDescription>
                      )}
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Step {clampedIndex + 1} of {steps.length}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                    {currentStep.content}
                  </CardContent>
                  {currentStep.footer && (
                    <CardFooter className="border-t border-border/60 bg-card/60 py-3 sm:py-4 flex-shrink-0">
                      {currentStep.footer}
                    </CardFooter>
                  )}
                </Card>
              )}
            </section>
          </div>
          {footer && (
            <div className="mt-4 border-t border-border/70 pt-3 sm:mt-6 sm:pt-4">
              {footer}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
