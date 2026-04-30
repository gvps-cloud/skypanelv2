import { lazy, Suspense, ComponentType, ReactNode, useState, useEffect, useRef } from 'react';
import { useIsMobile } from './use-mobile';

interface LazyLoadingOptions {
  fallback?: ReactNode;
  mobileOnly?: boolean;
  threshold?: number;
  preload?: boolean;
}

// Mobile-optimized lazy loading hook
export function useLazyLoading() {
  const isMobile = useIsMobile();

  const createLazyComponent = <T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyLoadingOptions = {}
  ) => {
    const {
      fallback = <div className="animate-pulse bg-muted rounded-md h-20 w-full" />,
      mobileOnly: _mobileOnly = true,
      preload = false
    } = options;

    // Preload component if requested
    if (preload && typeof window !== 'undefined') {
      // Preload after a short delay to avoid blocking initial render
      setTimeout(() => {
        importFn().catch(() => {
          // Ignore preload errors
        });
      }, 100);
    }

    const LazyComponent = lazy(importFn);

    // Always wrap in Suspense to prevent suspension errors
    // Whether on mobile or desktop
    return (props: any) => (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };

  const createIntersectionLazyComponent = <T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: LazyLoadingOptions = {}
  ) => {
    const {
      fallback = <div className="animate-pulse bg-muted rounded-md h-20 w-full" />,
      threshold = 0.1
    } = options;

    const IntersectionLazyComponent = (props: any) => {
      const [isVisible, setIsVisible] = useState(false);
      const ref = useRef<HTMLDivElement>(null);

      useEffect(() => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.disconnect();
            }
          },
          { threshold }
        );

        if (ref.current) {
          observer.observe(ref.current);
        }

        return () => observer.disconnect();
      }, []); // Remove threshold from dependencies

      if (!isVisible) {
        return <div ref={ref}>{fallback}</div>;
      }

      const LazyComponent = lazy(importFn);
      return (
        <Suspense fallback={fallback}>
          <LazyComponent {...props} />
        </Suspense>
      );
    };

    return IntersectionLazyComponent;
  };

  return {
    createLazyComponent,
    createIntersectionLazyComponent,
    isMobile
  };
}

// Utility for creating mobile-optimized loading states
export function createMobileLoadingFallback(
  height: string = 'h-20',
  className: string = ''
): ReactNode {
  return (
    <div className={`animate-pulse bg-muted rounded-md ${height} w-full ${className}`}>
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    </div>
  );
}

// Preload critical components for better UX
export function preloadCriticalComponents() {
  if (typeof window === 'undefined') return;

  // Preload components that are likely to be used soon
  const preloadPromises = [
    // Add component imports here as needed
  ];

  Promise.allSettled(preloadPromises).catch(() => {
    // Ignore preload errors
  });
}