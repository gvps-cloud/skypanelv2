-- Migration 025: Track SSH key creators at the database level

ALTER TABLE user_ssh_keys
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_ssh_keys_created_by_user_id
ON user_ssh_keys(created_by_user_id);

WITH creation_logs AS (
  SELECT DISTINCT ON (entity_id, organization_id)
    entity_id,
    organization_id,
    user_id
  FROM activity_logs
  WHERE event_type = 'ssh_key.create'
    AND entity_type = 'ssh_key'
    AND user_id IS NOT NULL
  ORDER BY entity_id, organization_id, created_at ASC
)
UPDATE user_ssh_keys usk
SET created_by_user_id = creation_logs.user_id
FROM creation_logs
WHERE usk.id::text = creation_logs.entity_id
  AND usk.organization_id = creation_logs.organization_id
  AND usk.created_by_user_id IS NULL;

COMMENT ON COLUMN user_ssh_keys.created_by_user_id IS 'User who originally added the SSH key to the organization';