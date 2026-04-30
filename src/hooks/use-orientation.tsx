import * as React from "react"

export type Orientation = 'portrait' | 'landscape'

export interface OrientationState {
  orientation: Orientation
  isChanging: boolean
}

export function useOrientation() {
  const [state, setState] = React.useState<OrientationState>({
    orientation: 'portrait',
    isChanging: false
  })

  React.useEffect(() => {
    const getOrientation = (): Orientation => {
      if (typeof window === 'undefined') return 'portrait'
      
      // Use screen.orientation API if available
      if (screen.orientation) {
        return screen.orientation.angle === 0 || screen.orientation.angle === 180 
          ? 'portrait' 
          : 'landscape'
      }
      
      // Fallback to window dimensions
      return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
    }

    const updateOrientation = () => {
      const newOrientation = getOrientation()
      
      setState(prev => {
        if (prev.orientation !== newOrientation) {
          // Mark as changing when orientation actually changes
          return {
            orientation: newOrientation,
            isChanging: true
          }
        }
        return prev
      })

      // Clear the changing flag after a brief delay to allow layout adjustments
      setTimeout(() => {
        setState(prev => ({ ...prev, isChanging: false }))
      }, 300)
    }

    // Set initial orientation
    updateOrientation()

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(updateOrientation, 100)
    }

    // Listen to multiple events for better compatibility
    window.addEventListener('orientationchange', handleOrientationChange)
    window.addEventListener('resize', handleOrientationChange)
    
    // Modern browsers support screen.orientation
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange)
    }

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.removeEventListener('resize', handleOrientationChange)
      
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange)
      }
    }
  }, [])

  return state
}