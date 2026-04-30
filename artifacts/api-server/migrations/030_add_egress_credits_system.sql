-- Migration: Add Egress Credits System
-- Description: Implements pre-paid credits for hourly egress billing to prevent abuse
-- Date: 2025-03-19

-- Organization egress credits balance table
CREATE TABLE IF NOT EXISTS organization_egress_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    credits_gb DECIMAL(18,6) NOT NULL DEFAULT 0 CHECK (credits_gb >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_egress_credits_org_id ON organization_egress_credits(organization_id);

-- Credit pack purchases history
CREATE TABLE IF NOT EXISTS egress_credit_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pack_id VARCHAR(50) NOT NULL,
    credits_gb DECIMAL(18,6) NOT NULL,
    amount_paid DECIMAL(12,6) NOT NULL,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_egress_credit_packs_org_id ON egress_credit_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_egress_credit_packs_transaction_id ON egress_credit_packs(payment_transaction_id);

-- Hourly transfer readings for delta calculation
CREATE TABLE IF NOT EXISTS vps_egress_hourly_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vps_instance_id UUID NOT NULL REFERENCES vps_instances(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    provider_instance_id INT NOT NULL,
    transfer_used_gb DECIMAL(18,6) NOT NULL,
    delta_gb DECIMAL(18,6) NOT NULL,
    credits_deducted_gb DECIMAL(18,6) NOT NULL,
    reading_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vps_egress_hourly_readings_vps_id ON vps_egress_hourly_readings(vps_instance_id);
CREATE INDEX IF NOT EXISTS idx_vps_egress_hourly_readings_org_id ON vps_egress_hourly_readings(organization_id);
CREATE INDEX IF NOT EXISTS idx_vps_egress_hourly_readings_reading_at ON vps_egress_hourly_readings(reading_at);

-- Add egress credit pack configuration to platform settings
INSERT INTO platform_settings (key, value)
VALUES (
    'egress_credit_packs',
    '[{"id":"100GB","gb":100,"price":0.50},{"id":"1TB","gb":1000,"price":5.00},{"id":"5TB","gb":5000,"price":25.00},{"id":"10TB","gb":10000,"price":50.00}]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Create triggers for updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organization_egress_credits'
      AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_org_egress_credits_updated_at ON organization_egress_credits;
    CREATE TRIGGER update_org_egress_credits_updated_at
    BEFORE UPDATE ON organization_egress_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE organization_egress_credits IS 'Stores pre-paid egress credits balance per organization for hourly billing enforcement';
COMMENT ON TABLE egress_credit_packs IS 'Records all egress credit pack purchases via PayPal';
COMMENT ON TABLE vps_egress_hourly_readings IS 'Hourly transfer readings for delta calculation and credit deduction tracking';
