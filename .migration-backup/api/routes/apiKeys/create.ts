/**
 * POST /api/api-keys
 *
 * Create a new API key for the authenticated user.
 *
 * Request body:
 * {
 *   "name": "My API Key",  // required: Human-readable name
 *   "expiresAt": "2024-12-31T23:59:59Z",  // optional: ISO 8601 timestamp
 *   "permissions": {  // optional: Granular permissions
 *     "vps": ["read", "create"],
 *     "billing": ["read"]
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "key": "sk_live_a1b2c3d4...",  // ONLY returned on creation
 *     "keyPrefix": "sk_live_a1b2",
 *     "name": "My API Key",
 *     "permissions": {...},
 *     "expiresAt": "2024-12-31T23:59:59Z",
 *     "createdAt": "2024-01-15T10:30:00Z"
 *   }
 * }
 *
 * SECURITY NOTES:
 * - The full API key is ONLY returned in the response to this endpoint
 * - Store it securely - it cannot be retrieved again
 * - The key is hashed using SHA-256 before storage
 * - Row-level security (RLS) ensures users can only access their own keys
 */

import { Router, Response } from 'express';
import { query } from '../../lib/database.js';
import { authenticateToken, type AuthenticatedRequest } from '../../middleware/auth.js';
import {
  generateApiKey,
  hashApiKey,
  extractApiKeyPrefix,
  validateApiKeyFormat,
} from '../../lib/secureRandom.js';

const router = Router();

/**
 * Validation helper for API key creation request
 */
interface CreateApiKeyRequest {
  name: string;
  expiresAt?: string;
  permissions?: Record<string, string[]>;
}

function validateCreateRequest(body: any): { valid: boolean; error?: string } {
  if (!body.name || typeof body.name !== 'string') {
    return { valid: false, error: 'Key name is required and must be a string' };
  }

  if (body.name.length < 3 || body.name.length > 255) {
    return { valid: false, error: 'Key name must be between 3 and 255 characters' };
  }

  if (body.expiresAt) {
    const expiresAt = new Date(body.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      return { valid: false, error: 'Invalid expiresAt timestamp' };
    }

    if (expiresAt < new Date()) {
      return { valid: false, error: 'expiresAt must be in the future' };
    }

    // Maximum 1 year from now
    const maxExpiry = new Date();
    maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
    if (expiresAt > maxExpiry) {
      return { valid: false, error: 'expiresAt must be within 1 year from now' };
    }
  }

  // Validate permissions structure if provided
  if (body.permissions) {
    if (typeof body.permissions !== 'object' || Array.isArray(body.permissions)) {
      return { valid: false, error: 'Permissions must be an object' };
    }

    // Validate permission values are arrays of strings
    for (const [key, value] of Object.entries(body.permissions)) {
      if (!Array.isArray(value)) {
        return { valid: false, error: `Permission '${key}' must be an array` };
      }

      const validActions = ['read', 'create', 'update', 'delete'];
      for (const action of value) {
        if (typeof action !== 'string' || !validActions.includes(action)) {
          return { valid: false, error: `Invalid permission action '${action}' in '${key}'` };
        }
      }
    }
  }

  return { valid: true };
}

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Validate request body
    const validation = validateCreateRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const { name, expiresAt, permissions }: CreateApiKeyRequest = req.body;

    // Generate API key
    const apiKey = generateApiKey();

    // Validate the generated key format
    if (!validateApiKeyFormat(apiKey)) {
      console.error('Generated API key has invalid format:', apiKey);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate valid API key',
      });
    }

    // Hash the key for storage
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = extractApiKeyPrefix(apiKey);

    // Check if user already has an API key with this name
    const existingKey = await query(
      'SELECT id FROM user_api_keys WHERE user_id = $1 AND key_name = $2',
      [userId, name]
    );

    if (existingKey.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An API key with this name already exists',
      });
    }

    // Count user's active API keys (limit to 10 per user)
    const keyCount = await query(
      'SELECT COUNT(*) FROM user_api_keys WHERE user_id = $1 AND active = true',
      [userId]
    );

    const activeKeyCount = parseInt(keyCount.rows[0].count, 10);
    if (activeKeyCount >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum limit of 10 active API keys reached. Please delete an existing key first.',
      });
    }

    // Store the API key (hash only, never the plaintext)
    const result = await query(
      `INSERT INTO user_api_keys (user_id, key_name, key_hash, key_prefix, permissions, expires_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, key_name, key_prefix, permissions, expires_at, created_at`,
      [
        userId,
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions || {}),
        expiresAt || null,
      ]
    );

    const newKey = result.rows[0];

    // Log the API key creation
    await query(
      `INSERT INTO activity_logs (user_id, event_type, entity_type, entity_id, message, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'api_key_created',
        'api_key',
        newKey.id,
        `API key "${name}" created`,
        'success',
      ]
    );

    // Return the full API key (ONLY TIME it will be shown)
    return res.status(201).json({
      success: true,
      data: {
        id: newKey.id,
        key: apiKey, // Full key - show it now or never
        keyPrefix: newKey.key_prefix,
        name: newKey.key_name,
        permissions: newKey.permissions,
        expiresAt: newKey.expires_at,
        createdAt: newKey.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create API key',
    });
  }
});

export default router;
