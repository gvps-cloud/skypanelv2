-- Migration 003: Remove deprecated PaaS system
-- Drops all tables, functions, and columns that supported the retired PaaS feature set

BEGIN;

-- Drop dependent tables first
DROP TABLE IF EXISTS paas_app_addons CASCADE;
DROP TABLE IF EXISTS paas_template_deployments CASCADE;
DROP TABLE IF EXISTS paas_app_pricing_overrides CASCADE;
DROP TABLE IF EXISTS paas_marketplace_addons CASCADE;
DROP TABLE IF EXISTS paas_marketplace_templates CASCADE;

-- Drop core PaaS tables
DROP TABLE IF EXISTS paas_resource_usage CASCADE;
DROP TABLE IF EXISTS paas_build_cache CASCADE;
DROP TABLE IF EXISTS paas_logs_metadata CASCADE;
DROP TABLE IF EXISTS paas_environment_vars CASCADE;
DROP TABLE IF EXISTS paas_domains CASCADE;
DROP TABLE IF EXISTS paas_addons CASCADE;
DROP TABLE IF EXISTS paas_deployments CASCADE;
DROP TABLE IF EXISTS paas_applications CASCADE;
DROP TABLE IF EXISTS paas_worker_nodes CASCADE;
DROP TABLE IF EXISTS paas_plans CASCADE;
DROP TABLE IF EXISTS paas_settings CASCADE;

-- Drop supporting functions
DROP FUNCTION IF EXISTS notify_paas_app_status_change() CASCADE;
DROP FUNCTION IF EXISTS notify_paas_deployment_status_change() CASCADE;

-- Remove PaaS-specific organization state
ALTER TABLE organizations
  DROP COLUMN IF EXISTS paas_suspended,
  DROP COLUMN IF EXISTS paas_suspended_at,
  DROP COLUMN IF EXISTS paas_suspend_reason;

COMMIT;
