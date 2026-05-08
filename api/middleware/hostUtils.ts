import type { Request } from "express";

/**
 * Resolve the effective request hostname from headers.
 *
 * For security-sensitive decisions (e.g. loopback bypass) callers should
 * prefer `getRequestDirectHostname` which only reads `Host` / `req.hostname`
 * and is immune to `X-Forwarded-Host` spoofing.
 */
export function getRequestHostname(req: Request): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeaderValue = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host || req.hostname || "";

  const host = hostHeaderValue.split(",")[0]?.trim() || "";
  if (!host) {
    return "";
  }

  if (host.startsWith("[")) {
    const match = host.match(/^\[([^\]]+)\](?::\d+)?$/);
    return (match?.[1] || host).toLowerCase();
  }

  return host.split(":")[0].toLowerCase();
}

/**
 * Resolve the hostname from the direct `Host` header or `req.hostname` only.
 *
 * Ignores `X-Forwarded-Host` so that a spoofed forwarded header cannot trick
 * the server into applying loopback security exemptions for external requests.
 */
export function getRequestDirectHostname(req: Request): string {
  const hostHeaderValue = req.headers.host || req.hostname || "";

  const host = hostHeaderValue.split(",")[0]?.trim() || "";
  if (!host) {
    return "";
  }

  if (host.startsWith("[")) {
    const match = host.match(/^\[([^\]]+)\](?::\d+)?$/);
    return (match?.[1] || host).toLowerCase();
  }

  return host.split(":")[0].toLowerCase();
}

export function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}
