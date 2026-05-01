-- Add cancelled_at timestamp to hosting_subscriptions
ALTER TABLE hosting_subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN hosting_subscriptions.cancelled_at IS 'Timestamp when the subscription was cancelled';
