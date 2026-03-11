-- Migration 016: Seed default organization roles and predefined permissions

-- Create a table to store predefined permission definitions
CREATE TABLE IF NOT EXISTS predefined_permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT
);

-- Insert predefined permissions
INSERT INTO predefined_permissions (name, category, description) VALUES
('vps_view', 'VPS', 'View VPS instances and their details'),
('vps_create', 'VPS', 'Create new VPS instances'),
('vps_delete', 'VPS', 'Delete VPS instances'),
('vps_manage', 'VPS', 'Manage VPS instances (start, stop, reboot, resize)'),
('ssh_keys_view', 'SSH Keys', 'View organization SSH keys'),
('ssh_keys_manage', 'SSH Keys', 'Create and delete organization SSH keys'),
('tickets_view', 'Support', 'View support tickets'),
('tickets_create', 'Support', 'Create support tickets'),
('tickets_manage', 'Support', 'Manage support tickets (close, reply, escalate)'),
('billing_view', 'Billing', 'View billing information and transaction history'),
('billing_manage', 'Billing', 'Manage billing (add funds, process refunds)'),
('members_manage', 'Team', 'Manage organization members (invite, remove, change roles)'),
('settings_manage', 'Settings', 'Manage organization settings')
ON CONFLICT (name) DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_predefined_permissions_category ON predefined_permissions(category);

-- Add comments
COMMENT ON TABLE predefined_permissions IS 'Stores predefined permission definitions for organization roles';
COMMENT ON COLUMN predefined_permissions.name IS 'Permission identifier (e.g., vps_view, tickets_manage)';
COMMENT ON COLUMN predefined_permissions.category IS 'Permission category (VPS, Support, Billing, Team, Settings)';
COMMENT ON COLUMN predefined_permissions.description IS 'Human-readable description of the permission';

-- Function to seed default roles for a given organization
CREATE OR REPLACE FUNCTION seed_default_roles_for_organization(org_id UUID)
RETURNS VOID AS $$
DECLARE
  owner_role_id UUID;
  admin_role_id UUID;
  vps_manager_role_id UUID;
  support_agent_role_id UUID;
  viewer_role_id UUID;
BEGIN
  -- Owner role: All permissions
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'owner',
    '["vps_view","vps_create","vps_delete","vps_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","billing_manage","members_manage","settings_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO owner_role_id;

  -- Admin role: All except billing_manage, members_manage
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'admin',
    '["vps_view","vps_create","vps_delete","vps_manage","ssh_keys_view","ssh_keys_manage","tickets_view","tickets_create","tickets_manage","billing_view","settings_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO admin_role_id;

  -- VPS Manager role: vps_view, vps_create, vps_manage
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'vps_manager',
    '["vps_view","vps_create","vps_manage","ssh_keys_view","ssh_keys_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO vps_manager_role_id;

  -- Support Agent role: tickets_view, tickets_create, tickets_manage
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'support_agent',
    '["tickets_view","tickets_create","tickets_manage"]'::jsonb,
    false
  )
  ON CONFLICT (organization_id, name) DO NOTHING
  RETURNING id INTO support_agent_role_id;

  -- Viewer role: vps_view, tickets_view, billing_view
  INSERT INTO organization_roles (organization_id, name, permissions, is_custom)
  VALUES (
    org_id,
    'viewer',
    '["vps_view","tickets_view","billing_view"]'::jsonb,
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
      ELSE viewer_role_id
    END
  )
  WHERE om.organization_id = org_id
    AND om.role_id IS NULL;

END;
$$ LANGUAGE plpgsql;

-- Seed default roles for existing organizations
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_default_roles_for_organization(org_record.id);
  END LOOP;
END;
$$;

-- Add trigger to automatically seed roles for new organizations
CREATE OR REPLACE FUNCTION auto_seed_roles_for_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_roles_for_organization(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_seed_roles ON organizations;
CREATE TRIGGER trigger_auto_seed_roles
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION auto_seed_roles_for_new_organization();

COMMENT ON FUNCTION seed_default_roles_for_organization(UUID) IS 'Seeds default roles (owner, admin, vps_manager, support_agent, viewer) for a given organization';
COMMENT ON FUNCTION auto_seed_roles_for_new_organization() IS 'Trigger function that automatically seeds default roles when a new organization is created';
