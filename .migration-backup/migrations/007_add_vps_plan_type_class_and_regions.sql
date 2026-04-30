-- Migration 007: Add type_class to vps_plans and create vps_plan_regions junction table

-- Add type_class column to vps_plans table
ALTER TABLE vps_plans
ADD COLUMN IF NOT EXISTS type_class VARCHAR(50) DEFAULT 'standard';

-- Add index on type_class for filtering
CREATE INDEX IF NOT EXISTS idx_vps_plans_type_class ON vps_plans(type_class);

-- Add comment for type_class
COMMENT ON COLUMN vps_plans.type_class IS 'Plan type class from Linode API: standard, dedicated, premium, gpu, accelerated, highmem, nanode';

-- Create vps_plan_regions junction table
CREATE TABLE IF NOT EXISTS vps_plan_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vps_plan_id UUID NOT NULL REFERENCES vps_plans(id) ON DELETE CASCADE,
  region_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vps_plan_id, region_id)
);

-- Add indexes for vps_plan_regions
CREATE INDEX IF NOT EXISTS idx_vps_plan_regions_vps_plan_id ON vps_plan_regions(vps_plan_id);
CREATE INDEX IF NOT EXISTS idx_vps_plan_regions_region_id ON vps_plan_regions(region_id);

-- Add comments
COMMENT ON TABLE vps_plan_regions IS 'Junction table linking VPS plans to available regions';
COMMENT ON COLUMN vps_plan_regions.vps_plan_id IS 'Foreign key to vps_plans table';
COMMENT ON COLUMN vps_plan_regions.region_id IS 'Region identifier (e.g., us-east, ca-central)';
