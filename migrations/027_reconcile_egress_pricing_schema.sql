ALTER TABLE IF EXISTS region_egress_pricing
  ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) NOT NULL DEFAULT 'linode',
  ADD COLUMN IF NOT EXISTS region_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS region_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pricing_scope VARCHAR(32) NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS pricing_category VARCHAR(32) NOT NULL DEFAULT 'core',
  ADD COLUMN IF NOT EXISTS base_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upcharge_price_per_gb DECIMAL(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_rate_per_gb DECIMAL(10,6),
  ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source VARCHAR(100) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

UPDATE region_egress_pricing
SET region_label = COALESCE(region_label, region_id)
WHERE region_label IS NULL;

UPDATE region_egress_pricing
SET customer_rate_per_gb = COALESCE(
  customer_rate_per_gb,
  COALESCE(base_price_per_gb, 0) + COALESCE(upcharge_price_per_gb, 0)
)
WHERE customer_rate_per_gb IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'region_egress_pricing_pricing_scope_check'
  ) THEN
    ALTER TABLE region_egress_pricing
      ADD CONSTRAINT region_egress_pricing_pricing_scope_check
      CHECK (pricing_scope IN ('global', 'region'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'region_egress_pricing_pricing_category_check'
  ) THEN
    ALTER TABLE region_egress_pricing
      ADD CONSTRAINT region_egress_pricing_pricing_category_check
      CHECK (pricing_category IN ('core', 'special', 'distributed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'region_egress_pricing_sync_status_check'
  ) THEN
    ALTER TABLE region_egress_pricing
      ADD CONSTRAINT region_egress_pricing_sync_status_check
      CHECK (sync_status IN ('pending', 'synced', 'manual', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_region_egress_pricing_region_id ON region_egress_pricing(region_id);
CREATE INDEX IF NOT EXISTS idx_region_egress_pricing_provider_type ON region_egress_pricing(provider_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_region_egress_pricing_provider_region_unique
  ON region_egress_pricing(provider_type, region_id);

DROP TRIGGER IF EXISTS update_region_egress_pricing_updated_at ON region_egress_pricing;
CREATE TRIGGER update_region_egress_pricing_updated_at
BEFORE UPDATE ON region_egress_pricing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
