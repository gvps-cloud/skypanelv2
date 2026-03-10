import express from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { query } from '../../lib/database.js';
import * as EmailTemplateService from '../../services/emailTemplateService.js';
import { logActivity } from '../../services/activityLogger.js';
import Handlebars from 'handlebars';

const router = express.Router();

// Middleware to ensure admin access
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/email-templates
 * List all email templates
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM email_templates ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

/**
 * GET /api/admin/email-templates/:name
 * Get a specific email template by name
 */
router.get('/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const template = await EmailTemplateService.getTemplate(name);
    
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error(`Error fetching email template ${name}:`, error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

/**
 * PUT /api/admin/email-templates/:name
 * Update an email template
 */
router.put('/:name', async (req: AuthenticatedRequest, res) => {
  const { name } = req.params;
  const { subject, html_body, text_body } = req.body;
  
  if (!subject || !html_body || !text_body) {
    return res.status(400).json({ error: 'Missing required fields: subject, html_body, text_body' });
  }
  
  try {
    // Check if template exists
    const existingTemplate = await EmailTemplateService.getTemplate(name);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Email template not found' });
    }
    
    // Update template
    const result = await query(
      `UPDATE email_templates 
       SET subject = $1, html_body = $2, text_body = $3, updated_at = NOW() 
       WHERE name = $4 
       RETURNING *`,
      [subject, html_body, text_body, name]
    );
    
    const updatedTemplate = result.rows[0];
    
    // Log activity
    if (req.user) {
      await logActivity({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        eventType: 'email_template.update',
        entityType: 'email_template',
        entityId: updatedTemplate.id.toString(),
        message: `Updated email template: ${name}`,
        status: 'success',
        metadata: { name }
      }, req);
    }
    
    res.json(updatedTemplate);
  } catch (error) {
    console.error(`Error updating email template ${name}:`, error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

/**
 * POST /api/admin/email-templates/preview
 * Preview an email template
 * Can preview existing template by name OR preview provided content
 */
router.post('/preview', async (req, res) => {
  const { name, data, subject, html, text } = req.body;
  const templateData = data || {};
  
  try {
    // If explicit content is provided, use it
    if (subject !== undefined && html !== undefined && text !== undefined) {
      const subjectTemplate = Handlebars.compile(subject);
      const htmlTemplate = Handlebars.compile(html);
      const textTemplate = Handlebars.compile(text);
      
      return res.json({
        subject: subjectTemplate(templateData),
        html: htmlTemplate(templateData),
        text: textTemplate(templateData)
      });
    }
    
    // Otherwise, look up by name
    if (!name) {
      return res.status(400).json({ error: 'Must provide either name OR subject/html/text' });
    }
    
    const rendered = await EmailTemplateService.renderTemplate(name, templateData);
    res.json(rendered);
  } catch (error: any) {
    console.error('Error previewing email template:', error);
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to preview email template' });
  }
});

export default router;
