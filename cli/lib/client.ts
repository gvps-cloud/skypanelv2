import { loadConfig } from "./config.js";

const cfg = loadConfig();

export type ApiError = { message: string; status?: number };

export class SkyPanelApiError extends Error {
  status: number;
  url?: string;
  constructor(message: string, status: number, url?: string) {
    super(message);
    this.status = status;
    this.url = url;
  }
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${cfg.apiUrl}${normalizedPath}`;
}

function getAuthHeaders(): Record<string, string> {
  if (cfg.apiToken.startsWith("sk_live_")) {
    return { "X-API-Key": cfg.apiToken };
  }
  return { Authorization: `Bearer ${cfg.apiToken}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { orgId?: string }
): Promise<T> {
  const url = buildUrl(path);
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
  if (opts?.orgId) {
    headers["X-Organization-ID"] = opts.orgId;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new SkyPanelApiError(message, res.status, url);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, opts?: { orgId?: string }): Promise<T> {
  return request<T>("GET", path, undefined, opts);
}

export async function apiPost<T>(path: string, body?: unknown, opts?: { orgId?: string }): Promise<T> {
  return request<T>("POST", path, body, opts);
}

export async function apiPut<T>(path: string, body?: unknown, opts?: { orgId?: string }): Promise<T> {
  return request<T>("PUT", path, body, opts);
}

export async function apiPatch<T>(path: string, body?: unknown, opts?: { orgId?: string }): Promise<T> {
  return request<T>("PATCH", path, body, opts);
}

export async function apiDelete<T>(path: string, opts?: { orgId?: string }): Promise<T> {
  return request<T>("DELETE", path, undefined, opts);
}

export async function testConnection(): Promise<{
  ok: boolean;
  error?: string;
  url?: string;
  user?: { email: string; role: string };
}> {
  try {
    const res = await apiGet<{ user?: { email?: string; role?: string } }>(
      "/api/auth/me"
    );
    const role = res.user?.role || "";
    if (role !== "admin") {
      return {
        ok: false,
        error: "SKYPANEL_API_TOKEN is valid, but it does not belong to an admin user.",
        url: buildUrl("/api/auth/me"),
      };
    }
    return {
      ok: true,
      user: {
        email: res.user?.email || "admin",
        role,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err.message, url: err.url };
  }
}

export function getApiUrl(): string {
  return cfg.apiUrl;
}
