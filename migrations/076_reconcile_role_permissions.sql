-- Migration 076: Reconcile predefined organization roles and permissions
-- Aligns seeded/default roles with billing, egress, and Enhance hosting access.

-- Keep permission definitions current for role builders and admin tooling.
INSERT INTO predefined_permissions (name, category, description) VALUES
  ('vps_view', 'VPS', 'View VPS instances and their details'),
  ('vps_create', 'VPS', 'Create new VPS instances'),
  ('vps_delete', 'VPS', 'Delete VPS instances'),
  ('vps_manage', 'VPS', 'Manage VPS instances (start, stop, reboot, resize)'),
  ('notes_view', 'Notes', 'View organization notes'),
  ('notes_manage', 'Notes', 'Create, update, and delete organization notes'),
  ('ssh_keys_view', 'SSH Keys', 'View organization SSH keys'),
  ('ssh_keys_manage', 'SSH Keys', 'Create and delete organization SSH keys'),
  ('tickets_view', 'Support', 'View support tickets'),
  ('tickets_create', 'Support', 'Create support tickets'),
  ('tickets_manage', 'Support', 'Manage support tickets (close, reply, escalate)'),
  ('billing_view', 'Billing', 'View billing information and transaction history'),
  ('billing_manage', 'Billing', 'Manage billing, wallets, payments, invoices, and refunds'),
  ('egress_view', 'Egress', 'View egress credit balance and usage'),
  ('egress_manage', 'Egress', 'Purchase, refund, and manage egress credits'),
  ('members_manage', 'Team', 'Manage organization members (invite, remove, change roles)'),
  ('settings_manage', 'Settings', 'Manage organization settings'),
  ('hosting_view', 'Hosting', 'View hosting subscriptions and details'),
  ('hosting_manage', 'Hosting', 'Purchase, cancel, and manage hosting subscriptions')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Reconcile existing predefined roles for every organization.
WITH role_defs(name, permissions) AS (
  VALUES
    (
      'owner',
      '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","egress_view","egress_manage","members_manage","settings_manage","hosting_view","hosting_manage"]'::jsonb
    ),
    (
      'admin',
      '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","egress_view","egress_manage","members_manage","settings_manage","hosting_view","hosting_manage"]'::jsonb
    ),
    (
      'billing_manager',
      '["billing_view","billing_manage","egress_view","egress_manage","hosting_view","notes_view","tickets_view","tickets_create"]'::jsonb
    ),
    (
      'member',
      '["vps_view","vps_create","vps_manage","notes_view","notes_manage","ssh_keys_view","tickets_view","tickets_create","billing_view","egress_view","hosting_view","hosting_manage"]'::jsonb
    ),
    (
      'vps_manager',
      '["vps_view","vps_create","vps_manage","notes_view","ssh_keys_view","ssh_keys_manage"]'::jsonb
    ),
    (
      'hosting_manager',
      '["hosting_view","hosting_manage","billing_view","notes_view","ssh_keys_view","tickets_view","tickets_create","egress_view"]'::jsonb
    ),
    (
      'support_agent',
      '["notes_view","tickets_view","tickets_create","tickets_manage","hosting_view"]'::jsonb
    ),
    (
      'viewer',
      '["vps_view","notes_view","tickets_view","hosting_view"]'::jsonb
    )
)
INSERT INTO organization_roles (organization_id, name, permissions, is_custom, created_at, updated_at)
SELECT org.id, role_defs.name, role_defs.permissions, false, NOW(), NOW()
FROM organizations org
CROSS JOIN role_defs
ON CONFLICT (organization_id, name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  is_custom = false,
  updated_at = NOW()
WHERE organization_roles.is_custom = false;

-- Backfill legacy rows that still have no role_id.
UPDATE organization_members om
SET role_id = r.id
FROM organization_roles r
WHERE om.role_id IS NULL
  AND r.organization_id = om.organization_id
  AND r.is_custom = false
  AND r.name = om.role
  AND om.role IN ('owner', 'admin', 'member');

UPDATE organization_members om
SET role_id = r.id
FROM organization_roles r
WHERE om.role_id IS NULL
  AND r.organization_id = om.organization_id
  AND r.is_custom = false
  AND r.name = 'viewer';

-- Update the default seed function so future organizations receive the same role set.
CREATE OR REPLACE FUNCTION seed_default_roles_for_organization(org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES
    (
      org_id,
      'owner',
      '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","egress_view","egress_manage","members_manage","settings_manage","hosting_view","hosting_manage"]'::jsonb,
      false
    ),
    (
      org_id,
      'admin',
      '["vps_view","vps_create","vps_delete","vps_manage","notes_view","notes_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","egress_view","egress_manage","members_manage","settings_manage","hosting_view","hosting_manage"]'::jsonb,
      false
    ),
    (
      org_id,
      'billing_manager',
      '["billing_view","billing_manage","egress_view","egress_manage","hosting_view","notes_view","tickets_view","tickets_create"]'::jsonb,
      false
    ),
    (
      org_id,
      'member',
      '["vps_view","vps_create","vps_manage","notes_view","notes_manage","ssh_keys_view","tickets_view","tickets_create","billing_view","egress_view","hosting_view","hosting_manage"]'::jsonb,
      false
    ),
    (
      org_id,
      'vps_manager',
      '["vps_view","vps_create","vps_manage","notes_view","ssh_keys_view","ssh_keys_manage"]'::jsonb,
      false
    ),
    (
      org_id,
      'hosting_manager',
      '["hosting_view","hosting_manage","billing_view","notes_view","ssh_keys_view","tickets_view","tickets_create","egress_view"]'::jsonb,
      false
    ),
    (
      org_id,
      'support_agent',
      '["notes_view","tickets_view","tickets_create","tickets_manage","hosting_view"]'::jsonb,
      false
    ),
    (
      org_id,
      'viewer',
      '["vps_view","notes_view","tickets_view","hosting_view"]'::jsonb,
      false
    )
  ON CONFLICT (organization_id, name) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    is_custom = false,
    updated_at = NOW()
  WHERE organization_roles.is_custom = false;

  UPDATE organization_members om
  SET role_id = r.id
  FROM organization_roles r
  WHERE om.organization_id = org_id
    AND om.role_id IS NULL
    AND r.organization_id = org_id
    AND r.is_custom = false
    AND r.name = om.role
    AND om.role IN ('owner', 'admin', 'member');

  UPDATE organization_members om
  SET role_id = r.id
  FROM organization_roles r
  WHERE om.organization_id = org_id
    AND om.role_id IS NULL
    AND r.organization_id = org_id
    AND r.is_custom = false
    AND r.name = 'viewer';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_seed_roles_for_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_roles_for_organization(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_default_roles_for_organization(UUID) IS 'Seeds default roles (owner, admin, billing_manager, member, vps_manager, hosting_manager, support_agent, viewer) for a given organization';
