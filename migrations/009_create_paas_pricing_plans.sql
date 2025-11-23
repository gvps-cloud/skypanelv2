-- Migration: PaaS Pricing Plans
-- Description: Pricing plans for PaaS applications

CREATE TABLE IF NOT EXISTS paas_pricing_plans (
    id SERIAL PRIMARY KEY,
    
    -- Plan Details
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- Plan Type
    plan_type VARCHAR(50) DEFAULT 'monthly', -- monthly, per_resource, custom
    
    -- Monthly Pricing (if plan_type = 'monthly')
    monthly_price DECIMAL(10,2),
    
    -- Resource Limits (for monthly plans)
    cpu_cores DECIMAL(10,2),
    ram_mb INTEGER,
    disk_gb INTEGER,
    bandwidth_gb INTEGER, -- Monthly bandwidth limit
    
    -- Per-Resource Pricing (if plan_type = 'per_resource')
    price_per_cpu_hour DECIMAL(10,4), -- Price per CPU core per hour
    price_per_ram_gb_hour DECIMAL(10,4), -- Price per GB RAM per hour
    price_per_disk_gb_month DECIMAL(10,4), -- Price per GB disk per month
    price_per_bandwidth_gb DECIMAL(10,4), -- Price per GB bandwidth
    
    -- Features
    max_applications INTEGER, -- Max apps allowed on this plan
    buildpack_support BOOLEAN DEFAULT true,
    custom_domain_support BOOLEAN DEFAULT true,
    ssl_support BOOLEAN DEFAULT true,
    max_custom_domains INTEGER DEFAULT 5,
    
    -- Visibility
    is_active BOOLEAN DEFAULT true,
    is_visible BOOLEAN DEFAULT true, -- Show in client UI
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    features JSONB DEFAULT '[]', -- Array of feature descriptions
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- Admin user ID who created this plan
    
    -- Constraints
    CONSTRAINT valid_plan_type CHECK (plan_type IN ('monthly', 'per_resource', 'custom'))
);

-- Indexes
CREATE INDEX idx_paas_pricing_slug ON paas_pricing_plans(slug);
CREATE INDEX idx_paas_pricing_active ON paas_pricing_plans(is_active);
CREATE INDEX idx_paas_pricing_visible ON paas_pricing_plans(is_visible);
CREATE INDEX idx_paas_pricing_sort ON paas_pricing_plans(sort_order);

-- Ensure only one default plan
CREATE UNIQUE INDEX idx_paas_pricing_one_default 
    ON paas_pricing_plans(is_default) 
    WHERE is_default = true;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_pricing_plans_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_pricing_plans_timestamp
    BEFORE UPDATE ON paas_pricing_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_pricing_plans_timestamp();

-- Comments
COMMENT ON TABLE paas_pricing_plans IS 'Pricing plans for PaaS applications';
COMMENT ON COLUMN paas_pricing_plans.plan_type IS 'Type of pricing: monthly flat rate or per-resource usage';
COMMENT ON COLUMN paas_pricing_plans.features IS 'JSON array of plan feature descriptions for display';
