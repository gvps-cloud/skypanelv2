-- Migration: PaaS Application Ports
-- Description: Port mappings for PaaS applications (for uncloud x-ports)

CREATE TABLE IF NOT EXISTS paas_app_ports (
    id SERIAL PRIMARY KEY,
    
    -- Application Reference
    application_id INTEGER NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
    
    -- Port Configuration
    container_port INTEGER NOT NULL, -- Port inside the container
    protocol VARCHAR(20) DEFAULT 'https', -- https, http, tcp, udp
    
    -- Custom Domain (optional)
    custom_domain VARCHAR(500), -- e.g., 'myapp.example.com' or null for auto-generated
    
    -- Port Settings
    is_primary BOOLEAN DEFAULT false, -- Primary port for the application
    is_internal_only BOOLEAN DEFAULT false, -- Only accessible within cluster
    
    -- Host Mode Publishing (optional, for direct TCP/UDP)
    host_port INTEGER, -- Host port for direct binding (host mode)
    host_ip VARCHAR(45), -- Host IP for binding (e.g., '0.0.0.0')
    target_machine VARCHAR(255), -- Specific machine for host mode (@machine syntax)
    
    -- SSL/TLS
    enable_ssl BOOLEAN DEFAULT true,
    ssl_cert_path TEXT, -- Custom SSL cert (if not using auto Caddy)
    ssl_key_path TEXT,
    
    -- Metadata
    name VARCHAR(255), -- Friendly name for this port
    description TEXT,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_protocol CHECK (protocol IN ('https', 'http', 'tcp', 'udp')),
    CONSTRAINT valid_port_range CHECK (container_port >= 1 AND container_port <= 65535),
    CONSTRAINT valid_host_port_range CHECK (host_port IS NULL OR (host_port >= 1 AND host_port <= 65535))
);

-- Indexes
CREATE INDEX idx_paas_app_ports_application ON paas_app_ports(application_id);
CREATE INDEX idx_paas_app_ports_custom_domain ON paas_app_ports(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_paas_app_ports_primary ON paas_app_ports(is_primary) WHERE is_primary = true;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_app_ports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_app_ports_timestamp
    BEFORE UPDATE ON paas_app_ports
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_app_ports_timestamp();

-- Ensure only one primary port per application
CREATE UNIQUE INDEX idx_paas_app_ports_one_primary 
    ON paas_app_ports(application_id) 
    WHERE is_primary = true;

-- Comments
COMMENT ON TABLE paas_app_ports IS 'Port mappings and custom domains for PaaS applications';
COMMENT ON COLUMN paas_app_ports.custom_domain IS 'Custom domain for this port (null = auto-generated domain)';
COMMENT ON COLUMN paas_app_ports.is_primary IS 'Whether this is the primary port/domain for the application';
COMMENT ON COLUMN paas_app_ports.host_port IS 'For direct host binding (host mode), bypasses Caddy ingress';
COMMENT ON COLUMN paas_app_ports.target_machine IS 'Specific machine for host mode binding using @machine suffix';
