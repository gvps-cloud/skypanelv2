import Handlebars from 'handlebars';
import { query } from '../lib/database.js';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Fetch an email template by name from the database.
 * @param name The unique name of the template.
 * @returns The email template or null if not found.
 */
export async function getTemplate(name: string): Promise<EmailTemplate | null> {
  const result = await query(
    'SELECT * FROM email_templates WHERE name = $1',
    [name]
  );
  return result.rows[0] || null;
}

/**
 * Render an email template with the provided data.
 * @param name The unique name of the template.
 * @param data The data to interpolate into the template.
 * @returns An object containing the rendered subject, HTML body, and text body.
 * @throws Error if the template is not found.
 */
export async function renderTemplate(name: string, data: any): Promise<{ subject: string; html: string; text: string }> {
  const template = await getTemplate(name);
  
  if (!template) {
    throw new Error(`Email template '${name}' not found`);
  }

  const subjectTemplate = Handlebars.compile(template.subject);
  const htmlTemplate = Handlebars.compile(template.html_body);
  const textTemplate = Handlebars.compile(template.text_body);

  return {
    subject: subjectTemplate(data),
    html: htmlTemplate(data),
    text: textTemplate(data)
  };
}
