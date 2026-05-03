-- Migration 065: Add Enhance hosting FAQ and documentation content
-- Uses product-generic copy and points users to live catalog/admin-managed data.

INSERT INTO faq_categories (name, description, display_order, is_active)
VALUES ('Web Hosting', 'Enhance-backed website hosting questions', 5, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
  c.id,
  'What web hosting does the platform offer?',
  'When the Enhance integration is enabled, the platform can sell and manage website hosting from the same dashboard as VPS, billing, support, and organization resources. The available plans and features come from the configured hosting catalog rather than hardcoded marketing values.',
  0,
  TRUE
FROM faq_categories c
WHERE c.name = 'Web Hosting'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i
    WHERE i.category_id = c.id
      AND i.question = 'What web hosting does the platform offer?'
  );

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
  c.id,
  'How is web hosting billed?',
  'Hosting uses a dedicated hosting wallet for subscription charges. You can fund that hosting wallet from your main wallet or through the available payment methods, keeping VPS spend and hosting spend separate.',
  1,
  TRUE
FROM faq_categories c
WHERE c.name = 'Web Hosting'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i
    WHERE i.category_id = c.id
      AND i.question = 'How is web hosting billed?'
  );

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
  c.id,
  'Can I use my own domain for hosting?',
  'Yes. Initial hosting checkout requires your own domain so the platform can create the website subscription against the selected active hosting plan.',
  2,
  TRUE
FROM faq_categories c
WHERE c.name = 'Web Hosting'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i
    WHERE i.category_id = c.id
      AND i.question = 'Can I use my own domain for hosting?'
  );

INSERT INTO documentation_categories (name, description, slug, icon, display_order, is_active)
VALUES (
  'Web Hosting',
  'Enhance hosting plans, checkout, billing, and service management',
  'web-hosting',
  'Globe',
  5,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Enhance Web Hosting Overview', 'enhance-web-hosting',
'<h2>Enhance Web Hosting</h2>
<p>Web hosting is available when the platform Enhance integration is enabled and active hosting plans are configured. The public pricing page, hosting checkout, and dashboard all read from the same hosting catalog so plan names, prices, and features stay aligned with the database.</p>

<h3>What you can manage</h3>
<ul>
  <li><strong>Hosting plans</strong> — View active plans from the configured catalog.</li>
  <li><strong>Websites and domains</strong> — Purchase hosting for your own domain and manage the resulting service from the dashboard.</li>
  <li><strong>Panel access</strong> — Open the hosting control panel for subscriptions that support SSO.</li>
  <li><strong>Organization resources</strong> — Review hosting subscriptions alongside VPS, SSH keys, and support resources for an organization.</li>
</ul>

<h3>Billing model</h3>
<p>Hosting subscriptions use a dedicated hosting wallet. Fund it from your main wallet or supported payment methods, then monthly hosting charges debit the hosting wallet instead of the general VPS wallet.</p>

<h3>Important checkout requirement</h3>
<p>Initial hosting checkout requires your own domain. Staging domains are not offered for first purchase flows.</p>',
'Overview of Enhance-backed web hosting, live plan catalog behavior, and hosting wallet billing.', 0, TRUE
FROM documentation_categories
WHERE slug = 'web-hosting'
ON CONFLICT DO NOTHING;

INSERT INTO documentation_articles (category_id, title, slug, content, summary, display_order, is_active)
SELECT id, 'Ordering Hosting', 'ordering-hosting',
'<h2>Ordering Hosting</h2>
<p>Use the hosting store to select an active hosting plan, enter your domain, and complete purchase from your organization context.</p>

<ol>
  <li>Open <strong>Web Hosting</strong> from the dashboard navigation.</li>
  <li>Choose <strong>Create Hosting</strong> to open the hosting store.</li>
  <li>Select one of the active plans shown from the hosting catalog.</li>
  <li>Enter your own domain and optional region/server-group selection when available.</li>
  <li>Confirm purchase. The platform debits the hosting wallet and creates the hosting subscription.</li>
</ol>

<p>If the hosting wallet does not have enough balance, fund it from Billing before retrying checkout.</p>',
'How to purchase a hosting subscription from the configured active hosting plan catalog.', 1, TRUE
FROM documentation_categories
WHERE slug = 'web-hosting'
ON CONFLICT DO NOTHING;
