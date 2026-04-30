-- Migration: 050_create_announcements
-- Adds announcements table for site-wide broadcast messages

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'warning', 'success', 'maintenance', 'urgent')),
  target_audience TEXT NOT NULL DEFAULT 'all'
    CHECK (target_audience IN ('all', 'authenticated', 'guests', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_dismissable BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for fast public endpoint lookup of currently-active announcements
CREATE INDEX idx_announcements_active_lookup
  ON announcements (is_active, target_audience, priority DESC)
  WHERE is_active = true;

-- Index for admin listing (sorted by recency)
CREATE INDEX idx_announcements_created_at
  ON announcements (created_at DESC);

COMMENT ON TABLE announcements IS 'Site-wide broadcast announcements with audience targeting and scheduling';
