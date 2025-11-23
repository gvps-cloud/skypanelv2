-- Migration: Relax PaaS App Ports Constraint
-- Description: Allow multiple port mappings for the same container port to support multiple custom domains

-- Drop the existing strict constraint
ALTER TABLE paas_app_ports DROP CONSTRAINT IF EXISTS paas_app_ports_application_id_container_port_key;

-- Create a new unique index that includes custom_domain
-- This allows multiple entries for the same container port as long as they have different domains
-- We use COALESCE to handle NULL values (treating them as empty string for uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_paas_app_ports_unique 
ON paas_app_ports(application_id, container_port, COALESCE(custom_domain, ''));
