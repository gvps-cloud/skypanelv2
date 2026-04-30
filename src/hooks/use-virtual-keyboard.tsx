import * as React from "react"

export interface VirtualKeyboardState {
  isVisible: boolean
  height: number
}

export function useVirtualKeyboard() {
  const [state, setState] = React.useState<VirtualKeyboardState>({
    isVisible: false,
    height: 0
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight

    const handleViewportChange = () => {
      const newHeight = window.visualViewport?.height || window.innerHeight
      const heightDifference = initialViewportHeight - newHeight
      
      // Consider virtual keyboard visible if viewport height decreased by more than 150px
      const isKeyboardVisible = heightDifference > 150
      
      setState({
        isVisible: isKeyboardVisible,
        height: isKeyboardVisible ? heightDifference : 0
      })

      // Update current height for reference
    }

    // Handle window resize for fallback
    const handleResize = () => {
      const newHeight = window.innerHeight
      const heightDifference = initialViewportHeight - newHeight
      
      // Only update if we don't have visualViewport support
      if (!window.visualViewport) {
        const isKeyboardVisible = heightDifference > 150
        
        setState({
          isVisible: isKeyboardVisible,
          height: isKeyboardVisible ? heightDifference : 0
        })
      }
    }

    // Update initial height on orientation change
    const handleOrientationChange = () => {
      setTimeout(() => {
        initialViewportHeight = window.visualViewport?.height || window.innerHeight
        
        setState({
          isVisible: false,
          height: 0
        })
      }, 500) // Wait for orientation change to complete
    }

    // Use Visual Viewport API if available (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize)
    }

    // Listen for orientation changes to reset baseline
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
      } else {
        window.removeEventListener('resize', handleResize)
      }
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return state
}