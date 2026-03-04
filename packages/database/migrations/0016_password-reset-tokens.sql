-- Migration: Password reset tokens for manager-issued resets.
-- Adds one-time reset tokens and atomic consume function that updates iam.users.password_hash.

CREATE TABLE iam.password_reset_tokens (
  reset_token_id text PRIMARY KEY DEFAULT gen_prefixed_id('prt_'::text),
  user_id text NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  issued_by text NOT NULL DEFAULT 'manager'
);

CREATE INDEX idx_password_reset_tokens_user_active
  ON iam.password_reset_tokens(user_id)
  WHERE used_at IS NULL;

CREATE INDEX idx_password_reset_tokens_expires_at
  ON iam.password_reset_tokens(expires_at);

CREATE OR REPLACE FUNCTION iam.issue_password_reset_token(
  p_user_id text,
  p_token_hash text,
  p_expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
BEGIN
  -- Invalidate previous unused tokens for the same user.
  UPDATE iam.password_reset_tokens
  SET used_at = now()
  WHERE user_id = p_user_id
    AND used_at IS NULL;

  INSERT INTO iam.password_reset_tokens (user_id, token_hash, expires_at)
  VALUES (p_user_id, p_token_hash, p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION iam.consume_password_reset_token(
  p_token_hash text,
  p_new_password_hash text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = iam
AS $$
DECLARE
  v_user_id text;
BEGIN
  UPDATE iam.password_reset_tokens
  SET used_at = now()
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE iam.users
  SET password_hash = p_new_password_hash,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Force re-authentication everywhere after password reset.
  UPDATE iam.auth_sessions
  SET revoked_at = now(),
      revoked_by = 'password_reset'
  WHERE user_id = v_user_id
    AND revoked_at IS NULL;

  DELETE FROM iam.sessions
  WHERE user_id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION iam.issue_password_reset_token(text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION iam.consume_password_reset_token(text, text) TO service_role;
GRANT ALL ON iam.password_reset_tokens TO service_role;
