import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { config } from "../config/index.js";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TTL_MS = 2 * 60 * 60 * 1000;

function isSafeMethod(method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function hasBearerAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  return typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ");
}

function hasApiKeyAuth(req: Request): boolean {
  return typeof req.headers["x-api-key"] === "string";
}

function shouldCheckCsrf(req: Request): boolean {
  const hasCookieAuth = Boolean(req.cookies?.auth_token);
  return hasCookieAuth && !hasBearerAuth(req) && !hasApiKeyAuth(req);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getCsrfSecret(): string {
  return process.env.CSRF_SECRET || config.JWT_SECRET;
}

function signToken(payload: string): string {
  return crypto.createHmac("sha256", getCsrfSecret()).update(payload).digest("hex");
}

function issueToken(): string {
  const nonce = crypto.randomBytes(24).toString("hex");
  const issuedAt = Date.now().toString();
  const payload = `${nonce}.${issuedAt}`;
  const signature = signToken(payload);
  return `${payload}.${signature}`;
}

function isValidToken(token: string): boolean {
  const [nonce, issuedAtRaw, signature] = token.split(".");
  if (!nonce || !issuedAtRaw || !signature) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CSRF_TTL_MS) {
    return false;
  }

  const payload = `${nonce}.${issuedAtRaw}`;
  const expectedSignature = signToken(payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSignature, "utf8"),
  );
}

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: CSRF_TTL_MS,
  };
}

function readSubmittedToken(req: Request): string | undefined {
  const headerToken = req.headers[CSRF_HEADER_NAME];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }

  const bodyToken = (req.body as { csrfToken?: string } | undefined)?.csrfToken;
  if (typeof bodyToken === "string" && bodyToken.length > 0) {
    return bodyToken;
  }

  return undefined;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const enforce = parseBoolean(process.env.CSRF_ENFORCE, true);
  const shadowMode = parseBoolean(process.env.CSRF_SHADOW_MODE, false);

  if (!shouldCheckCsrf(req)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

  if (isSafeMethod(req.method)) {
    const token = cookieToken && isValidToken(cookieToken) ? cookieToken : issueToken();
    res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
    res.setHeader("X-CSRF-Token", token);
    next();
    return;
  }

  const submittedToken = readSubmittedToken(req);
  const valid =
    Boolean(cookieToken) &&
    Boolean(submittedToken) &&
    cookieToken === submittedToken &&
    isValidToken(cookieToken);

  if (valid) {
    next();
    return;
  }

  console.warn("[Security] CSRF validation failed", {
    method: req.method,
    path: req.originalUrl,
    shadowMode,
    enforce,
  });

  if (!enforce || shadowMode) {
    next();
    return;
  }

  res.status(403).json({
    error: "CSRF validation failed",
    code: "CSRF_VALIDATION_FAILED",
  });
}

