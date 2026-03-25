/**
 * Rate Limiting Configuration Validation Service
 * 
 * Provides comprehensive validation of rate limiting configuration
 * at application startup and runtime health checks.
 */

import { config, validateRateLimitConfig, type RateLimitConfig } from '../config/index.js';
import { logRateLimitConfig } from './activityLogger.js';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  configSummary: {
    anonymousLimits: string;
    authenticatedLimits: string;
    adminLimits: string;
    trustProxy: boolean | string | number;
    environment: string;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error';
  timestamp: Date;
  rateLimiting: {
    configValid: boolean;
    trustProxyEnabled: boolean;
    limitsConfigured: boolean;
    metricsEnabled: boolean;
  };
  configuration: {
    anonymousLimit: number;
    authenticatedLimit: number;
    adminLimit: number;
    windowMs: number;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Comprehensive configuration validation
 */
export function validateRateLimitConfiguration(): ConfigValidationResult {
  const rateLimitConfig = config.rateLimiting;
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Basic validation using existing validator
  const basicValidation = validateRateLimitConfig(rateLimitConfig);
  errors.push(...basicValidation.errors);
  
  // Enhanced validation checks
  
  // 1. Environment-specific validation
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isProduction) {
    // Production-specific checks
    if (rateLimitConfig.trustProxy === true && !process.env.TRUST_PROXY) {
      warnings.push('Trust proxy is enabled by default in production - consider explicit configuration');
    }

    if (rateLimitConfig.anonymousMaxRequests >= rateLimitConfig.authenticatedMaxRequests) {
      errors.push('Anonymous limits should be lower than authenticated limits in production');
    }
  }

  if (isDevelopment) {
    // Development-specific checks
    if (!rateLimitConfig.trustProxy) {
      warnings.push('Trust proxy should be enabled in development for proper IP detection with Vite proxy');
    }
  }
  
  // 2. Logical consistency checks
  if (rateLimitConfig.authenticatedMaxRequests <= rateLimitConfig.anonymousMaxRequests) {
    errors.push('Authenticated user limits should be higher than anonymous user limits');
  }
  
  if (rateLimitConfig.adminMaxRequests <= rateLimitConfig.authenticatedMaxRequests) {
    errors.push('Admin user limits should be higher than authenticated user limits');
  }
  
  // 3. Window size validation
  const windowMinutes = rateLimitConfig.anonymousWindowMs / 60000;
  if (windowMinutes < 1) {
    errors.push('Rate limit window should be at least 1 minute');
  } else if (windowMinutes > 60) {
    warnings.push('Rate limit window is longer than 1 hour - consider shorter windows for better responsiveness');
  }
  
  // 4. Rate calculation is kept for reference but no longer generates warnings
  // Rate-based warnings were removed as they don't reflect VPS hosting platform needs
  // where high API usage is legitimate for server management operations
  const anonymousRatePerMinute = rateLimitConfig.anonymousMaxRequests / windowMinutes;

  // 5. Trust proxy validation
  if (typeof rateLimitConfig.trustProxy === 'string') {
    // Validate subnet format if it's a string
    const subnetPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!subnetPattern.test(rateLimitConfig.trustProxy) && 
        !['loopback', 'linklocal', 'uniquelocal'].includes(rateLimitConfig.trustProxy)) {
      errors.push(`Invalid trust proxy configuration: ${rateLimitConfig.trustProxy}`);
    }
  }
  
  // 6. Generate recommendations
  if (rateLimitConfig.anonymousMaxRequests < 50) {
    recommendations.push('Consider increasing anonymous limits if legitimate users are being blocked');
  }
  
  if (rateLimitConfig.authenticatedMaxRequests < 200) {
    recommendations.push('Authenticated users could benefit from higher limits for better UX');
  }
  
  if (windowMinutes === 15 && anonymousRatePerMinute < 5) {
    recommendations.push('Consider shorter rate limit windows for more responsive limit resets');
  }
  
  // Environment-specific recommendations
  if (isProduction) {
    recommendations.push('Monitor rate limiting metrics regularly to optimize limits based on actual usage');
  }
  
  const configSummary = {
    anonymousLimits: `${rateLimitConfig.anonymousMaxRequests} requests per ${windowMinutes} minutes`,
    authenticatedLimits: `${rateLimitConfig.authenticatedMaxRequests} requests per ${windowMinutes} minutes`,
    adminLimits: `${rateLimitConfig.adminMaxRequests} requests per ${windowMinutes} minutes`,
    trustProxy: rateLimitConfig.trustProxy,
    environment: process.env.NODE_ENV || 'development'
  };
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendations,
    configSummary
  };
}

/**
 * Perform startup validation and logging
 */
