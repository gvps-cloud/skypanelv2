-- Migration 077: Add os_disk_id column to vps_instances
-- Stores the user-selected OS disk provider ID for password reset.
-- Overrides the config-derived boot disk when set.

ALTER TABLE vps_instances
  ADD COLUMN IF NOT EXISTS os_disk_id INTEGER;

COMMENT ON COLUMN vps_instances.os_disk_id IS 'User-selected OS disk provider ID for password reset; overrides config-derived boot disk';