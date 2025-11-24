-- Migration: Fix created_by columns to use UUID
-- Description: Change created_by from INTEGER to UUID to match users.id type
-- This migration fixes a type mismatch where created_by columns were defined as INTEGER
-- but users.id is UUID. This was causing errors when trying to insert user IDs.

-- Update paas_worker_nodes
-- This table tracks PaaS worker nodes and who created them
ALTER TABLE paas_worker_nodes 
  ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

-- Update paas_app_env_vars
-- This table stores environment variables for PaaS applications
ALTER TABLE paas_app_env_vars 
  ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

-- Update paas_pricing_plans
-- This table defines pricing plans for PaaS services
ALTER TABLE paas_pricing_plans 
  ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

-- Update paas_marketplace_templates
-- This table contains marketplace templates for quick PaaS deployments
ALTER TABLE paas_marketplace_templates 
  ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

-- Update paas_locations
-- This table stores datacenter location information
ALTER TABLE paas_locations 
  ALTER COLUMN created_by TYPE UUID USING created_by::text::uuid;

-- Add foreign key constraints to ensure referential integrity
-- These constraints ensure that created_by values reference valid users

ALTER TABLE paas_worker_nodes
  DROP CONSTRAINT IF EXISTS fk_paas_worker_nodes_created_by,
  ADD CONSTRAINT fk_paas_worker_nodes_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE paas_app_env_vars
  DROP CONSTRAINT IF EXISTS fk_paas_app_env_vars_created_by,
  ADD CONSTRAINT fk_paas_app_env_vars_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE paas_pricing_plans
  DROP CONSTRAINT IF EXISTS fk_paas_pricing_plans_created_by,
  ADD CONSTRAINT fk_paas_pricing_plans_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE paas_marketplace_templates
  DROP CONSTRAINT IF EXISTS fk_paas_marketplace_templates_created_by,
  ADD CONSTRAINT fk_paas_marketplace_templates_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE paas_locations
  DROP CONSTRAINT IF EXISTS fk_paas_locations_created_by,
  ADD CONSTRAINT fk_paas_locations_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Comments
COMMENT ON CONSTRAINT fk_paas_worker_nodes_created_by ON paas_worker_nodes 
  IS 'Links worker node to the admin user who created it';

COMMENT ON CONSTRAINT fk_paas_app_env_vars_created_by ON paas_app_env_vars 
  IS 'Links environment variable to the user who created it';

COMMENT ON CONSTRAINT fk_paas_pricing_plans_created_by ON paas_pricing_plans 
  IS 'Links pricing plan to the admin user who created it';

COMMENT ON CONSTRAINT fk_paas_marketplace_templates_created_by ON paas_marketplace_templates 
  IS 'Links marketplace template to the admin user who created it';

COMMENT ON CONSTRAINT fk_paas_locations_created_by ON paas_locations 
  IS 'Links location to the admin user who created it';
