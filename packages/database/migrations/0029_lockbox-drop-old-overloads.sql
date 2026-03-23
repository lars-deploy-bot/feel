-- Migration: Drop old lockbox function overloads
--
-- 0028 used CREATE OR REPLACE which created new overloads instead of replacing
-- the old signatures. This causes PostgREST ambiguity errors:
--   "Could not choose the best candidate function between:
--    public.lockbox_list(p_user_id => text, ...) and
--    public.lockbox_list(p_user_id => text, ..., p_scope => jsonb)"
--
-- Drop the old signatures so only the scope-aware versions remain.
-- Also migrates existing user-env-keys data from environment-suffixed
-- instance_id to the canonical "user-env-keys" instance_id.

BEGIN;

-- Step 1: Drop old function overloads (without p_scope parameter)
DROP FUNCTION IF EXISTS public.lockbox_save(text, text, text, text, bytea, bytea, bytea, timestamptz);
DROP FUNCTION IF EXISTS public.lockbox_get(text, text, text, text);
DROP FUNCTION IF EXISTS public.lockbox_delete(text, text, text, text);
DROP FUNCTION IF EXISTS public.lockbox_exists(text, text, text, text);
DROP FUNCTION IF EXISTS public.lockbox_list(text, text, text);

-- Step 2: Backfill scope from old environment-suffixed instance_id
-- Extract the environment suffix and store it in scope before collapsing instance_id
UPDATE lockbox.user_secrets
SET scope = jsonb_build_object('environment', substring(instance_id from 'user-env-keys:(.+)$'))
WHERE namespace = 'user_env_keys'
  AND instance_id LIKE 'user-env-keys:%'
  AND (scope IS NULL OR scope = '{}');

-- Step 3: Migrate user-env-keys data from old environment-suffixed instance_id
-- to canonical "user-env-keys" (environment scoping now lives in scope jsonb)
UPDATE lockbox.user_secrets
SET instance_id = 'user-env-keys'
WHERE namespace = 'user_env_keys'
  AND instance_id LIKE 'user-env-keys:%';

COMMIT;
