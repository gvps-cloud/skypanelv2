-- Migration: PaaS Applications
-- Description: Create table for client PaaS applications

CREATE TABLE IF NOT EXISTS paas_applications (
    id SERIAL PRIMARY KEY,
    
    -- Ownership
    user_id INTEGER NOT NULL, -- References users(id)
    
    -- Application Details
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL, -- URL-friendly name
    description TEXT,
    
    -- Repository
    repository_url TEXT, -- Git repository URL
    repository_branch VARCHAR(255) DEFAULT 'main',
    deploy_method VARCHAR(50) DEFAULT 'buildpack', -- buildpack, dockerfile, image
    
    -- Buildpack Configuration
    buildpack_builder VARCHAR(255), -- e.g., 'heroku/builder:22', 'paketo-buildpacks/builder:base'
    buildpack_custom_url TEXT, -- Custom buildpack URL if needed
    detected_language VARCHAR(50), -- auto-detected: nodejs, python, ruby, php, go, java, etc.
    
    -- Docker Image (if using pre-built image)
    docker_image VARCHAR(500), -- Full image name with tag
    
    -- Deployment Target
    worker_node_id INTEGER REFERENCES paas_worker_nodes(id) ON DELETE SET NULL,
    
    -- Uncloud Service Info
    uncloud_service_name VARCHAR(255), -- Service name in uncloud
    uncloud_compose_path TEXT, -- Path to generated docker-compose.yml
    
    -- Network & Domains
    internal_domain VARCHAR(500), -- Internal service domain (e.g., myapp.cluster.uncloud.run)
    primary_domain VARCHAR(500), -- Primary custom domain (if set)
    
    -- Status
    status VARCHAR(50) DEFAULT 'inactive', -- inactive, deploying, running, stopped, error, deleting
    health_status VARCHAR(50), -- healthy, unhealthy, unknown
    
    -- Resources (from pricing plan or custom)
    cpu_limit DECIMAL(10,2), -- CPU cores
    ram_limit_mb INTEGER, -- RAM in MB
    disk_limit_gb INTEGER, -- Disk in GB
    
    -- Pricing
    pricing_plan_id INTEGER, -- Link to pricing plan (optional, will create later)
    monthly_price DECIMAL(10,2), -- Override price if custom
    
    -- Auto-scaling (future feature)
    min_instances INTEGER DEFAULT 1,
    max_instances INTEGER DEFAULT 1,
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}', -- Additional configuration
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_deployed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    
    -- Constraints
    UNIQUE(user_id, slug),
    CONSTRAINT valid_status CHECK (status IN ('inactive', 'deploying', 'running', 'stopped', 'error', 'deleting')),
    CONSTRAINT valid_deploy_method CHECK (deploy_method IN ('buildpack', 'dockerfile', 'image')),
    CONSTRAINT valid_health_status CHECK (health_status IS NULL OR health_status IN ('healthy', 'unhealthy', 'unknown'))
);

-- Indexes
CREATE INDEX idx_paas_apps_user ON paas_applications(user_id);
CREATE INDEX idx_paas_apps_status ON paas_applications(status);
CREATE INDEX idx_paas_apps_worker ON paas_applications(worker_node_id);
CREATE INDEX idx_paas_apps_slug ON paas_applications(slug);
CREATE INDEX idx_paas_apps_created_at ON paas_applications(created_at);
CREATE INDEX idx_paas_apps_deleted_at ON paas_applications(deleted_at) WHERE deleted_at IS NULL;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_applications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_applications_timestamp
    BEFORE UPDATE ON paas_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_applications_timestamp();

-- Comments
COMMENT ON TABLE paas_applications IS 'Client PaaS applications for deployment';
COMMENT ON COLUMN paas_applications.slug IS 'URL-friendly unique identifier per user';
COMMENT ON COLUMN paas_applications.deploy_method IS 'How the application is built/deployed';
COMMENT ON COLUMN paas_applications.buildpack_builder IS 'Cloud Native Buildpacks builder to use';
COMMENT ON COLUMN paas_applications.detected_language IS 'Auto-detected programming language/framework';
COMMENT ON COLUMN paas_applications.internal_domain IS 'Internal domain assigned by uncloud';
COMMENT ON COLUMN paas_applications.deleted_at IS 'Soft delete timestamp for data retention';
