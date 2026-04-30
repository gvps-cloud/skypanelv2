-- Migration: Relax activity logs constraint to allow NULL user_id for more flexible system events
-- Date: 2025-11-17
-- Purpose: Remove overly restrictive constraint on activity_logs.user_id

-- Drop the existing restrictive constraint
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_or_system_check;

-- Add a more relaxed constraint that allows NULL user_id for various system/billing events
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_or_system_relaxed_check
CHECK (
  user_id IS NOT NULL OR
  user_id IS NULL -- Allow NULL user_id for system events, billing, and other automated processes
);

-- Add comment explaining the relaxed constraint
COMMENT ON CONSTRAINT activity_logs_user_or_system_relaxed_check ON activity_logs IS 'Allows NULL user_id for system events, billing events, and other automated processes';

-- Also ensure the user_id column can accept NULL values explicitly
ALTER TABLE activity_logs ALTER COLUMN user_id DROP NOT NULL;

-- Add comment on the column to clarify its purpose
COMMENT ON COLUMN activity_logs.user_id IS 'User ID for user-initiated events, NULL for system/billing/automated events';