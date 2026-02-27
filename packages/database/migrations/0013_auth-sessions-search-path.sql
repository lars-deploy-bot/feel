-- Migration: Harden auth_sessions SECURITY DEFINER functions with explicit search_path.
-- Prevents search_path injection attacks on SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION iam.revoke_auth_session(
  p_user_id text,
  p_sid text,
  p_revoked_by text DEFAULT 'user'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE iam.auth_sessions
  SET revoked_at = now(), revoked_by = p_revoked_by
  WHERE sid = p_sid
    AND user_id = p_user_id
    AND revoked_at IS NULL;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

CREATE OR REPLACE FUNCTION iam.revoke_other_auth_sessions(
  p_user_id text,
  p_current_sid text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE iam.auth_sessions
  SET revoked_at = now(), revoked_by = 'user'
  WHERE user_id = p_user_id
    AND sid != p_current_sid
    AND revoked_at IS NULL;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

CREATE OR REPLACE FUNCTION iam.touch_auth_session(
  p_sid text,
  p_user_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
BEGIN
  UPDATE iam.auth_sessions
  SET last_active_at = now()
  WHERE sid = p_sid
    AND user_id = p_user_id
    AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION iam.cleanup_expired_auth_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
DECLARE
  rows_affected integer;
BEGIN
  DELETE FROM iam.auth_sessions
  WHERE expires_at < now();
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;
