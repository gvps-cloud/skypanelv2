-- Migration 011: Create organization_roles table

-- Create organization_roles table
CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_org_role_name UNIQUE(organization_id, name)
);

-- Add indexes for organization_roles
CREATE INDEX IF NOT EXISTS idx_organization_roles_org_id ON organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_roles_is_custom ON organization_roles(is_custom);

-- Add trigger for updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organization_roles_updated_at'
  ) THEN
    CREATE TRIGGER update_organization_roles_updated_at
    BEFORE UPDATE ON organization_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Add comments
COMMENT ON TABLE organization_roles IS 'Stores organization-specific roles with granular permissions';
COMMENT ON COLUMN organization_roles.organization_id IS 'Foreign key to organizations table';
COMMENT ON COLUMN organization_roles.name IS 'Role name (e.g., owner, admin, vps_manager)';
COMMENT ON COLUMN organization_roles.permissions IS 'JSON array of permission strings (e.g., ["vps_view", "vps_create"])';
COMMENT ON COLUMN organization_roles.is_custom IS 'True for user-created custom roles, false for predefined system roles';
