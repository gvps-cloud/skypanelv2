import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { RateLimitMetrics, RateLimitHealthResponse, RateLimitOverrideSummary } from './types';
import { normalizeHealthResponse, normalizeOverride } from './normalize';

export function useRateLimitData() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<RateLimitMetrics | null>(null);
  const [healthCheck, setHealthCheck] = useState<RateLimitHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh] = useState(true);
  const [refreshInterval] = useState(30);
  const [overrides, setOverrides] = useState<RateLimitOverrideSummary[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);

  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/health/metrics?window=15'), {
        headers: authHeader,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }

      const data = await response.json();
      if (!data?.metrics) {
        throw new Error('Metrics response missing metrics payload');
      }
      setMetrics(data.metrics);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Failed to fetch rate limit metrics:', error);
      toast.error('Failed to load rate limiting metrics');
    }
  }, [authHeader]);

  const fetchHealthCheck = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/health/rate-limiting'), {
        headers: authHeader,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch health check: ${response.status}`);
      }

      const data = await response.json();
      const normalizedHealth = normalizeHealthResponse(data);
      setHealthCheck(normalizedHealth);
    } catch (error: any) {
      console.error('Failed to fetch rate limit health check:', error);
      toast.error('Failed to load rate limiting health status');
    }
  }, [authHeader]);

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/admin/rate-limits/overrides'), {
        headers: authHeader,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch overrides: ${response.status}`);
      }

      const data = await response.json();
      const overridesPayload: RateLimitOverrideSummary[] = Array.isArray(data.overrides)
        ? data.overrides.map(normalizeOverride)
        : [];

      setOverrides(overridesPayload);
    } catch (error: any) {
      console.error('Failed to fetch rate limit overrides:', error);
      toast.error('Failed to load rate limit overrides');
      setOverrides([]);
    } finally {
      setOverridesLoading(false);
    }
  }, [authHeader]);

  const defaultAuthenticatedLimit = useMemo(() => {
    if (!healthCheck) return 0;
    return Number(healthCheck.configuration.rawLimits.authenticated ?? 0);
  }, [healthCheck]);

  const defaultAuthenticatedWindow = useMemo(() => {
    if (!healthCheck) return 15;
    const windowMs = Number(healthCheck.configuration.windows.authenticatedMs ?? 0);
    const minutes = Math.round(windowMs / 60000);
    return minutes > 0 ? minutes : 15;
  }, [healthCheck]);

  const defaultOverrideLimit = useMemo(() => {
    return defaultAuthenticatedLimit > 0 ? defaultAuthenticatedLimit : 1000;
  }, [defaultAuthenticatedLimit]);

  const defaultOverrideWindow = useMemo(() => {
    return defaultAuthenticatedWindow > 0 ? defaultAuthenticatedWindow : 15;
  }, [defaultAuthenticatedWindow]);

  const activeOverrides = overrides.length > 0 ? overrides.length : healthCheck?.overridesCount ?? 0;

  const refreshData = useCallback(
    async (includeOverrides = false) => {
      setLoading(true);
      try {
        if (includeOverrides) {
          await Promise.all([fetchMetrics(), fetchHealthCheck(), fetchOverrides()]);
        } else {
          await Promise.all([fetchMetrics(), fetchHealthCheck()]);
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchMetrics, fetchHealthCheck, fetchOverrides],
  );

  useEffect(() => {
    refreshData(true);
  }, [refreshData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshData]);

  const getRequestShare = useCallback(
    (requests: number) => {
      if (!metrics || metrics.totalRequests === 0) {
        return 0;
      }
      const ratio = (requests / metrics.totalRequests) * 100;
      return Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio)) : 0;
    },
    [metrics],
  );

  return {
    metrics,
    healthCheck,
    loading,
    lastUpdated,
    activeOverrides,
    refreshData,
    overrides,
    overridesLoading,
    fetchOverrides,
    fetchHealthCheck,
    defaultOverrideLimit,
    defaultOverrideWindow,
    getRequestShare,
  };
}