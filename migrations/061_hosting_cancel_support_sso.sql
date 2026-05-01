-- Migration 061: Add hosting_subscription_id to support_tickets for reactivation flow
-- and enhance_member_id to organizations for SSO link resolution

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS hosting_subscription_id uuid REFERENCES hosting_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS enhance_member_id varchar(255);

CREATE INDEX IF NOT EXISTS idx_support_tickets_hosting_subscription_id ON support_tickets(hosting_subscription_id);
