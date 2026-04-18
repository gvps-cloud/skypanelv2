-- Fix: mark_all_notifications_read() was not scoped by organization_id.
-- A user in multiple orgs would mark ALL their notifications read across all orgs.
-- Update the function to accept organization_id and filter by it.

CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_id_param UUID, organization_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE activity_logs
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = user_id_param
    AND organization_id = organization_id_param
    AND is_read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
