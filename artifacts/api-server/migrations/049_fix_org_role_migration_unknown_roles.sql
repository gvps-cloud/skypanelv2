/**
 * Migration: 049_fix_org_role_migration_unknown_roles
 *
 * Fixes silent role downgrades from migration 015 where unknown legacy roles
 * (anything other than 'owner' or 'admin') were silently mapped to viewer_role_id.
 * This migration logs unknown roles and provides a more explicit handling strategy.
 *
 * Note: This migration cannot fully reverse the damage of migration 015 for already-
 * migrated data, but it adds logging and improves the migration for future runs.
 */

DO $$
DECLARE
  org_record RECORD;
  member_record RECORD;
  unknown_role_count INTEGER := 0;
BEGIN
  -- Log a warning that this fix migration is being applied
  RAISE NOTICE 'Running migration 049: Fix organization role migration silent downgrades';

  -- Create a table to track unknown roles for auditing
  CREATE TABLE IF NOT EXISTS _unknown_role_audit (
    id SERIAL PRIMARY KEY,
    organization_id UUID,
    user_id UUID,
    legacy_role VARCHAR(100),
    migrated_to VARCHAR(50),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Find all organization_members that were migrated with unknown roles
  -- These would have been silently set to viewer
  FOR member_record IN
    SELECT om.organization_id, om.user_id, om.role, r.name as role_name
    FROM organization_members om
    JOIN organization_roles r ON om.role_id = r.id
    WHERE om.role IS NOT NULL
      AND om.role NOT IN ('owner', 'admin')
      AND r.name = 'viewer'
  LOOP
    unknown_role_count := unknown_role_count + 1;

    -- Log to audit table
    INSERT INTO _unknown_role_audit (organization_id, user_id, legacy_role, migrated_to)
    VALUES (member_record.organization_id, member_record.user_id, member_record.role, 'viewer');
  END LOOP;

  RAISE NOTICE 'Detected % organization_members with unknown legacy roles migrated to viewer',
    unknown_role_count;

  -- Add a check constraint to prevent future silent downgrades
  -- This ensures that if a new role value is added to the legacy column,
  -- it will be caught rather than silently converted
  ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS chk_known_legacy_role;

  ALTER TABLE organization_members
    ADD CONSTRAINT chk_known_legacy_role
    CHECK (role IS NULL OR role IN ('owner', 'admin', 'member', 'superadmin', 'moderator', 'vps_manager', 'support'));

  RAISE NOTICE 'Added check constraint to prevent silent role downgrades in future migrations';

END;
$$ LANGUAGE plpgsql;

-- Add comment to help future developers understand the role migration
COMMENT ON TABLE organization_members IS 'Legacy role column (role) maps to organization_roles.id via role_id. Only owner/admin are auto-migrated; other roles should be explicitly mapped.';
