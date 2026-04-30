import { query } from '../lib/database.js';

export interface RateLimitOverride {
  id: string;
  userId: string;
  maxRequests: number;
  windowMs: number;
  reason: string | null;
  createdBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CachedOverride {
  override: RateLimitOverride | null;
  expiresAt: number;
}

const overrideCache = new Map<string, CachedOverride>();
const CACHE_TTL_MS = 30 * 1000;

function hydrateOverride(row: any): RateLimitOverride {
  return {
    id: row.id,
    userId: row.user_id,
    maxRequests: Number(row.max_requests),
    windowMs: Number(row.window_ms),
    reason: row.reason ?? null,
    createdBy: row.created_by ?? null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function setCacheEntry(userId: string, override: RateLimitOverride | null): void {
  overrideCache.set(userId, {
    override,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearRateLimitOverrideCache(userId?: string): void {
  if (userId) {
    overrideCache.delete(userId);
    return;
  }
  overrideCache.clear();
}

export async function getRateLimitOverrideForUser(userId: string): Promise<RateLimitOverride | null> {
  const cached = overrideCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.override;
  }

  const { rows } = await query(
    `SELECT id, user_id, max_requests, window_ms, reason, created_by, expires_at, created_at, updated_at
     FROM user_rate_limit_overrides
     WHERE user_id = $1`,
    [userId],
  );

  if (!rows[0]) {
    setCacheEntry(userId, null);
    return null;
  }

  const override = hydrateOverride(rows[0]);

  if (override.expiresAt && override.expiresAt.getTime() <= Date.now()) {
    await query('DELETE FROM user_rate_limit_overrides WHERE id = $1', [override.id]).catch((error: unknown) => {
      console.warn('Failed to clean up expired rate limit override:', error);
    });
    setCacheEntry(userId, null);
    return null;
  }

  setCacheEntry(userId, override);
  return override;
}

export async function upsertRateLimitOverride(options: {
  userId: string;
  maxRequests: number;
  windowMs: number;
  reason?: string | null;
  createdBy?: string | null;
  expiresAt?: Date | null;
}): Promise<RateLimitOverride> {
  const { userId, maxRequests, windowMs, reason, createdBy, expiresAt } = options;

  const { rows } = await query(
    `INSERT INTO user_rate_limit_overrides (user_id, max_requests, window_ms, reason, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id)
     DO UPDATE SET
       max_requests = EXCLUDED.max_requests,
       window_ms = EXCLUDED.window_ms,
       reason = EXCLUDED.reason,
       created_by = EXCLUDED.created_by,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id, user_id, max_requests, window_ms, reason, created_by, expires_at, created_at, updated_at`,
    [userId, maxRequests, windowMs, reason ?? null, createdBy ?? null, expiresAt ?? null],
  );

  const override = hydrateOverride(rows[0]);
  setCacheEntry(userId, override);
  return override;
}

export async function deleteRateLimitOverride(userId: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM user_rate_limit_overrides WHERE user_id = $1', [userId]);
  clearRateLimitOverrideCache(userId);
  return rowCount > 0;
}

export interface RateLimitOverrideSummary extends RateLimitOverride {
  userEmail: string;
  userName: string | null;
  createdByEmail: string | null;
  createdByName: string | null;
}

export async function listActiveRateLimitOverrides(): Promise<RateLimitOverrideSummary[]> {
  const { rows } = await query(
    `SELECT
       o.id,
       o.user_id,
       o.max_requests,
       o.window_ms,
       o.reason,
       o.created_by,
       o.expires_at,
       o.created_at,
       o.updated_at,
       u.email AS user_email,
       u.name AS user_name,
       created_by_user.email AS created_by_email,
       created_by_user.name AS created_by_name
     FROM user_rate_limit_overrides o
     INNER JOIN users u ON u.id = o.user_id
     LEFT JOIN users created_by_user ON created_by_user.id = o.created_by
     WHERE o.expires_at IS NULL OR o.expires_at > NOW()
     ORDER BY o.created_at DESC`,
  );

  return rows.map((row) => ({
    ...hydrateOverride(row),
    userEmail: row.user_email,
    userName: row.user_name ?? null,
    createdByEmail: row.created_by_email ?? null,
    createdByName: row.created_by_name ?? null,
  }));
}
