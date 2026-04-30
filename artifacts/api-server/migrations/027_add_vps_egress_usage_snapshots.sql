CREATE TABLE IF NOT EXISTS vps_egress_usage_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vps_instance_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider_instance_id VARCHAR(255),
    label TEXT,
    region_id VARCHAR(64),
    region_label VARCHAR(255),
    transfer_included_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    measured_usage_gb DECIMAL(18,6) NOT NULL DEFAULT 0,
    billing_month DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (vps_instance_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_vps_egress_usage_snapshots_month
  ON vps_egress_usage_snapshots(billing_month);
CREATE INDEX IF NOT EXISTS idx_vps_egress_usage_snapshots_vps
  ON vps_egress_usage_snapshots(vps_instance_id);
CREATE INDEX IF NOT EXISTS idx_vps_egress_usage_snapshots_org
  ON vps_egress_usage_snapshots(organization_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'vps_egress_usage_snapshots'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_vps_egress_usage_snapshots_updated_at ON vps_egress_usage_snapshots;
    CREATE TRIGGER update_vps_egress_usage_snapshots_updated_at
      BEFORE UPDATE ON vps_egress_usage_snapshots
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
