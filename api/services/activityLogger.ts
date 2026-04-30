import { Request } from "express";
import { query } from "../lib/database.js";
import { getIP } from "../lib/ipDetection.js";
import { ValidationPatterns } from "../lib/validation.js";
import { sendActivityNotificationEmail } from "./activityEmailService.js";

export interface ActivityPayload {
  userId: string;
  organizationId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  message?: string | null;
  status?: "success" | "warning" | "error" | "info";
  metadata?: any;
  suppressNotification?: boolean;
}

export interface RateLimitEventPayload {
  userId?: string;
  organizationId?: string | null;
  endpoint: string;
  userType: "anonymous" | "authenticated" | "admin";
  limit: number;
  windowMs: number;
  currentCount: number;
  resetTime: number;
  clientIP: string;
  userAgent?: string;
}

// Removed local getIp function - now using unified IP detection service

let ensurePromise: Promise<void> | null = null;

export const ensureActivityLogsTable = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      await query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    } catch (err: any) {
      // Non-critical: some providers restrict extension creation; continue if that happens.
      if (err?.code !== "42501") {
        console.warn("Activity logs extension check failed:", err);
      }
    }

    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        organization_id UUID,
        event_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        message TEXT,
        status VARCHAR(50) DEFAULT 'info' CHECK (status IN ('success', 'warning', 'error', 'info')),
        ip_address VARCHAR(64),
        user_agent TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(
      "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE",
    );
    await query(
      "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ",
    );

    const indexStatements = [
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(organization_id)",
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type)",
    ];

    for (const stmt of indexStatements) {
      await query(stmt);
    }

    try {
      await query(`
        CREATE OR REPLACE FUNCTION notify_new_activity()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.event_type IN (
            'vps.create', 'vps.boot', 'vps.shutdown', 'vps.reboot', 'vps.delete',
            'vps.backups.enable', 'vps.backups.disable', 'vps.backups.schedule',
            'vps.backups.snapshot', 'vps.backups.restore',
            'vps.firewall.attach', 'vps.firewall.detach',
            'vps.network.rdns', 'vps.hostname.update',
            'auth.login', 'auth.password_change', 'auth.2fa.enabled', 'auth.2fa.disabled',
            'api_key.create', 'api_key.revoke',
            'ticket_reply',
            'user_update',
            'impersonation_target', 'impersonation_ended',
            'billing.payment.completed', 'billing.payment.failed', 'billing.payment.cancelled', 'billing.refund.completed',
            'platform_availability.update', 'platform_settings.update', 'theme_update'
          ) THEN
            PERFORM pg_notify(
              'new_activity',
              json_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'organization_id', NEW.organization_id,
                'event_type', NEW.event_type,
                'entity_type', NEW.entity_type,
                'entity_id', NEW.entity_id,
                'message', NEW.message,
                'status', NEW.status,
                'created_at', NEW.created_at,
                'is_read', NEW.is_read
              )::text
            );
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await query(
        "DROP TRIGGER IF EXISTS activity_notify_trigger ON activity_logs",
      );
      await query(`
        CREATE TRIGGER activity_notify_trigger
        AFTER INSERT ON activity_logs
        FOR EACH ROW
        EXECUTE FUNCTION notify_new_activity()
      `);
    } catch (err) {
      console.warn("Activity notification trigger setup failed:", err);
    }
  })().catch((err) => {
    ensurePromise = null;
    throw err;
  });

  return ensurePromise;
};

export async function logActivity(
  payload: ActivityPayload,
  req?: Request,
): Promise<void> {
  try {
    const {
      userId,
      organizationId = null,
      eventType,
      entityType,
      entityId = null,
      message = null,
      status = "info",
      metadata = {},
      suppressNotification = false,
    } = payload;

    const ip = req ? getIP(req, { enableLogging: false }) : undefined;
    const ua = req?.headers["user-agent"] || undefined;
    const isRead = suppressNotification;
    const readAt = suppressNotification ? new Date().toISOString() : null;
    const normalizedUserId =
      userId && ValidationPatterns.uuid.test(userId) ? userId : null;
    const occurredAt = new Date().toISOString();

    await ensureActivityLogsTable();

    await query(
      `INSERT INTO activity_logs (user_id, organization_id, event_type, entity_type, entity_id, message, status, ip_address, user_agent, metadata, is_read, read_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        normalizedUserId,
        organizationId,
        eventType,
        entityType,
        entityId,
        message,
        status,
        ip,
        ua,
        metadata,
        isRead,
        readAt,
      ],
    );

    if (normalizedUserId && !suppressNotification) {
      void sendActivityNotificationEmail({
        userId: normalizedUserId,
        eventType,
        entityType,
        entityId,
        message,
        status,
        metadata,
        occurredAt,
      }).catch((error) => {
        console.warn("Activity notification email failed:", error);
      });
    }
  } catch (e) {
    // Non-blocking: do not throw, but log to server console
    console.warn("Activity log insert failed:", e);
  }
}

