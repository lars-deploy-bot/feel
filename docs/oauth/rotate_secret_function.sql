-- Database function for atomic secret rotation with instance awareness
-- This ensures ACID properties and leverages the unique index for safety

CREATE OR REPLACE FUNCTION lockbox.rotate_secret(
  p_user_id text,
  p_instance_id text,
  p_namespace text,
  p_name text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text,
  p_scope jsonb DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_actor text DEFAULT NULL
)
RETURNS TABLE (
  new_secret_id uuid,
  new_version integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_id uuid;
  v_next_version integer;
  v_actor text;
BEGIN
  -- Use provided actor or default to user_id
  v_actor := COALESCE(p_actor, p_user_id);

  -- Get the next version number
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_next_version
  FROM lockbox.user_secrets
  WHERE user_id = p_user_id
    AND instance_id = p_instance_id
    AND namespace = p_namespace
    AND name = p_name;

  -- Insert the new secret with is_current = true
  -- The unique index will prevent duplicates if there's a race condition
  INSERT INTO lockbox.user_secrets (
    user_id,
    instance_id,
    namespace,
    name,
    version,
    ciphertext,
    iv,
    auth_tag,
    scope,
    is_current,
    expires_at,
    created_by,
    updated_by
  )
  VALUES (
    p_user_id,
    p_instance_id,
    p_namespace,
    p_name,
    v_next_version,
    p_ciphertext,
    p_iv,
    p_auth_tag,
    p_scope,
    true,
    p_expires_at,
    v_actor,
    v_actor
  )
  RETURNING user_secret_id INTO v_new_id;

  -- Demote all other versions for this key
  -- This happens AFTER insert to ensure we always have a current secret
  UPDATE lockbox.user_secrets
  SET is_current = false,
      updated_at = now(),
      updated_by = v_actor
  WHERE user_id = p_user_id
    AND instance_id = p_instance_id
    AND namespace = p_namespace
    AND name = p_name
    AND is_current = true
    AND user_secret_id <> v_new_id;

  -- Return the new secret ID and version
  RETURN QUERY
  SELECT v_new_id, v_next_version;
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION lockbox.rotate_secret TO service_role;

-- Example usage:
/*
SELECT * FROM lockbox.rotate_secret(
  'user-123',           -- user_id
  'linear:prod',        -- instance_id
  'oauth_connections',  -- namespace
  'linear',            -- name
  '\x...',             -- ciphertext
  'abc123...',         -- iv
  'def456...',         -- auth_tag
  '{"scope": "read write"}'::jsonb,  -- scope (optional)
  NOW() + INTERVAL '1 hour',         -- expires_at (optional)
  'system'             -- actor (optional)
);
*/