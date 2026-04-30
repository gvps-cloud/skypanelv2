-- Migration 006: Add 2FA columns to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_users_2fa_enabled ON users(two_factor_enabled);
