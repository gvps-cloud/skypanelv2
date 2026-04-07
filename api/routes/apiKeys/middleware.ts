/**
 * X-API-Key Authentication Middleware
 *
 * This middleware provides an alternative authentication method using API keys
 * via the X-API-Key header. It's designed for programmatic access to the API.
 *
 * USAGE:
 * Include the X-API-Key header in your requests:
 *   X-API-Key: sk_live_a1b2c3d4e5f6...
 *
 * The middleware will:
 * 1. Extract the API key from the X-API-Key header
 * 2. Hash the key using SHA-256
 * 3. Look up the hash in the user_api_keys table
 * 4. Set req.user and app.current_user_id for RLS
 * 5. Update last_used_at timestamp
 *
 * PRIORITY:
 * This middleware supports dual authentication:
 * - JWT via Authorization header takes precedence
 * - X-API-Key is used as fallback if no JWT present
 *
 * This allows both traditional users (JWT) and API clients (X-API-Key) to access
 * the same endpoints.
 *
 * ROW-LEVEL SECURITY (RLS):
 * Sets app.current_user_id to enable PostgreSQL RLS policies on the
 * user_api_keys table and any other RLS-protected tables.
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '../../lib/database.js';
import { hashApiKey, validateApiKeyFormat } from '../../lib/secureRandom.js';

/**
 * Extended request interface for API key authentication
 */
export interface ApiKeyRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
    organizationId?: string;
    isApiKey?: boolean; // Flag to indicate API key auth
  };
  userId?: string;
  organizationId?: string;
  apiKeyId?: string; // Track which API key was used
}

/**
 * Parse API key from various sources
 *
 * Checks in order:
 * 1. X-API-Key header (primary)
 * 2. Authorization: Bearer <api-key> (fallback)
 * Query-string API keys are intentionally not supported for security reasons.
 *
 * @returns The API key string or null
 */
function extractApiKey(req: Request): string | null {
  // Check X-API-Key header first (recommended)
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey && typeof xApiKey === 'string') {
    return xApiKey.trim();
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const token = parts[1];
      // Check if it looks like an API key (not a JWT)
      if (token.startsWith('sk_live_')) {
        return token;
      }
    }
  }

  return null;
}

/**
 * Validate API key and retrieve user information
 *
 * @param apiKey - The API key to validate
 * @returns User object with API key info, or null if invalid
 */
async function validateApiKey(apiKey: string): Promise<{
  userId: string;
  email: string;
  role: string;
  name: string | null;
  organizationId: string | null;
  apiKeyId: string;
  permissions: Record<string, string[]>;
} | null> {
  // Validate API key format
  if (!validateApiKeyFormat(apiKey)) {
    console.warn('Invalid API key format provided');
    return null;
  }

  // Hash the API key
  const keyHash = hashApiKey(apiKey);

  // Look up the API key in database
  const result = await query(
    `SELECT
      ak.id AS api_key_id,
      ak.user_id,
      ak.permissions,
      ak.expires_at,
      ak.active,
      u.email,
      u.role,
      u.name,
      u.active_organization_id
     FROM user_api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = $1`,
    [keyHash]
  );

  if (result.rows.length === 0) {
    console.warn('API key not found in database');
    return null;
  }

  const keyData = result.rows[0];

  // Check if key is active
  if (!keyData.active) {
    console.warn('API key is inactive', { apiKeyId: keyData.api_key_id });
    return null;
  }

  // Check if key has expired
  if (keyData.expires_at) {
    const expiresAt = new Date(keyData.expires_at);
    if (expiresAt < new Date()) {
      console.warn('API key has expired', { apiKeyId: keyData.api_key_id });
      return null;
    }
  }

  return {
    userId: keyData.user_id,
    email: keyData.email,
    role: keyData.role,
    name: keyData.name,
    organizationId: keyData.active_organization_id,
    apiKeyId: keyData.api_key_id,
    permissions: keyData.permissions || {},
  };
}

