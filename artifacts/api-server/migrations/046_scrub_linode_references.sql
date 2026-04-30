-- Migration 046: Scrub vendor references from documentation and FAQ content
-- Description: Replaces "Linode" with vendor-neutral language in user-facing
--              documentation_articles and faq_items content. Idempotent — only
--              touches rows that still contain vendor references.
-- Safety net: Seeded articles (migrations 036-038) already lack "Linode" refs;
--             this catches any admin-edited content created through the UI.

-- Documentation articles — title and content columns
UPDATE documentation_articles
SET title = REPLACE(title, 'Linode', 'upstream provider')
WHERE title ILIKE '%linode%';

UPDATE documentation_articles
SET content = REPLACE(content, 'Linode', 'upstream provider')
WHERE content ILIKE '%linode%';

UPDATE documentation_articles
SET summary = REPLACE(summary, 'Linode', 'upstream provider')
WHERE summary ILIKE '%linode%';

-- FAQ items — question and answer columns
UPDATE faq_items
SET question = REPLACE(question, 'Linode', 'upstream provider')
WHERE question ILIKE '%linode%';

UPDATE faq_items
SET answer = REPLACE(answer, 'Linode', 'upstream provider')
WHERE answer ILIKE '%linode%';
