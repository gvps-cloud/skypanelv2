-- Migration 045: Replace hardcoded URLs in documentation with {{PLATFORM_URL}} placeholder
-- Description: The frontend (Documentation.tsx) now replaces {{PLATFORM_URL}} with
--              window.location.origin at render time, so docs always show the actual
--              platform URL instead of a generic placeholder like "your-domain.com".

-- Replace all "https://your-domain.com" references with the template placeholder
UPDATE documentation_articles
SET content = REPLACE(content, 'https://your-domain.com', '{{PLATFORM_URL}}')
WHERE content LIKE '%https://your-domain.com%';

-- Replace any "https://api.example.com" references (if present from earlier seeds)
UPDATE documentation_articles
SET content = REPLACE(content, 'https://api.example.com', '{{PLATFORM_URL}}')
WHERE content LIKE '%https://api.example.com%';

-- Catch any remaining http:// variant
UPDATE documentation_articles
SET content = REPLACE(content, 'http://your-domain.com', '{{PLATFORM_URL}}')
WHERE content LIKE '%http://your-domain.com%';
