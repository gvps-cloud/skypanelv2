-- Migration: Add Egress FAQ Items
-- Description: Adds egress/network transfer related FAQ items to the FAQ page
-- Date: 2025-03-26
-- Uses WHERE NOT EXISTS to avoid duplicates regardless of unique constraint state

-- Add egress FAQ items under "Billing & Payments"
INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'What is egress billing?',
    'Egress (outbound network transfer) is the data sent from your VPS to the internet. We use a prepaid credit model: you purchase egress credit packs in advance, and your usage is deducted from your balance on an hourly basis. This keeps your costs predictable and prevents unexpected charges.',
    4,
    TRUE
FROM faq_categories c
WHERE c.name = 'Billing & Payments'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'What is egress billing?'
  );

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'What egress credit packs are available?',
    'We offer four pack sizes: 100GB ($0.50), 1TB ($5.00), 5TB ($25.00), and 10TB ($50.00). You can purchase packs at any time from the Egress Credits page or your organization settings, and they are added to your balance immediately after payment.',
    5,
    TRUE
FROM faq_categories c
WHERE c.name = 'Billing & Payments'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'What egress credit packs are available?'
  );

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'How does hourly egress billing work?',
    'Every hour, we check the outbound network transfer usage of each VPS in your organization. We calculate the difference (delta) from the previous reading and deduct it from your egress credit balance. You can view detailed usage history on each VPS''s detail page.',
    6,
    TRUE
FROM faq_categories c
WHERE c.name = 'Billing & Payments'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'How does hourly egress billing work?'
  );

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'What happens if my egress credits run out?',
    'If your organization''s egress credit balance reaches zero, your VPS instances may be automatically suspended to prevent unbilled network usage. You can restore service immediately by purchasing additional egress credit packs. Notifications are sent before your balance runs low.',
    7,
    TRUE
FROM faq_categories c
WHERE c.name = 'Billing & Payments'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'What happens if my egress credits run out?'
  );

-- Add egress FAQ items under "VPS Hosting"
INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'How do I check my VPS network usage?',
    'Each VPS detail page includes a Networking or Egress tab that shows your hourly transfer usage over time. Organization owners and admins can also view the shared egress credit balance and purchase history from the organization settings page.',
    4,
    TRUE
FROM faq_categories c
WHERE c.name = 'VPS Hosting'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'How do I check my VPS network usage?'
  );

-- Add egress FAQ items under "Technical"
INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    c.id,
    'Is inbound network transfer billed?',
    'No. Only outbound (egress) network transfer is billed. Inbound traffic to your VPS is free and unlimited.',
    4,
    TRUE
FROM faq_categories c
WHERE c.name = 'Technical'
  AND NOT EXISTS (
    SELECT 1 FROM faq_items i WHERE i.category_id = c.id AND i.question = 'Is inbound network transfer billed?'
  );
