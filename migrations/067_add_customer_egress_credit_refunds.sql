-- Migration 067: Allow customer egress credit refunds (sell credits back to main wallet)

ALTER TABLE egress_credit_packs
DROP CONSTRAINT IF EXISTS egress_credit_packs_adjustment_type_check;

ALTER TABLE egress_credit_packs
ADD CONSTRAINT egress_credit_packs_adjustment_type_check
CHECK (adjustment_type IN ('purchase', 'admin_add', 'admin_remove', 'customer_refund'));