/**
 * Logs rate limiting events with detailed metadata for security monitoring
 */
export async function logRateLimitEvent(
  payload: RateLimitEventPayload,
  req: Request,
): Promise<void> {
  try {
    const {
      userId,
      organizationId = null,
      endpoint,
      userType,
      limit,
      windowMs,
      currentCount,
      resetTime,
      clientIP,
      userAgent,
    } = payload;

    // Create detailed metadata for rate limiting event
    const metadata = {
      endpoint,
      userType,
      limit,
      windowMs,
      currentCount,
      resetTime: new Date(resetTime).toISOString(),
      rateLimitKey: `${clientIP}:${userType}`,
      requestMethod: req.method,
      requestPath: req.path,
      requestQuery: req.query,
      violationType: currentCount > limit ? "exceeded" : "approaching",
    };

    // Determine message and status based on violation severity
    const isExceeded = currentCount > limit;
    const message = isExceeded
      ? `Rate limit exceeded for ${userType} user on ${endpoint} (${currentCount}/${limit} requests)`
      : `Rate limit approaching for ${userType} user on ${endpoint} (${currentCount}/${limit} requests)`;

    const status = isExceeded ? "warning" : "info";

    await ensureActivityLogsTable();

    // Log as security-relevant activity
    await query(
      `INSERT INTO activity_logs (user_id, organization_id, event_type, entity_type, entity_id, message, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId && ValidationPatterns.uuid.test(userId) ? userId : null,
        organizationId,
        "rate_limit_violation",
        "api_request",
        endpoint,
        message,
        status,
        clientIP,
        userAgent || req.headers["user-agent"],
        metadata,
      ],
    );

    // Also log to console for immediate monitoring
    if (isExceeded) {
      console.warn("Rate Limit Exceeded:", {
        timestamp: new Date().toISOString(),
        clientIP,
        userId,
        userType,
        endpoint,
        limit,
        currentCount,
        userAgent: userAgent || req.headers["user-agent"],
      });
    }
  } catch (e) {
    // Non-blocking: do not throw, but log to server console
    console.warn("Rate limit activity log insert failed:", e);
  }
}

/**
 * Logs rate limiting configuration and startup events
 */
export async function logRateLimitConfig(config: any): Promise<void> {
  try {
    const metadata = {
      anonymousLimit: config.anonymousMaxRequests,
      authenticatedLimit: config.authenticatedMaxRequests,
      adminLimit: config.adminMaxRequests,
      windowMs: config.anonymousWindowMs,
      trustProxy: config.trustProxy,
      configSource: "environment_variables",
    };

    await ensureActivityLogsTable();

    await query(
      `INSERT INTO activity_logs (user_id, organization_id, event_type, entity_type, entity_id, message, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        null, // System event, no specific user
        null,
        "rate_limit_config",
        "system",
        "rate_limiter",
        "Rate limiting configuration loaded",
        "info",
        null,
        "system",
        metadata,
      ],
    );
  } catch (e) {
    console.warn("Rate limit config activity log insert failed:", e);
  }
}
