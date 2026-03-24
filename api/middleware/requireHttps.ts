/**
 * Require HTTPS Middleware
 *
 * Enforces HTTPS connections in production with HSTS headers.
 */

import { Request, Response, NextFunction } from 'express';

interface RequireHttpsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
  forwardedProtoHeader?: string;
  trustProxy?: boolean;
}

const DEFAULT_MAX_AGE = 31536000;

function isValidMaxAge(maxAge: number): boolean {
  return Number.isInteger(maxAge) && maxAge > 0 && maxAge <= 63072000;
}

function buildHSTSHeader(options: RequireHttpsOptions): string {
  const parts: string[] = [`max-age=${options.maxAge || DEFAULT_MAX_AGE}`];
  if (options.includeSubDomains !== false) {
    parts.push('includeSubDomains');
  }
  if (options.preload === true) {
    parts.push('preload');
  }
  return parts.join('; ');
}

function isSecureRequest(req: Request, options: RequireHttpsOptions): boolean {
  if (req.secure) {
    return true;
  }
  if (req.protocol === 'https') {
    return true;
  }
  if (options.trustProxy !== false) {
    const headerName = options.forwardedProtoHeader || 'X-Forwarded-Proto';
    const forwardedProto = req.headers[headerName.toLowerCase()] as string | undefined;
    if (forwardedProto && forwardedProto.toLowerCase() === 'https') {
      return true;
    }
  }
  return false;
}

function buildRedirectUrl(req: Request): string {
  const host = req.headers['x-forwarded-host'] as string | undefined ||
               req.headers.host ||
               req.hostname;
  const url = new URL(req.originalUrl || req.url || '/', `https://${host}`);
  return url.toString();
}

export function requireHttps(options: RequireHttpsOptions = {}) {
  if (options.maxAge !== undefined && !isValidMaxAge(options.maxAge)) {
    throw new Error(`Invalid maxAge: ${options.maxAge}`);
  }

  const hstsHeader = buildHSTSHeader(options);
  const trustProxy = options.trustProxy !== false && process.env.NODE_ENV === 'production';

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    if (isSecureRequest(req, { ...options, trustProxy })) {
      res.setHeader('Strict-Transport-Security', hstsHeader);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      return next();
    }

    const httpsUrl = buildRedirectUrl(req);
    const statusCode = req.method === 'GET' ? 301 : 307;

    res.setHeader('Strict-Transport-Security', hstsHeader);
    res.setHeader('Location', httpsUrl);

    return res.status(statusCode).send({
      error: 'Please use HTTPS',
      message: 'This server requires HTTPS connections',
      redirect: httpsUrl
    });
  };
}

export function hstsOnly(options: RequireHttpsOptions = {}) {
  if (options.maxAge !== undefined && !isValidMaxAge(options.maxAge)) {
    throw new Error(`Invalid maxAge: ${options.maxAge}`);
  }

  const hstsHeader = buildHSTSHeader(options);

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    res.setHeader('Strict-Transport-Security', hstsHeader);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  };
}

export const requireHttpsMiddleware = requireHttps({
  maxAge: DEFAULT_MAX_AGE,
  includeSubDomains: true,
  preload: false
});

export const hstsOnlyMiddleware = hstsOnly({
  maxAge: DEFAULT_MAX_AGE,
  includeSubDomains: true,
  preload: false
});

export default requireHttps;
