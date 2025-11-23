-- Migration: PaaS Marketplace Templates
-- Description: Pre-configured application templates for one-click deployment

CREATE TABLE IF NOT EXISTS paas_marketplace_templates (
    id SERIAL PRIMARY KEY,
    
    -- Template Details
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100), -- cms, blog, ecommerce, framework, database, etc.
    
    -- Template Image/Icon
    icon_url TEXT,
    screenshot_urls JSONB DEFAULT '[]', -- Array of screenshot URLs
    
    -- Repository
    repository_url TEXT NOT NULL,
    repository_branch VARCHAR(255) DEFAULT 'main',
    
    -- Buildpack Configuration
    buildpack_builder VARCHAR(255),
    deploy_method VARCHAR(50) DEFAULT 'buildpack',
    
    -- Required Add-ons
    required_addons JSONB DEFAULT '[]', -- [{type: 'postgresql', plan: 'basic'}, ...]
    
    -- Default Configuration
    default_env_vars JSONB DEFAULT '{}', -- Default environment variables
    default_ports JSONB DEFAULT '[]', -- Default port mappings
    
    -- Pricing
    pricing_plan_id INTEGER REFERENCES paas_pricing_plans(id),
    custom_monthly_price DECIMAL(10,2), -- Override pricing
    
    -- Template Info
    author VARCHAR(255),
    documentation_url TEXT,
    demo_url TEXT,
    tags JSONB DEFAULT '[]', -- Search tags
    
    -- Requirements
    min_ram_mb INTEGER,
    min_cpu_cores DECIMAL(10,2),
    min_disk_gb INTEGER,
    
    -- Popularity
    deploy_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00, -- Average rating
    
    -- Visibility
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    setup_instructions TEXT, -- Markdown instructions for post-deployment
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER, -- Admin user ID who created this template
    
    -- Constraints
    CONSTRAINT valid_deploy_method CHECK (deploy_method IN ('buildpack', 'dockerfile', 'image'))
);

-- Indexes
CREATE INDEX idx_paas_marketplace_slug ON paas_marketplace_templates(slug);
CREATE INDEX idx_paas_marketplace_category ON paas_marketplace_templates(category);
CREATE INDEX idx_paas_marketplace_active ON paas_marketplace_templates(is_active);
CREATE INDEX idx_paas_marketplace_featured ON paas_marketplace_templates(is_featured);
CREATE INDEX idx_paas_marketplace_deploy_count ON paas_marketplace_templates(deploy_count DESC);
CREATE INDEX idx_paas_marketplace_rating ON paas_marketplace_templates(rating DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_paas_marketplace_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paas_marketplace_templates_timestamp
    BEFORE UPDATE ON paas_marketplace_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_paas_marketplace_templates_timestamp();

-- Comments
COMMENT ON TABLE paas_marketplace_templates IS 'Pre-configured application templates for one-click deployment';
COMMENT ON COLUMN paas_marketplace_templates.required_addons IS 'JSON array of required add-ons with types and plans';
COMMENT ON COLUMN paas_marketplace_templates.default_env_vars IS 'Default environment variables for the template';
COMMENT ON COLUMN paas_marketplace_templates.deploy_count IS 'Number of times this template has been deployed';
