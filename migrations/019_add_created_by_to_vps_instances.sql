-- Migration: Add created_by column to vps_instances
-- This column tracks which user created the VPS instance

-- Add created_by column if it doesn't exist
ALTER TABLE vps_instances
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vps_instances_created_by ON vps_instances(created_by);

-- Add comment for documentation
COMMENT ON COLUMN vps_instances.created_by IS 'User who created this VPS instance';
