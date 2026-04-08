export interface RateLimitMetrics {
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

export interface RateLimitHealthResponse {
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

export interface RateLimitOverrideSummary {
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

export interface OverrideFormState {
  userId: string;
  email: string;
  maxRequests: number;
  windowMinutes: number;
  reason: string;
  expiresAt: string;
}