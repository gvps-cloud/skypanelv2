import { useEffect, useState } from 'react';
import { useIsMobile } from './use-mobile';

interface MobileAnimationConfig {
  reducedMotion: boolean;
  prefersReducedMotion: boolean;
  supportsBackdropFilter: boolean;
  isLowEndDevice: boolean;
}

export function useMobileAnimations() {
  const isMobile = useIsMobile();
  const [config, setConfig] = useState<MobileAnimationConfig>({
    reducedMotion: false,
    prefersReducedMotion: false,
    supportsBackdropFilter: true,
    isLowEndDevice: false,
  });

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check for backdrop-filter support
    const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(1px)') || 
                                   CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    
    // Detect low-end devices based on hardware concurrency and memory
    const isLowEndDevice = (() => {
      if (typeof navigator === 'undefined') return false;
      
      // Check hardware concurrency (CPU cores)
      const cores = navigator.hardwareConcurrency || 4;
      
      // Check device memory if available
      const memory = (navigator as any).deviceMemory;
      
      // Consider low-end if less than 4 cores or less than 4GB RAM
      return cores < 4 || (memory && memory < 4);
    })();

    setConfig({
      reducedMotion: prefersReducedMotion || isLowEndDevice,
      prefersReducedMotion,
      supportsBackdropFilter,
      isLowEndDevice,
    });

    // Listen for changes to reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setConfig(prev => ({
        ...prev,
        prefersReducedMotion: e.matches,
        reducedMotion: e.matches || prev.isLowEndDevice,
      }));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Get optimized animation classes for mobile
  const getAnimationClasses = (baseClasses: string) => {
    if (!isMobile) return baseClasses;
    
    const classes = [baseClasses];
    
    if (config.reducedMotion) {
      classes.push('mobile-reduced-motion');
    }
    
    return classes.join(' ');
  };

  // Get optimized transition duration
  const getTransitionDuration = (defaultDuration: string) => {
    if (!isMobile) return defaultDuration;
    if (config.reducedMotion) return '0.01ms';
    return defaultDuration;
  };

  // Get backdrop filter classes with fallback
  const getBackdropClasses = () => {
    if (!isMobile) return 'backdrop-blur-md';
    if (!config.supportsBackdropFilter) return 'bg-black/80';
    return 'mobile-backdrop-optimized';
  };

  // Get modal animation classes
  const getModalAnimationClasses = (isEntering: boolean) => {
    if (!isMobile) return '';
    
    const baseClass = isEntering ? 'mobile-modal-enter' : 'mobile-modal-exit';
    return config.reducedMotion ? `${baseClass} mobile-reduced-motion` : baseClass;
  };

  // Get overlay animation classes
  const getOverlayAnimationClasses = (isEntering: boolean) => {
    if (!isMobile) return '';
    
    const baseClass = isEntering ? 'mobile-modal-overlay-enter' : 'mobile-modal-overlay-exit';
    return config.reducedMotion ? `${baseClass} mobile-reduced-motion` : baseClass;
  };

  // Get touch feedback classes
  const getTouchFeedbackClasses = () => {
    if (!isMobile) return '';
    return config.reducedMotion ? '' : 'mobile-touch-feedback';
  };

  // Get scroll optimization classes
  const getScrollOptimizationClasses = () => {
    if (!isMobile) return '';
    return 'mobile-scroll-optimized';
  };

  return {
    isMobile,
    config,
    getAnimationClasses,
    getTransitionDuration,
    getBackdropClasses,
    getModalAnimationClasses,
    getOverlayAnimationClasses,
    getTouchFeedbackClasses,
    getScrollOptimizationClasses,
  };
}