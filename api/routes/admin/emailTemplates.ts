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

const extractHandlebarsVariables = (sources: Array<string | undefined | null>): string[] => {
  const vars = new Set<string>();

  const collectFromParam = (param: any) => {
    if (!param) return;
    if (param.type === 'PathExpression' && typeof param.original === 'string') {
      vars.add(param.original);
      return;
    }
    if (param.type === 'SubExpression') {
      for (const p of param.params || []) collectFromParam(p);
      return;
    }
  };

  const visit = (node: any) => {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }

    if (node.type === 'Program') {
      visit(node.body);
      return;
    }

    if (node.type === 'MustacheStatement') {
      const isPlainVariable =
        node.path?.type === 'PathExpression' &&
        (node.params?.length ?? 0) === 0 &&
        (node.hash?.pairs?.length ?? 0) === 0;
      if (isPlainVariable && typeof node.path.original === 'string') {
        vars.add(node.path.original);
      }
      for (const p of node.params || []) collectFromParam(p);
      for (const pair of node.hash?.pairs || []) collectFromParam(pair?.value);
      return;
    }

    if (node.type === 'BlockStatement') {
      for (const p of node.params || []) collectFromParam(p);
      visit(node.program);
      visit(node.inverse);
      return;
    }

    if (node.type === 'PartialStatement') {
      return;
    }

    if (node.type === 'ContentStatement') {
      return;
    }

    if (node.type === 'CommentStatement') {
      return;
    }
  };

  for (const source of sources) {
    if (!source || typeof source !== 'string') continue;
    try {
      const ast = Handlebars.parse(source);
      visit(ast as any);
    } catch {
      // Ignore parse errors; admins may be mid-edit.
    }
  }

  return Array.from(vars).sort((a, b) => a.localeCompare(b));
};

/**
 * GET /api/admin/email-templates
 * List all email templates
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM email_templates ORDER BY name ASC'
    );
    const templates = (result.rows || []).map((row) => ({
      ...row,
      variables: extractHandlebarsVariables([row.subject, row.html_body, row.text_body])
    }));
    res.json(templates);
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
    
    res.json({
      ...template,
      variables: extractHandlebarsVariables([template.subject, template.html_body, template.text_body])
    });
  } catch (error) {
    console.error('Error fetching email template %s:', name, error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

/**
 * PUT /api/admin/email-templates/:name
 * Update an email template
 */
router.put('/:name', async (req: AuthenticatedRequest, res) => {
  const { name } = req.params;
  const { subject, html_body, text_body, use_default_theme } = req.body;
  
  if (!subject || !html_body || !text_body) {
    return res.status(400).json({ error: 'Missing required fields: subject, html_body, text_body' });
  }
  
  try {
    // Check if template exists
    const existingTemplate = await EmailTemplateService.getTemplate(name);
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    const resolvedUseDefaultTheme =
      typeof use_default_theme === 'boolean'
        ? use_default_theme
        : existingTemplate.use_default_theme !== false;
    
    // Update template (tolerate older DBs missing the column)
    let result;
    try {
      result = await query(
        `UPDATE email_templates 
         SET subject = $1, html_body = $2, text_body = $3, use_default_theme = $4, updated_at = NOW() 
         WHERE name = $5 
         RETURNING *`,
        [subject, html_body, text_body, resolvedUseDefaultTheme, name]
      );
    } catch (err: any) {
      const message = (err?.message as string | undefined) || '';
      if (message.toLowerCase().includes('use_default_theme') && message.toLowerCase().includes('does not exist')) {
        result = await query(
          `UPDATE email_templates 
           SET subject = $1, html_body = $2, text_body = $3, updated_at = NOW() 
           WHERE name = $4 
           RETURNING *`,
          [subject, html_body, text_body, name]
        );
      } else {
        throw err;
      }
    }
    
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
    console.error('Error updating email template %s:', name, error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

/**
 * POST /api/admin/email-templates/preview
 * Preview an email template
 * Can preview existing template by name OR preview provided content
 */
router.post('/preview', async (req, res) => {
  const { name, data, subject, html, text, use_default_theme } = req.body;
  const templateData = data || {};
  
  try {
    // If explicit content is provided, use it (optionally themed)
    if (subject !== undefined && html !== undefined && text !== undefined) {
      let resolvedUseDefaultTheme = typeof use_default_theme === 'boolean'
        ? use_default_theme
        : true;

      if (typeof use_default_theme !== 'boolean' && name) {
        const existingTemplate = await EmailTemplateService.getTemplate(name);
        if (existingTemplate) {
          resolvedUseDefaultTheme = existingTemplate.use_default_theme !== false;
        }
      }

      const rendered = await EmailTemplateService.renderAdHocTemplate({
        subject,
        html,
        text,
        data: templateData,
        useDefaultTheme: resolvedUseDefaultTheme,
      });

      return res.json(rendered);
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
