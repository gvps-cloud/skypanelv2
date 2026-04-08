import type { RateLimitHealthResponse, RateLimitOverrideSummary } from './types';

export function normalizeOverride(override: any): RateLimitOverrideSummary {
  return {
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
  };
}

export function normalizeHealthResponse(
  data: any,
): RateLimitHealthResponse {
  const rawStatus = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  const normalizedStatus: RateLimitHealthResponse['status'] =
    rawStatus === 'healthy' || rawStatus === 'warning' || rawStatus === 'error'
      ? (rawStatus as RateLimitHealthResponse['status'])
      : 'warning';

  return {
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
    overridesCount: Number(
      data.overridesCount ?? (Array.isArray(data.overrides) ? data.overrides.length : 0),
    ),
  };
}