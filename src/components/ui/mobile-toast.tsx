import * as React from "react"
import { toast as sonnerToast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

interface MobileToastOptions {
  duration?: number
  position?: "top-center" | "top-left" | "top-right" | "bottom-center" | "bottom-left" | "bottom-right"
  className?: string
  style?: React.CSSProperties
}

interface ToastFunction {
  (message: string, options?: MobileToastOptions): string | number
}

interface MobileToast {
  success: ToastFunction
  error: ToastFunction
  warning: ToastFunction
  info: ToastFunction
  loading: ToastFunction
  dismiss: (id?: string | number) => void
}

/**
 * Mobile-optimized toast notifications with enhanced readability and positioning
 */
export const mobileToast: MobileToast = {
  success: (message: string, options?: MobileToastOptions) => {
    return sonnerToast.success(message, {
      duration: options?.duration || 4000,
      className: `mobile-toast mobile-toast-success ${options?.className || ''}`,
      style: {
        fontSize: '16px',
        lineHeight: '1.5',
        padding: '16px 20px',
        minHeight: '60px',
        borderRadius: '12px',
        ...options?.style,
      },
    })
  },

  error: (message: string, options?: MobileToastOptions) => {
    return sonnerToast.error(message, {
      duration: options?.duration || 6000, // Longer duration for errors on mobile
      className: `mobile-toast mobile-toast-error ${options?.className || ''}`,
      style: {
        fontSize: '16px',
        lineHeight: '1.5',
        padding: '16px 20px',
        minHeight: '60px',
        borderRadius: '12px',
        maxWidth: '90vw',
        wordBreak: 'break-word',
        ...options?.style,
      },
    })
  },

  warning: (message: string, options?: MobileToastOptions) => {
    return sonnerToast.warning(message, {
      duration: options?.duration || 5000,
      className: `mobile-toast mobile-toast-warning ${options?.className || ''}`,
      style: {
        fontSize: '16px',
        lineHeight: '1.5',
        padding: '16px 20px',
        minHeight: '60px',
        borderRadius: '12px',
        ...options?.style,
      },
    })
  },

  info: (message: string, options?: MobileToastOptions) => {
    return sonnerToast.info(message, {
      duration: options?.duration || 4000,
      className: `mobile-toast mobile-toast-info ${options?.className || ''}`,
      style: {
        fontSize: '16px',
        lineHeight: '1.5',
        padding: '16px 20px',
        minHeight: '60px',
        borderRadius: '12px',
        ...options?.style,
      },
    })
  },

  loading: (message: string, options?: MobileToastOptions) => {
    return sonnerToast.loading(message, {
      className: `mobile-toast mobile-toast-loading ${options?.className || ''}`,
      style: {
        fontSize: '16px',
        lineHeight: '1.5',
        padding: '16px 20px',
        minHeight: '60px',
        borderRadius: '12px',
        ...options?.style,
      },
    })
  },

  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id)
  },
}

/**
 * Hook that provides mobile-optimized toast notifications
 * Automatically adapts toast styling and positioning based on device type
 */
export function useMobileToast() {
  const isMobile = useIsMobile()

  const toast = React.useMemo(() => {
    if (isMobile) {
      return mobileToast
    }
    
    // Return standard toast for desktop with consistent API
    return {
      success: (message: string, _options?: MobileToastOptions) => 
        sonnerToast.success(message, { duration: _options?.duration }),
      error: (message: string, _options?: MobileToastOptions) => 
        sonnerToast.error(message, { duration: _options?.duration }),
      warning: (message: string, _options?: MobileToastOptions) => 
        sonnerToast.warning(message, { duration: _options?.duration }),
      info: (message: string, _options?: MobileToastOptions) => 
        sonnerToast.info(message, { duration: _options?.duration }),
      loading: (message: string, _options?: MobileToastOptions) => 
        sonnerToast.loading(message),
      dismiss: sonnerToast.dismiss,
    }
  }, [isMobile])

  return toast
}