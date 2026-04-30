/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface MobileFormFeedbackProps {
  type: "error" | "success" | "warning" | "info"
  message: string
  className?: string
  children?: React.ReactNode
}

/**
 * Mobile-optimized form feedback component with enhanced readability
 */
export function MobileFormFeedback({ 
  type, 
  message, 
  className,
  children 
}: MobileFormFeedbackProps) {
  const isMobile = useIsMobile()

  const icons = {
    error: AlertCircle,
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[type]



  const typeStyles = {
    error: isMobile 
      ? "mobile-form-error" 
      : "text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3",
    success: isMobile 
      ? "mobile-form-success"
      : "text-green-600 bg-green-50 border border-green-200 rounded-md p-3 dark:text-green-400 dark:bg-green-950 dark:border-green-800",
    warning: isMobile
      ? "mobile-form-warning"
      : "text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
    info: isMobile
      ? "mobile-form-info"
      : "text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-3 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
  }

  return (
    <div className={cn(typeStyles[type], className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn(
          "flex-shrink-0 mt-0.5",
          isMobile ? "h-5 w-5" : "h-4 w-4"
        )} />
        <div className="flex-1">
          <p className={cn(
            "font-medium",
            isMobile ? "text-base leading-relaxed" : "text-sm"
          )}>
            {message}
          </p>
          {children && (
            <div className={cn(
              "mt-2",
              isMobile ? "text-sm" : "text-xs"
            )}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for mobile-optimized form validation feedback
 */
export function useMobileFormFeedback() {
  const isMobile = useIsMobile()

  const showError = React.useCallback((message: string, element?: HTMLElement) => {
    if (isMobile && element) {
      // Scroll to error on mobile for better visibility
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      })
    }
  }, [isMobile])

  const showSuccess = React.useCallback((_message: string) => {
    // Success feedback logic
  }, [])

  return {
    showError,
    showSuccess,
    isMobile,
  }
}

/**
 * Mobile-optimized inline validation component
 */
interface MobileInlineValidationProps {
  error?: string
  success?: string
  warning?: string
  info?: string
  className?: string
}

export function MobileInlineValidation({
  error,
  success,
  warning,
  info,
  className
}: MobileInlineValidationProps) {
  const message = error || success || warning || info
  const type = error ? 'error' : success ? 'success' : warning ? 'warning' : 'info'

  if (!message) return null

  return (
    <MobileFormFeedback
      type={type}
      message={message}
      className={cn("mt-2", className)}
    />
  )
}