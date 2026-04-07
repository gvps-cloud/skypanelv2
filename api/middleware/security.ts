/**
 * Security middleware for admin operations
 */
import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { logActivity } from '../services/activityLogger.js';
import helmet from 'helmet';

/**
 * Enhanced Helmet configuration with XSS protection
 *
 * CSP Directives Explanation:
 * - default-src 'self': Only allow resources from same origin by default
 * - script-src 'self' 'unsafe-inline' 'unsafe-eval': Allow scripts from same origin + inline/eval (needed for React)
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
 */
const isProduction = process.env.NODE_ENV === "production";
const connectSrc = [
  "'self'",
  "https://api.paypal.com",
  "https://www.paypal.com",
  "https://cdn.jsdelivr.net",
  "https://*.linode.com",
  "https://api.linode.com",
  "https://*.sslip.io",
  ...(isProduction ? [] : ["ws://localhost:*", "wss://localhost:*"]),
];
const imgSrc = ["'self'", "data:", "blob:", "https:", ...(isProduction ? [] : ["http://localhost:*"])];
// Production still needs inline script/style support because:
// - index.html includes runtime/theme boot scripts
// - several UI components/libraries set inline styles at runtime
const scriptSrc = ["'self'", "'unsafe-inline'", "https://*.sslip.io"];
const styleSrc = ["'self'", "'unsafe-inline'"];

const helmetConfig = {
  hidePoweredBy: true,
  // Content Security Policy - strict but allows React/Modern web apps to function
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      blockAllMixedContent: [],
      connectSrc: [
        ...connectSrc,
      ],
      fontSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'self'", 'https://www.paypal.com'],
      imgSrc: [...imgSrc],
      manifestSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: [...scriptSrc],
      scriptSrcAttr: ["'none'"],
      styleSrc: [...styleSrc],
      upgradeInsecureRequests: [],
      workerSrc: ["'self'", 'blob:'],
    },
  },

  // HTTP Strict Transport Security - force HTTPS for 1 year + preload
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  },

  // Referrer Policy - control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin' as const,
  },

  // X-Content-Type-Options - prevent MIME sniffing
  noSniff: true,

  // X-Frame-Options - prevent clickjacking
  frameguard: {
    action: 'deny' as const,
  },

  // Note: X-XSS-Protection filter removed in Helmet 7+ as modern browsers
  // have better built-in XSS protection. The header is obsolete.

  // X-Download-Options - prevent opening downloaded files directly
  ieNoOpen: true,

  // X-DNS-Prefetch-Control - control DNS prefetching
  dnsPrefetchControl: {
    allow: false,
  },
};

// Export the enhanced helmet middleware
export const enhancedHelmet = helmet(helmetConfig);

/**
 * Middleware to log all admin operations for audit purposes
 */
export const auditLogger = (operation: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log the start of the operation
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log the operation completion
      if (req.user?.id) {
        logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'admin_operation',
          entityType: 'system',
          entityId: operation,
          message: `Admin operation: ${operation} (${req.method} ${req.path})`,
          status: statusCode >= 400 ? 'error' : 'success',
          metadata: {
            operation,
            method: req.method,
            path: req.path,
            status_code: statusCode,
            duration_ms: duration,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            request_size: req.headers['content-length'] || 0,
            response_size: data ? data.length : 0
          },
          suppressNotification: true
        }, req).catch(err => {
          console.error('Failed to log admin operation:', err);
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
export const adminSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add security headers for admin operations
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  next();
};

/**
 * Middleware to validate request size and prevent DoS
 */
export const requestSizeLimit = (maxSizeKB: number = 100) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = maxSizeKB * 1024;
    
    if (contentLength > maxSizeBytes) {
      res.status(413).json({ 
        error: 'Request too large',
        maxSize: `${maxSizeKB}KB`
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
    const confirmation = req.headers['x-admin-confirmation'] || req.body.confirmation;
    
    if (!confirmation || confirmation !== 'confirmed') {
      res.status(400).json({
        error: `This ${operationType} operation requires explicit confirmation`,
        requiresConfirmation: true,
        confirmationHeader: 'x-admin-confirmation',
        confirmationValue: 'confirmed'
      });
      return;
    }
    
    next();
  };
};

