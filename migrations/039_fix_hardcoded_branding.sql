-- Migration 039: Fix hardcoded branding in seeded data
-- Description: Replaces hardcoded GVPS.Cloud/SkyPanelV2 references with platform_setting-driven values
--              so the panel respects .env configuration for branding.

-- ============================================================================
-- 1. Add branding platform_settings entries
-- ============================================================================

INSERT INTO platform_settings (key, value)
VALUES ('branding', jsonb_build_object(
  'company_name', 'SkyPanelV2',
  'support_email', 'support@example.com',
  'rdns_base_domain', 'ip.rev.example.com'
))
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. Fix documentation articles — replace GVPS.Cloud with platform-agnostic text
-- ============================================================================

UPDATE documentation_articles
SET title   = REPLACE(title,   'GVPS.Cloud', 'the platform'),
    content = REPLACE(content, 'GVPS.Cloud', 'the platform'),
    summary = REPLACE(summary, 'GVPS.Cloud', 'the platform')
WHERE title   LIKE '%GVPS.Cloud%'
   OR content LIKE '%GVPS.Cloud%'
   OR summary LIKE '%GVPS.Cloud%';

-- Fix specific article titles that should be friendlier
-- NOTE: This targets legacy databases that may have the old slug 'welcome-to-gvps-cloud'.
-- Fresh installs seed with 'welcome-to-platform' so this is a no-op on new databases.
UPDATE documentation_articles
SET title   = 'Welcome to the Platform',
    slug    = 'welcome-to-platform',
    summary = 'Get up and running in minutes.'
WHERE slug = 'welcome-to-gvps-cloud';

UPDATE documentation_articles
SET summary = 'How to authenticate with the API.'
WHERE slug LIKE '%api-authentication%' AND summary LIKE '%GVPS.Cloud%';

-- Fix comprehensive doc's welcome article
UPDATE documentation_articles
SET title   = 'Welcome to the Platform',
    slug    = 'welcome',
    content = REPLACE(
      REPLACE(
        content,
        '<h2>Welcome to GVPS.Cloud</h2>',
        '<h2>Welcome</h2>'
      ),
      '<p>GVPS.Cloud is a modern cloud hosting platform',
      '<p>This is a modern cloud hosting platform'
    ),
    summary = 'Getting started with the platform.'
WHERE slug = 'welcome' AND (title LIKE '%GVPS%' OR content LIKE '%GVPS.Cloud%');

-- ============================================================================
-- 3. Fix FAQ items — replace SkyPanelV2 brand name
-- ============================================================================

-- Legacy upgrade fix: old databases may have question = 'What is SkyPanelV2?'
-- Fresh installs seed with 'What is this platform?' so this is a no-op on new databases.
UPDATE faq_items
SET question = 'What is this platform?',
    answer   = 'This is a cloud infrastructure platform that provides VPS hosting, dedicated servers, and managed services. It offers flexible, scalable solutions for businesses of all sizes.'
WHERE question = 'What is SkyPanelV2?';

-- ============================================================================
-- 4. Fix contact methods — support email
-- ============================================================================

UPDATE contact_methods
SET config = jsonb_set(config, '{email_address}', '"support@example.com"')
WHERE method_type = 'email'
  AND config->>'email_address' = 'support@skypanelv2.com';

-- ============================================================================
-- 5. Fix networking config — rdns_base_domain
-- ============================================================================

-- Only update if it's still the hardcoded default
UPDATE networking_config
SET rdns_base_domain = 'ip.rev.example.com'
WHERE rdns_base_domain = 'ip.rev.gvps.cloud';

-- ============================================================================
-- 6. Fix rdns_base_domain column default
-- ============================================================================

ALTER TABLE networking_config
  ALTER COLUMN rdns_base_domain SET DEFAULT 'ip.rev.example.com';

-- ============================================================================
-- 7. Remove hardcoded plans & regions article
--     Plan details are managed dynamically — no static doc needed
-- ============================================================================

DELETE FROM documentation_articles WHERE slug = 'plans-regions';
