/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusVariants = cva(
  "inline-flex items-center gap-2 text-sm font-medium",
  {
    variants: {
      variant: {
        online: "text-green-700 dark:text-green-400",
        offline: "text-red-700 dark:text-red-400",
        loading: "text-blue-700 dark:text-blue-400",
        error: "text-red-700 dark:text-red-400",
        warning: "text-yellow-700 dark:text-yellow-400",
        success: "text-green-700 dark:text-green-400",
        pending: "text-orange-700 dark:text-orange-400",
        stopped: "text-gray-700 dark:text-gray-400",
        running: "text-green-700 dark:text-green-400",
        provisioning: "text-blue-700 dark:text-blue-400",
        rebooting: "text-orange-700 dark:text-orange-400",
      },
      size: {
        sm: "text-xs",
        default: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      variant: "online",
      size: "default",
    },
  }
)

const indicatorVariants = cva(
  "rounded-full",
  {
    variants: {
      variant: {
        online: "bg-green-500",
        offline: "bg-red-500",
        loading: "bg-blue-500",
        error: "bg-red-500",
        warning: "bg-yellow-500",
        success: "bg-green-500",
        pending: "bg-orange-500",
        stopped: "bg-gray-500",
        running: "bg-green-500",
        provisioning: "bg-blue-500",
        rebooting: "bg-orange-500",
      },
      size: {
        sm: "h-2 w-2",
        default: "h-3 w-3",
        lg: "h-4 w-4",
      },
      animated: {
        true: "animate-pulse",
        false: "",
      },
    },
    defaultVariants: {
      variant: "online",
      size: "default",
      animated: false,
    },
  }
)

const pingVariants = cva(
  "absolute rounded-full opacity-75 animate-ping",
  {
    variants: {
      variant: {
        online: "bg-green-400",
        offline: "bg-red-400",
        loading: "bg-blue-400",
        error: "bg-red-400",
        warning: "bg-yellow-400",
        success: "bg-green-400",
        pending: "bg-orange-400",
        stopped: "bg-gray-400",
        running: "bg-green-400",
        provisioning: "bg-blue-400",
        rebooting: "bg-orange-400",
      },
      size: {
        sm: "h-2 w-2",
        default: "h-3 w-3",
        lg: "h-4 w-4",
      },
    },
    defaultVariants: {
      variant: "online",
      size: "default",
    },
  }
)

export interface StatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusVariants> {
  label?: string
  showPing?: boolean
  animated?: boolean
}

const Status = React.forwardRef<HTMLDivElement, StatusProps>(
  ({ className, variant, size, label, showPing = false, animated = false, ...props }, ref) => {
    const statusLabel = label || (variant ? variant.charAt(0).toUpperCase() + variant.slice(1) : "Status")
    
    // Get indicator size class for the container
    const sizeClasses = {
      sm: "h-2 w-2",
      default: "h-3 w-3",
      lg: "h-4 w-4",
    }
    const containerSize = sizeClasses[size || "default"]
    
    return (
      <div
        ref={ref}
        className={cn(statusVariants({ variant, size, className }))}
        role="status"
        aria-label={`Status: ${statusLabel}`}
        {...props}
      >
        <div className={cn("relative flex-shrink-0", containerSize)}>
          {showPing && (
            <span className={cn(pingVariants({ variant, size }), "inset-0")} />
          )}
          <span 
            className={cn(indicatorVariants({ variant, size, animated }), "absolute inset-0")}
            aria-hidden="true"
          />
        </div>
        {label && (
          <span className="select-none">{label}</span>
        )}
      </div>
    )
  }
)
Status.displayName = "Status"

export { Status, statusVariants }