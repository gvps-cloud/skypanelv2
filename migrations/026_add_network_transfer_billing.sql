ALTER TABLE vps_plans
ADD COLUMN IF NOT EXISTS transfer_overage_markup_type VARCHAR(20) NOT NULL DEFAULT 'flat',
ADD COLUMN IF NOT EXISTS transfer_overage_markup_value DECIMAL(10,6) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS transfer_overage_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS account_transfer_pool_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  provider_type VARCHAR(50) NOT NULL DEFAULT 'linode',
  quota_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  used_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  billable_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  region_transfers JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_month, provider_type)
);

CREATE TABLE IF NOT EXISTS vps_transfer_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  vps_instance_id UUID NOT NULL REFERENCES vps_instances(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type VARCHAR(50) NOT NULL DEFAULT 'linode',
  provider_instance_id VARCHAR(255) NOT NULL,
  region_id VARCHAR(100),
  included_transfer_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  outbound_transfer_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  inbound_transfer_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  stats_window VARCHAR(50) NOT NULL DEFAULT 'month-to-date',
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_month, vps_instance_id)
);

CREATE TABLE IF NOT EXISTS transfer_overage_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month DATE NOT NULL,
  vps_instance_id UUID NOT NULL REFERENCES vps_instances(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  region_id VARCHAR(100),
  usage_fraction DECIMAL(12,8) NOT NULL DEFAULT 0,
  included_transfer_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  outbound_transfer_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  allocated_overage_gb DECIMAL(14,3) NOT NULL DEFAULT 0,
  provider_rate_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
  customer_rate_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
  provider_cost_usd DECIMAL(12,4) NOT NULL DEFAULT 0,
  customer_cost_usd DECIMAL(12,4) NOT NULL DEFAULT 0,
  markup_type VARCHAR(20) NOT NULL DEFAULT 'flat',
  markup_value DECIMAL(10,6) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'calculated',
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_month, vps_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_account_transfer_pool_snapshots_period ON account_transfer_pool_snapshots(period_month DESC);
CREATE INDEX IF NOT EXISTS idx_vps_transfer_usage_monthly_period_org ON vps_transfer_usage_monthly(period_month DESC, organization_id);
CREATE INDEX IF NOT EXISTS idx_vps_transfer_usage_monthly_period_vps ON vps_transfer_usage_monthly(period_month DESC, vps_instance_id);
CREATE INDEX IF NOT EXISTS idx_transfer_overage_allocations_period_org ON transfer_overage_allocations(period_month DESC, organization_id);
CREATE INDEX IF NOT EXISTS idx_transfer_overage_allocations_status ON transfer_overage_allocations(status);
