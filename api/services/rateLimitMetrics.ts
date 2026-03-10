/**
 * Rate Limiting Metrics and Monitoring Service
 * 
 * Provides comprehensive metrics collection, aggregation, and monitoring
 * for rate limiting effectiveness and system health.
 */

import { Request } from 'express';
import { query } from '../lib/database.js';
import { getClientIP } from '../lib/ipDetection.js';
import { config } from '../config/index.js';
import type { UserType } from '../middleware/rateLimiting.js';

export interface RateLimitMetrics {
  // Basic metrics
  totalRequests: number;
  rateLimitedRequests: number;
  rateLimitHitRate: number; // Percentage of requests that hit rate limits
  
  // User type breakdown
  anonymousRequests: number;
  authenticatedRequests: number;
  adminRequests: number;
  
  // Rate limit violations by user type
  anonymousViolations: number;
  authenticatedViolations: number;
  adminViolations: number;
  
  // Time-based metrics
  timeWindow: string;
  startTime: Date;
  endTime: Date;
  
  // Top violating IPs and endpoints
  topViolatingIPs: Array<{ ip: string; violations: number; userType: string }>;
  topViolatingEndpoints: Array<{ endpoint: string; violations: number }>;
  
  // Configuration effectiveness
  configEffectiveness: {
    anonymousLimitUtilization: number; // Average % of limit used
    authenticatedLimitUtilization: number;
    adminLimitUtilization: number;
    recommendedAdjustments: string[];
  };
}

export interface RateLimitEvent {
  timestamp: Date;
  clientIP: string;
  userId?: string;
  userType: UserType;
  endpoint: string;
  endpointType?: 'dashboard' | 'api'; // Track whether this is a dashboard or external API endpoint
  method: string;
  limit: number;
  currentCount: number;
  windowMs: number;
  resetTime: Date;
  userAgent?: string;
  violationType: 'exceeded' | 'approaching' | 'normal';
  userEmail?: string;
  userName?: string;
}


/**
 * In-memory metrics store for real-time aggregation
 * In production, this could be replaced with Redis or a time-series database
 */
