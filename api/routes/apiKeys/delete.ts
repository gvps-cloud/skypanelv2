/**
 * DELETE /api/api-keys/:id
 *
 * Delete (deactivate) an API key.
 *
 * This endpoint soft-deletes an API key by setting active=false.
 * The key remains in the database for audit purposes but cannot be used.
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "API key deleted successfully"
 * }
 *
 * SECURITY NOTES:
 * - Soft delete: sets active=false instead of deleting the row
 * - Row-level security (RLS) ensures users can only delete their own keys
 * - Logs the deletion for audit trail
 * - Cannot be undone - a deleted key must be recreated
 */

import { Router, Request, Response } from 'express';
import { query, transaction } from '../../lib/database.js';
import { authenticateToken, type AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

/**
 * DELETE /api/api-keys/:id
 *
 * Delete (deactivate) an API key by ID.
 */
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

    // Check if the key exists and belongs to the user
    const existingKey = await query(
      `SELECT id, key_name, active FROM user_api_keys
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (existingKey.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    const keyData = existingKey.rows[0];

    // Check if already inactive
    if (!keyData.active) {
      return res.status(400).json({
        success: false,
        error: 'API key is already inactive',
      });
    }

    // Soft delete by setting active=false
    await query(
      `UPDATE user_api_keys
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    // Log the deletion
    await query(
      `INSERT INTO activity_logs (user_id, event_type, entity_type, entity_id, message, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'api_key_deleted',
        'api_key',
        keyId,
        `API key "${keyData.key_name}" deleted`,
        'success',
      ]
    );

    return res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete API key',
    });
  }
});

/**
 * PATCH /api/api-keys/:id
 *
 * Update an API key (currently only supports reactivation).
 *
 * Request body:
 * {
 *   "active": true  // Reactivate a deleted key
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "API key reactivated successfully"
 * }
 */
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const keyId = req.params.id;
    const { active } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(keyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API key ID format',
      });
    }

    // Validate request body
    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body. active must be a boolean',
      });
    }

    // Check if the key exists and belongs to the user
    const existingKey = await query(
      `SELECT id, key_name, active FROM user_api_keys
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (existingKey.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
      });
    }

    const keyData = existingKey.rows[0];

    // Check if already in desired state
    if (keyData.active === active) {
      return res.status(400).json({
        success: false,
        error: `API key is already ${active ? 'active' : 'inactive'}`,
      });
    }

    // Update the key
    await query(
      `UPDATE user_api_keys
       SET active = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [active, keyId, userId]
    );

    // Log the change
    await query(
      `INSERT INTO activity_logs (user_id, event_type, entity_type, entity_id, message, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        active ? 'api_key_reactivated' : 'api_key_deactivated',
        'api_key',
        keyId,
        `API key "${keyData.key_name}" ${active ? 'reactivated' : 'deactivated'}`,
        'success',
      ]
    );

    return res.json({
      success: true,
      message: `API key ${active ? 'reactivated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update API key',
    });
  }
});

export default router;
