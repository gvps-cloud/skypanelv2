-- Runtime toggle row for VPS/Linode compute (mirrors enhance integration pattern).
INSERT INTO platform_integrations (slug, display_name, description, enabled, env_required)
VALUES (
  'linode',
  'VPS / Linode Compute',
  'Linode-backed virtual private servers: provisioning, power, networking, and SSH access.',
  true,
  ARRAY['LINODE_API_TOKEN']::text[]
)
ON CONFLICT (slug) DO NOTHING;
