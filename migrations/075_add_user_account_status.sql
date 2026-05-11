-- Migration 075: Add user account status
-- Adds status, status_reason, and status_updated_at columns to the users table.
-- Status can be: active, inactive, or suspended.
-- Admin users (role = 'admin') are protected from suspension at the application level.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE;

-- Backfill existing users to active
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status) WHERE status != 'active';
