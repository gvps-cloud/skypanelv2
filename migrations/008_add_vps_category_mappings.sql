-- Migration 008: Add VPS category mappings for white-labeling

-- Create vps_category_mappings table
CREATE TABLE IF NOT EXISTS vps_category_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES service_providers(id) ON DELETE CASCADE,
  original_category VARCHAR(50) NOT NULL,
  custom_name VARCHAR(100) NOT NULL,
  custom_description TEXT,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, original_category)
);

-- Add indexes for vps_category_mappings
CREATE INDEX IF NOT EXISTS idx_vps_category_mappings_provider_id ON vps_category_mappings(provider_id);
CREATE INDEX IF NOT EXISTS idx_vps_category_mappings_original_category ON vps_category_mappings(original_category);
CREATE INDEX IF NOT EXISTS idx_vps_category_mappings_enabled ON vps_category_mappings(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_vps_category_mappings_display_order ON vps_category_mappings(display_order);

-- Add comments
COMMENT ON TABLE vps_category_mappings IS 'White-label category mappings for VPS plan types';
COMMENT ON COLUMN vps_category_mappings.id IS 'Unique identifier for the category mapping';
COMMENT ON COLUMN vps_category_mappings.provider_id IS 'Optional provider ID for multi-provider support (null means applies to all providers)';
COMMENT ON COLUMN vps_category_mappings.original_category IS 'Original category from provider API (e.g., standard, premium, gpu, cpu, memory, accelerated, nanode)';
COMMENT ON COLUMN vps_category_mappings.custom_name IS 'Custom display name for white-labeling';
COMMENT ON COLUMN vps_category_mappings.custom_description IS 'Optional custom description for the category';
COMMENT ON COLUMN vps_category_mappings.display_order IS 'Order for displaying categories in UI (lower numbers first)';
COMMENT ON COLUMN vps_category_mappings.enabled IS 'Whether this mapping is active';
COMMENT ON COLUMN vps_category_mappings.created_at IS 'Timestamp when the mapping was created';
COMMENT ON COLUMN vps_category_mappings.updated_at IS 'Timestamp when the mapping was last updated';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vps_category_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vps_category_mappings_updated_at
  BEFORE UPDATE ON vps_category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_vps_category_mappings_updated_at();

-- Insert default mappings (can be customized by admins)
INSERT INTO vps_category_mappings (original_category, custom_name, custom_description, display_order) VALUES
  ('standard', 'Standard VPS', 'Standard VPS plans offer a good mix of performance, resources, and price for most workloads.', 1),
  ('nanode', 'Basic VPS', 'Affordable entry-level plans perfect for testing, development, and lightweight applications.', 2),
  ('dedicated', 'Dedicated CPU', 'Dedicated CPU plans give you full access to CPU cores for consistent performance.', 3),
  ('premium', 'Premium Performance', 'Premium plans offer the latest high-performance CPUs with consistent performance for demanding workloads.', 4),
  ('highmem', 'High Memory', 'High Memory plans favor RAM over other resources, great for caching and in-memory databases.', 5),
  ('gpu', 'GPU Accelerated', 'GPU plans include dedicated GPUs for machine learning, AI, and video transcoding workloads.', 6),
  ('accelerated', 'Accelerated', 'Accelerated plans provide enhanced performance for I/O-intensive workloads.', 7)
ON CONFLICT (provider_id, original_category) DO NOTHING;