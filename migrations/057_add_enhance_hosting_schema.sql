-- Migration 057: Add Enhance hosting schema
-- Introduces the platform_integrations runtime toggle, hosting_plans catalog,
-- and hosting_subscriptions tables for the Enhance web hosting integration.

-- ============================================================
-- platform_integrations: generic runtime-toggled integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) UNIQUE NOT NULL,
  display_name varchar(255) NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  env_required text[],
  last_health_check_at timestamptz,
  last_health_status varchar(50),
  last_health_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed the Enhance integration row (disabled by default)
INSERT INTO platform_integrations (slug, display_name, description, enabled, env_required)
VALUES (
  'enhance',
  'Enhance Web Hosting',
  'Orchd/Enhance web hosting integration for shared hosting, WordPress, Node.js, and email services.',
  false,
  ARRAY['ENHANCE_API_URL', 'ENHANCE_MASTER_ORG_ID', 'ENHANCE_API_KEY']
)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_platform_integrations_slug ON platform_integrations(slug);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_integrations_updated_at ON platform_integrations;
CREATE TRIGGER trigger_platform_integrations_updated_at
  BEFORE UPDATE ON platform_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- organizations: Enhance customer mapping
-- ============================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enhance_customer_id varchar(255);

CREATE INDEX IF NOT EXISTS idx_organizations_enhance_customer_id ON organizations(enhance_customer_id);

-- ============================================================
-- hosting_plans: local catalog for purchasable hosting plans
-- ============================================================
CREATE TABLE IF NOT EXISTS hosting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enhance_plan_id varchar(255) UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  features jsonb DEFAULT '{}',
  service_type varchar(20) NOT NULL CHECK (service_type IN ('web','email','wordpress','node')),
  price_monthly numeric(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hosting_plans_active ON hosting_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_hosting_plans_service_type ON hosting_plans(service_type);

DROP TRIGGER IF EXISTS trigger_hosting_plans_updated_at ON hosting_plans;
CREATE TRIGGER trigger_hosting_plans_updated_at
  BEFORE UPDATE ON hosting_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- hosting_subscriptions: per-org purchased hosting records
-- ============================================================
CREATE TABLE IF NOT EXISTS hosting_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES hosting_plans(id) ON DELETE RESTRICT,
  domain varchar(255),
  enhance_subscription_id varchar(255),
  enhance_website_id varchar(255),
  primary_ip varchar(45),
  status varchar(20) NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','active','suspended','cancelled','error')),
  settings jsonb DEFAULT '{}',
  next_billing_at timestamptz,
  last_billed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_org_id ON hosting_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_status ON hosting_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_next_billing ON hosting_subscriptions(next_billing_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS trigger_hosting_subscriptions_updated_at ON hosting_subscriptions;
CREATE TRIGGER trigger_hosting_subscriptions_updated_at
  BEFORE UPDATE ON hosting_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS on hosting_subscriptions (mirror migration 048 pattern)
-- ============================================================
ALTER TABLE hosting_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org hosting subscriptions" ON hosting_subscriptions
  FOR SELECT USING (
    organization_id::text = current_setting('app.current_org_id', true)
    OR current_setting('app.current_org_id', true) IS NULL
    OR current_setting('app.current_user_is_admin', true) = 'true'
  );

CREATE POLICY "Admin can insert hosting subscriptions" ON hosting_subscriptions
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_is_admin', true) = 'true'
    OR organization_id::text = current_setting('app.current_org_id', true)
  );

CREATE POLICY "Admin can update hosting subscriptions" ON hosting_subscriptions
  FOR UPDATE USING (current_setting('app.current_user_is_admin', true) = 'true');

CREATE POLICY "Admin can delete hosting subscriptions" ON hosting_subscriptions
  FOR DELETE USING (current_setting('app.current_user_is_admin', true) = 'true');

-- ============================================================
-- RLS on hosting_plans (admin-only mutations, public reads)
-- ============================================================
ALTER TABLE hosting_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active hosting plans" ON hosting_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin can manage hosting plans" ON hosting_plans
  FOR ALL USING (current_setting('app.current_user_is_admin', true) = 'true');
