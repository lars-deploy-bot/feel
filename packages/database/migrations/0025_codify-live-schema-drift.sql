-- Migration 0025: codify live production schema drift
--
-- These objects are already live in production and used by application code.
-- This migration makes repo-managed environments converge on that live state.

-- -----------------------------------------------------------------------------
-- Missing functions used by app code
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION iam.get_or_create_invite_code(p_user_id text, p_new_code text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  existing_code TEXT;
BEGIN
  SELECT invite_code INTO existing_code
  FROM iam.users
  WHERE user_id = p_user_id;

  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  UPDATE iam.users
  SET invite_code = p_new_code
  WHERE user_id = p_user_id AND invite_code IS NULL
  RETURNING invite_code INTO existing_code;

  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;

  SELECT invite_code INTO existing_code
  FROM iam.users
  WHERE user_id = p_user_id;

  RETURN existing_code;
END;
$function$;

CREATE OR REPLACE FUNCTION integrations.get_available_integrations(p_user_id text)
RETURNS TABLE(
  provider_key text,
  display_name text,
  logo_path text,
  is_connected boolean,
  visibility_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    op.provider_key,
    op.display_name,
    op.logo_path,
    EXISTS (
      SELECT 1
      FROM lockbox.user_secrets us
      WHERE us.user_id = p_user_id
        AND us.namespace = 'oauth_connections'
        AND us.name = op.provider_key
        AND us.is_current = true
    ) AS is_connected,
    op.visibility_level AS visibility_status
  FROM integrations.providers op
  WHERE op.is_active = true
    AND (
      op.visibility_level = 'public'
      OR EXISTS (
        SELECT 1
        FROM integrations.access_policies oap
        WHERE oap.provider_id = op.provider_id
          AND oap.user_id = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM lockbox.user_secrets us
        WHERE us.user_id = p_user_id
          AND us.namespace = 'oauth_connections'
          AND us.name = op.provider_key
          AND us.is_current = true
      )
    );
END;
$function$;

-- Restrict execute to service_role only (called from app server, not client-side)
REVOKE ALL ON FUNCTION integrations.get_available_integrations(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION integrations.get_available_integrations(text) TO service_role;

-- -----------------------------------------------------------------------------
-- Columns live in production but absent from repo migrations
-- -----------------------------------------------------------------------------

ALTER TABLE app.automation_jobs
  ADD COLUMN IF NOT EXISTS action_thinking text;

ALTER TABLE app.feedback
  ADD COLUMN IF NOT EXISTS github_issue_url text,
  ADD COLUMN IF NOT EXISTS aware_email_sent text,
  ADD COLUMN IF NOT EXISTS fixed_email_sent text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- -----------------------------------------------------------------------------
-- Uniqueness / constraint shape
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS iam.idx_users_email_ci;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_ci
  ON iam.users (lower(email))
  WHERE email IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.domains'::regclass
      AND conname = 'domains_pkey'
  ) THEN
    ALTER TABLE app.domains
      RENAME CONSTRAINT domains_pkey TO workspaces_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.domains'::regclass
      AND conname = 'domains_hostname_key'
  ) THEN
    ALTER TABLE app.domains
      RENAME CONSTRAINT domains_hostname_key TO workspaces_hostname_key;
  END IF;
END $$;

ALTER TABLE app.domains
  ADD COLUMN IF NOT EXISTS sandbox_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.domains'::regclass
      AND conname = 'domains_sandbox_id_key'
  ) THEN
    ALTER TABLE app.domains
      ADD CONSTRAINT domains_sandbox_id_key UNIQUE (sandbox_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'lockbox'::regnamespace
      AND conrelid = 'lockbox.secret_keys'::regclass
      AND conname = 'secret_keys_environment_check'
  ) THEN
    ALTER TABLE lockbox.secret_keys
      RENAME CONSTRAINT secret_keys_environment_check TO secret_keys_env_len_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'integrations'::regnamespace
      AND conrelid = 'integrations.access_policies'::regclass
      AND conname = 'access_policies_provider_id_fkey'
  ) THEN
    ALTER TABLE integrations.access_policies
      RENAME CONSTRAINT access_policies_provider_id_fkey TO access_policies_provider_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'integrations'::regnamespace
      AND conrelid = 'integrations.access_policies'::regclass
      AND conname = 'access_policies_user_id_fkey'
  ) THEN
    ALTER TABLE integrations.access_policies
      RENAME CONSTRAINT access_policies_user_id_fkey TO access_policies_user_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'lockbox'::regnamespace
      AND conrelid = 'lockbox.secret_keys'::regclass
      AND conname = 'secret_keys_user_id_fkey'
  ) THEN
    ALTER TABLE lockbox.secret_keys
      RENAME CONSTRAINT secret_keys_user_id_fkey TO secret_keys_user_fk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'lockbox'::regnamespace
      AND conrelid = 'lockbox.user_secrets'::regclass
      AND conname = 'user_secrets_user_id_fkey'
  ) THEN
    ALTER TABLE lockbox.user_secrets
      RENAME CONSTRAINT user_secrets_user_id_fkey TO user_secrets_user_fk;
  END IF;
END $$;

ALTER TABLE app.errors DROP CONSTRAINT IF EXISTS errors_hash_key;
