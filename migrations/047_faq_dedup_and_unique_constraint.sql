-- Migration 047: FAQ deduplication, unique constraint, and white-label scrub
-- Description:
--   1. Removes duplicate FAQ items that accumulated from repeated migration runs
--   2. Adds a unique constraint on (category_id, question) to prevent future duplicates
--   3. Scrubs exposed provider names (Akamai, ReliableSite) from FAQ content

-- Step 1: Deduplicate — keep the earliest row per (category_id, question), delete the rest
DELETE FROM faq_items a
  USING faq_items b
  WHERE a.id > b.id
    AND a.category_id = b.category_id
    AND a.question = b.question;

-- Step 2: Add unique constraint (idempotent — skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'faq_items_category_question_unique'
      AND conrelid = 'faq_items'::regclass
  ) THEN
    ALTER TABLE faq_items
      ADD CONSTRAINT faq_items_category_question_unique
      UNIQUE (category_id, question);
  END IF;
END $$;

-- Step 3: Scrub provider names from FAQ content for white-label compliance
UPDATE faq_items
SET answer = regexp_replace(
  regexp_replace(answer, 'Linode/Akamai', 'our upstream infrastructure partners', 'g'),
  'ReliableSite', 'our data center partners', 'g'
)
WHERE answer ILIKE '%Akamai%' OR answer ILIKE '%ReliableSite%';
