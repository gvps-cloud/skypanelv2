-- Migration: PaaS Deployments
-- Description: Track deployment history for applications

CREATE TABLE IF NOT EXISTS paas_deployments (
    id SERIAL PRIMARY KEY,
    
    -- Application Reference
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    
    -- Deployment Info
    version VARCHAR(50), -- e.g., 'v1.2.3', git SHA, or auto-incrementing
    git_commit_sha VARCHAR(100), -- Git commit that was deployed
    git_branch VARCHAR(255), -- Git branch
    git_tag VARCHAR(255), -- Git tag if deployed from tag
    
    -- Build Info
    build_method VARCHAR(50), -- buildpack, dockerfile, image
    builder_used VARCHAR(255), -- Buildpack builder or Dockerfile path
    docker_image VARCHAR(500), -- Built/deployed image reference
    build_logs TEXT, -- Build logs (truncated or link to S3)
    build_duration_seconds INTEGER,
    
    -- Deployment Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, building, pushing, deploying, success, failed, rolled_back
    error_message TEXT,
    
    -- Deployment Details
    deployed_to_worker INTEGER REFERENCES paas_worker_nodes(id) ON DELETE SET NULL,
    deployed_at TIMESTAMP WITH TIME ZONE,
    deployment_duration_seconds INTEGER,
    
    -- Rollback Info
    is_rollback BOOLEAN DEFAULT false,
    rolled_back_from INTEGER REFERENCES paas_deployments(id), -- If this is a rollback, reference to failed deployment
    
    -- Configuration Snapshot (at time of deployment)
    env_vars_snapshot JSONB, -- Snapshot of env vars at deployment time
    ports_snapshot JSONB, -- Snapshot of port configuration
    resource_limits_snapshot JSONB, -- CPU/RAM/Disk limits
    
    -- Metadata
    triggered_by INTEGER, -- User ID who triggered this deployment
    trigger_type VARCHAR(50) DEFAULT 'manual', -- manual, auto, webhook, rollback
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'building', 'pushing', 'deploying', 'success', 'failed', 'rolled_back')),
    CONSTRAINT valid_build_method CHECK (build_method IN ('buildpack', 'dockerfile', 'image')),
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('manual', 'auto', 'webhook', 'rollback'))
);

-- Indexes
CREATE INDEX idx_paas_deployments_application ON paas_deployments(application_id);
CREATE INDEX idx_paas_deployments_status ON paas_deployments(status);
CREATE INDEX idx_paas_deployments_deployed_at ON paas_deployments(deployed_at);
CREATE INDEX idx_paas_deployments_git_commit ON paas_deployments(git_commit_sha);
CREATE INDEX idx_paas_deployments_triggered_by ON paas_deployments(triggered_by);
CREATE INDEX idx_paas_deployments_created_at ON paas_deployments(created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_deployments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_deployments_timestamp
    BEFORE UPDATE ON paas_deployments
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_deployments_timestamp();

-- Comments
COMMENT ON TABLE paas_deployments IS 'Deployment history and tracking for PaaS applications';
COMMENT ON COLUMN paas_deployments.version IS 'Deployment version identifier';
COMMENT ON COLUMN paas_deployments.git_commit_sha IS 'Git commit that was deployed';
COMMENT ON COLUMN paas_deployments.build_logs IS 'Build logs (may be truncated or S3 link)';
COMMENT ON COLUMN paas_deployments.is_rollback IS 'Whether this deployment is a rollback';
COMMENT ON COLUMN paas_deployments.env_vars_snapshot IS 'Snapshot of environment variables at deployment time';
COMMENT ON COLUMN paas_deployments.ports_snapshot IS 'Snapshot of port configuration at deployment time';
COMMENT ON COLUMN paas_deployments.trigger_type IS 'How this deployment was initiated';
