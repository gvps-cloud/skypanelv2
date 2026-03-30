#!/usr/bin/env node

/**
 * FAQ Cleanup & Re-seed Script
 *
 * Wipes all FAQ data (items, categories, updates) and re-seeds from the
 * canonical definitions in migrations 001 and 035.
 *
 * Usage:  node scripts/reseed-faq.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

// ── Canonical FAQ data (single source of truth) ──────────────────────────

const CATEGORIES = [
  { name: 'Getting Started', description: 'Getting started with our platform', display_order: 0, is_active: true },
  { name: 'VPS Hosting', description: 'Virtual Private Server questions', display_order: 1, is_active: true },
  { name: 'Billing & Payments', description: 'Payment methods and billing information', display_order: 2, is_active: true },
  { name: 'Support', description: 'How to get help and contact support', display_order: 3, is_active: true },
  { name: 'Technical', description: 'Technical specifications and capabilities', display_order: 4, is_active: true },
];

const FAQ_ITEMS = [
  // Getting Started
  { category: 'Getting Started', question: 'What is this platform?', answer: 'This is a cloud infrastructure platform that provides VPS hosting, dedicated servers, and managed services. It offers flexible, scalable solutions for businesses of all sizes.', display_order: 0 },
  { category: 'Getting Started', question: 'How do I create an account?', answer: `Click the 'Register' button at the top right of the page. Fill in your email, create a password, and verify your email address. Once verified, you can start deploying services immediately.`, display_order: 1 },
  { category: 'Getting Started', question: 'What payment methods do you accept?', answer: `We accept PayPal for wallet top-ups. You can add funds to your wallet using credit/debit cards through PayPal's secure payment gateway.`, display_order: 2 },
  { category: 'Getting Started', question: 'How does billing work?', answer: 'We use an hourly billing model. Resources are billed every hour based on usage. Charges are automatically deducted from your prepaid wallet balance.', display_order: 3 },

  // VPS Hosting
  { category: 'VPS Hosting', question: 'What is a VPS?', answer: 'A Virtual Private Server (VPS) is a virtualized server that provides dedicated resources (CPU, RAM, storage) in a shared hosting environment. It gives you full root access and control over your server.', display_order: 0 },
  { category: 'VPS Hosting', question: 'What operating systems are available?', answer: 'We offer a wide range of Linux distributions including Ubuntu, Debian, CentOS, Fedora, and more. You can also deploy custom images or use marketplace applications.', display_order: 1 },
  { category: 'VPS Hosting', question: 'Can I upgrade or downgrade my VPS?', answer: 'Yes! You can resize your VPS at any time. Upgrades happen quickly, while downgrades may require some downtime for disk reduction.', display_order: 2 },
  { category: 'VPS Hosting', question: 'Do you provide backups?', answer: 'Yes, we offer automated daily backups and manual snapshots. You can enable backups for any VPS instance and restore from any backup point.', display_order: 3 },
  { category: 'VPS Hosting', question: 'How do I check my VPS network usage?', answer: `Each VPS detail page includes a Networking or Egress tab that shows your hourly transfer usage over time. Organization owners and admins can also view the shared egress credit balance and purchase history from the organization settings page.`, display_order: 4 },

  // Billing & Payments
  { category: 'Billing & Payments', question: 'How do I add funds to my wallet?', answer: `Go to the Billing section and click 'Add Funds'. Enter the amount you want to add and complete the payment through PayPal.`, display_order: 0 },
  { category: 'Billing & Payments', question: 'Can I get a refund?', answer: `We offer prorated refunds for unused services. Contact our support team to request a refund, and we'll process it within 5-7 business days.`, display_order: 1 },
  { category: 'Billing & Payments', question: 'What happens if my wallet runs out of funds?', answer: `You'll receive email notifications when your balance is low. If your wallet reaches zero, your services will be suspended until you add more funds.`, display_order: 2 },
  { category: 'Billing & Payments', question: 'Can I set up auto-reload?', answer: `Currently, auto-reload is not available, but it's on our roadmap. You'll need to manually add funds as needed.`, display_order: 3 },
  { category: 'Billing & Payments', question: 'What is egress billing?', answer: 'Egress (outbound network transfer) is the data sent from your VPS to the internet. We use a prepaid credit model: you purchase egress credit packs in advance, and your usage is deducted from your balance on an hourly basis. This keeps your costs predictable and prevents unexpected charges.', display_order: 4 },
  { category: 'Billing & Payments', question: 'What egress credit packs are available?', answer: 'We offer four pack sizes: 100GB ($0.50), 1TB ($5.00), 5TB ($25.00), and 10TB ($50.00). You can purchase packs at any time from the Egress Credits page or your organization settings, and they are added to your balance immediately after payment.', display_order: 5 },
  { category: 'Billing & Payments', question: 'How does hourly egress billing work?', answer: `Every hour, we check the outbound network transfer usage of each VPS in your organization. We calculate the difference (delta) from the previous reading and deduct it from your egress credit balance. You can view detailed usage history on each VPS's detail page.`, display_order: 6 },
  { category: 'Billing & Payments', question: 'What happens if my egress credits run out?', answer: `If your organization's egress credit balance reaches zero, your VPS instances may be automatically suspended to prevent unbilled network usage. You can restore service immediately by purchasing additional egress credit packs. Notifications are sent before your balance runs low.`, display_order: 7 },

  // Support
  { category: 'Support', question: 'How do I contact support?', answer: 'You can create a support ticket from your dashboard. We typically respond within 24 hours for regular tickets and within 4 hours for urgent issues.', display_order: 0 },
  { category: 'Support', question: 'Do you offer live chat support?', answer: 'Currently, support is provided through our ticketing system. Live chat support is planned for future releases.', display_order: 1 },
  { category: 'Support', question: 'What are your support hours?', answer: 'Our support team is available 24/7 for critical issues. Regular tickets are handled during business hours (9 AM - 6 PM EST).', display_order: 2 },

  // Technical
  { category: 'Technical', question: 'What data centers do you use?', answer: 'We partner with leading infrastructure providers to deliver reliable cloud hosting. Servers are available in multiple regions worldwide including North America, Europe, and Asia.', display_order: 0 },
  { category: 'Technical', question: 'Do you provide DDoS protection?', answer: 'Yes, all our services include basic DDoS protection. Advanced DDoS mitigation is available as an add-on.', display_order: 1 },
  { category: 'Technical', question: 'Can I use my own domain?', answer: 'Yes! You can point your domain to your VPS using A/AAAA records. We also support custom reverse DNS.', display_order: 2 },
  { category: 'Technical', question: 'Is there an API available?', answer: 'Yes, we provide a comprehensive RESTful API. You can generate API keys from your account settings and integrate with our platform programmatically.', display_order: 3 },
  { category: 'Technical', question: 'Is inbound network transfer billed?', answer: 'No. Only outbound (egress) network transfer is billed. Inbound traffic to your VPS is free and unlimited.', display_order: 4 },
];

const FAQ_UPDATES = [
  { title: 'New API endpoints for theme controls', description: 'Automate theme presets and dynamic branding from your CI/CD pipeline.', offset_days: 7, display_order: 0 },
  { title: 'Status page redesign', description: 'Real-time health metrics with region-level granularity and historical uptime.', offset_days: 14, display_order: 1 },
  { title: 'Improved billing transparency', description: 'Hourly usage charts and wallet alerts keep your finance team in sync.', offset_days: 21, display_order: 2 },
];

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Wiping FAQ tables...');
    await pool.query('TRUNCATE TABLE faq_items, faq_updates, faq_categories CASCADE');

    console.log('Seeding FAQ categories...');
    const catMap = new Map();
    for (const cat of CATEGORIES) {
      const res = await pool.query(
        `INSERT INTO faq_categories (name, description, display_order, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [cat.name, cat.description, cat.display_order, cat.is_active],
      );
      catMap.set(cat.name, res.rows[0].id);
    }

    console.log(`  → ${catMap.size} categories inserted`);

    console.log('Seeding FAQ items...');
    let itemCount = 0;
    for (const item of FAQ_ITEMS) {
      const categoryId = catMap.get(item.category);
      if (!categoryId) {
        console.warn(`  ⚠ Skipping "${item.question}" — category "${item.category}" not found`);
        continue;
      }
      await pool.query(
        `INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [categoryId, item.question, item.answer, item.display_order],
      );
      itemCount++;
    }
    console.log(`  → ${itemCount} items inserted`);

    console.log('Seeding FAQ updates...');
    for (const upd of FAQ_UPDATES) {
      await pool.query(
        `INSERT INTO faq_updates (title, description, published_date, display_order, is_active)
         VALUES ($1, $2, NOW() - INTERVAL '1 day' * $3, $4, TRUE)`,
        [upd.title, upd.description, upd.offset_days, upd.display_order],
      );
    }
    console.log(`  → ${FAQ_UPDATES.length} updates inserted`);

    // Verify
    const verify = await pool.query(`
      SELECT c.name AS category, COUNT(i.id) AS items
      FROM faq_categories c
      LEFT JOIN faq_items i ON i.category_id = c.id
      GROUP BY c.name
      ORDER BY MIN(c.display_order)
    `);
    console.log('\nVerification:');
    for (const row of verify.rows) {
      console.log(`  ${row.category}: ${row.items} items`);
    }

    const dups = await pool.query(`
      SELECT category_id, question, COUNT(*) AS cnt
      FROM faq_items
      GROUP BY category_id, question
      HAVING COUNT(*) > 1
    `);
    if (dups.rows.length === 0) {
      console.log('  ✅ No duplicates found');
    } else {
      console.log(`  ⚠ ${dups.rows.length} duplicate questions remain!`);
    }

    console.log('\nDone!');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
