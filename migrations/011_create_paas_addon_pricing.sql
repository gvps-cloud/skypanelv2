-- Migration: PaaS Add-on Pricing
-- Description: Pricing for add-on services

CREATE TABLE IF NOT EXISTS paas_addon_pricing (
    id SERIAL PRIMARY KEY,
    
    -- Add-on Type
    addon_type VARCHAR(50) NOT NULL,
    
    -- Plan Details
    name VARCHAR(255) NOT NULL, -- e.g., "PostgreSQL Basic", "Redis Pro"
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- Pricing
    monthly_price DECIMAL(10,2) NOT NULL,
    
    -- Resource Specs
    storage_gb INTEGER,
    max_connections INTEGER,
    ram_mb INTEGER,
    cpu_cores DECIMAL(10,2),
    
    -- Features
    backup_enabled BOOLEAN DEFAULT false,
    backup_retention_days INTEGER DEFAULT 7,
    high_availability BOOLEAN DEFAULT false,
    
    -- Visibility
    is_active BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    features JSONB DEFAULT '[]',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_addon_type CHECK (addon_type IN ('postgresql', 'mysql', 'redis', 'mongodb', 'elasticsearch', 'rabbitmq', 'memcached'))
);

-- Indexes
CREATE INDEX idx_paas_addon_pricing_type ON paas_addon_pricing(addon_type);
CREATE INDEX idx_paas_addon_pricing_active ON paas_addon_pricing(is_active);
CREATE INDEX idx_paas_addon_pricing_visible ON paas_addon_pricing(is_visible);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_addon_pricing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_addon_pricing_timestamp
    BEFORE UPDATE ON paas_addon_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_addon_pricing_timestamp();

-- Comments
COMMENT ON TABLE paas_addon_pricing IS 'Pricing plans for PaaS add-on services';
