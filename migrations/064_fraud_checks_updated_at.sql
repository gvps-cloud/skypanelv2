-- Migration 064: Add updated_at column to fraud_checks table
-- Fixes bug where admin override endpoint references updated_at but column doesn't exist

ALTER TABLE fraud_checks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
