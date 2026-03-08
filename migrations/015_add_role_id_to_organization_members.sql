-- Migration 015: Add role_id column to organization_members table

-- Add role_id column to organization_members table
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL;

-- Add index for role_id
CREATE INDEX IF NOT EXISTS idx_organization_members_role_id ON organization_members(role_id);

-- Add comment for role_id
COMMENT ON COLUMN organization_members.role_id IS 'Foreign key to organization_roles table (nullable for backward compatibility with legacy role column)';

-- Note: The existing 'role' column (owner/admin/member) remains for backward compatibility.
-- New code should use role_id for granular permissions, while old code can continue using the role column.
