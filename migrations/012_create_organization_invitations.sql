-- Migration 012: Create organization_invitations table

-- Create organization_invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for organization_invitations
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invited_email ON organization_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_role_id ON organization_invitations(role_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_inviter_id ON organization_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at);

-- Add trigger for updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_organization_invitations_updated_at'
  ) THEN
    CREATE TRIGGER update_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Add comments
COMMENT ON TABLE organization_invitations IS 'Stores pending and processed organization invitations with tokens for email-based acceptance';
COMMENT ON COLUMN organization_invitations.organization_id IS 'Foreign key to organizations table';
COMMENT ON COLUMN organization_invitations.invited_email IS 'Email address of the invited user';
COMMENT ON COLUMN organization_invitations.role_id IS 'Foreign key to organization_roles table (nullable for backward compatibility)';
COMMENT ON COLUMN organization_invitations.inviter_id IS 'Foreign key to users table - who sent the invitation';
COMMENT ON COLUMN organization_invitations.token IS 'Unique token for invitation acceptance via email link';
COMMENT ON COLUMN organization_invitations.status IS 'Invitation status: pending, accepted, declined, cancelled, expired';
COMMENT ON COLUMN organization_invitations.expires_at IS 'Expiration time for the invitation (typically 7 days)';
