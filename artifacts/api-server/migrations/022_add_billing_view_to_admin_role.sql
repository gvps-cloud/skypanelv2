-- 023_add_billing_view_to_admin_role.sql
-- Restore billing_view permission to admin roles so they can access dashboard billing information

-- Add billing_view permission to all existing admin roles
UPDATE organization_roles
SET permissions = permissions || '["billing_view"]'::jsonb
WHERE name = 'admin' AND NOT (permissions @> '["billing_view"]'::jsonb);
