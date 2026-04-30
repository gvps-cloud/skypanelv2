import * as React from "react"
import { useIsMobile } from "./use-mobile"

export interface MobileNavigationOptions {
  onBackButton?: () => boolean | void // Return false to prevent default behavior
  preventBackOnModal?: boolean
  confirmBeforeBack?: boolean
  confirmMessage?: string
}

export function useMobileNavigation(options: MobileNavigationOptions = {}) {
  const {
    onBackButton,
    preventBackOnModal = true,
    confirmBeforeBack = false,
    confirmMessage = "Are you sure you want to go back? Your progress may be lost."
  } = options
  
  const isMobile = useIsMobile()
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isMobile) return

    const handlePopState = (_event: PopStateEvent) => {
      // If we should prevent back navigation on modal
      if (preventBackOnModal && isModalOpen) {
        // Push a new state to prevent actual navigation
        window.history.pushState(null, '', window.location.href)
        
        // Call custom handler if provided
        if (onBackButton) {
          const shouldPreventDefault = onBackButton()
          if (shouldPreventDefault === false) {
            // Allow navigation if handler returns false
            window.history.back()
          }
        }
        return
      }

      // Show confirmation if requested
      if (confirmBeforeBack) {
        const shouldContinue = window.confirm(confirmMessage)
        if (!shouldContinue) {
          // Push state again to prevent navigation
          window.history.pushState(null, '', window.location.href)
          return
        }
      }

      // Call custom handler
      if (onBackButton) {
        const shouldPreventDefault = onBackButton()
        if (shouldPreventDefault !== false) {
          // Prevent default navigation unless handler explicitly returns false
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    // Add initial state to handle back button
    window.history.pushState(null, '', window.location.href)
    
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isMobile, isModalOpen, onBackButton, preventBackOnModal, confirmBeforeBack, confirmMessage])

  // Function to set modal state
  const setModalOpen = React.useCallback((open: boolean) => {
    setIsModalOpen(open)
  }, [])

  // Function to programmatically trigger back navigation
  const goBack = React.useCallback(() => {
    if (onBackButton) {
      const shouldPreventDefault = onBackButton()
      if (shouldPreventDefault === false) {
        window.history.back()
      }
    } else {
      window.history.back()
    }
  }, [onBackButton])

  return {
    setModalOpen,
    goBack,
    isModalOpen
  }
}