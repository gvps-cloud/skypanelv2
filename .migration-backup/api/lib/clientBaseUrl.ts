/**
 * Resolve the client-facing base URL to use for payment return URLs,
 * email links, and other cross-origin redirects.
 *
 * Preference order:
 *   1. `CLIENT_URL` environment variable (explicit deployment override)
 *   2. Incoming `Origin` header
 *   3. `X-Forwarded-Host` (+ `X-Forwarded-Proto` if present)
 *   4. `Host` header + inferred protocol
 *   5. Fallback to `config.CLIENT_URL` (defaults to `http://localhost:5173`)
 *
 * Centralizing this keeps the three PayPal return-URL builders (payments,
 * organizations, egress) in sync and removes direct `process.env` access
 * from route files per AGENTS.md.
 */
import type { Request } from "express";
import { config } from "../config/index.js";

export function resolveClientBaseUrl(req: Request): string {
  const explicit = process.env.CLIENT_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const originHeader =
    typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (originHeader) {
    return originHeader;
  }

  const forwardedHost =
    typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"].trim()
      : "";
  if (forwardedHost) {
    const forwardedProto =
      typeof req.headers["x-forwarded-proto"] === "string"
        ? req.headers["x-forwarded-proto"].trim()
        : "";
    const proto = forwardedProto || req.protocol;
    return `${proto}://${forwardedHost}`;
  }

  const host = req.get("host");
  if (host) {
    return `${req.protocol}://${host}`;
  }

  return config.CLIENT_URL;
}
