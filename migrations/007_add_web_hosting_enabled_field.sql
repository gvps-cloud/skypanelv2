-- Migration 008: Add Web Hosting Enabled Field
-- Date: 2025-02-23
-- Description: Adds enabled field to enhance_config to control web hosting visibility

-- Add enabled column to enhance_config table
ALTER TABLE enhance_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;
