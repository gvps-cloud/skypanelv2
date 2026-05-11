-- Migration 073: Add persistent rate limit IP rules for trusted and blocked IPs

CREATE TABLE IF NOT EXISTS rate_limit_ip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL UNIQUE,
  rule_type varchar(20) NOT NULL CHECK (rule_type IN ('trusted', 'blocked')),
  max_requests integer CHECK (max_requests IS NULL OR max_requests > 0),
  window_ms integer CHECK (window_ms IS NULL OR window_ms > 0),
  reason text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_rules_rule_type
  ON rate_limit_ip_rules (rule_type);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_rules_expires_at
  ON rate_limit_ip_rules (expires_at);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_rules_created_by
  ON rate_limit_ip_rules (created_by);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_rate_limit_ip_rules_updated_at'
  ) THEN
    CREATE TRIGGER update_rate_limit_ip_rules_updated_at
      BEFORE UPDATE ON rate_limit_ip_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
