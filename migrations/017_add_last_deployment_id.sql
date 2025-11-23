-- Migration: Add last_deployment_id to paas_applications
-- Description: Add foreign key reference to last successful deployment

ALTER TABLE paas_applications 
  ADD COLUMN last_deployment_id INTEGER REFERENCES paas_deployments(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_paas_apps_last_deployment ON paas_applications(last_deployment_id);

-- Comment
COMMENT ON COLUMN paas_applications.last_deployment_id IS 'Reference to the last successful deployment';
