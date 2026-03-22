-- Migration: Make lockbox scope-aware
--
-- Adds workspace scoping to user env keys. Keys can be:
--   scope = '{}'                                → global (available in all workspaces)
--   scope = '{"workspace":"example.alive.best"}' → workspace-specific
--
-- The same key name can exist with different scopes.
-- All existing keys have scope = '{}' (global) and remain unchanged.

BEGIN;

-- Step 1: Drop old unique indexes that don't include scope
DROP INDEX IF EXISTS lockbox.user_secrets_instance_version_idx;
DROP INDEX IF EXISTS lockbox.user_secrets_one_current_per_instance_idx;

-- Step 2: Create new unique indexes that include scope
-- Version history index: one version per (user, instance, namespace, name, scope)
CREATE UNIQUE INDEX user_secrets_instance_scope_version_idx
  ON lockbox.user_secrets (user_id, instance_id, namespace, name, scope, version DESC);

-- Current version index: one current row per (user, instance, namespace, name, scope)
CREATE UNIQUE INDEX user_secrets_one_current_per_scope_idx
  ON lockbox.user_secrets (user_id, instance_id, namespace, name, scope)
  WHERE (is_current = true);

-- Step 3: Add a GIN index on scope for efficient jsonb filtering
CREATE INDEX idx_user_secrets_scope ON lockbox.user_secrets USING gin (scope);

-- Step 4: Replace lockbox_save to accept p_scope
CREATE OR REPLACE FUNCTION public.lockbox_save(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_name text,
  p_ciphertext bytea,
  p_iv bytea,
  p_auth_tag bytea,
  p_expires_at timestamptz DEFAULT NULL,
  p_scope jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_next_version integer;
  v_new_id uuid;
BEGIN
  -- Defense in depth: if this is ever granted to authenticated, enforce self-access.
  IF current_setting('role', true) = 'authenticated' THEN
    IF (SELECT auth.uid())::text <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user mismatch';
    END IF;
  END IF;

  SELECT COALESCE(MAX(us.version), 0) + 1
  INTO v_next_version
  FROM lockbox.user_secrets us
  WHERE us.user_id = p_user_id
    AND us.instance_id = p_instance_id
    AND us.namespace = p_namespace
    AND us.name = p_name
    AND us.scope = p_scope;

  UPDATE lockbox.user_secrets
  SET is_current = false,
      updated_at = now(),
      updated_by = p_user_id
  WHERE user_id = p_user_id
    AND instance_id = p_instance_id
    AND namespace = p_namespace
    AND name = p_name
    AND scope = p_scope
    AND is_current = true;

  INSERT INTO lockbox.user_secrets (
    user_id,
    instance_id,
    namespace,
    name,
    ciphertext,
    iv,
    auth_tag,
    scope,
    version,
    is_current,
    expires_at,
    created_by,
    updated_by
  ) VALUES (
    p_user_id,
    p_instance_id,
    p_namespace,
    p_name,
    p_ciphertext,
    p_iv,
    p_auth_tag,
    p_scope,
    v_next_version,
    true,
    p_expires_at,
    p_user_id,
    p_user_id
  )
  RETURNING user_secret_id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

-- Step 5: Replace lockbox_get to accept p_scope
CREATE OR REPLACE FUNCTION public.lockbox_get(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_name text,
  p_scope jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(ciphertext bytea, iv bytea, auth_tag bytea)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF (SELECT auth.uid())::text <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user mismatch';
    END IF;
  END IF;

  RETURN QUERY
  SELECT us.ciphertext, us.iv, us.auth_tag
  FROM lockbox.user_secrets us
  WHERE us.user_id = p_user_id
    AND us.instance_id = p_instance_id
    AND us.namespace = p_namespace
    AND us.name = p_name
    AND us.scope = p_scope
    AND us.is_current = true
  LIMIT 1;
END;
$function$;

-- Step 6: Replace lockbox_delete to accept p_scope
CREATE OR REPLACE FUNCTION public.lockbox_delete(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_name text,
  p_scope jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF (SELECT auth.uid())::text <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user mismatch';
    END IF;
  END IF;

  DELETE FROM lockbox.user_secrets
  WHERE user_id = p_user_id
    AND instance_id = p_instance_id
    AND namespace = p_namespace
    AND name = p_name
    AND scope = p_scope;
END;
$function$;

-- Step 7: Replace lockbox_exists to accept p_scope
CREATE OR REPLACE FUNCTION public.lockbox_exists(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_name text,
  p_scope jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF (SELECT auth.uid())::text <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user mismatch';
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM lockbox.user_secrets us
    WHERE us.user_id = p_user_id
      AND us.instance_id = p_instance_id
      AND us.namespace = p_namespace
      AND us.name = p_name
      AND us.scope = p_scope
      AND us.is_current = true
  ) INTO v_exists;

  RETURN v_exists;
END;
$function$;

-- Step 8: Replace lockbox_list — add optional p_scope filter
-- When p_scope is NULL, return ALL scopes (for listing all keys)
-- When p_scope is set, return only matching scope
CREATE OR REPLACE FUNCTION public.lockbox_list(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_scope jsonb DEFAULT NULL
)
RETURNS TABLE(
  user_secret_id uuid,
  user_id text,
  instance_id text,
  namespace text,
  name citext,
  ciphertext bytea,
  iv bytea,
  auth_tag bytea,
  version integer,
  is_current boolean,
  scope jsonb,
  expires_at timestamptz,
  last_used_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  created_by text,
  updated_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    IF (SELECT auth.uid())::text <> p_user_id THEN
      RAISE EXCEPTION 'Access denied: user mismatch';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    us.user_secret_id,
    us.user_id,
    us.instance_id,
    us.namespace,
    us.name,
    us.ciphertext,
    us.iv,
    us.auth_tag,
    us.version,
    us.is_current,
    us.scope,
    us.expires_at,
    us.last_used_at,
    us.deleted_at,
    us.created_at,
    us.updated_at,
    us.created_by,
    us.updated_by
  FROM lockbox.user_secrets us
  WHERE us.user_id = p_user_id
    AND us.instance_id = p_instance_id
    AND us.namespace = p_namespace
    AND us.is_current = true
    AND (p_scope IS NULL OR us.scope = p_scope)
  ORDER BY us.created_at DESC;
END;
$function$;

COMMIT;
