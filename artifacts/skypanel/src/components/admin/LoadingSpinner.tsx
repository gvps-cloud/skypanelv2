import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  variant?: 'default' | 'overlay';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  text,
  variant = 'default',
}) => {
  if (variant === 'overlay') {
    return (
      <div className={cn(
        "absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10",
        "animate-in fade-in-0 duration-200",
        className
      )}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
          {text && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
      {text && (
        <span className="text-sm text-muted-foreground">
          {text}
        </span>
      )}
    </div>
  );
};

export const LoadingButton: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
}> = ({ isLoading, children, className, loadingText }) => {
  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "transition-opacity duration-200",
        isLoading && "opacity-0"
      )}>
        {children}
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" text={loadingText} />
        </div>
      )}
    </div>
  );
};