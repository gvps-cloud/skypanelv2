-- Migration: Add active_organization_id column to users table
-- This column stores the user's currently selected organization for context persistence

-- Add active_organization_id column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_active_organization_id ON users(active_organization_id);

-- Add comment for documentation
COMMENT ON COLUMN users.active_organization_id IS 'Currently active organization for this user, persists across sessions';
