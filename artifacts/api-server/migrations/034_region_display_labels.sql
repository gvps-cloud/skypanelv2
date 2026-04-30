-- Migration: 034_region_display_labels
-- Purpose: Store custom display labels for regions to enable whitelabeling
-- This allows admins to show friendly names like "US East" instead of "Newark"

CREATE TABLE IF NOT EXISTS region_display_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'linode',
  display_label VARCHAR(100) NOT NULL,
  display_country VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_region_display_labels_region ON region_display_labels(region_id);
CREATE INDEX IF NOT EXISTS idx_region_display_labels_provider ON region_display_labels(provider);

-- Seed default whitelabel names for known Linode regions
INSERT INTO region_display_labels (region_id, provider, display_label, display_country) VALUES
  -- Americas
  ('us-east', 'linode', 'US East (Newark)', 'United States'),
  ('us-west', 'linode', 'US West (Fremont)', 'United States'),
  ('us-central', 'linode', 'US Central (Dallas)', 'United States'),
  ('us-southeast', 'linode', 'US Southeast (Atlanta)', 'United States'),
  ('us-ord', 'linode', 'US Central (Chicago)', 'United States'),
  ('us-lax', 'linode', 'US West (Los Angeles)', 'United States'),
  ('us-mia', 'linode', 'US Southeast (Miami)', 'United States'),
  ('us-sea', 'linode', 'US West (Seattle)', 'United States'),
  ('us-iad', 'linode', 'US East (Washington D.C.)', 'United States'),
  ('ca-central', 'linode', 'Canada (Toronto)', 'Canada'),
  ('br-gru', 'linode', 'Brazil (São Paulo)', 'Brazil'),
  -- Europe
  ('eu-west', 'linode', 'EU West (London)', 'United Kingdom'),
  ('eu-central', 'linode', 'EU Central (Frankfurt)', 'Germany'),
  ('nl-ams', 'linode', 'EU West (Amsterdam)', 'Netherlands'),
  ('de-fra-2', 'linode', 'EU Central (Frankfurt)', 'Germany'),
  ('gb-lon', 'linode', 'EU West (London)', 'United Kingdom'),
  ('es-mad', 'linode', 'EU South (Madrid)', 'Spain'),
  ('it-mil', 'linode', 'EU South (Milan)', 'Italy'),
  ('fr-par', 'linode', 'EU West (Paris)', 'France'),
  ('fr-par-2', 'linode', 'EU West (Paris)', 'France'),
  ('se-sto', 'linode', 'EU North (Stockholm)', 'Sweden'),
  -- Asia-Pacific
  ('ap-south', 'linode', 'Asia Pacific (Singapore)', 'Singapore'),
  ('ap-northeast', 'linode', 'Asia Pacific (Tokyo)', 'Japan'),
  ('ap-southeast', 'linode', 'Asia Pacific (Sydney)', 'Australia'),
  ('ap-west', 'linode', 'Asia Pacific (Mumbai)', 'India'),
  ('in-maa', 'linode', 'Asia Pacific (Chennai)', 'India'),
  ('in-bom-2', 'linode', 'Asia Pacific (Mumbai)', 'India'),
  ('jp-tyo-3', 'linode', 'Asia Pacific (Tokyo)', 'Japan'),
  ('jp-osa', 'linode', 'Asia Pacific (Osaka)', 'Japan'),
  ('sg-sin-2', 'linode', 'Asia Pacific (Singapore)', 'Singapore'),
  ('id-cgk', 'linode', 'Asia Pacific (Jakarta)', 'Indonesia'),
  ('au-mel', 'linode', 'Oceania (Melbourne)', 'Australia')
ON CONFLICT (region_id, provider) DO NOTHING;
