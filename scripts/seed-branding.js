/**
 * Seed Branding Script
 *
 * Reads branding configuration from .env and updates the database to match.
 * This ensures that documentation articles, FAQ items, contact methods, and
 * networking config all reflect the configured brand — not hardcoded defaults.
 *
 * The script is rerunnable: on subsequent runs it reads the previously stored
 * brand name from platform_settings so that changing BRAND_NAME in .env will
 * correctly replace the old brand throughout the database.
 *
 * Usage:
 *   node scripts/seed-branding.js
 *
 * Required .env variables (falls back to sensible defaults if unset):
 *   COMPANY_BRAND_NAME  — display name (e.g. "GVPS.Cloud")
 *   RDNS_BASE_DOMAIN    — rDNS base domain (e.g. "ip.rev.gvps.cloud")
 *   SUPPORT_EMAIL       — support email address (e.g. "support@gvps.cloud")
 *                         Falls back to CONTACT_FORM_RECIPIENT or FROM_EMAIL
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

const BRAND_NAME =
  process.env.COMPANY_BRAND_NAME?.trim() ||
  process.env.VITE_COMPANY_NAME?.trim() ||
  process.env.COMPANY_NAME?.trim() ||
  'the platform';

const RDNS_DOMAIN =
  process.env.RDNS_BASE_DOMAIN?.trim() ||
  'ip.rev.example.com';

const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL?.trim() ||
  process.env.CONTACT_FORM_RECIPIENT?.trim() ||
  process.env.FROM_EMAIL?.trim() ||
  'support@example.com';

async function seedBranding() {
  let client;
  console.log(`🎨 Seeding branding configuration...`);
  console.log(`   Brand name  : ${BRAND_NAME}`);
  console.log(`   rDNS domain : ${RDNS_DOMAIN}`);
  console.log(`   Support email: ${SUPPORT_EMAIL}\n`);

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // ─── 0. Read the previously stored brand name (if any) ──────────
    let previousBrand = null;
    const prevResult = await client.query(
      `SELECT value->>'company_name' AS brand FROM platform_settings WHERE key = 'branding'`
    );
    if (prevResult.rows.length > 0 && prevResult.rows[0].brand) {
      previousBrand = prevResult.rows[0].brand;
    }
    if (previousBrand) {
      console.log(`   Previous brand: ${previousBrand} (will be replaced)`);
    }

    // ─── 1. Update platform_settings branding entry ──────────────────
    const brandingJSON = JSON.stringify({
      company_name: BRAND_NAME,
      support_email: SUPPORT_EMAIL,
      rdns_base_domain: RDNS_DOMAIN,
    });
    // Persist branding to platform_settings for future API consumption (e.g., public brand info endpoint)
    await client.query(`
      INSERT INTO platform_settings (key, value)
      VALUES ('branding', $1::jsonb)
      ON CONFLICT (key) DO UPDATE
      SET value = $1::jsonb
    `, [brandingJSON]);
    console.log('✅ platform_settings.branding updated');

    // ─── 2. Update documentation articles ────────────────────────────
    // Replace generic "the platform" placeholder AND any previous brand name
    const placeholders = ['the platform'];
    if (previousBrand && previousBrand !== 'the platform') {
      placeholders.push(previousBrand);
    }

    for (const placeholder of placeholders) {
      const docResult = await client.query(`
        UPDATE documentation_articles
        SET title   = REPLACE(title,   $1::text, $2::text),
            content = REPLACE(content, $1::text, $2::text),
            summary = REPLACE(summary, $1::text, $2::text)
        WHERE title   LIKE '%' || $1::text || '%'
           OR content LIKE '%' || $1::text || '%'
           OR summary LIKE '%' || $1::text || '%'
      `, [placeholder, BRAND_NAME]);
      console.log(`✅ documentation_articles (${placeholder} → ${BRAND_NAME}): ${docResult.rowCount} rows updated`);
    }

    // Clean up any "the the" → "the" artifacts from the replacement above
    await client.query(`
      UPDATE documentation_articles
      SET content = REPLACE(content, 'the the ', 'the '),
          summary = REPLACE(summary, 'the the ', 'the '),
          title   = REPLACE(title,   'the the ', 'the ')
      WHERE content LIKE '%the the %'
         OR summary LIKE '%the the %'
         OR title   LIKE '%the the %'
    `);

    // Fix specific welcome article title/slug (only the generic placeholder variant)
    const welcomeSlug = 'welcome-to-' + BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await client.query(`
      UPDATE documentation_articles
      SET title = $1::text,
          slug  = $2::text
      WHERE slug = 'welcome-to-platform'
    `, [`Welcome to ${BRAND_NAME}`, welcomeSlug]);

    // ─── 3. Update FAQ items ─────────────────────────────────────────
    for (const placeholder of placeholders) {
      const faqResult = await client.query(`
        UPDATE faq_items
        SET question = REPLACE(question, $1::text, $2::text),
            answer   = REPLACE(answer,   $1::text, $2::text)
        WHERE question LIKE '%' || $1::text || '%'
           OR answer   LIKE '%' || $1::text || '%'
      `, [placeholder === 'the platform' ? 'this platform' : placeholder, BRAND_NAME]);
      console.log(`✅ faq_items (${placeholder}): ${faqResult.rowCount} rows updated`);
    }

    // ─── 4. Update contact methods email ─────────────────────────────
    // Only update legacy/placeholder values — don't overwrite intentional customizations
    const contactResult = await client.query(`
      UPDATE contact_methods
      SET config = jsonb_set(config, '{email_address}', to_jsonb($1::text))
      WHERE method_type = 'email'
        AND config->>'email_address' IN ('support@example.com', 'support@skypanelv2.com', 'support@gvps.cloud')
    `, [SUPPORT_EMAIL]);
    console.log(`✅ contact_methods: ${contactResult.rowCount} rows updated`);

    // ─── 5. Update networking config ─────────────────────────────────
    const existingNet = await client.query(`SELECT id FROM networking_config LIMIT 1`);
    if (existingNet.rows.length > 0) {
      await client.query(`
        UPDATE networking_config SET rdns_base_domain = $1::text, updated_at = NOW()
      `, [RDNS_DOMAIN]);
    } else {
      await client.query(`
        INSERT INTO networking_config (rdns_base_domain, created_at, updated_at)
        VALUES ($1::text, NOW(), NOW())
      `, [RDNS_DOMAIN]);
    }
    console.log('✅ networking_config.rdns_base_domain updated');

    await client.query('COMMIT');
    console.log('\n🎉 Branding seed complete!');

  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    }
    console.error('❌ Branding seed failed:', error);
    process.exit(1);
  } finally {
    client?.release();
    await pool.end();
  }
}

seedBranding();
