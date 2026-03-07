-- Add vps_id to support_tickets table
ALTER TABLE support_tickets
ADD COLUMN vps_id UUID REFERENCES vps_instances(id) ON DELETE SET NULL;
