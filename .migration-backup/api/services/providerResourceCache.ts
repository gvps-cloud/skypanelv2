/**
 * Provider Resource Cache Service
 * Implements caching for provider resources (plans, images)
 * with configurable TTL per resource type
 */

export interface CachedResource<T> {
  data: T;
  timestamp: number;
  providerId: string;
}

export interface CacheConfig {
  ttlMs: number;
  enabled: boolean;
}

export class ProviderResourceCache {
  // Cache stores for different resource types
  private static plansCache: Map<string, CachedResource<any[]>> = new Map();
  private static imagesCache: Map<string, CachedResource<any[]>> = new Map();
  private static regionsCache: Map<string, CachedResource<any[]>> = new Map();

  // TTL configurations (in milliseconds)
  private static readonly CACHE_CONFIGS: Record<string, CacheConfig> = {
    plans: {
      ttlMs: 60 * 60 * 1000, // 1 hour
      enabled: true,
    },
    images: {
      ttlMs: 60 * 60 * 1000, // 1 hour
      enabled: true,
    },
    regions: {
      ttlMs: 24 * 60 * 60 * 1000, // 24 hours (regions rarely change)
      enabled: true,
    },
  };

  /**
   * Check if cached data is still valid
   */
  private static isCacheValid(
    cache: CachedResource<any> | undefined,
    resourceType: keyof typeof ProviderResourceCache.CACHE_CONFIGS,
  ): boolean {
    if (!cache) return false;

    const config = this.CACHE_CONFIGS[resourceType];
    if (!config.enabled) return false;

    const now = Date.now();
    return now - cache.timestamp < config.ttlMs;
  }

  /**
   * Get cached plans for a provider
   */
  static getCachedPlans(providerId: string): any[] | null {
    const cached = this.plansCache.get(providerId);
    if (this.isCacheValid(cached, "plans")) {
      console.log(`[Cache HIT] Plans for provider ${providerId}`);
      return cached!.data;
    }
    console.log(`[Cache MISS] Plans for provider ${providerId}`);
    return null;
  }

  /**
   * Set cached plans for a provider
   */
  static setCachedPlans(providerId: string, plans: any[]): void {
    this.plansCache.set(providerId, {
      data: plans,
      timestamp: Date.now(),
      providerId,
    });
    console.log(
      `[Cache SET] Plans for provider ${providerId} (${plans.length} items)`,
    );
  }

  /**
   * Get cached images for a provider
   */
  static getCachedImages(providerId: string): any[] | null {
    const cached = this.imagesCache.get(providerId);
    if (this.isCacheValid(cached, "images")) {
      console.log(`[Cache HIT] Images for provider ${providerId}`);
      return cached!.data;
    }
    console.log(`[Cache MISS] Images for provider ${providerId}`);
    return null;
  }

  /**
   * Set cached images for a provider
   */
  static setCachedImages(providerId: string, images: any[]): void {
    this.imagesCache.set(providerId, {
      data: images,
      timestamp: Date.now(),
      providerId,
    });
    console.log(
      `[Cache SET] Images for provider ${providerId} (${images.length} items)`,
    );
  }

  /**
   * Get cached regions for a provider
   */
  static getCachedRegions(providerId: string): any[] | null {
    const cached = this.regionsCache.get(providerId);
    if (this.isCacheValid(cached, "regions")) {
      console.log(`[Cache HIT] Regions for provider ${providerId}`);
      return cached!.data;
    }
    console.log(`[Cache MISS] Regions for provider ${providerId}`);
    return null;
  }

  /**
   * Set cached regions for a provider
   */
  static setCachedRegions(providerId: string, regions: any[]): void {
    this.regionsCache.set(providerId, {
      data: regions,
      timestamp: Date.now(),
      providerId,
    });
    console.log(
      `[Cache SET] Regions for provider ${providerId} (${regions.length} items)`,
    );
  }

  /**
   * Invalidate all caches for a specific provider
   * Called when provider configuration changes
   */
  static invalidateProvider(providerId: string): void {
    console.log(`[Cache INVALIDATE] All resources for provider ${providerId}`);
    this.plansCache.delete(providerId);
    this.imagesCache.delete(providerId);
    this.regionsCache.delete(providerId);
  }

  /**
   * Invalidate specific resource type for a provider
   */
  static invalidateResource(
    providerId: string,
    resourceType: "plans" | "images" | "regions",
  ): void {
    console.log(
      `[Cache INVALIDATE] ${resourceType} for provider ${providerId}`,
    );
    switch (resourceType) {
      case "plans":
        this.plansCache.delete(providerId);
        break;
      case "images":
        this.imagesCache.delete(providerId);
        break;
      case "regions":
        this.regionsCache.delete(providerId);
        break;
    }
  }

  /**
   * Clear all caches (useful for testing or maintenance)
   */
  static clearAll(): void {
    console.log("[Cache CLEAR] All provider resource caches");
    this.plansCache.clear();
    this.imagesCache.clear();
    this.regionsCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getStats(): {
    plans: { size: number; providers: string[] };
    images: { size: number; providers: string[] };
    regions: { size: number; providers: string[] };
  } {
    return {
      plans: {
        size: this.plansCache.size,
        providers: Array.from(this.plansCache.keys()),
      },
      images: {
        size: this.imagesCache.size,
        providers: Array.from(this.imagesCache.keys()),
      },
      regions: {
        size: this.regionsCache.size,
        providers: Array.from(this.regionsCache.keys()),
      },
    };
  }

  /**
   * Configure cache TTL for a resource type
   * Useful for runtime configuration adjustments
   */
  static configureTTL(
    resourceType: keyof typeof ProviderResourceCache.CACHE_CONFIGS,
    ttlMs: number,
  ): void {
    if (this.CACHE_CONFIGS[resourceType]) {
      this.CACHE_CONFIGS[resourceType].ttlMs = ttlMs;
      console.log(`[Cache CONFIG] ${resourceType} TTL set to ${ttlMs}ms`);
    }
  }

  /**
   * Enable or disable caching for a resource type
   */
  static setCacheEnabled(
    resourceType: keyof typeof ProviderResourceCache.CACHE_CONFIGS,
    enabled: boolean,
  ): void {
    if (this.CACHE_CONFIGS[resourceType]) {
      this.CACHE_CONFIGS[resourceType].enabled = enabled;
      console.log(
        `[Cache CONFIG] ${resourceType} caching ${enabled ? "enabled" : "disabled"}`,
      );
    }
  }
}
