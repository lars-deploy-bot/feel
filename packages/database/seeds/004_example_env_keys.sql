-- Example environment keys for staging bootstrap user.
-- Demonstrates the scope system: global, environment-scoped, workspace-scoped.
--
-- These are NOT real secrets — they're example values for development/testing.
-- Uses lockbox_save RPC which handles encryption and version rotation.
-- Idempotent: lockbox_save rotates existing keys instead of duplicating.
--
-- Requires the staging user from 003_staging_users.sql to exist.

DO $$
DECLARE
  v_user_id text := 'user_lars_staging';
  v_instance text := 'user-env-keys';
  v_ns text := 'user_env_keys';
  -- Dummy ciphertext/iv/auth_tag — these are not real encrypted values,
  -- just valid-length bytea placeholders for seed data.
  v_cipher bytea := '\x0000000000000000000000000000000000000000000000000000000000000000';
  v_iv bytea := '\x000000000000000000000000';
  v_tag bytea := '\x00000000000000000000000000000000';
BEGIN
  -- Skip if staging user doesn't exist
  IF NOT EXISTS (SELECT 1 FROM iam.users WHERE user_id = v_user_id) THEN
    RAISE NOTICE 'Staging user not found — skipping env key seeds.';
    RETURN;
  END IF;

  -- 1. Global key (all environments, all workspaces)
  PERFORM public.lockbox_save(
    v_user_id, v_instance, v_ns, 'EXAMPLE_GLOBAL_KEY',
    v_cipher, v_iv, v_tag,
    NULL,       -- no expiry
    '{}'::jsonb -- global scope
  );
  RAISE NOTICE 'Seeded EXAMPLE_GLOBAL_KEY (global)';

  -- 2. Production-only key
  PERFORM public.lockbox_save(
    v_user_id, v_instance, v_ns, 'STRIPE_LIVE_KEY',
    v_cipher, v_iv, v_tag,
    NULL,
    '{"environment": "prod"}'::jsonb
  );
  RAISE NOTICE 'Seeded STRIPE_LIVE_KEY (environment: prod)';

  -- 3. Staging-only key
  PERFORM public.lockbox_save(
    v_user_id, v_instance, v_ns, 'STRIPE_TEST_KEY',
    v_cipher, v_iv, v_tag,
    NULL,
    '{"environment": "staging"}'::jsonb
  );
  RAISE NOTICE 'Seeded STRIPE_TEST_KEY (environment: staging)';

  -- 4. Workspace-scoped key
  PERFORM public.lockbox_save(
    v_user_id, v_instance, v_ns, 'WORKSPACE_SECRET',
    v_cipher, v_iv, v_tag,
    NULL,
    '{"workspace": "alive"}'::jsonb
  );
  RAISE NOTICE 'Seeded WORKSPACE_SECRET (workspace: alive)';

  -- 5. Workspace + environment scoped key
  PERFORM public.lockbox_save(
    v_user_id, v_instance, v_ns, 'STRIPE_LIVE_KEY',
    v_cipher, v_iv, v_tag,
    NULL,
    '{"environment": "prod", "workspace": "alive"}'::jsonb
  );
  RAISE NOTICE 'Seeded STRIPE_LIVE_KEY (environment: prod, workspace: alive)';

END $$;
