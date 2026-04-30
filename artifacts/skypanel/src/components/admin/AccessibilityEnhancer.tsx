/* eslint-disable react-refresh/only-export-components */
import React from 'react';

/**
 * Hook for managing focus within a component
 */
export const useFocusManagement = () => {
  const focusableElementsRef = React.useRef<HTMLElement[]>([]);
  const currentFocusIndexRef = React.useRef(-1);

  const updateFocusableElements = React.useCallback((container: HTMLElement | null) => {
    if (!container) return;

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="menuitem"]:not([disabled])',
    ].join(', ');

    const elements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    focusableElementsRef.current = elements;
  }, []);

  const focusFirst = React.useCallback(() => {
    const firstElement = focusableElementsRef.current[0];
    if (firstElement) {
      firstElement.focus();
      currentFocusIndexRef.current = 0;
    }
  }, []);

  const focusLast = React.useCallback(() => {
    const lastIndex = focusableElementsRef.current.length - 1;
    const lastElement = focusableElementsRef.current[lastIndex];
    if (lastElement) {
      lastElement.focus();
      currentFocusIndexRef.current = lastIndex;
    }
  }, []);

  const focusNext = React.useCallback(() => {
    const currentIndex = currentFocusIndexRef.current;
    const nextIndex = (currentIndex + 1) % focusableElementsRef.current.length;
    const nextElement = focusableElementsRef.current[nextIndex];
    if (nextElement) {
      nextElement.focus();
      currentFocusIndexRef.current = nextIndex;
    }
  }, []);

  const focusPrevious = React.useCallback(() => {
    const currentIndex = currentFocusIndexRef.current;
    const prevIndex = currentIndex <= 0 
      ? focusableElementsRef.current.length - 1 
      : currentIndex - 1;
    const prevElement = focusableElementsRef.current[prevIndex];
    if (prevElement) {
      prevElement.focus();
      currentFocusIndexRef.current = prevIndex;
    }
  }, []);

  return {
    updateFocusableElements,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
  };
};

/**
 * Hook for keyboard navigation
 */
export const useKeyboardNavigation = (
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void,
  onTab?: (shiftKey: boolean) => void
) => {
  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onEscape?.();
        break;
      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        break;
      case 'ArrowUp':
        if (onArrowUp) {
          event.preventDefault();
          onArrowUp();
        }
        break;
      case 'ArrowDown':
        if (onArrowDown) {
          event.preventDefault();
          onArrowDown();
        }
        break;
      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft();
        }
        break;
      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight();
        }
        break;
      case 'Tab':
        if (onTab) {
          event.preventDefault();
          onTab(event.shiftKey);
        }
        break;
    }
  }, [onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onTab]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { handleKeyDown };
};

/**
 * Hook for managing live regions for screen readers
 */
export const useLiveRegion = () => {
  const liveRegionRef = React.useRef<HTMLDivElement | null>(null);

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) {
      // Create live region if it doesn't exist
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    // Update the live region
    liveRegionRef.current.setAttribute('aria-live', priority);
    liveRegionRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (liveRegionRef.current && document.body.contains(liveRegionRef.current)) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  return { announce };
};

/**
 * Hook for managing reduced motion preferences
 */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

/**
 * Component for providing skip links
 */
export const SkipLinks: React.FC<{
  links: Array<{ href: string; label: string }>;
}> = ({ links }) => {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <div className="fixed top-0 left-0 z-50 bg-primary text-primary-foreground p-2 space-x-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary-foreground"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
};

/**
 * Component for providing focus trap functionality
 */
export const FocusTrap: React.FC<{
  children: React.ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}> = ({ children, isActive, onEscape }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { updateFocusableElements, focusFirst, focusLast } = useFocusManagement();

  React.useEffect(() => {
    if (isActive && containerRef.current) {
      updateFocusableElements(containerRef.current);
      focusFirst();
    }
  }, [isActive, updateFocusableElements, focusFirst]);

  useKeyboardNavigation(
    onEscape,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    (shiftKey) => {
      if (isActive) {
        if (shiftKey) {
          focusLast();
        } else {
          focusFirst();
        }
      }
    }
  );

  return (
    <div ref={containerRef} className="focus-trap">
      {children}
    </div>
  );
};

/**
 * Hook for managing loading states with accessibility announcements
 */
export const useAccessibleLoading = () => {
  const { announce } = useLiveRegion();
  const [isLoading, setIsLoading] = React.useState(false);

  const startLoading = React.useCallback((message = 'Loading, please wait') => {
    setIsLoading(true);
    announce(message, 'polite');
  }, [announce]);

  const stopLoading = React.useCallback((message = 'Loading complete') => {
    setIsLoading(false);
    announce(message, 'polite');
  }, [announce]);

  const announceError = React.useCallback((message: string) => {
    announce(`Error: ${message}`, 'assertive');
  }, [announce]);

  const announceSuccess = React.useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    announceError,
    announceSuccess,
  };
};