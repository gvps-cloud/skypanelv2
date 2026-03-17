import Handlebars from 'handlebars';
import { query } from '../lib/database.js';
import { themeService, resolveThemePalette, type ThemePalette } from './themeService.js';
import { config } from '../config/index.js';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  use_default_theme?: boolean;
  created_at: Date;
  updated_at: Date;
}

type RenderedEmail = { subject: string; html: string; text: string };

const resolveCompanyName = (): string =>
  (config.COMPANY_BRAND_NAME && config.COMPANY_BRAND_NAME.trim())
  || (process.env.COMPANY_NAME && process.env.COMPANY_NAME.trim())
  || (process.env.VITE_COMPANY_NAME && process.env.VITE_COMPANY_NAME.trim())
  || 'SkyPanelV2';

const resolveCompanyLogoUrl = (): string | undefined =>
  (process.env.COMPANY_LOGO_URL && process.env.COMPANY_LOGO_URL.trim())
  || undefined;

const isFullHtmlDocument = (html: string): boolean => /<!doctype\s+html|<html[\s>]/i.test(html);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const hslToHex = (h: number, s: number, l: number): string => {
  const normalizedHue = ((h % 360) + 360) % 360;
  const normalizedS = clamp(s / 100, 0, 1);
  const normalizedL = clamp(l / 100, 0, 1);

  const c = (1 - Math.abs(2 * normalizedL - 1)) * normalizedS;
  const x = c * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const m = normalizedL - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (normalizedHue < 60) {
    r = c; g = x; b = 0;
  } else if (normalizedHue < 120) {
    r = x; g = c; b = 0;
  } else if (normalizedHue < 180) {
    r = 0; g = c; b = x;
  } else if (normalizedHue < 240) {
    r = 0; g = x; b = c;
  } else if (normalizedHue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toByte = (v: number) => Math.round((v + m) * 255);
  const toHex = (v: number) => toByte(v).toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const normalizeEmailColor = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('#') || /^rgb/i.test(trimmed)) {
    return trimmed;
  }

  // Convert themeService's common "hsl(h s% l%)" shape into hex for email client compatibility.
  const match = trimmed.match(/^hsl\(\s*([0-9.+-]+)\s+([0-9.+-]+)%\s+([0-9.+-]+)%\s*\)$/i);
  if (match) {
    const h = Number(match[1]);
    const s = Number(match[2]);
    const l = Number(match[3]);
    if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
      return hslToHex(h, s, l);
    }
  }

  // Email HTML does not support CSS variables; fall back when we see them.
  if (/^var\(/i.test(trimmed)) {
    return fallback;
  }

  return trimmed;
};

const resolveEmailPalette = async (): Promise<ThemePalette> => {
  const themeConfig = await themeService.getThemeConfig();
  const palette = resolveThemePalette(themeConfig);
  return {
    background: normalizeEmailColor(palette.background, '#ffffff'),
    foreground: normalizeEmailColor(palette.foreground, '#111827'),
    card: normalizeEmailColor(palette.card, '#ffffff'),
    cardForeground: normalizeEmailColor(palette.cardForeground, '#111827'),
    muted: normalizeEmailColor(palette.muted, '#f3f4f6'),
    mutedForeground: normalizeEmailColor(palette.mutedForeground, '#6b7280'),
    border: normalizeEmailColor(palette.border, '#e5e7eb'),
    primary: normalizeEmailColor(palette.primary, '#111827'),
    primaryForeground: normalizeEmailColor(palette.primaryForeground, '#ffffff'),
    secondary: normalizeEmailColor(palette.secondary, '#f3f4f6'),
    secondaryForeground: normalizeEmailColor(palette.secondaryForeground, '#111827'),
    accent: normalizeEmailColor(palette.accent, '#f3f4f6'),
    accentForeground: normalizeEmailColor(palette.accentForeground, '#111827'),
    destructive: normalizeEmailColor(palette.destructive, '#ef4444'),
    destructiveForeground: normalizeEmailColor(palette.destructiveForeground, '#ffffff'),
    ring: normalizeEmailColor(palette.ring, '#111827'),
  };
};

let cachedEmailPalette: { palette: ThemePalette; fetchedAt: number } | null = null;
const EMAIL_PALETTE_TTL_MS = 60_000;

const getCachedEmailPalette = async (): Promise<ThemePalette> => {
  const now = Date.now();
  if (cachedEmailPalette && now - cachedEmailPalette.fetchedAt < EMAIL_PALETTE_TTL_MS) {
    return cachedEmailPalette.palette;
  }
  const palette = await resolveEmailPalette();
  cachedEmailPalette = { palette, fetchedAt: now };
  return palette;
};

