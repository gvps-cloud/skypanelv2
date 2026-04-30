-- Add default theme wrapper toggle for email templates
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS use_default_theme BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill (safety for older rows / manual schema edits)
UPDATE email_templates
SET use_default_theme = TRUE
WHERE use_default_theme IS NULL;

