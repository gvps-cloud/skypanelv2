/**
 * Public Contact API Routes
 * Provides contact configuration for the public Contact page
 */
import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../lib/database.js';
import { sendContactFormEmail } from '../services/emailService.js';
import { config as appConfig } from '../config/index.js';

const router = express.Router();

/**
 * Get all active contact configuration
 * GET /api/contact/config
 * Returns categories, methods, availability, and emergency support text
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    console.log('[Contact API] Fetching contact configuration...');
    
    // Fetch active contact categories ordered by display_order
    const categoriesResult = await query(
      `SELECT id, label, value, display_order, is_active, created_at, updated_at 
       FROM contact_categories 
       WHERE is_active = TRUE 
       ORDER BY display_order ASC`
    );
    console.log(`[Contact API] Found ${categoriesResult.rows.length} active categories`);

    // Fetch active contact methods
    const methodsResult = await query(
      `SELECT id, method_type, title, description, config, created_at, updated_at 
       FROM contact_methods 
       WHERE is_active = TRUE`
    );
    console.log(`[Contact API] Found ${methodsResult.rows.length} active contact methods`);

    // Fetch availability schedule ordered by display_order
    const availabilityResult = await query(
      `SELECT id, day_of_week, is_open, hours_text, display_order, created_at, updated_at 
       FROM platform_availability 
       ORDER BY display_order ASC`
    );
    console.log(`[Contact API] Found ${availabilityResult.rows.length} availability schedules`);

    // Fetch emergency support text
    const emergencySupportResult = await query(
      `SELECT value 
       FROM platform_settings 
       WHERE key = 'emergency_support_text'`
    );

    // Transform methods array into an object keyed by method_type
    const methods: any = {};
    for (const method of methodsResult.rows) {
      // Ensure config is properly parsed if it's a string
      const config = typeof method.config === 'string' 
        ? JSON.parse(method.config) 
        : method.config;
      
      methods[method.method_type] = {
        id: method.id,
        method_type: method.method_type,
        title: method.title,
        description: method.description,
        is_active: true, // Since we only fetch active methods, they're all active
        config: config,
        created_at: method.created_at,
        updated_at: method.updated_at
      };
      
      console.log(`[Contact API] Processed ${method.method_type} method with config keys:`, Object.keys(config));
    }

    const response = {
      categories: categoriesResult.rows || [],
      methods,
      availability: availabilityResult.rows || [],
      emergency_support_text: emergencySupportResult.rows[0]?.value?.text || null
    };

    console.log('[Contact API] Successfully prepared response with', {
      categoriesCount: response.categories.length,
      methodsCount: Object.keys(response.methods).length,
      availabilityCount: response.availability.length,
      hasEmergencyText: !!response.emergency_support_text
    });

    res.json(response);
  } catch (err: any) {
    console.error('[Contact API] Error fetching contact configuration:', err);
    console.error('[Contact API] Error stack:', err.stack);
    res.status(500).json({ 
      error: err.message || 'Failed to fetch contact configuration',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

router.post(
  '/',
  [
    body('name')
      .isString()
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 120 }).withMessage('Name must be 120 characters or fewer'),
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('subject')
      .isString()
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ max: 200 }).withMessage('Subject must be 200 characters or fewer'),
    body('category')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 }).withMessage('Category must be 100 characters or fewer'),
    body('message')
      .isString()
      .trim()
      .isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, email, subject, category, message } = req.body as {
        name: string;
        email: string;
        subject: string;
        category?: string;
        message: string;
      };

  let recipient = appConfig.CONTACT_FORM_RECIPIENT || appConfig.FROM_EMAIL;
      let categoryLabel = category;

      try {
        const emailMethodResult = await query(
          `SELECT config
           FROM contact_methods
           WHERE method_type = 'email' AND is_active = TRUE
           LIMIT 1`
        );

        const emailConfigRaw = emailMethodResult.rows[0]?.config;
        const emailConfig = typeof emailConfigRaw === 'string' ? JSON.parse(emailConfigRaw) : emailConfigRaw;
        if (emailConfig?.email_address) {
          recipient = emailConfig.email_address;
        }
      } catch (err) {
        console.warn('[Contact API] Failed to load email contact configuration, falling back to environment variables:', err);
      }

      if (category) {
        try {
          const categoryResult = await query(
            `SELECT label
             FROM contact_categories
             WHERE value = $1
             LIMIT 1`,
            [category]
          );

          if (categoryResult.rows[0]?.label) {
            categoryLabel = categoryResult.rows[0].label;
          }
        } catch (err) {
          console.warn('[Contact API] Failed to resolve contact category label:', err);
        }
      }

      if (!recipient) {
        res.status(500).json({ error: 'Contact form recipient is not configured. Please try again later.' });
        return;
      }

      const timestamp = new Date().toISOString();
      const normalizedSubject = subject.trim();
      const categoryText = categoryLabel || 'Not specified';

      await sendContactFormEmail(
        recipient,
        {
          name,
          email,
          category: categoryText,
          subject: normalizedSubject,
          message,
          sentAt: timestamp,
        },
        `${name} <${email}>`
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('[Contact API] Failed to process contact form submission:', err);
      res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }
  }
);

export default router;
