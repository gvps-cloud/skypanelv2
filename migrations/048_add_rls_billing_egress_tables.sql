/**
 * Migration: 048_add_rls_billing_egress_tables
 * Adds Row-Level Security (RLS) policies to billing and egress tables
 * for defense-in-depth organization data isolation.
 *
 * Note: RLS policies alone are not sufficient - application-level checks
 * (requireOrganization, checkOrganizationMembership) must also be applied.
 * RLS provides an additional layer of protection against accidental data
 * leakage through direct database access.
 *
 * This migration is DEFENSIVE - it only applies RLS to tables that exist,
 * making it safe to run on any database state.
 */

DO $$
BEGIN
  -- Enable RLS on organization_egress_billing_cycles if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_egress_billing_cycles'
  ) THEN
    ALTER TABLE organization_egress_billing_cycles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org billing cycles" ON organization_egress_billing_cycles
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can insert billing cycles" ON organization_egress_billing_cycles
        FOR INSERT WITH CHECK (
            current_setting('app.current_user_is_admin', true) = 'true'
            OR organization_id::TEXT = current_setting('app.current_org_id', true)
        );

    CREATE POLICY "Admin can update billing cycles" ON organization_egress_billing_cycles
        FOR UPDATE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can delete billing cycles" ON organization_egress_billing_cycles
        FOR DELETE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on organization_egress_billing_cycles';
  ELSE
    RAISE NOTICE 'Skipping organization_egress_billing_cycles (table does not exist)';
  END IF;

  -- Enable RLS on organization_egress_billing_allocations if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_egress_billing_allocations'
  ) THEN
    ALTER TABLE organization_egress_billing_allocations ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org billing allocations" ON organization_egress_billing_allocations
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can insert billing allocations" ON organization_egress_billing_allocations
        FOR INSERT WITH CHECK (
            current_setting('app.current_user_is_admin', true) = 'true'
            OR organization_id::TEXT = current_setting('app.current_org_id', true)
        );

    CREATE POLICY "Admin can update billing allocations" ON organization_egress_billing_allocations
        FOR UPDATE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can delete billing allocations" ON organization_egress_billing_allocations
        FOR DELETE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on organization_egress_billing_allocations';
  ELSE
    RAISE NOTICE 'Skipping organization_egress_billing_allocations (table does not exist)';
  END IF;

  -- Enable RLS on wallets if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) THEN
    ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org wallet" ON wallets
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin or billing manager can update wallet" ON wallets
        FOR UPDATE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on wallets';
  ELSE
    RAISE NOTICE 'Skipping wallets (table does not exist)';
  END IF;

  -- Enable RLS on payment_transactions if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_transactions'
  ) THEN
    ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org transactions" ON payment_transactions
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can insert transactions" ON payment_transactions
        FOR INSERT WITH CHECK (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    -- Transactions should not be updated once created
    CREATE POLICY "No updates to transactions" ON payment_transactions
        FOR UPDATE USING (false);

    CREATE POLICY "Admin can delete transactions" ON payment_transactions
        FOR DELETE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on payment_transactions';
  ELSE
    RAISE NOTICE 'Skipping payment_transactions (table does not exist)';
  END IF;

  -- Enable RLS on billing_invoices if table exists (actual invoice table name)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'billing_invoices'
  ) THEN
    ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org invoices" ON billing_invoices
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can insert invoices" ON billing_invoices
        FOR INSERT WITH CHECK (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    -- Invoices should not be updated once issued
    CREATE POLICY "No updates to invoices" ON billing_invoices
        FOR UPDATE USING (false);

    CREATE POLICY "Admin can delete invoices" ON billing_invoices
        FOR DELETE USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on billing_invoices';
  ELSE
    RAISE NOTICE 'Skipping billing_invoices (table does not exist)';
  END IF;

  -- Enable RLS on organization_egress_credits if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_egress_credits'
  ) THEN
    ALTER TABLE organization_egress_credits ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view org egress credits" ON organization_egress_credits
        FOR SELECT USING (
            organization_id::TEXT = current_setting('app.current_org_id', true)
            OR current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_user_is_admin', true) = 'true'
        );

    CREATE POLICY "Admin can manage egress credits" ON organization_egress_credits
        FOR ALL USING (
            current_setting('app.current_user_is_admin', true) = 'true'
        );

    RAISE NOTICE 'RLS enabled on organization_egress_credits';
  ELSE
    RAISE NOTICE 'Skipping organization_egress_credits (table does not exist)';
  END IF;

END;
$$ LANGUAGE plpgsql;

-- region_egress_pricing is a global/pricing table - no RLS needed for org isolation
-- Modifications are controlled at application level by admin role checks
