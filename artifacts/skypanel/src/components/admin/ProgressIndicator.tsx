import React from 'react';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: string;
  completedSteps: string[];
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  completedSteps,
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isUpcoming = !isCompleted && !isCurrent;

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 transition-all duration-300",
              "animate-in slide-in-from-left-2",
              isCurrent && "scale-105"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
              isCompleted && "border-green-500 bg-green-500 text-white",
              isCurrent && "border-primary bg-primary text-primary-foreground animate-pulse",
              isUpcoming && "border-muted-foreground/30 bg-muted text-muted-foreground"
            )}>
              {isCompleted ? (
                <CheckCircle className="h-4 w-4" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            
            <div className="flex-1 space-y-1">
              <p className={cn(
                "text-sm font-medium transition-colors duration-200",
                isCompleted && "text-green-600 dark:text-green-400",
                isCurrent && "text-primary",
                isUpcoming && "text-muted-foreground"
              )}>
                {step.label}
              </p>
              {step.description && (
                <p className={cn(
                  "text-xs transition-colors duration-200",
                  isCompleted && "text-green-600/80 dark:text-green-400/80",
                  isCurrent && "text-primary/80",
                  isUpcoming && "text-muted-foreground/80"
                )}>
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
