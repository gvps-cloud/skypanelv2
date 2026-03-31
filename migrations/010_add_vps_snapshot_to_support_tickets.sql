-- Migration 010: Add VPS snapshot fields to support tickets
-- This allows VPS information to be retained even if the VPS is deleted

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS vps_label_snapshot VARCHAR(255),
ADD COLUMN IF NOT EXISTS vps_ip_snapshot INET;

-- Backfill existing tickets with current VPS information
UPDATE support_tickets st
SET
    vps_label_snapshot = vi.label,
    vps_ip_snapshot = vi.ip_address
FROM vps_instances vi
WHERE st.vps_id = vi.id;

-- Index for faster searching on snapshot fields if needed (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_support_tickets_vps_label_snapshot ON support_tickets(vps_label_snapshot);
