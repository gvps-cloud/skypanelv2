CREATE TABLE IF NOT EXISTS region_egress_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_type VARCHAR(50) NOT NULL DEFAULT 'linode',
    region_id VARCHAR(64) NOT NULL,
    region_label VARCHAR(255),
    pricing_scope VARCHAR(32) NOT NULL DEFAULT 'global' CHECK (pricing_scope IN ('global', 'region')),
    pricing_category VARCHAR(32) NOT NULL DEFAULT 'core' CHECK (pricing_category IN ('core', 'special', 'distributed')),
    base_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
    upcharge_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
    billing_enabled BOOLEAN NOT NULL DEFAULT false,
    source VARCHAR(100) NOT NULL DEFAULT 'manual',
    sync_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'manual', 'error')),
    source_reference TEXT,
    synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (provider_type, region_id)
);

CREATE INDEX IF NOT EXISTS idx_region_egress_pricing_region_id ON region_egress_pricing(region_id);
CREATE INDEX IF NOT EXISTS idx_region_egress_pricing_provider_type ON region_egress_pricing(provider_type);

CREATE TABLE IF NOT EXISTS organization_egress_billing_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_month DATE NOT NULL,
    pool_id VARCHAR(64) NOT NULL,
    pool_scope VARCHAR(32) NOT NULL CHECK (pool_scope IN ('global', 'region')),
    region_id VARCHAR(64),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    total_measured_usage_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    allocated_pool_usage_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    allocated_pool_quota_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    allocated_billable_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    unit_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,6) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'preview' CHECK (status IN ('preview', 'pending', 'billed', 'failed', 'void')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    billed_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (billing_month, pool_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_egress_billing_cycles_month ON organization_egress_billing_cycles(billing_month);
CREATE INDEX IF NOT EXISTS idx_org_egress_billing_cycles_org ON organization_egress_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_egress_billing_cycles_pool ON organization_egress_billing_cycles(pool_id);

CREATE TABLE IF NOT EXISTS organization_egress_billing_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    billing_cycle_id UUID NOT NULL REFERENCES organization_egress_billing_cycles(id) ON DELETE CASCADE,
    billing_month DATE NOT NULL,
    pool_id VARCHAR(64) NOT NULL,
    pool_scope VARCHAR(32) NOT NULL CHECK (pool_scope IN ('global', 'region')),
    region_id VARCHAR(64),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vps_instance_id UUID REFERENCES vps_instances(id) ON DELETE SET NULL,
    provider_instance_id VARCHAR(255),
    measured_usage_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    usage_share DECIMAL(18,10) NOT NULL DEFAULT 0,
    allocated_pool_usage_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    allocated_pool_quota_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    allocated_billable_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    unit_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,6) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_egress_billing_allocations_cycle ON organization_egress_billing_allocations(billing_cycle_id);
CREATE INDEX IF NOT EXISTS idx_org_egress_billing_allocations_vps ON organization_egress_billing_allocations(vps_instance_id);
CREATE INDEX IF NOT EXISTS idx_org_egress_billing_allocations_org ON organization_egress_billing_allocations(organization_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'region_egress_pricing'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_region_egress_pricing_updated_at ON region_egress_pricing;
    CREATE TRIGGER update_region_egress_pricing_updated_at BEFORE UPDATE ON region_egress_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organization_egress_billing_cycles'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_org_egress_billing_cycles_updated_at ON organization_egress_billing_cycles;
    CREATE TRIGGER update_org_egress_billing_cycles_updated_at BEFORE UPDATE ON organization_egress_billing_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organization_egress_billing_allocations'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_org_egress_billing_allocations_updated_at ON organization_egress_billing_allocations;
    CREATE TRIGGER update_org_egress_billing_allocations_updated_at BEFORE UPDATE ON organization_egress_billing_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
