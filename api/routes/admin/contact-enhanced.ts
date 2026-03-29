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

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (typeof title !== 'undefined') {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(title);
      console.log(`[Contact Method Update] Updating title to: ${title}`);
    }
    if (typeof description !== 'undefined') {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
      console.log(`[Contact Method Update] Updating description`);
    }
    if (typeof is_active !== 'undefined') {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(is_active);
      console.log(`[Contact Method Update] Updating is_active to: ${is_active}`);
    }
    if (typeof config !== 'undefined') {
      updateFields.push(`config = $${paramIndex++}`);
      const configJson = JSON.stringify(config);
      updateValues.push(configJson);
      console.log(`[Contact Method Update] Updating config (${configJson.length} bytes):`, config);
    }

    if (updateFields.length === 0) {
      console.error(`[Contact Method Update] No fields to update for ${method_type}`);
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date().toISOString());
    updateValues.push(method_type);

    console.log(`[Contact Method Update] Executing database update with ${updateFields.length} fields`);
    const updateResult = await query(
      `UPDATE contact_methods 
       SET ${updateFields.join(', ')} 
       WHERE method_type = $${paramIndex}
       RETURNING id, method_type, title, description, is_active, config, created_at, updated_at`,
      updateValues
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
