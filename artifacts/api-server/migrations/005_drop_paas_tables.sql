-- Migration: Drop PaaS tables
-- Description: Remove all PaaS-related tables from the database

-- Drop tables in order respecting foreign key constraints
DROP TABLE IF EXISTS paas_billing_usage CASCADE;
DROP TABLE IF EXISTS paas_addon_pricing CASCADE;
DROP TABLE IF EXISTS paas_addons CASCADE;
DROP TABLE IF EXISTS paas_deployments CASCADE;
DROP TABLE IF EXISTS paas_app_env_vars CASCADE;
DROP TABLE IF EXISTS paas_app_ports CASCADE;
DROP TABLE IF EXISTS paas_applications CASCADE;
DROP TABLE IF EXISTS paas_marketplace_templates CASCADE;
DROP TABLE IF EXISTS paas_pricing_plans CASCADE;
DROP TABLE IF EXISTS paas_worker_nodes CASCADE;
DROP TABLE IF EXISTS paas_locations CASCADE;
