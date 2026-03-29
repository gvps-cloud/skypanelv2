/**
 * Better Stack (Better Uptime) Service
 *
 * Fetches monitor status, incidents, and status reports from the Better Stack API
 * and caches responses in the database with a configurable TTL.
 *
 * Environment variables:
 *   BETTERUPTIME_API_KEY       – Bearer token for the Better Stack Uptime API
 *   BETTERUPTIME_STATUS_PAGE_ID – ID of the status page whose resources to display
 */

import { query } from "../lib/database.js";
import { config } from "../config/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BetterStackMonitor {
  id: string;
  name: string;
  status: "operational" | "degraded" | "downtime" | "maintenance";
  availability: number;          // 0–1, e.g. 0.99963
  statusHistory: Array<{
    day: string;                 // YYYY-MM-DD
    status: string;
    downtimeDuration: number;    // seconds
  }>;
}

export interface BetterStackIncident {
  id: string;
  name: string;
  url: string;
  cause: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  status: "started" | "acknowledged" | "resolved";
  regions: string[];
}

export interface BetterStackStatusReport {
  id: string;
  title: string;
  reportType: "manual" | "automatic" | "maintenance";
  startsAt: string;
  endsAt: string | null;
  aggregateState: "operational" | "degraded" | "downtime" | "maintenance";
  affectedResources: Array<{
    statusPageResourceId: string;
    status: string;
  }>;
  statusUpdates: BetterStackStatusUpdate[];
}

export interface BetterStackStatusUpdate {
  id: string;
  author: string | null;
  status: string;
  message: string;
  createdAt: string;
}

