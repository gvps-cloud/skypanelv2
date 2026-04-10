CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('personal', 'organization')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notes_scope_owner_check CHECK (
    (scope = 'personal' AND organization_id IS NULL AND owner_user_id IS NOT NULL) OR
    (scope = 'organization' AND organization_id IS NOT NULL AND owner_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notes_owner_user_id
  ON notes(owner_user_id, updated_at DESC)
  WHERE scope = 'personal';

CREATE INDEX IF NOT EXISTS idx_notes_organization_id
  ON notes(organization_id, updated_at DESC)
  WHERE scope = 'organization';

CREATE INDEX IF NOT EXISTS idx_notes_created_by_user_id
  ON notes(created_by_user_id);

UPDATE organization_roles
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["notes_view"]'::jsonb,
    updated_at = NOW()
WHERE name IN ('owner', 'admin', 'viewer', 'vps_manager', 'support_agent')
  AND NOT COALESCE(permissions, '[]'::jsonb) ? 'notes_view';

UPDATE organization_roles
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["notes_manage"]'::jsonb,
    updated_at = NOW()
WHERE name IN ('owner', 'admin')
  AND NOT COALESCE(permissions, '[]'::jsonb) ? 'notes_manage';
