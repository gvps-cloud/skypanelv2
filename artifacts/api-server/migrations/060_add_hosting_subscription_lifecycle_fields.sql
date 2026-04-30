-- ============================================================
-- Migration 060: Hosting subscription lifecycle fields
-- ============================================================
-- Adds two columns previously missing from `hosting_subscriptions`:
--   * server_group_id  – the Enhance server-group id selected at purchase
--                        time, so the customer-facing list / detail pages
--                        can show *where* their site is hosted without
--                        making per-row Enhance API calls.
--   * cancelled_at     – the actual moment a subscription was cancelled.
--                        Previously the UI inferred this from `updated_at`,
--                        which is unreliable because any subsequent row
--                        update would clobber the cancellation timestamp.
-- ============================================================

ALTER TABLE hosting_subscriptions
  ADD COLUMN IF NOT EXISTS server_group_id varchar(64),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Backfill `cancelled_at` for already-cancelled rows using the best signal
-- we have today (`updated_at`). Newly-cancelled rows will get a real
-- timestamp via the cancel endpoint.
UPDATE hosting_subscriptions
   SET cancelled_at = updated_at
 WHERE status = 'cancelled'
   AND cancelled_at IS NULL;
