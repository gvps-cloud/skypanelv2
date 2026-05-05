-- Immutable snapshots for hosting context on support tickets (parity with VPS snapshots)

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS hosting_domain_snapshot varchar(255),
ADD COLUMN IF NOT EXISTS hosting_plan_name_snapshot varchar(255);

COMMENT ON COLUMN support_tickets.hosting_domain_snapshot IS 'Domain captured when the ticket was created if a hosting subscription was linked.';
COMMENT ON COLUMN support_tickets.hosting_plan_name_snapshot IS 'Hosting plan display name captured when the ticket was created if a hosting subscription was linked.';
