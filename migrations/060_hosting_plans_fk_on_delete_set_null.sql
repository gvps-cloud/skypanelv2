-- Migration 060: Make hosting_subscriptions.plan_id nullable and FK ON DELETE SET NULL
-- This allows deleting hosting_plans without blocking on old (cancelled/error) subscriptions.

BEGIN;

-- Drop existing FK constraint
ALTER TABLE hosting_subscriptions
  DROP CONSTRAINT IF EXISTS hosting_subscriptions_plan_id_fkey;

-- Make plan_id nullable so FK can be set to NULL on plan deletion
ALTER TABLE hosting_subscriptions
  ALTER COLUMN plan_id DROP NOT NULL;

-- Recreate FK with ON DELETE SET NULL
ALTER TABLE hosting_subscriptions
  ADD CONSTRAINT hosting_subscriptions_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES hosting_plans(id) ON DELETE SET NULL;

COMMIT;
