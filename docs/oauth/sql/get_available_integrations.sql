-- integrations.get_available_integrations
--
-- Returns all integrations visible to a user based on:
-- 1. Master kill switch (is_active must be true)
-- 2. Public visibility (visibility_level = 'public')
-- 3. Explicit policy grant (entry in access_policies table)
-- 4. Grandfathering (user already has a connection in lockbox)
--
-- Usage: SELECT * FROM integrations.get_available_integrations('user-uuid-here');

CREATE OR REPLACE FUNCTION integrations.get_available_integrations(p_user_id uuid)
RETURNS TABLE (
  provider_key text,
  display_name text,
  logo_path text,
  is_connected boolean,
  visibility_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.provider_key,
    op.display_name,
    op.logo_path,
    -- "Grandfathering": any current connection for this provider
    EXISTS (
      SELECT 1
      FROM lockbox.user_secrets us
      WHERE us.user_id   = p_user_id
        AND us.namespace = 'oauth_connections'
        AND us.name      = op.provider_key
        AND us.is_current = true
    ) AS is_connected,
    op.visibility_level AS visibility_status
  FROM integrations.providers op
  WHERE
    -- Master kill switch: provider must be globally active
    op.is_active = true
    AND (
      -- Public providers
      op.visibility_level = 'public'
      OR
      -- Explicit policy grant
      EXISTS (
        SELECT 1
        FROM integrations.access_policies oap
        WHERE oap.provider_id = op.provider_id
          AND oap.user_id     = p_user_id
      )
      OR
      -- Grandfathered: user already has a current connection stored
      EXISTS (
        SELECT 1
        FROM lockbox.user_secrets us
        WHERE us.user_id   = p_user_id
          AND us.namespace = 'oauth_connections'
          AND us.name      = op.provider_key
          AND us.is_current = true
      )
    );
END;
$$;

-- Example: Grant access to a specific user for an admin_only provider
--
-- INSERT INTO integrations.access_policies (provider_id, user_id)
-- SELECT p.provider_id, u.user_id
-- FROM integrations.providers p
-- JOIN iam.users u ON u.email = 'your@email.com'
-- WHERE p.provider_key = 'stripe'
-- ON CONFLICT (provider_id, user_id) DO NOTHING;
