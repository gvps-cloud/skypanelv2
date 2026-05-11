-- Migration 074: Add indexes on ip_address for admin IP activity queries

CREATE INDEX IF NOT EXISTS idx_activity_logs_ip_address
  ON activity_logs (ip_address)
  WHERE ip_address IS NOT NULL AND ip_address <> '';

CREATE INDEX IF NOT EXISTS idx_fraud_checks_ip_address
  ON fraud_checks (ip_address)
  WHERE ip_address IS NOT NULL;
