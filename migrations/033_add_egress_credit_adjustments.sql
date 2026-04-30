-- Add reason column to egress_credit_packs for admin credit adjustments
ALTER TABLE egress_credit_packs 
ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add adjustment_type column to track add/remove operations
ALTER TABLE egress_credit_packs 
ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(20) NOT NULL DEFAULT 'purchase';

-- Create check constraint for adjustment_type
ALTER TABLE egress_credit_packs 
DROP CONSTRAINT IF EXISTS egress_credit_packs_adjustment_type_check;

ALTER TABLE egress_credit_packs 
ADD CONSTRAINT egress_credit_packs_adjustment_type_check 
CHECK (adjustment_type IN ('purchase', 'admin_add', 'admin_remove'));

-- Update comment
COMMENT ON TABLE egress_credit_packs IS 'Records all egress credit transactions: purchases via PayPal and admin adjustments';
