-- Migration 056: Add member role, hosting_manager role, and hosting/egress permissions
-- This migration performs six distinct operations rather than re-running the seed function,
-- because seed_default_roles_for_organization() uses ON CONFLICT DO NOTHING.

-- ============================================================
-- Step 1: Seed new permissions into predefined_permissions
-- ============================================================
INSERT INTO predefined_permissions (name, category, description) VALUES
  ('hosting_view', 'Hosting', 'View hosting subscriptions and details'),
  ('hosting_manage', 'Hosting', 'Purchase, cancel, and manage hosting subscriptions'),
  ('egress_view', 'Egress', 'View egress credit balance and usage'),
  ('egress_manage', 'Egress', 'Purchase and manage egress credits')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Step 2: Append new permissions to existing predefined roles via UPDATE
-- ============================================================

-- owner: add hosting_view, hosting_manage (egress_view, egress_manage already present from migration 032)
UPDATE organization_roles
SET permissions = permissions || '["hosting_view","hosting_manage"]'::jsonb
WHERE name = 'owner' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- admin: add hosting_view, hosting_manage (egress_view already present from migration 032)
UPDATE organization_roles
SET permissions = permissions || '["hosting_view","hosting_manage"]'::jsonb
WHERE name = 'admin' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- vps_manager: NO hosting permissions (VPS and hosting are fully decoupled)
-- support_agent: add hosting_view
UPDATE organization_roles
SET permissions = permissions || '["hosting_view"]'::jsonb
WHERE name = 'support_agent' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- viewer: add hosting_view
UPDATE organization_roles
SET permissions = permissions || '["hosting_view"]'::jsonb
WHERE name = 'viewer' AND is_custom = false
  AND NOT (permissions ? 'hosting_view');

-- ============================================================
-- Step 3: Insert the new member role for all orgs
-- ============================================================
INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
SELECT id, 'member',
  '["vps_view","vps_create","vps_manage","notes_view","notes_manage","ssh_keys_view","tickets_view","tickets_create","billing_view","egress_view","hosting_view","hosting_manage"]'::jsonb,
  false
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

-- ============================================================
-- Step 4: Insert the new hosting_manager role for all orgs
-- ============================================================
INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
SELECT id, 'hosting_manager',
  '["hosting_view","hosting_manage","billing_view","notes_view","ssh_keys_view","tickets_view","tickets_create","egress_view"]'::jsonb,
  false
FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

-- ============================================================
-- Step 5: Backfill legacy member rows to the new role
-- ============================================================
-- Backfill legacy member -> new member role
UPDATE organization_members om
SET role_id = mr.id
FROM organization_roles mr
WHERE mr.organization_id = om.organization_id
  AND mr.name = 'member'
  AND mr.is_custom = false
  AND om.role_id IS NULL
  AND om.role = 'member';

-- Backfill other null-role rows -> viewer (preserve existing behavior)
UPDATE organization_members om
SET role_id = vr.id
FROM organization_roles vr
WHERE vr.organization_id = om.organization_id
  AND vr.name = 'viewer'
  AND vr.is_custom = false
  AND om.role_id IS NULL
  AND (om.role IS NULL OR om.role NOT IN ('owner', 'admin', 'member'));

-- ============================================================
-- Step 6: Update the seed_default_roles_for_organization() function body
-- ============================================================
CREATE OR REPLACE FUNCTION seed_default_roles_for_organization(org_id UUID)
RETURNS VOID AS $$
DECLARE
  owner_role_id UUID;
  admin_role_id UUID;
  member_role_id UUID;
  vps_manager_role_id UUID;
  hosting_manager_role_id UUID;
  support_agent_role_id UUID;
  viewer_role_id UUID;
BEGIN
  -- Owner role: all permissions
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'owner',
    '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","egress_view","egress_manage","members_manage","settings_manage","hosting_view","hosting_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO owner_role_id;

  -- Admin role: all except billing_manage, members_manage, egress_manage
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'admin',
    '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","egress_view","settings_manage","hosting_view","hosting_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO admin_role_id;

  -- Member role: general operator
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'member',
    '["vps_view","vps_create","vps_manage","notes_view","notes_manage","ssh_keys_view","tickets_view","tickets_create","billing_view","egress_view","hosting_view","hosting_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO member_role_id;

  -- VPS Manager role: VPS-only, no hosting
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'vps_manager',
    '["vps_view","vps_create","vps_manage","notes_view","ssh_keys_view","ssh_keys_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO vps_manager_role_id;

  -- Hosting Manager role: hosting-only, no VPS
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'hosting_manager',
    '["hosting_view","hosting_manage","billing_view","notes_view","ssh_keys_view","tickets_view","tickets_create","egress_view"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO hosting_manager_role_id;

  -- Support Agent role
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'support_agent',
    '["notes_view","tickets_view","tickets_create","tickets_manage","hosting_view"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO support_agent_role_id;

  -- Viewer role
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'viewer',
    '["vps_view","notes_view","tickets_view","hosting_view"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO viewer_role_id;

  -- Update existing organization_members to use new roles based on legacy role column
  UPDATE organization_members om
  SET role_id = (
    CASE om.role
      WHEN 'owner' THEN owner_role_id
      WHEN 'admin' THEN admin_role_id
      WHEN 'member' THEN member_role_id
      ELSE viewer_role_id
    END
  )
  WHERE om.organization_id = org_id
    AND om.role_id IS NULL;

END;
$$ LANGUAGE plpgsql;

-- Update the auto-seed trigger function to use the updated seed function
CREATE OR REPLACE FUNCTION auto_seed_roles_for_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_roles_for_organization(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_default_roles_for_organization(UUID) IS 'Seeds default roles (owner, admin, member, vps_manager, hosting_manager, support_agent, viewer) for a given organization';
