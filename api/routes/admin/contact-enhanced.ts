/**
 * Enhanced Admin Contact Management Routes with Comprehensive Logging
 * This file contains the enhanced PUT endpoint with detailed error logging
 * To use: replace the PUT handler in api/routes/admin/contact.ts with this implementation
 */
import { Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';

// Enhanced PUT endpoint handler with comprehensive logging
const enhancedPutHandler = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const { method_type } = req.params;
  
  try {
    console.log(`[Contact Method Update] Starting update for method_type: ${method_type}`);
    console.log(`[Contact Method Update] Request body:`, JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('[Contact Method Update] Validation failed for %s:', method_type, errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, is_active, config } = req.body;

    // Check if method exists
    console.log(`[Contact Method Update] Checking if method exists: ${method_type}`);
    const existingResult = await query(
      'SELECT id, title FROM contact_methods WHERE method_type = $1',
      [method_type]
    );

    if (existingResult.rows.length === 0) {
      console.error(`[Contact Method Update] Method not found: ${method_type}`);
      return res.status(404).json({ error: 'Contact method not found' });
    }

    console.log(`[Contact Method Update] Found existing method: ${existingResult.rows[0].title}`);

    if (typeof title !== 'undefined') {
      console.log(`[Contact Method Update] Updating title to: ${title}`);
    }
    if (typeof description !== 'undefined') {
      console.log(`[Contact Method Update] Updating description`);
    }
    if (typeof is_active !== 'undefined') {
      console.log(`[Contact Method Update] Updating is_active to: ${is_active}`);
    }
    if (typeof config !== 'undefined') {
      console.log(`[Contact Method Update] Updating config:`, config);
    }

    if (typeof title === 'undefined' && typeof description === 'undefined' && typeof is_active === 'undefined' && typeof config === 'undefined') {
      console.error(`[Contact Method Update] No fields to update for ${method_type}`);
      return res.status(400).json({ error: 'No fields to update' });
    }

    console.log(`[Contact Method Update] Executing database update`);
    const updateResult = await query(
      `UPDATE contact_methods 
       SET
         title = CASE WHEN $1::boolean THEN $2 ELSE title END,
         description = CASE WHEN $3::boolean THEN $4 ELSE description END,
         is_active = CASE WHEN $5::boolean THEN $6::boolean ELSE is_active END,
         config = CASE WHEN $7::boolean THEN $8::jsonb ELSE config END,
         updated_at = $9
       WHERE method_type = $10
       RETURNING id, method_type, title, description, is_active, config, created_at, updated_at`,
      [
        typeof title !== 'undefined',
        typeof title !== 'undefined' ? title : null,
        typeof description !== 'undefined',
        typeof description !== 'undefined' ? description : null,
        typeof is_active !== 'undefined',
        typeof is_active !== 'undefined' ? is_active : null,
        typeof config !== 'undefined',
        typeof config !== 'undefined' ? JSON.stringify(config) : null,
        new Date().toISOString(),
        method_type
      ]
    );

    if (updateResult.rows.length === 0) {
      console.error(`[Contact Method Update] Update returned no rows for ${method_type}`);
      throw new Error('Update operation failed - no rows returned');
    }

    const updatedMethod = updateResult.rows[0];
    console.log(`[Contact Method Update] Successfully updated method: ${updatedMethod.id}`);
    console.log(`[Contact Method Update] Updated config:`, updatedMethod.config);

    // Log activity
    if (req.user?.id) {
      console.log(`[Contact Method Update] Logging activity for user: ${req.user.id}`);
      await logActivity({
        userId: req.user.id,
        organizationId: req.user.organizationId ?? null,
        eventType: 'contact_method.update',
        entityType: 'contact_method',
        entityId: updatedMethod.id,
        message: `Updated contact method '${updatedMethod.title}' (${method_type})`,
        status: 'success',
        metadata: { method_type, title: updatedMethod.title }
      }, req);
    }

    const duration = Date.now() - startTime;
    console.log(`[Contact Method Update] Completed successfully in ${duration}ms`);

    return res.json({ method: updatedMethod });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[Contact Method Update] Error after ${duration}ms:`, {
      method_type,
      error: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail
    });
    
    // Log failed activity
    if (req.user?.id) {
      try {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'contact_method.update',
          entityType: 'contact_method',
          entityId: method_type,
          message: `Failed to update contact method (${method_type}): ${err.message}`,
          status: 'error',
          metadata: { method_type, error: err.message }
        }, req);
      } catch (logErr) {
        console.error('[Contact Method Update] Failed to log error activity:', logErr);
      }
    }
    
    return res.status(500).json({ error: err.message || 'Failed to update contact method' });
  }
};

export { enhancedPutHandler };
