-- Migration 058: Add fraud checks table for FraudLabsPro integration

CREATE TABLE IF NOT EXISTS fraud_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  check_type varchar(50) NOT NULL,
  ip_address inet,
  email varchar(255),
  amount numeric(10,2),
  currency varchar(10),
  score integer,
  status varchar(20) NOT NULL,
  is_vpn boolean,
  is_proxy boolean,
  is_tor boolean,
  raw_response jsonb,
  action_taken varchar(20),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_checks_user ON fraud_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_org ON fraud_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_status ON fraud_checks(status);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_type ON fraud_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_created ON fraud_checks(created_at);
