-- Migration: 032_add_egress_permissions_to_roles.sql
-- Add egress_view and egress_manage permissions to default organization roles
-- 
-- Background: Migration 016 seeded default roles but was missing egress permissions.
-- The code in roles.ts PREDEFINED_ROLES includes egress permissions for owner/admin,
-- but existing organizations were created with the migration 016 version that lacked them.

-- Add egress_view and egress_manage to owner role (if not already present)
UPDATE organization_roles 
SET permissions = permissions || '["egress_view", "egress_manage"]'::jsonb
WHERE name = 'owner' 
  AND NOT (permissions @> '"egress_view"'::jsonb);

-- Add egress_view (only) to admin role (if not already present)
UPDATE organization_roles 
SET permissions = permissions || '["egress_view"]'::jsonb
WHERE name = 'admin' 
  AND NOT (permissions @> '"egress_view"'::jsonb);
