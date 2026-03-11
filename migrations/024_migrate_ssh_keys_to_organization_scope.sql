-- Migration 024: Migrate SSH keys from user scope to organization scope

ALTER TABLE user_ssh_keys
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_ssh_keys'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE $sql$
      UPDATE user_ssh_keys usk
      SET organization_id = u.active_organization_id
      FROM users u
      WHERE usk.user_id = u.id
        AND usk.organization_id IS NULL
        AND u.active_organization_id IS NOT NULL
    $sql$;

    EXECUTE $sql$
      WITH first_memberships AS (
        SELECT DISTINCT ON (om.user_id)
          om.user_id,
          om.organization_id
        FROM organization_members om
        ORDER BY om.user_id, om.created_at ASC
      )
      UPDATE user_ssh_keys usk
      SET organization_id = fm.organization_id
      FROM first_memberships fm
      WHERE usk.user_id = fm.user_id
        AND usk.organization_id IS NULL
    $sql$;

    EXECUTE $sql$
      WITH owned_organizations AS (
        SELECT DISTINCT ON (o.owner_id)
          o.owner_id,
          o.id AS organization_id
        FROM organizations o
        ORDER BY o.owner_id, o.created_at DESC
      )
      UPDATE user_ssh_keys usk
      SET organization_id = oo.organization_id
      FROM owned_organizations oo
      WHERE usk.user_id = oo.owner_id
        AND usk.organization_id IS NULL
    $sql$;

    EXECUTE $sql$
      INSERT INTO organizations (name, slug, owner_id, created_at, updated_at)
      SELECT DISTINCT
        COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1), 'User') || '''s Organization',
        'ssh-migrated-' || substr(replace(u.id::text, '-', ''), 1, 12),
        u.id,
        NOW(),
        NOW()
      FROM users u
      INNER JOIN user_ssh_keys usk ON usk.user_id = u.id
      WHERE usk.organization_id IS NULL
      ON CONFLICT (slug) DO NOTHING
    $sql$;

    EXECUTE $sql$
      INSERT INTO organization_members (organization_id, user_id, role, created_at)
      SELECT o.id, o.owner_id, 'owner', NOW()
      FROM organizations o
      WHERE o.slug LIKE 'ssh-migrated-%'
      ON CONFLICT (organization_id, user_id) DO NOTHING
    $sql$;

    EXECUTE $sql$
      UPDATE users u
      SET active_organization_id = o.id
      FROM organizations o
      WHERE o.owner_id = u.id
        AND o.slug LIKE 'ssh-migrated-%'
        AND u.active_organization_id IS NULL
    $sql$;

    EXECUTE $sql$
      UPDATE user_ssh_keys usk
      SET organization_id = o.id
      FROM organizations o
      WHERE usk.user_id = o.owner_id
        AND usk.organization_id IS NULL
        AND o.slug LIKE 'ssh-migrated-%'
    $sql$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_ssh_keys WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Unable to resolve organization_id for one or more SSH keys';
  END IF;
END $$;

WITH ranked_keys AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, fingerprint
           ORDER BY created_at ASC, id ASC
         ) AS row_num
  FROM user_ssh_keys
)
DELETE FROM user_ssh_keys
WHERE id IN (SELECT id FROM ranked_keys WHERE row_num > 1);

ALTER TABLE user_ssh_keys DROP CONSTRAINT IF EXISTS unique_user_fingerprint;
DROP INDEX IF EXISTS idx_user_ssh_keys_user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_organization_fingerprint'
  ) THEN
    ALTER TABLE user_ssh_keys
    ADD CONSTRAINT unique_organization_fingerprint UNIQUE (organization_id, fingerprint);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_ssh_keys_organization_id ON user_ssh_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_ssh_keys_fingerprint ON user_ssh_keys(fingerprint);

ALTER TABLE user_ssh_keys ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE user_ssh_keys DROP COLUMN IF EXISTS user_id;

COMMENT ON TABLE user_ssh_keys IS 'Stores SSH keys per organization with provider-specific IDs for Linode.';
COMMENT ON COLUMN user_ssh_keys.organization_id IS 'Foreign key to organizations table';
COMMENT ON COLUMN user_ssh_keys.name IS 'Organization-visible name for the SSH key';

INSERT INTO predefined_permissions (name, category, description) VALUES
('ssh_keys_view', 'SSH Keys', 'View organization SSH keys'),
('ssh_keys_manage', 'SSH Keys', 'Create and delete organization SSH keys')
ON CONFLICT (name) DO NOTHING;

UPDATE organization_roles
SET permissions = permissions || '["ssh_keys_view"]'::jsonb
WHERE name IN ('owner', 'admin', 'vps_manager')
  AND NOT (permissions @> '["ssh_keys_view"]'::jsonb);

UPDATE organization_roles
SET permissions = permissions || '["ssh_keys_manage"]'::jsonb
WHERE name IN ('owner', 'admin', 'vps_manager')
  AND NOT (permissions @> '["ssh_keys_manage"]'::jsonb);