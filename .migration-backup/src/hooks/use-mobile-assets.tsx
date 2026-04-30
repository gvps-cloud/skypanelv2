import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from './use-mobile';

interface AssetLoadingOptions {
  priority?: 'high' | 'low';
  format?: 'webp' | 'avif' | 'auto';
  quality?: number;
  lazy?: boolean;
}

interface NetworkInfo {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  saveData?: boolean;
}

export function useMobileAssets() {
  const isMobile = useIsMobile();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({});
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // Detect network conditions
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      const updateNetworkInfo = () => {
        const info: NetworkInfo = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          saveData: connection.saveData
        };
        setNetworkInfo(info);
        
        // Consider connection slow if it's 2g/slow-2g or save data is enabled
        const isSlow = info.effectiveType === '2g' || 
                      info.effectiveType === 'slow-2g' || 
                      info.saveData ||
                      (info.downlink && info.downlink < 1);
        setIsSlowConnection(isSlow);
      };

      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);

      return () => {
        connection.removeEventListener('change', updateNetworkInfo);
      };
    }
  }, []);

  // Optimize image loading based on device and network conditions
  const getOptimizedImageProps = useCallback((
    src: string, 
    options: AssetLoadingOptions = {}
  ) => {
    const {
      priority = 'low',
      format = 'auto',
      quality = isSlowConnection ? 60 : 80,
      lazy = true
    } = options;

    const props: any = {
      src,
      loading: lazy && priority === 'low' ? 'lazy' : 'eager',
      decoding: 'async'
    };

    props['data-quality'] = quality;

    // Add responsive sizing for mobile
    if (isMobile) {
      props.sizes = '(max-width: 768px) 100vw, 50vw';
    }

    // Add format hints for modern browsers
    if (format === 'auto') {
      // Browser will choose best format
      props.type = 'image/*';
    }

    return props;
  }, [isMobile, isSlowConnection]);

  // Preload critical assets
  const preloadAsset = useCallback((
    src: string, 
    type: 'image' | 'script' | 'style' = 'image'
  ) => {
    if (typeof window === 'undefined' || isSlowConnection) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = src;
    
    if (type === 'image') {
      link.as = 'image';
    } else if (type === 'script') {
      link.as = 'script';
    } else if (type === 'style') {
      link.as = 'style';
    }

    document.head.appendChild(link);
  }, [isSlowConnection]);

  // Lazy load images with intersection observer
  const createLazyImageLoader = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: isMobile ? '50px' : '100px', // Smaller margin on mobile
        threshold: 0.1
      }
    );

    return imageObserver;
  }, [isMobile]);

  // Optimize CSS and JS loading
  const loadAssetAsync = useCallback(async (
    src: string, 
    type: 'script' | 'style'
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (type === 'script') {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
      } else if (type === 'style') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = src;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load stylesheet: ${src}`));
        document.head.appendChild(link);
      }
    });
  }, []);

  // Bundle multiple assets for efficient loading
  const loadAssetBundle = useCallback(async (
    assets: Array<{ src: string; type: 'script' | 'style'; priority?: 'high' | 'low' }>
  ) => {
    // Sort by priority
    const highPriority = assets.filter(a => a.priority === 'high');
    const lowPriority = assets.filter(a => a.priority !== 'high');

    // Load high priority assets first
    if (highPriority.length > 0) {
      await Promise.allSettled(
        highPriority.map(asset => loadAssetAsync(asset.src, asset.type))
      );
    }

    // Load low priority assets after a delay on slow connections
    if (lowPriority.length > 0) {
      const delay = isSlowConnection ? 1000 : 100;
      setTimeout(() => {
        Promise.allSettled(
          lowPriority.map(asset => loadAssetAsync(asset.src, asset.type))
        );
      }, delay);
    }
  }, [isSlowConnection, loadAssetAsync]);

  return {
    isMobile,
    networkInfo,
    isSlowConnection,
    getOptimizedImageProps,
    preloadAsset,
    createLazyImageLoader,
    loadAssetAsync,
    loadAssetBundle
  };
}