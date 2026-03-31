-- 017_remove_billing_view_from_admin.sql
-- Ensure default admin and viewer roles do not include billing_view permission

UPDATE organization_roles
SET permissions = (
  SELECT jsonb_agg(value) FROM jsonb_array_elements_text(permissions) AS elem(value)
  WHERE value <> 'billing_view'
)
WHERE name IN ('admin','viewer');
