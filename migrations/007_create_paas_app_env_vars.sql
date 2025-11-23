-- Migration: PaaS Application Environment Variables
-- Description: Environment variables for PaaS applications (encrypted storage)

CREATE TABLE IF NOT EXISTS paas_app_env_vars (
    id SERIAL PRIMARY KEY,
    
    -- Application Reference
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    
    -- Environment Variable
    key VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL, -- Encrypted value
    
    -- Metadata
    is_secret BOOLEAN DEFAULT true, -- Whether to hide value in UI (show as ***)
    description TEXT, -- Optional description
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- User ID who created this env var
    
    -- Constraints
    UNIQUE(application_id, key)
);

-- Indexes
CREATE INDEX idx_paas_env_vars_application ON paas_app_env_vars(application_id);
CREATE INDEX idx_paas_env_vars_key ON paas_app_env_vars(key);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_app_env_vars_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_app_env_vars_timestamp
    BEFORE UPDATE ON paas_app_env_vars
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_app_env_vars_timestamp();

-- Comments
COMMENT ON TABLE paas_app_env_vars IS 'Environment variables for PaaS applications (encrypted)';
COMMENT ON COLUMN paas_app_env_vars.value_encrypted IS 'Encrypted environment variable value';
COMMENT ON COLUMN paas_app_env_vars.is_secret IS 'Whether to mask value in UI';
