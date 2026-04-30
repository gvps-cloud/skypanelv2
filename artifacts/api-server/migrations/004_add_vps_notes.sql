-- Migration: Add notes column to vps_instances
-- Date: 2025-11-28
-- Description: Allows users to add personal notes to their VPS instances

-- Add notes column to vps_instances table
ALTER TABLE vps_instances
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment describing the column
COMMENT ON COLUMN vps_instances.notes IS 'User-defined notes for the VPS instance';

-- Create index for potential full-text search on notes
CREATE INDEX IF NOT EXISTS idx_vps_instances_notes_search 
ON vps_instances USING gin(to_tsvector('english', COALESCE(notes, '')));