class RateLimitMetricsStore {
  private events: RateLimitEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events in memory
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Periodic cleanup of old events
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }
  
  /**
   * Record a rate limiting event
   */
  recordEvent(event: RateLimitEvent): void {
    this.events.push(event);
    
    // Keep only recent events in memory
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }
  
  /**
   * Get events within a time window
   */
  getEvents(startTime: Date, endTime: Date): RateLimitEvent[] {
    return this.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }
  
  /**
   * Clean up old events (older than 1 hour)
   */
  private cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.events = this.events.filter(event => event.timestamp > oneHourAgo);
  }
  
  /**
   * Get current metrics summary
   */
  getCurrentMetrics(windowMinutes: number = 15): RateLimitMetrics {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);
    const events = this.getEvents(startTime, endTime);
    
    return this.calculateMetrics(events, startTime, endTime);
  }
  
  /**
   * Calculate comprehensive metrics from events
   */
  private calculateMetrics(events: RateLimitEvent[], startTime: Date, endTime: Date): RateLimitMetrics {
    const totalRequests = events.length;
    const violations = events.filter(e => e.violationType === 'exceeded');
    const rateLimitedRequests = violations.length;
    
    // User type breakdown
    const anonymousRequests = events.filter(e => e.userType === 'anonymous').length;
    const authenticatedRequests = events.filter(e => e.userType === 'authenticated').length;
    const adminRequests = events.filter(e => e.userType === 'admin').length;
    
    const anonymousViolations = violations.filter(e => e.userType === 'anonymous').length;
    const authenticatedViolations = violations.filter(e => e.userType === 'authenticated').length;
    const adminViolations = violations.filter(e => e.userType === 'admin').length;

    // Top violating sources - track comprehensive info (user + IP)
    const topViolators = new Map<string, {
      count: number;
      userType: string;
      identifier: string;      // userId or IP
      ip: string;             // Always track IP
      userId?: string;        // User ID if authenticated
      userEmail?: string;     // User email if available
      userName?: string;      // User name if available
    }>();
    violations.forEach(event => {
      // Use userId as key for authenticated users, IP for anonymous
      const key = event.userId || event.clientIP;

      const existing = topViolators.get(key) || {
        count: 0,
        userType: event.userType,
        identifier: event.userId || event.clientIP,
        ip: event.clientIP,
        userId: event.userId,
        userEmail: event.userEmail,
        userName: event.userName,
      };

      topViolators.set(key, {
        ...existing,
        count: existing.count + 1
      });
    });

    const topViolatingIPs = Array.from(topViolators.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(v => ({
        identifier: v.identifier,
        ip: v.ip,
        violations: v.count,
        userType: v.userType,
        userId: v.userId,
        userEmail: v.userEmail,
        userName: v.userName,
      }));
    
    // Top violating endpoints
    const endpointViolations = new Map<string, number>();
    violations.forEach(event => {
      const count = endpointViolations.get(event.endpoint) || 0;
      endpointViolations.set(event.endpoint, count + 1);
    });
    
    const topViolatingEndpoints = Array.from(endpointViolations.entries())
      .map(([endpoint, violations]) => ({ endpoint, violations }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10);
    
    // Configuration effectiveness analysis
    const configEffectiveness = this.analyzeConfigEffectiveness(events);
    
    return {
      totalRequests,
      rateLimitedRequests,
      rateLimitHitRate: totalRequests > 0 ? (rateLimitedRequests / totalRequests) * 100 : 0,
      anonymousRequests,
      authenticatedRequests,
      adminRequests,
      anonymousViolations,
      authenticatedViolations,
      adminViolations,
      timeWindow: `${Math.round((endTime.getTime() - startTime.getTime()) / 60000)} minutes`,
      startTime,
      endTime,
      topViolatingIPs,
      topViolatingEndpoints,
      configEffectiveness
    };
  }
  
  /**
   * Analyze configuration effectiveness and provide recommendations
   */
  private analyzeConfigEffectiveness(events: RateLimitEvent[]): RateLimitMetrics['configEffectiveness'] {
    const rateLimitConfig = config.rateLimiting;
    const recommendations: string[] = [];
    
    // Calculate average limit utilization by user type
    const anonymousEvents = events.filter(e => e.userType === 'anonymous');
    const authenticatedEvents = events.filter(e => e.userType === 'authenticated');
    const adminEvents = events.filter(e => e.userType === 'admin');

    const anonymousUtilization = this.calculateAverageUtilization(anonymousEvents);
    const authenticatedUtilization = this.calculateAverageUtilization(authenticatedEvents);
    const adminUtilization = this.calculateAverageUtilization(adminEvents);
    
    // Generate recommendations based on utilization patterns
    if (anonymousUtilization > 80) {
      recommendations.push('Anonymous user limits are frequently exceeded - consider increasing limits or implementing additional authentication incentives');
    }
    
    if (authenticatedUtilization > 90) {
      recommendations.push('Authenticated user limits are frequently exceeded - consider increasing limits for better user experience');
    }
    
    if (adminUtilization > 95) {
      recommendations.push('Admin user limits are being hit - consider increasing admin limits or investigating unusual admin activity');
    }
    
    // Check for suspicious patterns
    const violationsByIP = new Map<string, number>();
    events.filter(e => e.violationType === 'exceeded').forEach(event => {
      const count = violationsByIP.get(event.clientIP) || 0;
      violationsByIP.set(event.clientIP, count + 1);
    });

    const suspiciousIPs = Array.from(violationsByIP.entries()).filter(([, count]) => count > 10);
    if (suspiciousIPs.length > 0) {
      recommendations.push(`${suspiciousIPs.length} IP(s) with excessive violations detected - monitor these patterns for legitimate vs abusive traffic`);
    }

    return {
      anonymousLimitUtilization: anonymousUtilization,
      authenticatedLimitUtilization: authenticatedUtilization,
      adminLimitUtilization: adminUtilization,
      recommendedAdjustments: recommendations
    };
  }
  
  /**
   * Calculate average limit utilization for a set of events
   * Uses event.limit which is the effective limit (accounting for dashboard multiplier)
   */
  private calculateAverageUtilization(events: RateLimitEvent[]): number {
    if (events.length === 0) return 0;

    const totalUtilization = events.reduce((sum, event) => {
      // Use event.limit which is the effective limit for that specific request
      // This accounts for dashboard vs API endpoint differences
      return sum + (event.currentCount / event.limit) * 100;
    }, 0);

    return totalUtilization / events.length;
  }
}

// Global metrics store instance
const metricsStore = new RateLimitMetricsStore();

/**
 * Record a rate limiting event for metrics collection
 */
export function recordRateLimitEvent(
  req: Request,
  userType: UserType,
  limit: number,
  currentCount: number,
  windowMs: number,
  resetTime: number,
  userId?: string,
  endpointType?: 'dashboard' | 'api',
  userEmail?: string,
  userName?: string
): void {
  try {
    const ipResult = getClientIP(req, {
      trustProxy: Boolean(config.rateLimiting.trustProxy),
      enableLogging: false
    });

    const event: RateLimitEvent = {
      timestamp: new Date(),
      clientIP: ipResult.ip,
      userId,
      userType,
      endpoint: req.path,
      endpointType, // Track whether this is a dashboard or external API endpoint
      method: req.method,
      limit,
      currentCount,
      windowMs,
      resetTime: new Date(resetTime),
      userAgent: req.headers['user-agent'],
      violationType: currentCount > limit ? 'exceeded' :
                   currentCount > limit * 0.8 ? 'approaching' : 'normal',
      userEmail,
      userName,
    };
    
    metricsStore.recordEvent(event);
    
    // Log detailed information for exceeded limits
    if (event.violationType === 'exceeded') {
      console.warn('Rate Limit Exceeded - Detailed Metrics:', {
        timestamp: event.timestamp.toISOString(),
        clientIP: event.clientIP,
        userId: event.userId,
        userType: event.userType,
        endpointType: event.endpointType || 'unknown', // Show whether dashboard or external API
        endpoint: event.endpoint,
        method: event.method,
        limit: event.limit,
        currentCount: event.currentCount,
        utilizationPercent: Math.round((event.currentCount / event.limit) * 100),
        resetTime: event.resetTime.toISOString(),
        userAgent: event.userAgent,
        guidance: getUserGuidanceMessage(event.userType)
      });
    }
  } catch (error) {
    console.error('Failed to record rate limit event:', error);
  }
}

/**
 * Get user-friendly guidance message based on user type
 */
function getUserGuidanceMessage(userType: UserType): string {
  switch (userType) {
    case 'anonymous':
      return 'Consider creating an account for higher rate limits and better service access.';
    case 'authenticated':
      return 'You have reached your request limit. Please wait before making additional requests.';
    case 'admin':
      return 'Admin rate limit reached. If this is unexpected, please check for automated processes or contact system administrators.';
    default:
      return 'Request limit reached. Please wait before making additional requests.';
  }
}

/**
 * Get current rate limiting metrics
 */
export function getCurrentMetrics(windowMinutes: number = 15): RateLimitMetrics {
  return metricsStore.getCurrentMetrics(windowMinutes);
}

/**
 * Get aggregated statistics for a specific time period
 */
export function getAggregatedStatistics(startTime: Date, endTime: Date): RateLimitMetrics {
  const events = metricsStore.getEvents(startTime, endTime);
  return metricsStore['calculateMetrics'](events, startTime, endTime);
}

/**
 * Log rate limiting effectiveness summary
 */
export function logEffectivenessSummary(): void {
  const metrics = getCurrentMetrics(60); // Last hour
  
  console.log('Rate Limiting Effectiveness Summary (Last Hour):', {
    timestamp: new Date().toISOString(),
    totalRequests: metrics.totalRequests,
    rateLimitHitRate: `${metrics.rateLimitHitRate.toFixed(2)}%`,
    userTypeBreakdown: {
      anonymous: `${metrics.anonymousRequests} requests, ${metrics.anonymousViolations} violations`,
      authenticated: `${metrics.authenticatedRequests} requests, ${metrics.authenticatedViolations} violations`,
      admin: `${metrics.adminRequests} requests, ${metrics.adminViolations} violations`
    },
    configEffectiveness: {
      anonymousUtilization: `${metrics.configEffectiveness.anonymousLimitUtilization.toFixed(1)}%`,
      authenticatedUtilization: `${metrics.configEffectiveness.authenticatedLimitUtilization.toFixed(1)}%`,
      adminUtilization: `${metrics.configEffectiveness.adminLimitUtilization.toFixed(1)}%`
    },
    recommendations: metrics.configEffectiveness.recommendedAdjustments,
    topViolatingEndpoints: metrics.topViolatingEndpoints.slice(0, 3)
  });
}

/**
 * Initialize metrics collection with periodic reporting
 */
export function initializeMetricsCollection(): void {
  // Log effectiveness summary every hour
  setInterval(() => {
    logEffectivenessSummary();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('Rate limiting metrics collection initialized');
}

/**
 * Get metrics for database persistence (for historical analysis)
 */
export async function persistMetricsToDatabase(): Promise<void> {
  try {
    const metrics = getCurrentMetrics(15); // Last 15 minutes
    
    // Create metrics table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS rate_limit_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        time_window_minutes INTEGER NOT NULL,
        total_requests INTEGER NOT NULL,
        rate_limited_requests INTEGER NOT NULL,
        rate_limit_hit_rate DECIMAL(5,2) NOT NULL,
        anonymous_requests INTEGER NOT NULL,
        authenticated_requests INTEGER NOT NULL,
        admin_requests INTEGER NOT NULL,
        anonymous_violations INTEGER NOT NULL,
        authenticated_violations INTEGER NOT NULL,
        admin_violations INTEGER NOT NULL,
        config_effectiveness JSONB NOT NULL,
        top_violating_ips JSONB NOT NULL,
        top_violating_endpoints JSONB NOT NULL
      )
    `);
    
    // Insert current metrics
    await query(`
      INSERT INTO rate_limit_metrics (
        time_window_minutes, total_requests, rate_limited_requests, rate_limit_hit_rate,
        anonymous_requests, authenticated_requests, admin_requests,
        anonymous_violations, authenticated_violations, admin_violations,
        config_effectiveness, top_violating_ips, top_violating_endpoints
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      15, // time window
      metrics.totalRequests,
      metrics.rateLimitedRequests,
      metrics.rateLimitHitRate,
      metrics.anonymousRequests,
      metrics.authenticatedRequests,
      metrics.adminRequests,
      metrics.anonymousViolations,
      metrics.authenticatedViolations,
      metrics.adminViolations,
      JSON.stringify(metrics.configEffectiveness),
      JSON.stringify(metrics.topViolatingIPs),
      JSON.stringify(metrics.topViolatingEndpoints)
    ]);
    
  } catch (error) {
    console.error('Failed to persist rate limit metrics to database:', error);
  }
}

/**
 * Start periodic metrics persistence (every 15 minutes)
 */
export function startMetricsPersistence(): void {
  // Persist metrics every 15 minutes
  setInterval(() => {
    persistMetricsToDatabase();
  }, 15 * 60 * 1000); // 15 minutes
  
  console.log('Rate limiting metrics persistence started');
}