/**
 * Security middleware for admin operations
 */
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import type { AuthenticatedRequest } from "./auth.js";
import { logActivity } from "../services/activityLogger.js";
import helmet from "helmet";
import { config } from "../config/index.js";
import { isLoopbackHost, getRequestDirectHostname } from "./hostUtils.js";

/**
 * Enhanced Helmet configuration with XSS protection
 *
 * CSP Directives Explanation:
 * - default-src 'self': Only allow resources from same origin by default
 * - script-src 'self' 'nonce-<random>': Scripts from same origin or with matching nonce (no unsafe-inline)
 * - style-src 'self' 'unsafe-inline': Allow styles from same origin + inline (needed for React/Tailwind)
 * - img-src 'self' data: blob: https://*: Allow images from same origin, data URLs, blobs, and any HTTPS
 * - font-src 'self' data:: Allow fonts from same origin and data URLs
 * - connect-src 'self' https://api.paypal.com https://www.paypal.com https://cdn.jsdelivr.net https://*.linode.com https://api.linode.com: Allow API calls to self, PayPal, status page map data, and Linode latency checks
 * - frame-src https://www.paypal.com: Only allow PayPal for iframe embeds
 * - object-src 'none': Block plugins (Flash, etc.)
 * - base-uri 'self': Restrict <base> tag to same origin
 * - form-action 'self': Restrict form submissions to same origin
 * - frame-ancestors 'none': Prevent page from being embedded in frames (clickjacking protection)
 * - upgrade-insecure-requests: Automatically upgrade HTTP to HTTPS
 *
 * **XSS hardening note:** `'unsafe-eval'` is omitted in BOTH development and
 * production. Modern Vite (>= 5) uses native ES modules in dev and does not
 * require eval(). Removing it closes a significant XSS vector at no cost to
 * developer ergonomics. `'unsafe-inline'` remains in dev for Vite's HMR error
 * overlay; production uses nonce-based scripts exclusively.
 */
const isProduction = config.NODE_ENV === "production";

const buildCspDirectives = (useUpgradeInsecureRequests: boolean) => {
  // Derive WS/WSS origins from configured CORS origins so production
  // domains defined via CLIENT_URL/CORS_ORIGINS can open SSH WebSockets.
  const wsOrigins = config.corsOrigins.flatMap((origin) => {
    try {
      const url = new URL(origin);
      return url.protocol === "https:"
        ? [`wss://${url.host}`]
        : [`ws://${url.host}`];
    } catch {
      return [];
    }
  });

  const connectSrc = [
    "'self'",
    "https://api.paypal.com",
    "https://www.paypal.com",
    "https://cdn.jsdelivr.net",
    "https://*.linode.com",
    "https://api.linode.com",
    "https://*.sslip.io",
    "https://*.nip.io",
    ...wsOrigins,
    ...(isProduction ? [] : ["ws://localhost:*", "wss://localhost:*"]),
  ];
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https:",
    ...(isProduction ? [] : ["http://localhost:*"]),
  ];
  // Production uses nonce-based CSP for scripts; dev keeps unsafe-inline for Vite HMR
  const scriptSrc = isProduction
    ? [
        "'self'",
        (req: Request, res: Response) =>
          `'nonce-${(res as any).locals.cspNonce}'`,
        "https://*.sslip.io",
      ]
    : ["'self'", "'unsafe-inline'", "https://*.sslip.io"];
  // style-src keeps 'unsafe-inline' because React sets inline styles at runtime
  // and dynamic theme/chart CSS injection requires it
  const styleSrc = ["'self'", "'unsafe-inline'"];

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    blockAllMixedContent: [],
    connectSrc: [...connectSrc],
    fontSrc: ["'self'", "data:"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    frameSrc: ["'self'", "https://www.paypal.com"],
    imgSrc: [...imgSrc],
    manifestSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: [...scriptSrc],
    scriptSrcAttr: isProduction
      ? [
          (req: Request, res: Response) =>
            `'nonce-${(res as any).locals.cspNonce}'`,
        ]
      : ["'none'"],
    styleSrc: [...styleSrc],
    upgradeInsecureRequests: useUpgradeInsecureRequests ? [] : null,
    workerSrc: ["'self'", "blob:"],
  };
};

// Security middleware with per-request nonce generation via Helmet's dynamic directives
export const createSecurityMiddleware = () => {
  const sharedHelmetConfig = {
    hidePoweredBy: true,
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin" as const,
    },
    noSniff: true,
    frameguard: {
      action: "deny" as const,
    },
    ieNoOpen: true,
    dnsPrefetchControl: {
      allow: false,
    },
  };

  const localHelmet = helmet({
    ...sharedHelmetConfig,
    contentSecurityPolicy: {
      directives: buildCspDirectives(false) as any,
    },
    hsts: false,
  });

  const externalHelmet = helmet({
    ...sharedHelmetConfig,
    contentSecurityPolicy: {
      directives: buildCspDirectives(isProduction) as any,
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  return [
    (req: Request, res: Response, next: NextFunction) => {
      const nonce = crypto.randomBytes(16).toString("base64");
      (res as any).locals.cspNonce = nonce;
      next();
    },
    (req: Request, res: Response, next: NextFunction) => {
      if (isLoopbackHost(getRequestDirectHostname(req))) {
        return localHelmet(req, res, next);
      }
      return externalHelmet(req, res, next);
    },
  ];
};

/**
 * Middleware to log all admin operations for audit purposes
 */
export const auditLogger = (operation: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const startTime = Date.now();

    // Log the start of the operation
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log the operation completion
      if (req.user?.id) {
        logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "admin_operation",
            entityType: "system",
            entityId: operation,
            message: `Admin operation: ${operation} (${req.method} ${req.path})`,
            status: statusCode >= 400 ? "error" : "success",
            metadata: {
              operation,
              method: req.method,
              path: req.path,
              status_code: statusCode,
              duration_ms: duration,
              ip_address: req.ip,
              user_agent: req.headers["user-agent"],
              request_size: req.headers["content-length"] || 0,
              response_size: data ? data.length : 0,
            },
            suppressNotification: true,
          },
          req,
        ).catch((err) => {
          console.error("Failed to log admin operation:", err);
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to validate admin session and add security headers
 */
export const adminSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Add security headers for admin operations
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");

  next();
};

/**
 * Middleware to validate request size and prevent DoS
 */
export const requestSizeLimit = (maxSizeKB: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0");
    const maxSizeBytes = maxSizeKB * 1024;

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        error: "Request too large",
        maxSize: `${maxSizeKB}KB`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to validate sensitive operations with additional confirmation
 */
export const requireConfirmation = (operationType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const confirmation =
      req.headers["x-admin-confirmation"] || req.body.confirmation;

    if (!confirmation || confirmation !== "confirmed") {
      res.status(400).json({
        error: `This ${operationType} operation requires explicit confirmation`,
        requiresConfirmation: true,
        confirmationHeader: "x-admin-confirmation",
        confirmationValue: "confirmed",
      });
      return;
    }

    next();
  };
};
