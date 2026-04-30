ALTER TABLE wallets
  ALTER COLUMN balance TYPE DECIMAL(12,4) USING ROUND(balance::numeric, 4),
  ALTER COLUMN balance SET DEFAULT 0.0000;

ALTER TABLE payment_transactions
  ALTER COLUMN amount TYPE DECIMAL(12,4) USING ROUND(amount::numeric, 4);

ALTER TABLE IF EXISTS billing_invoices
  ALTER COLUMN total_amount TYPE DECIMAL(12,4) USING ROUND(total_amount::numeric, 4),
  ALTER COLUMN total_amount SET DEFAULT 0.0000;

ALTER TABLE vps_billing_cycles
  ALTER COLUMN total_amount TYPE DECIMAL(12,4) USING ROUND(total_amount::numeric, 4);
