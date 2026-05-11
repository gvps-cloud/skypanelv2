import { query } from "../lib/database.js";
import { isValidIP, sanitizeIP } from "../lib/ipDetection.js";

export type RateLimitIpRuleType = "trusted" | "blocked";

export interface RateLimitIpRule {
  id: string;
  ipAddress: string;
  ruleType: RateLimitIpRuleType;
  maxRequests: number | null;
  windowMs: number | null;
  reason: string | null;
  createdBy: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitIpRuleSummary extends RateLimitIpRule {
  createdByEmail: string | null;
  createdByName: string | null;
}

interface CachedIpRule {
  rule: RateLimitIpRule | null;
  expiresAt: number;
}

const ipRuleCache = new Map<string, CachedIpRule>();
const CACHE_TTL_MS = 30 * 1000;

function isMissingTableError(error: any): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("relation") && message.includes("rate_limit_ip_rules") && message.includes("does not exist");
}

function normalizeIpAddress(ipAddress: string): string {
  const sanitized = sanitizeIP(ipAddress);
  if (!isValidIP(sanitized)) {
    throw new Error("A valid IPv4 or IPv6 address is required");
  }
  return sanitized;
}

function hydrateRule(row: any): RateLimitIpRule {
  return {
    id: row.id,
    ipAddress: row.ip_address,
    ruleType: row.rule_type,
    maxRequests: row.max_requests === null || row.max_requests === undefined ? null : Number(row.max_requests),
    windowMs: row.window_ms === null || row.window_ms === undefined ? null : Number(row.window_ms),
    reason: row.reason ?? null,
    createdBy: row.created_by ?? null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function setCacheEntry(ipAddress: string, rule: RateLimitIpRule | null): void {
  ipRuleCache.set(ipAddress, {
    rule,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearRateLimitIpRuleCache(ipAddress?: string): void {
  if (ipAddress) {
    ipRuleCache.delete(sanitizeIP(ipAddress));
    return;
  }
  ipRuleCache.clear();
}

export async function getActiveRateLimitIpRule(ipAddress: string): Promise<RateLimitIpRule | null> {
  const normalizedIp = normalizeIpAddress(ipAddress);
  const cached = ipRuleCache.get(normalizedIp);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rule;
  }

  let rows: any[] = [];
  try {
    const result = await query(
      `SELECT id, ip_address::text AS ip_address, rule_type, max_requests, window_ms, reason,
              created_by, expires_at, created_at, updated_at
       FROM rate_limit_ip_rules
       WHERE ip_address = $1::inet
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [normalizedIp],
    );
    rows = result.rows;
  } catch (error) {
    if (isMissingTableError(error)) {
      setCacheEntry(normalizedIp, null);
      return null;
    }
    throw error;
  }

  if (!rows[0]) {
    setCacheEntry(normalizedIp, null);
    return null;
  }

  const rule = hydrateRule(rows[0]);
  setCacheEntry(normalizedIp, rule);
  return rule;
}

export async function listActiveRateLimitIpRules(): Promise<RateLimitIpRuleSummary[]> {
  let rows: any[] = [];
  try {
    const result = await query(
      `SELECT
         r.id,
         r.ip_address::text AS ip_address,
         r.rule_type,
         r.max_requests,
         r.window_ms,
         r.reason,
         r.created_by,
         r.expires_at,
         r.created_at,
         r.updated_at,
         u.email AS created_by_email,
         u.name AS created_by_name
       FROM rate_limit_ip_rules r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.expires_at IS NULL OR r.expires_at > NOW()
       ORDER BY
         CASE WHEN r.rule_type = 'blocked' THEN 0 ELSE 1 END,
         r.created_at DESC`,
    );
    rows = result.rows;
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }

  return rows.map((row) => ({
    ...hydrateRule(row),
    createdByEmail: row.created_by_email ?? null,
    createdByName: row.created_by_name ?? null,
  }));
}

export async function upsertRateLimitIpRule(options: {
  ipAddress: string;
  ruleType: RateLimitIpRuleType;
  maxRequests?: number | null;
  windowMs?: number | null;
  reason?: string | null;
  createdBy?: string | null;
  expiresAt?: Date | null;
}): Promise<RateLimitIpRule> {
  const ipAddress = normalizeIpAddress(options.ipAddress);
  const ruleType = options.ruleType;

  if (!['trusted', 'blocked'].includes(ruleType)) {
    throw new Error("ruleType must be 'trusted' or 'blocked'");
  }

  const maxRequests = ruleType === "trusted" ? Number(options.maxRequests) : null;
  const windowMs = ruleType === "trusted" ? Number(options.windowMs) : null;

  if (ruleType === "trusted" && (!maxRequests || maxRequests < 1 || !windowMs || windowMs < 1)) {
    throw new Error("Trusted IP rules require positive maxRequests and windowMs values");
  }

  const { rows } = await query(
    `INSERT INTO rate_limit_ip_rules (ip_address, rule_type, max_requests, window_ms, reason, created_by, expires_at)
     VALUES ($1::inet, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (ip_address)
     DO UPDATE SET
       rule_type = EXCLUDED.rule_type,
       max_requests = EXCLUDED.max_requests,
       window_ms = EXCLUDED.window_ms,
       reason = EXCLUDED.reason,
       created_by = EXCLUDED.created_by,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id, ip_address::text AS ip_address, rule_type, max_requests, window_ms, reason,
               created_by, expires_at, created_at, updated_at`,
    [
      ipAddress,
      ruleType,
      maxRequests,
      windowMs,
      options.reason ?? null,
      options.createdBy ?? null,
      options.expiresAt ?? null,
    ],
  );

  const rule = hydrateRule(rows[0]);
  setCacheEntry(ipAddress, rule);
  return rule;
}

export async function deleteRateLimitIpRule(id: string): Promise<boolean> {
  const { rows } = await query(
    `DELETE FROM rate_limit_ip_rules
     WHERE id = $1
     RETURNING ip_address::text AS ip_address`,
    [id],
  );

  if (!rows[0]) {
    return false;
  }

  clearRateLimitIpRuleCache(rows[0].ip_address);
  return true;
}
