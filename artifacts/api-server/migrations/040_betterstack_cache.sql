-- Migration 040: Create Better Stack cache table
-- Description: Stores cached responses from the Better Stack / Better Uptime API
--              to reduce external API calls and persist across server restarts.

CREATE TABLE IF NOT EXISTS betterstack_cache (
  key VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_betterstack_cache_expires ON betterstack_cache (expires_at);

COMMENT ON TABLE betterstack_cache IS 'Cache for Better Stack (Better Uptime) API responses. Used by the public /status page.';
COMMENT ON COLUMN betterstack_cache.key IS 'Cache key: monitors, incidents_active, incidents_history, status_reports';
COMMENT ON COLUMN betterstack_cache.data IS 'JSON response data from Better Stack API';
COMMENT ON COLUMN betterstack_cache.fetched_at IS 'When the data was last fetched from Better Stack';
COMMENT ON COLUMN betterstack_cache.expires_at IS 'When the cached data should be considered stale';
