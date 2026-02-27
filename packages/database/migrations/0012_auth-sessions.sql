-- Migration: Auth Sessions Table
-- Tracks server-side login sessions for session listing and remote revocation.

CREATE TABLE iam.auth_sessions (
  auth_session_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sid text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
  user_agent text,
  ip_address inet,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by text
);

CREATE INDEX idx_auth_sessions_user_active ON iam.auth_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_sessions_expires ON iam.auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_sid ON iam.auth_sessions(sid);

-- Revoke a single session (returns true if revoked, false if not found)
CREATE OR REPLACE FUNCTION iam.revoke_auth_session(
  p_user_id text,
  p_sid text,
  p_revoked_by text DEFAULT 'user'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Revoke all sessions except the current one (returns count of revoked)
CREATE OR REPLACE FUNCTION iam.revoke_other_auth_sessions(
  p_user_id text,
  p_current_sid text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Touch last_active_at for a session
CREATE OR REPLACE FUNCTION iam.touch_auth_session(
  p_sid text,
  p_user_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE iam.auth_sessions
  SET last_active_at = now()
  WHERE sid = p_sid
    AND user_id = p_user_id
    AND revoked_at IS NULL;
END;
$$;

-- Cleanup expired sessions (returns count of deleted)
CREATE OR REPLACE FUNCTION iam.cleanup_expired_auth_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute to service_role only
GRANT EXECUTE ON FUNCTION iam.revoke_auth_session(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION iam.revoke_other_auth_sessions(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION iam.touch_auth_session(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION iam.cleanup_expired_auth_sessions() TO service_role;
GRANT ALL ON iam.auth_sessions TO service_role;
