import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useIsMobile } from './use-mobile';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  networkLatency?: number;
  frameRate: number;
  isLowEndDevice: boolean;
}

interface PerformanceThresholds {
  maxRenderTime: number;
  maxMemoryUsage: number;
  minFrameRate: number;
}

export function useMobilePerformance() {
  const isMobile = useIsMobile();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    frameRate: 60,
    isLowEndDevice: false
  });
  const [isPerformanceOptimized, setIsPerformanceOptimized] = useState(false);
  const _frameCountRef = useRef(0);
  const _lastFrameTimeRef = useRef(performance.now());

  // Default thresholds for mobile performance (memoized)
  const thresholds: PerformanceThresholds = useMemo(() => ({
    maxRenderTime: isMobile ? 16 : 8, // 60fps = 16ms per frame
    maxMemoryUsage: isMobile ? 50 : 100, // MB
    minFrameRate: isMobile ? 30 : 60
  }), [isMobile]);

  // Detect low-end device characteristics
  useEffect(() => {
    const detectLowEndDevice = () => {
      const cores = navigator.hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      const connection = (navigator as any).connection;
      
      const isLowEnd = cores < 4 || 
                      memory < 4 || 
                      (connection && (
                        connection.effectiveType === '2g' || 
                        connection.effectiveType === 'slow-2g' ||
                        connection.saveData
                      ));

      setMetrics(prev => ({ ...prev, isLowEndDevice: isLowEnd }));
      setIsPerformanceOptimized(isLowEnd);
    };

    detectLowEndDevice();
  }, []);

  // Monitor frame rate (disabled to prevent infinite loops)
  useEffect(() => {
    if (!isMobile) return;

    // Simplified frame rate detection - just set a reasonable default
    setMetrics(prev => ({ ...prev, frameRate: 60 }));
  }, [isMobile]);

  // Monitor memory usage (simplified to prevent infinite loops)
  useEffect(() => {
    if (!isMobile || !(performance as any).memory) return;

    // One-time memory check
    const memory = (performance as any).memory;
    if (memory) {
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      setMetrics(prev => ({ ...prev, memoryUsage: usedMB }));
    }
  }, [isMobile]);

  // Measure render performance
  const measureRenderTime = useCallback((componentName: string) => {
    if (!isMobile) return () => {};

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({ ...prev, renderTime }));
      
      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && renderTime > thresholds.maxRenderTime) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }, [isMobile, thresholds.maxRenderTime]);

  // Get performance-optimized settings (memoized to prevent infinite loops)
  const getOptimizedSettings = useMemo(() => {
    const { isLowEndDevice, frameRate, memoryUsage } = metrics;
    
    return {
      // Animation settings
      enableAnimations: !isLowEndDevice && frameRate >= thresholds.minFrameRate,
      animationDuration: isLowEndDevice ? 0.1 : frameRate < 30 ? 0.2 : 0.3,
      
      // Rendering settings
      enableShadows: !isLowEndDevice && frameRate >= 45,
      enableBlur: !isLowEndDevice && frameRate >= 40,
      enableGradients: !isLowEndDevice,
      
      // Memory settings
      enableLazyLoading: isLowEndDevice || (memoryUsage && memoryUsage > thresholds.maxMemoryUsage),
      maxConcurrentImages: isLowEndDevice ? 3 : 6,
      
      // Network settings
      enablePreloading: !isLowEndDevice && frameRate >= 50,
      imageQuality: isLowEndDevice ? 60 : 80,
      
      // Component settings
      enableVirtualization: isLowEndDevice || (memoryUsage && memoryUsage > 40),
      debounceDelay: isLowEndDevice ? 300 : 150
    };
  }, [metrics, thresholds]);

  // Performance optimization recommendations
  const getOptimizationRecommendations = useCallback(() => {
    const { isLowEndDevice, frameRate, memoryUsage, renderTime } = metrics;
    const recommendations: string[] = [];

    if (isLowEndDevice) {
      recommendations.push('Device detected as low-end - enabling performance optimizations');
    }

    if (frameRate < thresholds.minFrameRate) {
      recommendations.push('Low frame rate detected - reducing animation complexity');
    }

    if (memoryUsage && memoryUsage > thresholds.maxMemoryUsage) {
      recommendations.push('High memory usage - enabling lazy loading and cleanup');
    }

    if (renderTime > thresholds.maxRenderTime) {
      recommendations.push('Slow render times - optimizing component updates');
    }

    return recommendations;
  }, [metrics, thresholds]);

  // Force performance optimization mode
  const enablePerformanceMode = useCallback(() => {
    setIsPerformanceOptimized(true);
  }, []);

  const disablePerformanceMode = useCallback(() => {
    setIsPerformanceOptimized(false);
  }, []);

  return {
    metrics,
    thresholds,
    isPerformanceOptimized,
    measureRenderTime,
    getOptimizedSettings,
    getOptimizationRecommendations,
    enablePerformanceMode,
    disablePerformanceMode,
    isMobile
  };
}