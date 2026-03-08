-- Migration 014: Create activity_feed table

-- Create activity_feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for activity_feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_org_id ON activity_feed(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_is_read ON activity_feed(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);

-- Add comments
COMMENT ON TABLE activity_feed IS 'Stores user notifications and activity feed entries with read status tracking';
COMMENT ON COLUMN activity_feed.user_id IS 'Foreign key to users table - notification recipient';
COMMENT ON COLUMN activity_feed.organization_id IS 'Foreign key to organizations table (nullable for system-wide notifications)';
COMMENT ON COLUMN activity_feed.type IS 'Activity type (e.g., invitation_created, invitation_accepted, vps_created)';
COMMENT ON COLUMN activity_feed.title IS 'Notification title displayed to user';
COMMENT ON COLUMN activity_feed.description IS 'Detailed description of the activity';
COMMENT ON COLUMN activity_feed.data IS 'JSON object containing additional context (e.g., invitation token, user names)';
COMMENT ON COLUMN activity_feed.is_read IS 'Whether the user has read this notification';
