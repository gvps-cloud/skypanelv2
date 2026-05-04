-- Migration 066: Add durable Enhance hosting billing cycles

CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  html_content text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  total_amount numeric(12,4) NOT NULL DEFAULT 0.0000,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_created_at ON billing_invoices(created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hosting_billing_cycle_status') THEN
    CREATE TYPE hosting_billing_cycle_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hosting_billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hosting_subscription_id uuid NOT NULL REFERENCES hosting_subscriptions(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES hosting_plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  domain text NOT NULL,
  cycle_type varchar(20) NOT NULL DEFAULT 'renewal',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount numeric(12,6) NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'USD',
  status hosting_billing_cycle_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES billing_invoices(id) ON DELETE SET NULL,
  refunded_amount numeric(12,6) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hosting_billing_cycles_cycle_type_check
    CHECK (cycle_type IN ('initial', 'renewal', 'manual')),
  CONSTRAINT hosting_billing_cycles_period_check
    CHECK (period_end > period_start),
  CONSTRAINT hosting_billing_cycles_amount_check
    CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_org ON hosting_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_subscription ON hosting_billing_cycles(hosting_subscription_id);
CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_status ON hosting_billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_period ON hosting_billing_cycles(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_transaction ON hosting_billing_cycles(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_hosting_billing_cycles_invoice ON hosting_billing_cycles(invoice_id);

DROP TRIGGER IF EXISTS trigger_hosting_billing_cycles_updated_at ON hosting_billing_cycles;
CREATE TRIGGER trigger_hosting_billing_cycles_updated_at
  BEFORE UPDATE ON hosting_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS original_hosting_billing_cycle_id uuid REFERENCES hosting_billing_cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_original_hosting_cycle
  ON refunds(original_hosting_billing_cycle_id);
