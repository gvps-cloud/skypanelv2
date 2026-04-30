/**
 * Admin Platform Settings Routes
 * Manage platform-wide settings including availability schedules
 */
import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import { logActivity } from '../../services/activityLogger.js';

const router = express.Router();

// Valid days of the week
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ============================================================================
// PLATFORM AVAILABILITY ROUTES
// ============================================================================

/**
 * Get platform availability schedules and emergency support text
 * GET /api/admin/platform/availability
 */
router.get('/availability', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Fetch availability schedules
    const availabilityResult = await query(
      `SELECT id, day_of_week, is_open, hours_text, display_order, created_at, updated_at 
       FROM platform_availability 
       ORDER BY display_order ASC`
    );

    // Fetch emergency support text from platform_settings
    const emergencyTextResult = await query(
      `SELECT value 
       FROM platform_settings 
       WHERE key = $1`,
      ['emergency_support_text']
    );

    const emergencySupportText = emergencyTextResult.rows.length > 0 
      ? emergencyTextResult.rows[0].value?.text 
      : null;

    res.json({ 
      availability: availabilityResult.rows || [],
      emergency_support_text: emergencySupportText
    });
  } catch (err: any) {
    console.error('Admin platform availability fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch platform availability' });
  }
});

/**
 * Update platform availability schedules and emergency support text
 * PUT /api/admin/platform/availability
 */
