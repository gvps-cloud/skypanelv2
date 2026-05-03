-- Migration 063: Add dedicated hosting wallets
-- Keeps the existing wallets table as the main VPS/general wallet and adds
-- an organization-scoped wallet for monthly Enhance hosting charges.

CREATE TABLE IF NOT EXISTS hosting_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  balance DECIMAL(12,6) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hosting_wallets_org_id ON hosting_wallets(organization_id);

WITH seeded_hosting_wallets AS (
  INSERT INTO hosting_wallets (organization_id, balance, currency)
  SELECT
    w.organization_id,
    GREATEST(
      0,
      LEAST(
        w.balance,
        COALESCE(active_hosting.monthly_total, 0)
      )
    ),
    COALESCE(w.currency, 'USD')
  FROM wallets w
  LEFT JOIN (
    SELECT hs.organization_id, SUM(hp.price_monthly) AS monthly_total
    FROM hosting_subscriptions hs
    JOIN hosting_plans hp ON hp.id = hs.plan_id
    WHERE hs.status = 'active'
    GROUP BY hs.organization_id
  ) active_hosting ON active_hosting.organization_id = w.organization_id
  ON CONFLICT (organization_id) DO NOTHING
  RETURNING organization_id, balance
)
UPDATE wallets w
SET balance = w.balance - hw.balance,
    updated_at = NOW()
FROM seeded_hosting_wallets hw
WHERE hw.organization_id = w.organization_id
  AND hw.balance > 0;

DROP TRIGGER IF EXISTS trigger_hosting_wallets_updated_at ON hosting_wallets;
CREATE TRIGGER trigger_hosting_wallets_updated_at
  BEFORE UPDATE ON hosting_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE hosting_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org hosting wallet" ON hosting_wallets;
CREATE POLICY "Users can view org hosting wallet" ON hosting_wallets
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_org_id', true)
    OR current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_user_is_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Admin can insert hosting wallet" ON hosting_wallets;
CREATE POLICY "Admin can insert hosting wallet" ON hosting_wallets
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_is_admin', true) = 'true'
  );

DROP POLICY IF EXISTS "Admin or billing manager can update hosting wallet" ON hosting_wallets;
CREATE POLICY "Admin or billing manager can update hosting wallet" ON hosting_wallets
  FOR UPDATE USING (
    current_setting('app.current_user_is_admin', true) = 'true'
  );
