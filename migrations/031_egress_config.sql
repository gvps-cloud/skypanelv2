-- Migration: Add Egress Configuration Settings
-- Description: Adds configurable settings for egress credit system
-- Date: 2025-03-20

-- Add warning threshold configuration
-- This allows admins to configure when low balance warnings are shown
INSERT INTO platform_settings (key, value)
VALUES (
    'egress_warning_threshold_gb',
    '200'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Note: egress_credit_packs was already added in migration 030
-- This migration just adds the threshold configuration