router.put(
  '/availability',
  authenticateToken,
  requireAdmin,
  [
    body('schedules').optional().isArray().withMessage('Schedules must be an array'),
    body('schedules.*.day_of_week')
      .optional()
      .isString()
      .trim()
      .toLowerCase()
      .isIn(VALID_DAYS)
      .withMessage(`Day of week must be one of: ${VALID_DAYS.join(', ')}`),
    body('schedules.*.is_open')
      .optional()
      .isBoolean()
      .withMessage('is_open must be a boolean'),
    body('schedules.*.hours_text')
      .optional()
      .isString()
      .trim()
      .withMessage('Hours text must be a string'),
    body('emergency_support_text')
      .optional()
      .isString()
      .withMessage('Emergency support text must be a string')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { schedules, emergency_support_text } = req.body as {
        schedules?: Array<{ day_of_week: string; is_open: boolean; hours_text: string }>;
        emergency_support_text?: string;
      };

      const now = new Date().toISOString();

      // Update availability schedules if provided
      if (schedules && schedules.length > 0) {
        // Validate that we don't have duplicate days
        const days = schedules.map(s => s.day_of_week.toLowerCase());
        const uniqueDays = new Set(days);
        if (days.length !== uniqueDays.size) {
          res.status(400).json({ error: 'Duplicate days found in schedules array' });
          return;
        }

        // Update each schedule
        const updatePromises = schedules.map(async ({ day_of_week, is_open, hours_text }) => {
          const normalizedDay = day_of_week.toLowerCase();
          
          // Check if schedule exists for this day
          const existingResult = await query(
            'SELECT id FROM platform_availability WHERE day_of_week = $1',
            [normalizedDay]
          );

          if (existingResult.rows.length > 0) {
            // Update existing schedule
            return query(
              `UPDATE platform_availability 
               SET is_open = $1, hours_text = $2, updated_at = $3 
               WHERE day_of_week = $4`,
              [is_open, hours_text, now, normalizedDay]
            );
          } else {
            // Insert new schedule with appropriate display_order
            const displayOrder = VALID_DAYS.indexOf(normalizedDay);
            return query(
              `INSERT INTO platform_availability (day_of_week, is_open, hours_text, display_order, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [normalizedDay, is_open, hours_text, displayOrder, now, now]
            );
          }
        });

        await Promise.all(updatePromises);

        // Log activity
        if (req.user?.id) {
          await logActivity({
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: 'platform_availability.update',
            entityType: 'platform_availability',
            entityId: 'bulk',
            message: `Updated ${schedules.length} availability schedule(s)`,
            status: 'success',
            metadata: { count: schedules.length }
          }, req);
        }
      }

      // Update emergency support text if provided
      if (typeof emergency_support_text !== 'undefined') {
        // Upsert emergency support text
        await query(
          `INSERT INTO platform_settings (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = NOW()`,
          ['emergency_support_text', JSON.stringify({ text: emergency_support_text })]
        );

        // Log activity
        if (req.user?.id) {
          await logActivity({
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: 'platform_settings.update',
            entityType: 'platform_settings',
            entityId: 'emergency_support_text',
            message: 'Updated emergency support text',
            status: 'success',
            metadata: { key: 'emergency_support_text' }
          }, req);
        }
      }

      // Fetch and return updated data
      const availabilityResult = await query(
        `SELECT id, day_of_week, is_open, hours_text, display_order, created_at, updated_at 
         FROM platform_availability 
         ORDER BY display_order ASC`
      );

      const emergencyTextResult = await query(
        `SELECT value 
         FROM platform_settings 
         WHERE key = $1`,
        ['emergency_support_text']
      );

      const updatedEmergencySupportText = emergencyTextResult.rows.length > 0 
        ? emergencyTextResult.rows[0].value?.text 
        : null;

      res.json({
        availability: availabilityResult.rows || [],
        emergency_support_text: updatedEmergencySupportText
      });
    } catch (err: any) {
      console.error('Admin platform availability update error:', err);
      res.status(500).json({ error: err.message || 'Failed to update platform availability' });
    }
  }
);

// ============================================================================
// REGION DISPLAY LABELS ROUTES
// ============================================================================

/**
 * GET /api/admin/platform/region-labels
 *
 * Get all region display labels for whitelabeling
 */
router.get('/region-labels', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Fetch all region display labels
    const result = await query(
      `SELECT id, region_id, provider, display_label, display_country, created_at, updated_at
       FROM region_display_labels
       ORDER BY display_country ASC, display_label ASC`
    );

    res.json({
      success: true,
      labels: result.rows || []
    });
  } catch (err: any) {
    console.error('Admin region labels fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch region labels' });
  }
});

/**
 * GET /api/admin/platform/region-labels/:regionId
 *
 * Get display label for a specific region
 */
router.get('/region-labels/:regionId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { regionId } = req.params;

    const result = await query(
      `SELECT id, region_id, provider, display_label, display_country, created_at, updated_at
       FROM region_display_labels
       WHERE region_id = $1 AND provider = 'linode'`,
      [regionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Region label not found' });
      return;
    }

    res.json({
      success: true,
      label: result.rows[0]
    });
  } catch (err: any) {
    console.error('Admin region label fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch region label' });
  }
});

/**
 * PUT /api/admin/platform/region-labels/:regionId
 *
 * Update display label for a specific region
 */
router.put(
  '/region-labels/:regionId',
  authenticateToken,
  requireAdmin,
  [
    body('display_label').isString().trim().notEmpty().withMessage('Display label is required'),
    body('display_country').isString().trim().notEmpty().withMessage('Display country is required'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { regionId } = req.params;
      const { display_label, display_country } = req.body as {
        display_label: string;
        display_country: string;
      };

      // Upsert the region label
      const result = await query(
        `INSERT INTO region_display_labels (region_id, provider, display_label, display_country, updated_at)
         VALUES ($1, 'linode', $2, $3, NOW())
         ON CONFLICT (region_id, provider)
         DO UPDATE SET display_label = $2, display_country = $3, updated_at = NOW()
         RETURNING id, region_id, provider, display_label, display_country, created_at, updated_at`,
        [regionId, display_label, display_country]
      );

      // Invalidate the regions cache so the new labels take effect immediately
      const { invalidateRegionsCache } = await import('../../routes/pricing.js');
      invalidateRegionsCache();

      // Log activity
      if (req.user?.id) {
        await logActivity({
          userId: req.user.id,
          organizationId: req.user.organizationId ?? null,
          eventType: 'region_label.update',
          entityType: 'region_display_labels',
          entityId: regionId,
          message: `Updated region label for ${regionId}`,
          status: 'success',
          metadata: { region_id: regionId, display_label, display_country }
        }, req);
      }

      res.json({
        success: true,
        label: result.rows[0]
      });
    } catch (err: any) {
      console.error('Admin region label update error:', err);
      res.status(500).json({ error: err.message || 'Failed to update region label' });
    }
  }
);

/**
 * DELETE /api/admin/platform/region-labels/:regionId
 *
 * Delete (reset) display label for a specific region to default
 */
router.delete('/region-labels/:regionId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { regionId } = req.params;

    await query(
      `DELETE FROM region_display_labels WHERE region_id = $1 AND provider = 'linode'`,
      [regionId]
    );

    // Invalidate the regions cache
    const { invalidateRegionsCache } = await import('../../routes/pricing.js');
    invalidateRegionsCache();

    res.json({
      success: true,
      message: 'Region label deleted'
    });
  } catch (err: any) {
    console.error('Admin region label delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete region label' });
  }
});

/**
 * POST /api/admin/platform/region-labels/bulk
 *
 * Bulk update region labels
 */
router.post(
  '/region-labels/bulk',
  authenticateToken,
  requireAdmin,
  [
    body('labels').isArray().withMessage('Labels must be an array'),
    body('labels.*.region_id').isString().trim().notEmpty().withMessage('Region ID is required'),
    body('labels.*.display_label').isString().trim().notEmpty().withMessage('Display label is required'),
    body('labels.*.display_country').isString().trim().notEmpty().withMessage('Display country is required'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { labels } = req.body as {
        labels: Array<{ region_id: string; display_label: string; display_country: string }>;
      };

      // Upsert each label
      for (const label of labels) {
        await query(
          `INSERT INTO region_display_labels (region_id, provider, display_label, display_country, updated_at)
           VALUES ($1, 'linode', $2, $3, NOW())
           ON CONFLICT (region_id, provider)
           DO UPDATE SET display_label = $2, display_country = $3, updated_at = NOW()`,
          [label.region_id, label.display_label, label.display_country]
        );
      }

      // Invalidate the regions cache
      const { invalidateRegionsCache } = await import('../../routes/pricing.js');
      invalidateRegionsCache();

      res.json({
        success: true,
        message: `Updated ${labels.length} region labels`
      });
    } catch (err: any) {
      console.error('Admin region labels bulk update error:', err);
      res.status(500).json({ error: err.message || 'Failed to bulk update region labels' });
    }
  }
);

export default router;