/**
 * Update last_used_at timestamp for an API key
 *
 * @param apiKeyId - The ID of the API key to update
 */
async function updateLastUsedAt(apiKeyId: string): Promise<void> {
  try {
    await query(
      `UPDATE user_api_keys
       SET last_used_at = NOW()
       WHERE id = $1`,
      [apiKeyId]
    );
  } catch (error) {
    // Don't fail the request if we can't update last_used_at
    console.error('Failed to update API key last_used_at:', error);
  }
}

/**
 * API Key Authentication Middleware
 *
 * Authenticates requests using X-API-Key header.
 * Sets req.user and app.current_user_id for RLS.
 *
 * This middleware does NOT send responses directly.
 * It sets req.user on success or continues without authentication.
 * Use requireApiKey() middleware to enforce API key authentication.
 */
export const authenticateApiKey = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (typeof req.query.apikey === "string" && req.query.apikey.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Query-string API keys are not allowed. Use the X-API-Key header.",
      });
    }

    const apiKey = extractApiKey(req);

    if (!apiKey) {
      // No API key provided, continue without authentication
      // Other middleware (like authenticateToken) may handle it
      return next();
    }

    // Validate the API key
    const keyData = await validateApiKey(apiKey);

    if (!keyData) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API key',
      });
    }

    // Set app.current_user_id for PostgreSQL RLS
    await query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      keyData.userId,
    ]);

    // Set req.user for downstream middleware
    req.user = {
      id: keyData.userId,
      email: keyData.email,
      role: keyData.role,
      name: keyData.name || undefined,
      organizationId: keyData.organizationId || undefined,
      isApiKey: true, // Flag to indicate API key authentication
    };
    req.userId = keyData.userId;
    req.organizationId = keyData.organizationId || undefined;
    (req as any).apiKeyId = keyData.apiKeyId;

    // Update last_used_at timestamp asynchronously
    updateLastUsedAt(keyData.apiKeyId).catch((error) => {
      console.error('Failed to update API key last_used_at:', error);
    });

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

/**
 * Require API Key Authentication Middleware
 *
 * Enforces that the request is authenticated via API key.
 * Rejects requests without a valid X-API-Key header.
 *
 * Use this on endpoints that should ONLY accept API key authentication,
 * not JWT authentication.
 */
export const requireApiKey = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isApiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key authentication required',
    });
  }
  next();
};

/**
 * Require API Key Permissions Middleware
 *
 * Checks if the API key has the required permissions.
 *
 * @param resource - The resource to check (e.g., 'vps', 'billing')
 * @param actions - Array of required actions (e.g., ['read', 'create'])
 *
 * @example
 * router.get('/api/vps', requireApiKeyPermission('vps', ['read']), handler);
 */
export const requireApiKeyPermission = (
  resource: string,
  actions: string[]
) => {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.user?.isApiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required',
      });
    }

    // Get the API key from the database to check permissions
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      return res.status(500).json({
        success: false,
        error: 'API key ID not found',
      });
    }

    const result = await query(
      'SELECT permissions FROM user_api_keys WHERE id = $1',
      [apiKeyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    const permissions = result.rows[0].permissions || {};

    // Check if the API key has the required permissions
    const resourcePermissions = permissions[resource] || [];
    const hasPermission = actions.every((action) =>
      resourcePermissions.includes(action)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${resource}:${actions.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Dual Authentication Middleware
 *
 * Accepts either JWT (Authorization header) or API key (X-API-Key header).
 * Sets req.user and app.current_user_id for RLS.
 *
 * This is the recommended middleware for most endpoints.
 */
export const authenticateDual = async (
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) => {
  // Check if already authenticated by JWT (authenticateToken middleware)
  if (req.user && !req.user.isApiKey) {
    return next();
  }

  // Try API key authentication
  return authenticateApiKey(req, res, next);
};

export default authenticateApiKey;
