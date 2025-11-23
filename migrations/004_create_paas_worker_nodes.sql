-- Migration: PaaS Worker Nodes
-- Description: Create table for managing PaaS worker nodes (uncloud cluster machines)

CREATE TABLE IF NOT EXISTS paas_worker_nodes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    
    -- SSH Connection Details
    ssh_host VARCHAR(255) NOT NULL,
    ssh_port INTEGER NOT NULL DEFAULT 22,
    ssh_user VARCHAR(100) NOT NULL DEFAULT 'root',
    ssh_key_path TEXT, -- Path to SSH private key on admin server
    ssh_key_encrypted TEXT, -- Encrypted SSH private key content
    
    -- Resource Information
    cpu_cores INTEGER,
    ram_mb INTEGER,
    disk_gb INTEGER,
    
    -- Network Information
    public_ip VARCHAR(45), -- IPv4 or IPv6
    private_ip VARCHAR(45),
    region VARCHAR(100),
    
    -- Uncloud Cluster Info
    uncloud_context VARCHAR(255), -- Uncloud context name
    uncloud_machine_name VARCHAR(255), -- Machine name in uncloud
    is_control_plane BOOLEAN DEFAULT false, -- First machine is control plane
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, provisioning, active, error, decommissioned
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status VARCHAR(50), -- healthy, degraded, unhealthy
    
    -- Capacity Tracking
    current_apps_count INTEGER DEFAULT 0,
    max_apps INTEGER DEFAULT 100,
    
    -- Metadata
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- User ID who created this worker
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'provisioning', 'active', 'error', 'decommissioned')),
    CONSTRAINT valid_health CHECK (health_status IS NULL OR health_status IN ('healthy', 'degraded', 'unhealthy'))
);

-- Indexes
CREATE INDEX idx_paas_workers_status ON paas_worker_nodes(status);
CREATE INDEX idx_paas_workers_health ON paas_worker_nodes(health_status);
CREATE INDEX idx_paas_workers_region ON paas_worker_nodes(region);
CREATE INDEX idx_paas_workers_created_at ON paas_worker_nodes(created_at);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_worker_nodes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_worker_nodes_timestamp
    BEFORE UPDATE ON paas_worker_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_worker_nodes_timestamp();

-- Comments
COMMENT ON TABLE paas_worker_nodes IS 'PaaS worker nodes for running client applications';
COMMENT ON COLUMN paas_worker_nodes.ssh_key_encrypted IS 'Encrypted SSH private key for secure storage';
COMMENT ON COLUMN paas_worker_nodes.uncloud_context IS 'Uncloud CLI context name for this cluster';
COMMENT ON COLUMN paas_worker_nodes.is_control_plane IS 'Whether this is the initial/control plane machine';
COMMENT ON COLUMN paas_worker_nodes.current_apps_count IS 'Number of applications currently deployed on this worker';
