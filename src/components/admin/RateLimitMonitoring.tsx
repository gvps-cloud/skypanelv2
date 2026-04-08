/**
 * Rate Limiting Monitoring Dashboard Component
 * 
 * Provides comprehensive monitoring and visualization of rate limiting
 * metrics, configuration status, and system health.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Shield, AlertTriangle, CheckCircle, TrendingUp, Users, Clock, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buildApiUrl } from '@/lib/api';

interface RateLimitMetrics {
  totalRequests: number;
  rateLimitedRequests: number;
  rateLimitHitRate: number;
  anonymousRequests: number;
  authenticatedRequests: number;
  adminRequests: number;
  anonymousViolations: number;
  authenticatedViolations: number;
  adminViolations: number;
  timeWindow: string;
  startTime: string;
  endTime: string;
  topViolatingIPs: Array<{
    identifier: string;
    ip: string;
    violations: number;
    userType: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
  }>;
  topViolatingEndpoints: Array<{ endpoint: string; violations: number }>;
  configEffectiveness: {
    anonymousLimitUtilization: number;
    authenticatedLimitUtilization: number;
    adminLimitUtilization: number;
    recommendedAdjustments: string[];
  };
  rates?: {
    anonymousRequestsPerMinute: number;
    authenticatedRequestsPerMinute: number;
    adminRequestsPerMinute: number;
    violationsPerMinute: number;
  };
}

interface RateLimitHealthResponse {
  success: boolean;
  status: 'healthy' | 'warning' | 'error';
  timestamp: string;
  configuration: {
    valid: boolean;
    summary: string[];
    limits: {
      anonymous: string;
      authenticated: string;
      admin: string;
    };
    trustProxy: boolean;
    rawLimits: {
      anonymous: number;
      authenticated: number;
      admin: number;
    };
    windows: {
      anonymousMs: number;
      authenticatedMs: number;
      adminMs: number;
    };
  };
  validation: {
    errors: string[];
    warnings: string[];
    recommendations: string[];
  };
  health: {
    configValid: boolean;
    trustProxyEnabled: boolean;
    limitsConfigured: boolean;
    metricsEnabled: boolean;
  };
  overrides: RateLimitOverrideSummary[];
  overridesCount: number;
}

interface RateLimitOverrideSummary {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  maxRequests: number;
  windowMs: number;
  reason: string | null;
  createdBy: string | null;
  createdByEmail?: string | null;
  createdByName?: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OverrideFormState {
  userId: string;
  email: string;
  maxRequests: number;
  windowMinutes: number;
  reason: string;
  expiresAt: string;
}

interface RateLimitMonitoringProps {
  token: string;
}

export const RateLimitMonitoring: React.FC<RateLimitMonitoringProps> = ({ token }) => {
  const [metrics, setMetrics] = useState<RateLimitMetrics | null>(null);
  const [healthCheck, setHealthCheck] = useState<RateLimitHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh] = useState(true);
  const [refreshInterval] = useState(30); // seconds
  const [overrides, setOverrides] = useState<RateLimitOverrideSummary[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<RateLimitOverrideSummary | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    userId: '',
    email: '',
    maxRequests: 0,
    windowMinutes: 15,
    reason: '',
    expiresAt: '',
  });
  const [savingOverride, setSavingOverride] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

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

      const rawStatus = typeof data.status === 'string' ? data.status.toLowerCase() : '';
      const normalizedStatus: RateLimitHealthResponse['status'] =
        rawStatus === 'healthy' || rawStatus === 'warning' || rawStatus === 'error'
          ? (rawStatus as RateLimitHealthResponse['status'])
          : 'warning';

      const normalizeOverride = (override: any): RateLimitOverrideSummary => ({
        id: override.id,
        userId: override.userId ?? override.user_id,
        userEmail: override.userEmail ?? override.user_email ?? 'unknown',
        userName: override.userName ?? override.user_name ?? null,
        maxRequests: Number(override.maxRequests ?? override.max_requests ?? 0),
        windowMs: Number(override.windowMs ?? override.window_ms ?? 0),
        reason: override.reason ?? null,
        createdBy: override.createdBy ?? override.created_by ?? null,
        createdByEmail: override.createdByEmail ?? override.created_by_email ?? null,
        createdByName: override.createdByName ?? override.created_by_name ?? null,
        expiresAt: override.expiresAt ?? override.expires_at ?? null,
        createdAt: override.createdAt ?? override.created_at ?? new Date().toISOString(),
        updatedAt: override.updatedAt ?? override.updated_at ?? new Date().toISOString(),
      });

      const normalizedHealth: RateLimitHealthResponse | null = data
        ? {
            success: Boolean(data.success),
            status: normalizedStatus,
            timestamp: data.timestamp ?? new Date().toISOString(),
            configuration: {
              valid: Boolean(data.configuration?.valid),
              summary: Array.isArray(data.configuration?.summary)
                ? data.configuration.summary
                : [],
              limits: {
                anonymous: data.configuration?.limits?.anonymous ?? 'Not configured',
                authenticated: data.configuration?.limits?.authenticated ?? 'Not configured',
                admin: data.configuration?.limits?.admin ?? 'Not configured',
              },
              trustProxy: Boolean(data.configuration?.trustProxy),
              rawLimits: {
                anonymous: Number(data.configuration?.rawLimits?.anonymous ?? 0),
                authenticated: Number(data.configuration?.rawLimits?.authenticated ?? 0),
                admin: Number(data.configuration?.rawLimits?.admin ?? 0),
              },
              windows: {
                anonymousMs: Number(data.configuration?.windows?.anonymousMs ?? 0),
                authenticatedMs: Number(data.configuration?.windows?.authenticatedMs ?? 0),
                adminMs: Number(data.configuration?.windows?.adminMs ?? 0),
              },
            },
            validation: {
              errors: Array.isArray(data.validation?.errors) ? data.validation.errors : [],
              warnings: Array.isArray(data.validation?.warnings) ? data.validation.warnings : [],
              recommendations: Array.isArray(data.validation?.recommendations)
                ? data.validation.recommendations
                : [],
            },
            health: {
              configValid: Boolean(data.health?.configValid),
              trustProxyEnabled: Boolean(data.health?.trustProxyEnabled),
              limitsConfigured: Boolean(data.health?.limitsConfigured),
              metricsEnabled: Boolean(data.health?.metricsEnabled),
            },
            overrides: Array.isArray(data.overrides)
              ? data.overrides.map(normalizeOverride)
              : [],
            overridesCount: Number(data.overridesCount ?? (Array.isArray(data.overrides) ? data.overrides.length : 0)),
          }
        : null;

      if (!normalizedHealth) {
        throw new Error('Health check response missing expected payload');
      }

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
      const mapOverride = (override: any): RateLimitOverrideSummary => ({
        id: override.id,
        userId: override.userId ?? override.user_id,
        userEmail: override.userEmail ?? override.user_email ?? 'unknown',
        userName: override.userName ?? override.user_name ?? null,
        maxRequests: Number(override.maxRequests ?? override.max_requests ?? 0),
        windowMs: Number(override.windowMs ?? override.window_ms ?? 0),
        reason: override.reason ?? null,
        createdBy: override.createdBy ?? override.created_by ?? null,
        createdByEmail: override.createdByEmail ?? override.created_by_email ?? null,
        createdByName: override.createdByName ?? override.created_by_name ?? null,
        expiresAt: override.expiresAt ?? override.expires_at ?? null,
        createdAt: override.createdAt ?? override.created_at ?? new Date().toISOString(),
        updatedAt: override.updatedAt ?? override.updated_at ?? new Date().toISOString(),
      });

      const overridesPayload: RateLimitOverrideSummary[] = Array.isArray(data.overrides)
        ? data.overrides.map(mapOverride)
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

  const formatWindowMinutes = (windowMs: number) => {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      return 0;
    }
    return Math.round(windowMs / 60000);
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return 'No expiry';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return date.toLocaleString();
  };

  const toDateTimeLocalInput = (value: string | null) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const closeOverrideDialog = useCallback(() => {
    setOverrideDialogOpen(false);
    setSelectedOverride(null);
    setOverrideForm({
      userId: '',
      email: '',
      maxRequests: defaultOverrideLimit,
      windowMinutes: defaultOverrideWindow,
      reason: '',
      expiresAt: '',
    });
  }, [defaultOverrideLimit, defaultOverrideWindow]);

  const openOverrideDialog = useCallback(
    (override?: RateLimitOverrideSummary) => {
      if (override) {
        setSelectedOverride(override);
        setOverrideForm({
          userId: override.userId,
          email: override.userEmail,
          maxRequests: override.maxRequests,
          windowMinutes: formatWindowMinutes(override.windowMs) || defaultOverrideWindow,
          reason: override.reason ?? '',
          expiresAt: toDateTimeLocalInput(override.expiresAt),
        });
      } else {
        setSelectedOverride(null);
        setOverrideForm({
          userId: '',
          email: '',
          maxRequests: defaultOverrideLimit,
          windowMinutes: defaultOverrideWindow,
          reason: '',
          expiresAt: '',
        });
      }
      setOverrideDialogOpen(true);
    },
    [defaultOverrideLimit, defaultOverrideWindow],
  );

  const handleOverrideSubmit = useCallback(async () => {
    if (!selectedOverride && overrideForm.email.trim().length === 0) {
      toast.error('User email is required to create a new override');
      return;
    }

    if (overrideForm.maxRequests <= 0 || overrideForm.windowMinutes <= 0) {
      toast.error('Max requests and window must be positive values');
      return;
    }

    setSavingOverride(true);
    try {
      const payload: Record<string, unknown> = {
        maxRequests: Number(overrideForm.maxRequests),
        windowMinutes: Number(overrideForm.windowMinutes),
      };

      if (overrideForm.reason.trim().length > 0) {
        payload.reason = overrideForm.reason.trim();
      }

      if (overrideForm.expiresAt) {
        const expiresDate = new Date(overrideForm.expiresAt);
        if (Number.isNaN(expiresDate.getTime())) {
          toast.error('Invalid expiration date');
          setSavingOverride(false);
          return;
        }
        payload.expiresAt = expiresDate.toISOString();
      }

      if (selectedOverride) {
        payload.userId = selectedOverride.userId;
      } else {
        payload.email = overrideForm.email.trim().toLowerCase();
      }

      const response = await fetch(buildApiUrl('/api/admin/rate-limits/overrides'), {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          errorBody?.error ||
          (Array.isArray(errorBody?.errors) ? errorBody.errors[0]?.msg || errorBody.errors[0] : null) ||
          'Failed to save override';
        throw new Error(message);
      }

      await Promise.all([fetchOverrides(), fetchHealthCheck()]);
      toast.success('Rate limit override saved');
      closeOverrideDialog();
    } catch (error: any) {
      console.error('Failed to save override:', error);
      toast.error(error?.message ?? 'Failed to save override');
    } finally {
      setSavingOverride(false);
    }
  }, [overrideForm, selectedOverride, authHeader, fetchOverrides, fetchHealthCheck, closeOverrideDialog]);

  const handleDeleteOverride = useCallback(
    async (override: RateLimitOverrideSummary) => {
      setDeletingOverrideId(override.id);
      try {
        const response = await fetch(
          buildApiUrl(`/api/admin/rate-limits/overrides/${override.userId}`),
          {
            method: 'DELETE',
            headers: authHeader,
          },
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message = errorBody?.error || 'Failed to delete override';
          throw new Error(message);
        }

        await Promise.all([fetchOverrides(), fetchHealthCheck()]);
        toast.success('Rate limit override removed');
      } catch (error: any) {
        console.error('Failed to delete override:', error);
        toast.error(error?.message ?? 'Failed to delete override');
      } finally {
        setDeletingOverrideId(null);
      }
    },
    [authHeader, fetchOverrides, fetchHealthCheck],
  );

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

  // Initial load
  useEffect(() => {
    refreshData(true);
  }, [refreshData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatNumber = (num: number) => {
    if (!Number.isFinite(num)) {
      return '0';
    }
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number) => {
    if (!Number.isFinite(num)) {
      return '0%';
    }
    return `${num.toFixed(1)}%`;
  };

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

  if (!metrics || !healthCheck) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading rate limiting monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">Rate Limiting Monitor</h2>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of API rate limiting effectiveness and system health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshData(true);
            }}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline" className="text-xs">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Never updated'}
          </Badge>
        </div>
      </div>

      {/* Status Overview */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">System Status</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold capitalize ${healthCheck.status === 'error' ? 'text-destructive' : healthCheck.status === 'warning' ? 'text-yellow-500' : 'text-primary'}`}>
                  {healthCheck.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Hit Rate</p>
              <p className="text-2xl font-bold">{formatPercentage(metrics.rateLimitHitRate)}</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(metrics.rateLimitedRequests)} of {formatNumber(metrics.totalRequests)} requests
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{formatNumber(metrics.totalRequests)}</p>
              <p className="text-xs text-muted-foreground">Last {metrics.timeWindow}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Window</p>
              <p className="text-2xl font-bold">{metrics.timeWindow}</p>
              <p className="text-xs text-muted-foreground">Current observation window</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Overrides</p>
              <p className="text-2xl font-bold">{activeOverrides}</p>
              <p className="text-xs text-muted-foreground">Users with custom rate limits</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-types">User Types</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Request Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Distribution</CardTitle>
                <CardDescription>Breakdown by user authentication type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Anonymous</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(metrics.anonymousRequests)} requests
                    </span>
                  </div>
                  <Progress value={getRequestShare(metrics.anonymousRequests)} className="h-2" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Authenticated</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(metrics.authenticatedRequests)} requests
                    </span>
                  </div>
                  <Progress value={getRequestShare(metrics.authenticatedRequests)} className="h-2" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Admin</span>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(metrics.adminRequests)} requests
                    </span>
                  </div>
                  <Progress value={getRequestShare(metrics.adminRequests)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Configuration Effectiveness */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Limit Utilization</CardTitle>
                <CardDescription>Average percentage of limits being used</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Anonymous Users</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics.configEffectiveness.anonymousLimitUtilization)}
                    </span>
                  </div>
                  <Progress 
                    value={metrics.configEffectiveness.anonymousLimitUtilization} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Authenticated Users</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics.configEffectiveness.authenticatedLimitUtilization)}
                    </span>
                  </div>
                  <Progress 
                    value={metrics.configEffectiveness.authenticatedLimitUtilization} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Admin Users</span>
                    <span className="text-sm text-muted-foreground">
                      {formatPercentage(metrics.configEffectiveness.adminLimitUtilization)}
                    </span>
                  </div>
                  <Progress 
                    value={metrics.configEffectiveness.adminLimitUtilization} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {metrics.configEffectiveness.recommendedAdjustments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
                <CardDescription>System-generated suggestions for optimization</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {metrics.configEffectiveness.recommendedAdjustments.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="user-types" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Anonymous Users</CardTitle>
                <CardDescription>Unauthenticated requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Requests</span>
                    <span className="font-medium">{formatNumber(metrics.anonymousRequests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Violations</span>
                    <span className="font-medium text-destructive">{formatNumber(metrics.anonymousViolations)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Configured Limit</span>
                    <span className="font-medium text-right">
                      {healthCheck.configuration.limits.anonymous}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Authenticated Users</CardTitle>
                <CardDescription>Requests with valid tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Requests</span>
                    <span className="font-medium">{formatNumber(metrics.authenticatedRequests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Violations</span>
                    <span className="font-medium text-destructive">{formatNumber(metrics.authenticatedViolations)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Configured Limit</span>
                    <span className="font-medium text-right">
                      {healthCheck.configuration.limits.authenticated}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Admin Users</CardTitle>
                <CardDescription>Administrative requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Requests</span>
                    <span className="font-medium">{formatNumber(metrics.adminRequests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Violations</span>
                    <span className="font-medium text-destructive">{formatNumber(metrics.adminViolations)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Configured Limit</span>
                    <span className="font-medium text-right">
                      {healthCheck.configuration.limits.admin}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Top Violating Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Violating Sources</CardTitle>
                <CardDescription>Users and IPs with the most rate limit violations</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topViolatingIPs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No violations detected</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>User Type</TableHead>
                        <TableHead className="text-right">Violations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.topViolatingIPs.map((item, index) => (
                        <TableRow key={index}>
                          {/* User Info or Anonymous */}
                          <TableCell className="font-mono text-sm">
                            {item.userId ? (
                              <div>
                                <div className="font-medium">
                                  {item.userName || item.userEmail || item.userId}
                                </div>
                                {item.userName && item.userEmail && item.userName !== item.userEmail && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.userEmail}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Anonymous</span>
                            )}
                          </TableCell>

                          {/* IP Address - always shown */}
                          <TableCell className="font-mono text-sm">{item.ip}</TableCell>

                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.userType}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-medium">{item.violations}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Top Violating Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Violating Endpoints</CardTitle>
                <CardDescription>API endpoints with the most rate limit violations</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topViolatingEndpoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No violations detected</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Violations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.topViolatingEndpoints.map((endpoint, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{endpoint.endpoint}</TableCell>
                          <TableCell className="text-right font-medium">{endpoint.violations}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Configuration Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration Status</CardTitle>
                <CardDescription>Current rate limiting configuration health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Configuration Valid</span>
                  <Badge variant={healthCheck.health.configValid ? 'default' : 'destructive'}>
                    {healthCheck.health.configValid ? 'Valid' : 'Invalid'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trust Proxy Enabled</span>
                  <Badge variant={healthCheck.health.trustProxyEnabled ? 'default' : 'secondary'}>
                    {healthCheck.health.trustProxyEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Limits Configured</span>
                  <Badge variant={healthCheck.health.limitsConfigured ? 'default' : 'destructive'}>
                    {healthCheck.health.limitsConfigured ? 'Configured' : 'Missing'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Metrics Enabled</span>
                  <Badge variant={healthCheck.health.metricsEnabled ? 'default' : 'secondary'}>
                    {healthCheck.health.metricsEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Current Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Limits</CardTitle>
                <CardDescription>Active rate limiting configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Anonymous Users</span>
                    <span className="text-sm text-muted-foreground text-right">
                      {healthCheck.configuration.limits.anonymous}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Authenticated Users</span>
                    <span className="text-sm text-muted-foreground text-right">
                      {healthCheck.configuration.limits.authenticated}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Admin Users</span>
                    <span className="text-sm text-muted-foreground text-right">
                      {healthCheck.configuration.limits.admin}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Issues and Recommendations */}
          {(healthCheck.validation.errors.length > 0 ||
            healthCheck.validation.warnings.length > 0 ||
            healthCheck.validation.recommendations.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(healthCheck.validation.errors.length > 0 || healthCheck.validation.warnings.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-destructive">Issues</CardTitle>
                    <CardDescription>Configuration problems that need attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {[...healthCheck.validation.errors, ...healthCheck.validation.warnings].map((issue, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          <span>{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {healthCheck.validation.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-primary">Recommendations</CardTitle>
                    <CardDescription>Suggested improvements for better performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {healthCheck.validation.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Override Management</CardTitle>
              <CardDescription>Grant elevated rate limits to trusted or high-volume users.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Active overrides: <span className="font-medium text-foreground">{activeOverrides}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Default authenticated policy: {formatNumber(defaultOverrideLimit)} requests / {defaultOverrideWindow} minutes
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void Promise.all([fetchOverrides(), fetchHealthCheck()]);
                  }}
                  disabled={overridesLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${overridesLoading ? 'animate-spin' : ''}`} />
                  Refresh Overrides
                </Button>
                <Button size="sm" onClick={() => openOverrideDialog()}>
                  New Override
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Overrides</CardTitle>
              <CardDescription>Users currently operating under custom rate limits</CardDescription>
            </CardHeader>
            <CardContent>
              {overridesLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Loading overrides...
                </div>
              ) : overrides.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {(healthCheck?.overridesCount ?? 0) > 0
                    ? 'Overrides exist but failed to load. Please refresh to try again.'
                    : 'No active overrides. All users are using the global configuration.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Max Requests</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((override) => (
                      <TableRow key={override.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {override.userName ? `${override.userName}` : override.userEmail}
                            </span>
                            {override.userName && (
                              <span className="text-xs text-muted-foreground">{override.userEmail}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatNumber(override.maxRequests)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatWindowMinutes(override.windowMs)} min
                        </TableCell>
                        <TableCell className="max-w-xs text-sm">
                          {override.reason ? override.reason : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">{formatDateTime(override.expiresAt)}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col">
                            <span>{formatDateTime(override.createdAt)}</span>
                            {override.createdByEmail && (
                              <span className="text-xs text-muted-foreground">
                                by {override.createdByName ?? override.createdByEmail}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openOverrideDialog(override)}
                            >
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive/80"
                                  disabled={deletingOverrideId === override.id}
                                >
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove override</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will revert {override.userEmail} to the default rate limit policy. Continue?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      void handleDeleteOverride(override);
                                    }}
                                    disabled={deletingOverrideId === override.id}
                                  >
                                    {deletingOverrideId === override.id ? 'Removing...' : 'Confirm'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={overrideDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeOverrideDialog();
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedOverride ? 'Edit Rate Limit Override' : 'New Rate Limit Override'}</DialogTitle>
                <DialogDescription>
                  {selectedOverride
                    ? 'Adjust the request budget for this user. Changes take effect immediately.'
                    : 'Provide the user email and desired request budget to grant additional capacity.'}
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleOverrideSubmit();
                }}
              >
                {!selectedOverride && (
                  <div className="space-y-2">
                    <Label htmlFor="override-email">User Email</Label>
                    <Input
                      id="override-email"
                      type="email"
                      placeholder="user@example.com"
                      value={overrideForm.email}
                      onChange={(event) =>
                        setOverrideForm((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the email address associated with the user's SkyPanel account.
                    </p>
                  </div>
                )}

                {selectedOverride && (
                  <div className="space-y-1">
                    <Label>User</Label>
                    <p className="text-sm font-medium text-foreground">
                      {selectedOverride.userName
                        ? `${selectedOverride.userName} (${selectedOverride.userEmail})`
                        : selectedOverride.userEmail}
                    </p>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="override-max">Max Requests</Label>
                    <Input
                      id="override-max"
                      type="number"
                      min={1}
                      step={1}
                      value={overrideForm.maxRequests}
                      onChange={(event) =>
                        setOverrideForm((previous) => ({
                          ...previous,
                          maxRequests: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="override-window">Window (minutes)</Label>
                    <Input
                      id="override-window"
                      type="number"
                      min={1}
                      step={1}
                      value={overrideForm.windowMinutes}
                      onChange={(event) =>
                        setOverrideForm((previous) => ({
                          ...previous,
                          windowMinutes: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="override-reason">Reason (optional)</Label>
                  <Textarea
                    id="override-reason"
                    placeholder="Document why this override is needed..."
                    value={overrideForm.reason}
                    onChange={(event) =>
                      setOverrideForm((previous) => ({
                        ...previous,
                        reason: event.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="override-expires">Expires At (optional)</Label>
                  <Input
                    id="override-expires"
                    type="datetime-local"
                    value={overrideForm.expiresAt}
                    onChange={(event) =>
                      setOverrideForm((previous) => ({
                        ...previous,
                        expiresAt: event.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep the override active until it is manually removed.
                  </p>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeOverrideDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingOverride}>
                    {savingOverride ? 'Saving...' : 'Save Override'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};