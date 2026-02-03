-- Database function for cleaning up expired secrets
--
-- SECURITY: This function is BACKEND-ONLY. It must NEVER be exposed to clients.
-- - Only granted to service_role (requires SUPABASE_SERVICE_KEY)
-- - Uses SECURITY DEFINER to bypass RLS (intentional for cross-tenant cleanup)
-- - Should be called via: pg_cron, backend cron job, or admin scripts
-- - NEVER call from client-side code or with anon/authenticated keys
--
-- Recommended: Use pg_cron (Method 3) or backend script (Method 1) for production.

CREATE OR REPLACE FUNCTION lockbox.cleanup_expired_secrets(
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE (
  deleted_count integer,
  expired_count integer,
  oldest_expired timestamptz,
  instance_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
-- Restrict to service_role only - this is enforced at GRANT level but adding
-- an explicit check prevents accidental exposure if grants change
SET search_path = lockbox, pg_temp
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_expired_count integer;
  v_oldest_expired timestamptz;
  v_instance_breakdown jsonb;
  v_current_role text;
BEGIN
  -- SECURITY: Verify caller is service_role (defense in depth)
  SELECT current_setting('role', true) INTO v_current_role;
  IF v_current_role IS DISTINCT FROM 'service_role' AND
     NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'cleanup_expired_secrets can only be called by service_role or superuser';
  END IF;

  -- Count expired secrets
  SELECT COUNT(*)
  INTO v_expired_count
  FROM lockbox.user_secrets
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  -- Get oldest expired secret
  SELECT MIN(expires_at)
  INTO v_oldest_expired
  FROM lockbox.user_secrets
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  -- Get breakdown by instance_id
  SELECT jsonb_object_agg(
    COALESCE(instance_id, 'default'),
    count
  )
  INTO v_instance_breakdown
  FROM (
    SELECT instance_id, COUNT(*) as count
    FROM lockbox.user_secrets
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
    GROUP BY instance_id
  ) AS instance_counts;

  -- Perform deletion if not a dry run
  IF NOT p_dry_run AND v_expired_count > 0 THEN
    DELETE FROM lockbox.user_secrets
    WHERE expires_at IS NOT NULL
      AND expires_at < now();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  -- Return results
  RETURN QUERY
  SELECT
    v_deleted_count,
    v_expired_count,
    v_oldest_expired,
    COALESCE(v_instance_breakdown, '{}'::jsonb);
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION lockbox.cleanup_expired_secrets TO service_role;

-- Optional: Create a scheduled job using pg_cron (if available)
-- This requires pg_cron extension to be enabled
/*
-- Enable pg_cron extension (run as superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-secrets',  -- job name
  '0 3 * * *',                -- cron expression (daily at 3 AM)
  $$SELECT lockbox.cleanup_expired_secrets(false);$$
);

-- To view scheduled jobs:
SELECT * FROM cron.job;

-- To remove the scheduled job:
SELECT cron.unschedule('cleanup-expired-secrets');
*/

-- Example usage:

-- Dry run to see what would be deleted
-- SELECT * FROM lockbox.cleanup_expired_secrets(true);

-- Actually delete expired secrets
-- SELECT * FROM lockbox.cleanup_expired_secrets(false);

-- Check for expired secrets without deleting
/*
SELECT
  instance_id,
  namespace,
  name,
  version,
  expires_at,
  age(now(), expires_at) as expired_for
FROM lockbox.user_secrets
WHERE expires_at IS NOT NULL
  AND expires_at < now()
ORDER BY expires_at ASC
LIMIT 20;
*/