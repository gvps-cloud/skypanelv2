-- Add last_warning_sent_at to hosting_subscriptions for balance warning deduplication
ALTER TABLE hosting_subscriptions
ADD COLUMN IF NOT EXISTS last_warning_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_last_warning
ON hosting_subscriptions(last_warning_sent_at);
