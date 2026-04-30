/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { LoaderCircle } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface MobileLoadingProps {
  isLoading: boolean
  title?: string
  description?: string
  progress?: number
  className?: string
  onCancel?: () => void
}

/**
 * Loading overlay with progress feedback - works on both mobile and desktop
 */
export function MobileLoading({
  isLoading,
  title = "Processing...",
  description,
  progress,
  className,
  onCancel
}: MobileLoadingProps) {
  const isMobile = useIsMobile()

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className={cn(
        "relative mx-4 w-full max-w-md rounded-xl border bg-card p-8 shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}>
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <LoaderCircle className={cn(
              "relative animate-spin text-primary",
              isMobile ? "h-12 w-12" : "h-10 w-10"
            )} />
          </div>
        </div>
        
        {/* Title */}
        <div className={cn(
          "text-center font-semibold text-foreground",
          isMobile ? "text-lg" : "text-base"
        )}>
          {title}
        </div>
        
        {/* Description */}
        {description && (
          <div className="mt-2 text-center text-sm text-muted-foreground">
            {description}
          </div>
        )}

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Hook for managing mobile loading states
 */
export function useMobileLoading() {
  const [loadingState, setLoadingState] = React.useState<{
    isLoading: boolean
    title?: string
    description?: string
    progress?: number
  }>({
    isLoading: false
  })

  const showLoading = React.useCallback((
    title?: string, 
    description?: string,
    progress?: number
  ) => {
    setLoadingState({
      isLoading: true,
      title,
      description,
      progress
    })
  }, [])

  const updateProgress = React.useCallback((progress: number, description?: string) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
      description: description || prev.description
    }))
  }, [])

  const hideLoading = React.useCallback(() => {
    setLoadingState({ isLoading: false })
  }, [])

  return {
    ...loadingState,
    showLoading,
    updateProgress,
    hideLoading
  }
}

/**
 * Mobile-optimized loading button component
 */
interface MobileLoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean
  loadingText?: string
  children: React.ReactNode
}

export function MobileLoadingButton({
  isLoading,
  loadingText = "Loading...",
  children,
  className,
  disabled,
  ...props
}: MobileLoadingButtonProps) {
  const isMobile = useIsMobile()

  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center gap-2",
        isMobile && "min-h-[48px] px-6 text-base",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        // show loader and text when loading
        <>
          <LoaderCircle className={cn(
            "animate-spin",
            isMobile ? "h-5 w-5" : "h-4 w-4"
          )} />
          <span className="opacity-70">
            {loadingText}
          </span>
        </>
      ) : (
        // render children directly to preserve flex layout
        <>
          {children}
        </>
      )}
    </button>
  )
}

/**
 * Mobile-optimized step progress indicator for multi-step forms
 */
interface MobileStepProgressProps {
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
  className?: string
}

export function MobileStepProgress({
  currentStep,
  totalSteps,
  stepLabels,
  className
}: MobileStepProgressProps) {
  const isMobile = useIsMobile()
  const progress = (currentStep / totalSteps) * 100

  if (!isMobile) {
    return null // Use desktop step indicator
  }

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-muted-foreground">
          {Math.round(progress)}%
        </span>
      </div>
      
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {stepLabels && stepLabels[currentStep - 1] && (
        <div className="mt-2 text-sm text-muted-foreground">
          {stepLabels[currentStep - 1]}
        </div>
      )}
    </div>
  )
}