export async function performStartupValidation(): Promise<void> {
  console.log('🔍 Validating rate limiting configuration...');
  
  const validation = validateRateLimitConfiguration();
  
  // Log configuration summary
  console.log('📊 Rate Limiting Configuration Summary:');
  console.log(`  Environment: ${validation.configSummary.environment}`);
  console.log(`  Anonymous Users: ${validation.configSummary.anonymousLimits}`);
  console.log(`  Authenticated Users: ${validation.configSummary.authenticatedLimits}`);
  console.log(`  Admin Users: ${validation.configSummary.adminLimits}`);
  console.log(`  Trust Proxy: ${validation.configSummary.trustProxy}`);
  
  // Log validation results
  if (validation.isValid) {
    console.log('✅ Rate limiting configuration is valid');
  } else {
    console.error('❌ Rate limiting configuration has errors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Rate limiting configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Log recommendations
  if (validation.recommendations.length > 0) {
    console.log('💡 Rate limiting recommendations:');
    validation.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  // Log configuration to activity logs for audit trail
  try {
    await logRateLimitConfig(config.rateLimiting);
  } catch (error) {
    console.warn('Failed to log rate limit configuration to activity logs:', error);
  }
  
  // Exit if critical errors in production
  if (!validation.isValid && process.env.NODE_ENV === 'production') {
    console.error('🚨 Critical rate limiting configuration errors detected in production');
    console.error('Application startup aborted to prevent security issues');
    process.exit(1);
  }
  
  console.log('✅ Rate limiting configuration validation completed');
}

/**
 * Get current health check status
 */
export function getRateLimitHealthCheck(): HealthCheckResult {
  const validation = validateRateLimitConfiguration();
  const rateLimitConfig = config.rateLimiting;
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Collect issues
  issues.push(...validation.errors);
  issues.push(...validation.warnings);
  
  // Collect recommendations
  recommendations.push(...validation.recommendations);
  
  // Determine overall health status
  let status: 'healthy' | 'warning' | 'error' = 'healthy';
  
  if (validation.errors.length > 0) {
    status = 'error';
  } else if (validation.warnings.length > 0) {
    status = 'warning';
  }
  
  return {
    status,
    timestamp: new Date(),
    rateLimiting: {
      configValid: validation.isValid,
      trustProxyEnabled: Boolean(rateLimitConfig.trustProxy),
      limitsConfigured: rateLimitConfig.anonymousMaxRequests > 0 && 
                       rateLimitConfig.authenticatedMaxRequests > 0 && 
                       rateLimitConfig.adminMaxRequests > 0,
      metricsEnabled: true // Metrics are always enabled in our implementation
    },
    configuration: {
      anonymousLimit: rateLimitConfig.anonymousMaxRequests,
      authenticatedLimit: rateLimitConfig.authenticatedMaxRequests,
      adminLimit: rateLimitConfig.adminMaxRequests,
      windowMs: rateLimitConfig.anonymousWindowMs
    },
    issues,
    recommendations
  };
}

/**
 * Validate configuration at runtime (for admin endpoints)
 */
export function validateRuntimeConfiguration(newConfig: Partial<RateLimitConfig>): ConfigValidationResult {
  // Create a temporary config object for validation
  const tempConfig: RateLimitConfig = {
    ...config.rateLimiting,
    ...newConfig
  };
  
  // Use the same validation logic but with the new configuration
  const originalConfig = config.rateLimiting;
  
  // Temporarily replace config for validation
  (config as any).rateLimiting = tempConfig;
  
  try {
    const result = validateRateLimitConfiguration();
    return result;
  } finally {
    // Restore original config
    (config as any).rateLimiting = originalConfig;
  }
}

/**
 * Get configuration recommendations based on current metrics
 */
export function getConfigurationRecommendations(metrics?: {
  rateLimitHitRate: number;
  anonymousViolations: number;
  authenticatedViolations: number;
  adminViolations: number;
}): string[] {
  const recommendations: string[] = [];
  const validation = validateRateLimitConfiguration();
  
  // Add base recommendations
  recommendations.push(...validation.recommendations);
  
  // Add metrics-based recommendations if provided
  if (metrics) {
    if (metrics.rateLimitHitRate > 10) {
      recommendations.push('High rate limit hit rate detected - consider increasing limits or investigating unusual traffic');
    }
    
    if (metrics.anonymousViolations > metrics.authenticatedViolations * 2) {
      recommendations.push('Anonymous users are hitting limits frequently - consider implementing authentication incentives');
    }
    
    if (metrics.adminViolations > 0) {
      recommendations.push('Admin users are hitting rate limits - investigate for automated processes or increase admin limits');
    }
}
  
  return recommendations;
}

/**
 * Log periodic configuration health summary
 */
export function logConfigurationHealthSummary(): void {
  const health = getRateLimitHealthCheck();
  
  console.log('🏥 Rate Limiting Health Check Summary:', {
    timestamp: health.timestamp.toISOString(),
    status: health.status,
    configValid: health.rateLimiting.configValid,
    trustProxyEnabled: health.rateLimiting.trustProxyEnabled,
    limitsConfigured: health.rateLimiting.limitsConfigured,
    currentLimits: {
      anonymous: health.configuration.anonymousLimit,
      authenticated: health.configuration.authenticatedLimit,
      admin: health.configuration.adminLimit,
      windowMinutes: Math.round(health.configuration.windowMs / 60000)
    },
    issueCount: health.issues.length,
    recommendationCount: health.recommendations.length
  });
  
  if (health.issues.length > 0) {
    console.warn('Issues detected:', health.issues);
  }
  
  if (health.recommendations.length > 0) {
    console.log('Recommendations:', health.recommendations);
  }
}

/**
 * Initialize configuration monitoring with periodic health checks
 */
export function initializeConfigurationMonitoring(): void {
  // Log health summary every 6 hours
  setInterval(() => {
    logConfigurationHealthSummary();
  }, 6 * 60 * 60 * 1000); // 6 hours
  
  console.log('Rate limiting configuration monitoring initialized');
}