-- Remove pending status from payment_transactions
-- Since PayPal payments are either completed or failed immediately, we don't need pending status

-- First, update any existing pending transactions to failed status
UPDATE payment_transactions
SET status = 'failed',
    updated_at = NOW()
WHERE status = 'pending';

-- Then remove pending from the check constraint
ALTER TABLE payment_transactions
DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

-- Add the new check constraint without pending status
ALTER TABLE payment_transactions
ADD CONSTRAINT payment_transactions_status_check
CHECK (status IN ('completed', 'failed', 'cancelled', 'refunded'));

-- Update the default value from 'pending' to 'failed'
ALTER TABLE payment_transactions
ALTER COLUMN status SET DEFAULT 'failed';

COMMENT ON TABLE payment_transactions IS 'Stores payment transaction records with completed/failed/cancelled/refunded statuses';
COMMENT ON COLUMN payment_transactions.status IS 'Transaction status: completed, failed, cancelled, or refunded (no pending - payments resolve immediately)';