const wrapWithDefaultEmailTheme = (
  innerHtml: string,
  palette: ThemePalette,
  opts?: { companyName?: string; companyLogoUrl?: string },
): string => {
  const companyName = (opts?.companyName && opts.companyName.trim().length > 0)
    ? opts.companyName.trim()
    : resolveCompanyName();
  const companyLogoUrl = opts?.companyLogoUrl ?? resolveCompanyLogoUrl();
  const year = new Date().getFullYear();

  const logoHtml = companyLogoUrl
    ? `<img src="${companyLogoUrl}" alt="${escapeHtml(companyName)}" style="display:block;height:28px;max-height:28px;width:auto;" />`
    : `<div style="font-weight:700;font-size:16px;line-height:20px;color:${palette.primary};">${escapeHtml(companyName)}</div>`;

  return `
<div style="margin:0;padding:24px 12px;background:${palette.background};color:${palette.foreground};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:separate;width:100%;max-width:600px;background:${palette.card};border:1px solid ${palette.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:18px 22px;border-bottom:1px solid ${palette.border};background:${palette.card};">
              ${logoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:${palette.cardForeground};">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 22px;border-top:1px solid ${palette.border};background:${palette.muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.4;color:${palette.mutedForeground};">
              © ${year} ${escapeHtml(companyName)}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
`.trim();
};

const normalizeTemplateData = async (
  input: Record<string, any> | undefined,
): Promise<Record<string, any>> => {
  const data = { ...(input || {}) };

  const companyName = resolveCompanyName();
  data.companyName ??= data.company_name ?? companyName;
  data.company_name ??= data.companyName;

  data.displayName ??= data.name ?? data.userName ?? 'there';
  data.name ??= data.displayName;

  const palette = await getCachedEmailPalette();
  data.emailTheme ??= {
    ...palette,
    companyName: data.companyName,
    companyLogoUrl: resolveCompanyLogoUrl(),
  };

  if (typeof data.message === 'string') {
    data.messageHtml ??= escapeHtml(data.message).replace(/\r?\n/g, '<br />');
  }

  return data;
};

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
export async function renderTemplate(name: string, data: any): Promise<RenderedEmail> {
  const template = await getTemplate(name);
  
  if (!template) {
    throw new Error(`Email template '${name}' not found`);
  }

  const normalizedData = await normalizeTemplateData(data || {});

  const subjectTemplate = Handlebars.compile(template.subject);
  const htmlTemplate = Handlebars.compile(template.html_body);
  const textTemplate = Handlebars.compile(template.text_body);

  const rendered: RenderedEmail = {
    subject: subjectTemplate(normalizedData),
    html: htmlTemplate(normalizedData),
    text: textTemplate(normalizedData)
  };

  const shouldWrap = template.use_default_theme !== false;
  if (shouldWrap && rendered.html && !isFullHtmlDocument(rendered.html)) {
    const palette = (normalizedData.emailTheme || {}) as ThemePalette;
    rendered.html = wrapWithDefaultEmailTheme(rendered.html, palette, {
      companyName: normalizedData.companyName,
      companyLogoUrl: normalizedData.emailTheme?.companyLogoUrl,
    });
  }

  return rendered;
}

export async function renderAdHocTemplate(input: {
  subject: string;
  html: string;
  text: string;
  data?: Record<string, any>;
  useDefaultTheme?: boolean;
}): Promise<RenderedEmail> {
  const normalizedData = await normalizeTemplateData(input.data || {});

  const subjectTemplate = Handlebars.compile(input.subject);
  const htmlTemplate = Handlebars.compile(input.html);
  const textTemplate = Handlebars.compile(input.text);

  const rendered: RenderedEmail = {
    subject: subjectTemplate(normalizedData),
    html: htmlTemplate(normalizedData),
    text: textTemplate(normalizedData),
  };

  const shouldWrap = input.useDefaultTheme !== false;
  if (shouldWrap && rendered.html && !isFullHtmlDocument(rendered.html)) {
    const palette = (normalizedData.emailTheme || {}) as ThemePalette;
    rendered.html = wrapWithDefaultEmailTheme(rendered.html, palette, {
      companyName: normalizedData.companyName,
      companyLogoUrl: normalizedData.emailTheme?.companyLogoUrl,
    });
  }

  return rendered;
}
