-- Migration: 055_volume_pricing
-- Block Storage Volume pricing and management tables

BEGIN;

-- Volume types (pricing tiers for Block Storage)
CREATE TABLE IF NOT EXISTS volume_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) NOT NULL,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'ssd' CHECK (storage_type IN ('ssd', 'nvme')),
    size_min_gb INTEGER NOT NULL DEFAULT 1,
    size_max_gb INTEGER NOT NULL DEFAULT 10000,
    price_per_gb_month NUMERIC(10, 4) NOT NULL,
    price_per_gb_hour NUMERIC(10, 6) NOT NULL,
    region_pricing JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE volume_types IS 'Block Storage volume pricing tiers';
COMMENT ON COLUMN volume_types.region_pricing IS 'Region-specific pricing overrides: { "us-east": { "price_per_gb_month": 0.01 } }';

-- Volumes (per-organization volume instances)
CREATE TABLE IF NOT EXISTS volumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vps_id UUID REFERENCES vps_instances(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'linode',
    provider_volume_id VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    size_gb INTEGER NOT NULL,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'ssd' CHECK (storage_type IN ('ssd', 'nvme')),
    status VARCHAR(50) NOT NULL DEFAULT 'creating',
    filesystem_path VARCHAR(500),
    encryption VARCHAR(20) DEFAULT 'enabled',
    hourly_price NUMERIC(10, 6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_volume_id)
);

CREATE INDEX IF NOT EXISTS idx_volumes_organization_id ON volumes(organization_id);
CREATE INDEX IF NOT EXISTS idx_volumes_vps_id ON volumes(vps_id);
CREATE INDEX IF NOT EXISTS idx_volumes_provider_volume_id ON volumes(provider, provider_volume_id);

COMMENT ON TABLE volumes IS 'Block Storage volumes per organization';
COMMENT ON COLUMN volumes.vps_id IS 'Optional: the VPS this volume is attached to (null if detached)';

-- Volume pricing history (for billing audit)
CREATE TABLE IF NOT EXISTS volume_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volume_id UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    size_gb INTEGER NOT NULL,
    price_per_gb_hour NUMERIC(10, 6) NOT NULL,
    hours_billed NUMERIC(10, 4) NOT NULL DEFAULT 1,
    total_amount NUMERIC(10, 4) NOT NULL,
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volume_billing_volume_id ON volume_billing(volume_id);
CREATE INDEX IF NOT EXISTS idx_volume_billing_organization_id ON volume_billing(organization_id);
CREATE INDEX IF NOT EXISTS idx_volume_billing_period ON volume_billing(billing_period_start, billing_period_end);

COMMENT ON TABLE volume_billing IS 'Hourly billing records for Block Storage volumes';

-- Seed default volume types
INSERT INTO volume_types (label, storage_type, size_min_gb, size_max_gb, price_per_gb_month, price_per_gb_hour, region_pricing, display_order, description) VALUES
    ('SSD Block Storage', 'ssd', 10, 10000, 0.0000, 0.000015, '{"us-east": {"price_per_gb_month": 0.0000, "price_per_gb_hour": 0.000015}, "eu-west": {"price_per_gb_month": 0.0000, "price_per_gb_hour": 0.000018}}', 1, 'Standard SSD Block Storage'),
    ('NVMe Block Storage', 'nvme', 250, 10000, 0.0000, 0.000025, '{"us-east": {"price_per_gb_month": 0.0000, "price_per_gb_hour": 0.000025}, "eu-west": {"price_per_gb_month": 0.0000, "price_per_gb_hour": 0.000030}}', 2, 'High-performance NVMe Block Storage')
ON CONFLICT DO NOTHING;

-- Add updated_at trigger for volume_types
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER volume_types_updated_at
    BEFORE UPDATE ON volume_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER volumes_updated_at
    BEFORE UPDATE ON volumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;

-- Verify all tables exist
SELECT 'volume_types' as table_name, COUNT(*) as row_count FROM volume_types;
SELECT 'volumes' as table_name, COUNT(*) as row_count FROM volumes;
SELECT 'volume_billing' as table_name, COUNT(*) as row_count FROM volume_billing;
