-- Migration 040: Remove duplicate API Authentication article
-- Description: Migration 037 seeded 'API Authentication' with slug 'api-authentication'
--              and migration 038 seeded another with slug 'authentication'.
--              This removes the duplicate from 037, keeping the more comprehensive 038 version.

DELETE FROM documentation_articles
WHERE slug = 'api-authentication'
  AND title = 'API Authentication';