export interface BetterStackUptimeData {
  configured: boolean;
  monitors: BetterStackMonitor[];
  activeIncidents: BetterStackIncident[];
  incidentsHistory: BetterStackIncident[];
  statusReports: BetterStackStatusReport[];
  cachedAt: string | null;
  stale: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_V2 = "https://uptime.betterstack.com/api/v2";
const API_BASE_V3 = "https://uptime.betterstack.com/api/v3";
const CACHE_TTL_MINUTES = 5;

// Cache keys used in the betterstack_cache table
const CACHE_KEYS = {
  monitors: "monitors",
  incidentsActive: "incidents_active",
  incidentsHistory: "incidents_history",
  statusReports: "status_reports",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isConfigured(): boolean {
  return !!(config.BETTERUPTIME_API_KEY && config.BETTERUPTIME_STATUS_PAGE_ID);
}

/**
 * Make an authenticated request to the Better Stack API.
 */
async function betterStackRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.BETTERUPTIME_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Better Stack API error ${response.status}: ${text || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Database cache layer
// ---------------------------------------------------------------------------

interface CacheRow {
  key: string;
  data: any;
  fetched_at: string;
  expires_at: string;
}

/**
 * Retrieve cached data if it has not expired yet.
 */
async function getCached<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  const result = await query(
    `SELECT key, data, fetched_at, expires_at
     FROM betterstack_cache
     WHERE key = $1`,
    [key],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as CacheRow;
  const now = new Date();
  const expiresAt = new Date(row.expires_at);
  const stale = now >= expiresAt;

  // If stale but present, return with stale flag so callers can decide
  return { data: row.data as T, stale };
}

/**
 * Store data in the cache with the configured TTL.
 */
async function setCached<T>(key: string, data: T): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60_000);

  await query(
    `INSERT INTO betterstack_cache (key, data, fetched_at, expires_at)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE
       SET data      = EXCLUDED.data,
           fetched_at = EXCLUDED.fetched_at,
           expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(data), expiresAt.toISOString()],
  );
}

// ---------------------------------------------------------------------------
// Better Stack API calls
// ---------------------------------------------------------------------------

/**
 * Fetch status page resources (monitors displayed on the status page).
 */
async function fetchMonitorsFromApi(): Promise<BetterStackMonitor[]> {
  const statusPageId = config.BETTERUPTIME_STATUS_PAGE_ID!;
  const json = await betterStackRequest<any>(
    `${API_BASE_V2}/status-pages/${statusPageId}/resources`,
  );

  const resources: any[] = json.data ?? [];
  return resources.map(normalizeMonitor);
}

/**
 * Fetch active (unresolved) incidents.
 */
async function fetchActiveIncidentsFromApi(): Promise<BetterStackIncident[]> {
  const json = await betterStackRequest<any>(
    `${API_BASE_V3}/incidents?resolved=false`,
  );

  const incidents: any[] = json.data ?? [];
  return incidents.map(normalizeIncident);
}

/**
 * Fetch incident history for the last N days (default 30).
 */
async function fetchIncidentHistoryFromApi(
  days: number = 30,
): Promise<BetterStackIncident[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split("T")[0]; // YYYY-MM-DD

  const json = await betterStackRequest<any>(
    `${API_BASE_V3}/incidents?from=${fromStr}`,
  );

  const incidents: any[] = json.data ?? [];
  return incidents.map(normalizeIncident);
}

/**
 * Fetch status reports (incidents + maintenance shown on status page).
 *
 * We fetch status updates for each report so the frontend can render timelines.
 */
async function fetchStatusReportsFromApi(): Promise<BetterStackStatusReport[]> {
  const statusPageId = config.BETTERUPTIME_STATUS_PAGE_ID!;
  const reportsJson = await betterStackRequest<any>(
    `${API_BASE_V2}/status-pages/${statusPageId}/status-reports`,
  );

  const reports: any[] = reportsJson.data ?? [];

  // Fetch updates for each report (up to 10 recent reports)
  const withUpdates = await Promise.all(
    reports.slice(0, 10).map(async (report: any) => {
      try {
        const updatesJson = await betterStackRequest<any>(
          `${API_BASE_V2}/status-pages/${statusPageId}/status-reports/${report.id}/status-updates`,
        );
        const updates: any[] = updatesJson.data ?? [];
        return normalizeStatusReport(report, updates);
      } catch {
        // If individual update fetch fails, return report without updates
        return normalizeStatusReport(report, []);
      }
    }),
  );

  return withUpdates;
}

// ---------------------------------------------------------------------------
// Normalizers – map raw API responses to our clean types
// ---------------------------------------------------------------------------

function normalizeMonitor(raw: any): BetterStackMonitor {
  const attr = raw.attributes ?? raw;
  return {
    id: String(raw.id ?? attr.id),
    name: attr.public_name ?? attr.pronounceable_name ?? "Unknown",
    status: mapResourceStatus(attr.status),
    availability: typeof attr.availability === "number" ? attr.availability : 1,
    statusHistory: Array.isArray(attr.status_history)
      ? attr.status_history.map((h: any) => ({
          day: h.day,
          status: h.status,
          downtimeDuration: h.downtime_duration ?? 0,
        }))
      : [],
  };
}

function normalizeIncident(raw: any): BetterStackIncident {
  const attr = raw.attributes ?? raw;
  return {
    id: String(raw.id ?? attr.id),
    name: attr.name ?? "Untitled incident",
    url: attr.url ?? "",
    cause: attr.cause ?? null,
    startedAt: attr.started_at ?? new Date().toISOString(),
    acknowledgedAt: attr.acknowledged_at ?? null,
    resolvedAt: attr.resolved_at ?? null,
    status: mapIncidentStatus(attr.status),
    regions: attr.regions ?? [],
  };
}

function normalizeStatusReport(
  raw: any,
  rawUpdates: any[],
): BetterStackStatusReport {
  const attr = raw.attributes ?? raw;
  return {
    id: String(raw.id ?? attr.id),
    title: attr.title ?? "Status report",
    reportType: attr.report_type ?? "manual",
    startsAt: attr.starts_at,
    endsAt: attr.ends_at ?? null,
    aggregateState: mapResourceStatus(attr.aggregate_state ?? "operational"),
    affectedResources: Array.isArray(attr.affected_resources)
      ? attr.affected_resources.map((r: any) => ({
          statusPageResourceId: String(r.status_page_resource_id),
          status: r.status,
        }))
      : [],
    statusUpdates: rawUpdates.map(normalizeStatusUpdate),
  };
}

function normalizeStatusUpdate(raw: any): BetterStackStatusUpdate {
  const attr = raw.attributes ?? raw;
  return {
    id: String(raw.id ?? attr.id),
    author: attr.author ?? null,
    status: attr.status ?? "",
    message: attr.message ?? "",
    createdAt: attr.created_at ?? new Date().toISOString(),
  };
}

function mapResourceStatus(
  status: string,
): "operational" | "degraded" | "downtime" | "maintenance" {
  switch (status) {
    case "operational":
      return "operational";
    case "degraded":
      return "degraded";
    case "downtime":
      return "downtime";
    case "maintenance":
      return "maintenance";
    default:
      return "operational";
  }
}

function mapIncidentStatus(
  status: string,
): "started" | "acknowledged" | "resolved" {
  switch (status?.toLowerCase()) {
    case "acknowledged":
      return "acknowledged";
    case "resolved":
      return "resolved";
    default:
      return "started";
  }
}

// ---------------------------------------------------------------------------
// Cached data retrieval (with stale-while-revalidate pattern)
// ---------------------------------------------------------------------------

/**
 * Get the cached timestamp across all cache keys (most recent fetch).
 */
async function getLatestCachedAt(): Promise<string | null> {
  const result = await query(
    `SELECT MAX(fetched_at) as latest FROM betterstack_cache`,
  );
  const row = result.rows[0];
  return row?.latest ? new Date(row.latest).toISOString() : null;
}

/**
 * Retrieve cached data for a key. If stale, attempt a refresh in the
 * background but still return the stale data immediately.
 */
async function getCachedOrFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T | null; stale: boolean }> {
  const cached = await getCached<T>(cacheKey);

  if (cached && !cached.stale) {
    return cached;
  }

  // Cache is stale or missing – try to refresh
  try {
    const fresh = await fetcher();
    await setCached(cacheKey, fresh);
    return { data: fresh, stale: false };
  } catch (err) {
    console.error(
      `[BetterStack] Failed to refresh cache key "${cacheKey}":`,
      err instanceof Error ? err.message : err,
    );

    // Return stale data if we have it, otherwise null
    if (cached) {
      return cached;
    }
    return { data: null, stale: true };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all Better Stack data for the status page.
 *
 * Returns a `configured: false` object when the integration is not set up,
 * so the frontend can gracefully fall back.
 */
export async function getBetterStackData(): Promise<BetterStackUptimeData> {
  if (!isConfigured()) {
    return {
      configured: false,
      monitors: [],
      activeIncidents: [],
      incidentsHistory: [],
      statusReports: [],
      cachedAt: null,
      stale: false,
    };
  }

  // Fetch all data categories in parallel via cache layer
  const [monitorsResult, activeResult, historyResult, reportsResult] =
    await Promise.all([
      getCachedOrFetch(CACHE_KEYS.monitors, fetchMonitorsFromApi),
      getCachedOrFetch(CACHE_KEYS.incidentsActive, fetchActiveIncidentsFromApi),
      getCachedOrFetch(
        CACHE_KEYS.incidentsHistory,
        () => fetchIncidentHistoryFromApi(30),
      ),
      getCachedOrFetch(CACHE_KEYS.statusReports, fetchStatusReportsFromApi),
    ]);

  const anyStale =
    monitorsResult.stale ||
    activeResult.stale ||
    historyResult.stale ||
    reportsResult.stale;

  const cachedAt = await getLatestCachedAt();

  return {
    configured: true,
    monitors: (monitorsResult.data ?? []) as BetterStackMonitor[],
    activeIncidents: (activeResult.data ?? []) as BetterStackIncident[],
    incidentsHistory: (historyResult.data ?? []) as BetterStackIncident[],
    statusReports: (reportsResult.data ?? []) as BetterStackStatusReport[],
    cachedAt,
    stale: anyStale,
  };
}
