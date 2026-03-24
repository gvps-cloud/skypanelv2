/**
 * GET /api/api-keys
 *
 * List all API keys for the authenticated user.
 *
 * Query parameters:
 * - includeInactive: boolean - Include inactive/deleted keys (default: false)
 * - limit: number - Maximum number of keys to return (default: 50, max: 100)
 * - offset: number - Number of keys to skip (default: 0)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "keyPrefix": "sk_live_a1b2",  // First 12 chars only
 *       "name": "My API Key",
 *       "permissions": {...},
 *       "lastUsedAt": "2024-01-15T10:30:00Z",
 *       "expiresAt": "2024-12-31T23:59:59Z",
 *       "active": true,
 *       "createdAt": "2024-01-15T10:30:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 5,
 *     "limit": 50,
 *     "offset": 0
 *   }
 * }
 *
 * SECURITY NOTES:
 * - NEVER returns the full API key or key hash
 * - Only returns the key prefix (first 12 characters)
 * - Row-level security (RLS) ensures users can only see their own keys
 * - Inactive keys are excluded by default unless explicitly requested
 */

import { Router, Request, Response } from 'express';
import { query } from '../../lib/database.js';
import { authenticateToken, type AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

interface ListApiKeysQuery {
  includeInactive?: string;
  limit?: string;
  offset?: string;
}

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { includeInactive, limit, offset } = req.query as ListApiKeysQuery;

    // Parse and validate limit
    let parsedLimit = 50;
    if (limit) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
        });
      }
      if (parsedLimit > 100) {
        parsedLimit = 100; // Max limit
      }
    }

    // Parse and validate offset
    let parsedOffset = 0;
    if (offset) {
      parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid offset parameter',
        });
      }
    }

    // Build query based on includeInactive flag
    const includeInactiveFlag = includeInactive === 'true';
    const whereClause = includeInactiveFlag
      ? 'WHERE user_id = $1'
      : 'WHERE user_id = $1 AND active = true';

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) FROM user_api_keys ${whereClause}`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const result = await query(
      `SELECT
        id,
        key_prefix,
        key_name,
        permissions,
        last_used_at,
        expires_at,
        active,
        created_at
       FROM user_api_keys
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parsedLimit, parsedOffset]
    );

    // Format response (NEVER include key_hash or full key)
    const keys = result.rows.map((key) => ({
      id: key.id,
      keyPrefix: key.key_prefix,
      name: key.key_name,
      permissions: key.permissions,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      active: key.active,
      createdAt: key.created_at,
    }));

    return res.json({
      success: true,
      data: keys,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
    });
  }
});

/**
 * GET /api/api-keys/:id
 *
 * Get details of a specific API key.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "keyPrefix": "sk_live_a1b2",
 *     "name": "My API Key",
 *     "permissions": {...},
 *     "lastUsedAt": "2024-01-15T10:30:00Z",
 *     "expiresAt": "2024-12-31T23:59:59Z",
 *     "active": true,
 *     "createdAt": "2024-01-15T10:30:00Z"
 *   }
 * }
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const keyId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(keyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API key ID format',
      });
    }

    const result = await query(
      `SELECT
        id,
        key_prefix,
        key_name,
        permissions,
        last_used_at,
        expires_at,
        active,
        created_at
       FROM user_api_keys
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    const key = result.rows[0];

    return res.json({
      success: true,
      data: {
        id: key.id,
        keyPrefix: key.key_prefix,
        name: key.key_name,
        permissions: key.permissions,
        lastUsedAt: key.last_used_at,
        expiresAt: key.expires_at,
        active: key.active,
        createdAt: key.created_at,
      },
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get API key',
    });
  }
});

export default router;
