-- Migration 043: Remove duplicate documentation articles
-- Description: Cleans up overlapping articles seeded by migrations 037 and 038.
--              Migration 037 introduced shorter starter articles; migration 038
--              seeded comprehensive versions with different slugs. Both co-exist
--              because ON CONFLICT DO NOTHING only prevents slug-per-category
--              collisions, but these duplicates have different slugs within the
--              same category.
--
-- Articles removed:
--   1. 'managing-ssh-keys'       → superseded by 'ssh-keys' (038, more detailed)
--   2. 'organization-management' → superseded by 'organizations' (038, more detailed)
--   3. 'welcome-to-platform'     → superseded by 'welcome' (038, more detailed)
--   4. 'api-endpoints-overview'  → removed entirely; the API Reference category
--                                  is now rendered by the ApiReference component
--   5. 'reverse-dns'             → superseded by 'rdns-configuration' (042,
--                                  comprehensive guide)

-- Only delete the old slug if the new (comprehensive) version already exists,
-- so this is a no-op on databases that only ran one of the two seed migrations.

-- 1. SSH Keys: keep 'ssh-keys', remove 'managing-ssh-keys'
DELETE FROM documentation_articles
WHERE slug = 'managing-ssh-keys'
  AND EXISTS (SELECT 1 FROM documentation_articles WHERE slug = 'ssh-keys');

-- 2. Organizations: keep 'organizations', remove 'organization-management'
DELETE FROM documentation_articles
WHERE slug = 'organization-management'
  AND EXISTS (SELECT 1 FROM documentation_articles WHERE slug = 'organizations');

-- 3. Welcome: keep 'welcome', remove 'welcome-to-platform'
DELETE FROM documentation_articles
WHERE slug = 'welcome-to-platform'
  AND EXISTS (SELECT 1 FROM documentation_articles WHERE slug = 'welcome');

-- 4. API Endpoints Overview: remove entirely (ApiReference component handles this)
DELETE FROM documentation_articles
WHERE slug = 'api-endpoints-overview';

-- 5. Reverse DNS: keep 'rdns-configuration', remove 'reverse-dns'
DELETE FROM documentation_articles
WHERE slug = 'reverse-dns'
  AND EXISTS (SELECT 1 FROM documentation_articles WHERE slug = 'rdns-configuration');
