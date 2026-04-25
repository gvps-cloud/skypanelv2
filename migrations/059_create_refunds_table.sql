-- Migration 059: Create refunds table for structured refund management

CREATE TYPE refund_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  original_billing_cycle_id uuid REFERENCES vps_billing_cycles(id) ON DELETE SET NULL,
  original_hosting_subscription_id uuid REFERENCES hosting_subscriptions(id) ON DELETE SET NULL,
  paypal_capture_id varchar(255),
  amount numeric(10,2) NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'USD',
  reason text NOT NULL,
  status refund_status NOT NULL DEFAULT 'pending',
  initiated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  initiated_by_type varchar(20) NOT NULL,
  provider_refund_id varchar(255),
  provider_response jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_org ON refunds(organization_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_original_txn ON refunds(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON refunds(created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refunds_updated_at ON refunds;
CREATE TRIGGER trigger_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add provider_capture_id to payment_transactions for true PayPal refunds
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS provider_capture_id varchar(255);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_capture_id ON payment_transactions(provider_capture_id);
