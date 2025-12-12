-- Migration 006: Enhance Hosting Suite Schema
-- Date: 2025-12-10
-- Description: Adds support for First-Party Hosting (Web, Email, WP, Node) via Enhance

-- 1. Enhance Configuration (Singleton or Multi-cluster support)
CREATE TABLE IF NOT EXISTS enhance_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Default Cluster',
    api_url VARCHAR(500) NOT NULL, -- e.g. https://api.enhance.com
    org_id VARCHAR(255) NOT NULL,  -- Organization ID in Enhance
    api_key TEXT NOT NULL,         -- Encrypted or raw API Key
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_enhance_config_updated_at
    BEFORE UPDATE ON enhance_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Hosting Plans (Synced from Enhance and categorized)
CREATE TYPE hosting_service_type AS ENUM ('web', 'email', 'wordpress', 'node');

CREATE TABLE IF NOT EXISTS hosting_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enhance_plan_id VARCHAR(255) NOT NULL, -- ID from Enhance API
    enhance_config_id UUID REFERENCES enhance_config(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_type hosting_service_type NOT NULL DEFAULT 'web',
    
    -- Pricing
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    markup_percentage DECIMAL(5,2) DEFAULT 0.00, -- Optional markup logic
    
    -- Limits / Specs (Snapshotted from Enhance for display)
    description TEXT,
    features JSONB DEFAULT '{}', -- e.g. { "disk_mb": 1000, "websites": 1 }
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(enhance_plan_id, enhance_config_id)
);

CREATE TRIGGER update_hosting_plans_updated_at
    BEFORE UPDATE ON hosting_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_hosting_plans_type ON hosting_plans(service_type);
CREATE INDEX idx_hosting_plans_active ON hosting_plans(is_active);

-- 3. Hosting Subscriptions (Active User Services)
CREATE TABLE IF NOT EXISTS hosting_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- User's Org context
    
    plan_id UUID NOT NULL REFERENCES hosting_plans(id),
    
    -- Enhance Identifiers
    enhance_website_id VARCHAR(255), -- The 'Website' ID in Enhance
    enhance_subscription_id VARCHAR(255), -- If Enhance separates sub from website
    enhance_customer_id VARCHAR(255), -- The User/Customer ID in Enhance
    
    -- Service Details
    domain VARCHAR(255) NOT NULL,
    primary_ip VARCHAR(64),
    
    -- State
    status VARCHAR(50) DEFAULT 'provisioning' CHECK (status IN ('provisioning', 'active', 'suspended', 'cancelled', 'error')),
    
    -- Metadata (e.g. Node version, PHP version caches)
    settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_hosting_subscriptions_updated_at
    BEFORE UPDATE ON hosting_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_hosting_subs_user ON hosting_subscriptions(user_id);
CREATE INDEX idx_hosting_subs_org ON hosting_subscriptions(organization_id);
CREATE INDEX idx_hosting_subs_status ON hosting_subscriptions(status);
CREATE INDEX idx_hosting_subs_enhance_id ON hosting_subscriptions(enhance_website_id);
