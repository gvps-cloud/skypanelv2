-- Migration: PaaS Add-ons
-- Description: Add-on services (databases, cache, etc.) for PaaS applications

CREATE TABLE IF NOT EXISTS paas_addons (
    id SERIAL PRIMARY KEY,
    
    -- Application Reference
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    
    -- Add-on Type
    addon_type VARCHAR(50) NOT NULL, -- postgresql, mysql, redis, mongodb, elasticsearch, rabbitmq, etc.
    name VARCHAR(255) NOT NULL,
    
    -- Provisioning
    status VARCHAR(50) DEFAULT 'pending', -- pending, provisioning, active, error, deleting
    
    -- Connection Info (encrypted)
    connection_string_encrypted TEXT,
    host VARCHAR(255),
    port INTEGER,
    database_name VARCHAR(255),
    username_encrypted TEXT,
    password_encrypted TEXT,
    
    -- Resource Limits
    storage_gb INTEGER,
    max_connections INTEGER,
    
    -- Deployment Info
    worker_node_id INTEGER REFERENCES paas_worker_nodes(id) ON DELETE SET NULL,
    docker_container_id VARCHAR(255), -- Container ID for this addon
    docker_volume_name VARCHAR(255), -- Volume for data persistence
    
    -- Pricing
    addon_pricing_id INTEGER, -- Reference to addon pricing (will create next)
    monthly_price DECIMAL(10,2),
    
    -- Metadata
    config JSONB DEFAULT '{}', -- Additional configuration
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provisioned_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_addon_type CHECK (addon_type IN ('postgresql', 'mysql', 'redis', 'mongodb', 'elasticsearch', 'rabbitmq', 'memcached')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'provisioning', 'active', 'error', 'deleting'))
);

-- Indexes
CREATE INDEX idx_paas_addons_application ON paas_addons(application_id);
CREATE INDEX idx_paas_addons_type ON paas_addons(addon_type);
CREATE INDEX idx_paas_addons_status ON paas_addons(status);
CREATE INDEX idx_paas_addons_worker ON paas_addons(worker_node_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_addons_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_addons_timestamp
    BEFORE UPDATE ON paas_addons
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_addons_timestamp();

-- Comments
COMMENT ON TABLE paas_addons IS 'Add-on services for PaaS applications';
COMMENT ON COLUMN paas_addons.addon_type IS 'Type of database/service';
COMMENT ON COLUMN paas_addons.connection_string_encrypted IS 'Encrypted connection string for the addon';
