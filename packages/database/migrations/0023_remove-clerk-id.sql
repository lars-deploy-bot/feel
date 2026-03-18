-- Migration 0023: remove legacy clerk_id naming and functions
--
-- Goal:
-- - Active schema uses user_id consistently instead of legacy clerk_id.
-- - Dead current_clerk_id() helpers are removed.
-- - Legacy public tables keep their data but stop exposing Clerk terminology.

-- -----------------------------------------------------------------------------
-- Active app schema
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'gateway_settings'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'gateway_settings'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE app.gateway_settings RENAME COLUMN clerk_id TO user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.gateway_settings'::regclass
      AND conname = 'gateway_settings_clerk_id_fkey'
  ) THEN
    ALTER TABLE app.gateway_settings
      RENAME CONSTRAINT gateway_settings_clerk_id_fkey TO gateway_settings_user_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.gateway_settings'::regclass
      AND conname = 'gateway_settings_clerk_id_gateway_key'
  ) THEN
    ALTER TABLE app.gateway_settings
      RENAME CONSTRAINT gateway_settings_clerk_id_gateway_key TO gateway_settings_user_id_gateway_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'app'
      AND tablename = 'gateway_settings'
      AND indexname = 'idx_gateway_settings_clerk'
  ) THEN
    ALTER INDEX app.idx_gateway_settings_clerk RENAME TO idx_gateway_settings_user_id;
  END IF;
END $$;

DROP POLICY IF EXISTS gateway_settings_delete_own ON app.gateway_settings;
DROP POLICY IF EXISTS gateway_settings_insert_own ON app.gateway_settings;
DROP POLICY IF EXISTS gateway_settings_select_own ON app.gateway_settings;
DROP POLICY IF EXISTS gateway_settings_update_own ON app.gateway_settings;

CREATE POLICY gateway_settings_delete_own ON app.gateway_settings
  FOR DELETE TO authenticated
  USING (user_id = sub());

CREATE POLICY gateway_settings_insert_own ON app.gateway_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = sub());

CREATE POLICY gateway_settings_select_own ON app.gateway_settings
  FOR SELECT TO authenticated
  USING (user_id = sub());

CREATE POLICY gateway_settings_update_own ON app.gateway_settings
  FOR UPDATE TO authenticated
  USING (user_id = sub())
  WITH CHECK (user_id = sub());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_profile'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_profile'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE app.user_profile RENAME COLUMN clerk_id TO user_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.user_profile'::regclass
      AND conname = 'user_profile_clerk_id_key'
  ) THEN
    ALTER TABLE app.user_profile
      RENAME CONSTRAINT user_profile_clerk_id_key TO user_profile_user_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'user_profile'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'app'::regnamespace
      AND conrelid = 'app.user_profile'::regclass
      AND conname = 'user_profile_user_id_fkey'
  ) THEN
    ALTER TABLE app.user_profile
      ADD CONSTRAINT user_profile_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES iam.users(user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can manage own profile" ON app.user_profile;
DROP POLICY IF EXISTS select_own ON app.user_profile;
DROP POLICY IF EXISTS update_self ON app.user_profile;

CREATE POLICY "Users can manage own profile" ON app.user_profile
  FOR ALL TO authenticated
  USING (user_id = sub())
  WITH CHECK (user_id = sub());

CREATE POLICY select_own ON app.user_profile
  FOR SELECT TO authenticated
  USING (user_id = app.sub());

CREATE POLICY update_self ON app.user_profile
  FOR UPDATE TO authenticated
  USING (user_id = app.sub())
  WITH CHECK (user_id = app.sub());

ALTER TABLE app.errors DROP COLUMN IF EXISTS clerk_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'app'
      AND tablename = 'feedback'
      AND policyname = 'feedback_insert_self_or_null_clerk'
  ) THEN
    ALTER POLICY feedback_insert_self_or_null_clerk
      ON app.feedback
      RENAME TO feedback_insert_self_or_null_user;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- iam schema cleanup
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS iam.idx_users_clerk_id;
ALTER TABLE iam.users DROP COLUMN IF EXISTS clerk_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'iam'
      AND tablename = 'users'
      AND indexname = 'iam_users_clerk_id_key'
  ) THEN
    ALTER INDEX iam.iam_users_clerk_id_key RENAME TO iam_users_user_id_key;
  END IF;
END $$;

DROP FUNCTION IF EXISTS iam.current_clerk_id();
DROP FUNCTION IF EXISTS lockbox.validate_bearer_token(text);

-- -----------------------------------------------------------------------------
-- Legacy public schema: preserve data, rename semantics
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DataSet'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'DataSet'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public."DataSet" RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public."DataSet"')
      AND conname = 'DataSet_clerk_id_fkey'
  ) THEN
    ALTER TABLE public."DataSet"
      RENAME CONSTRAINT "DataSet_clerk_id_fkey" TO "DataSet_user_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Evaluator'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Evaluator'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public."Evaluator" RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public."Evaluator"')
      AND conname = 'Evaluator_clerk_id_fkey'
  ) THEN
    ALTER TABLE public."Evaluator"
      RENAME CONSTRAINT "Evaluator_clerk_id_fkey" TO "Evaluator_user_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'EvolutionRun'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'EvolutionRun'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public."EvolutionRun" RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public."EvolutionRun"')
      AND conname = 'EvolutionRun_clerk_id_fkey'
  ) THEN
    ALTER TABLE public."EvolutionRun"
      RENAME CONSTRAINT "EvolutionRun_clerk_id_fkey" TO "EvolutionRun_user_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Generation'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Generation'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public."Generation" RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public."Generation"')
      AND conname = 'Generation_clerk_id_fkey'
  ) THEN
    ALTER TABLE public."Generation"
      RENAME CONSTRAINT "Generation_clerk_id_fkey" TO "Generation_user_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Workflow'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Workflow'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public."Workflow" RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public."Workflow"')
      AND conname = 'Workflow_clerk_id_fkey'
  ) THEN
    ALTER TABLE public."Workflow"
      RENAME CONSTRAINT "Workflow_clerk_id_fkey" TO "Workflow_user_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feedback'
      AND column_name = 'clerk_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feedback'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.feedback RENAME COLUMN clerk_id TO user_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conrelid = to_regclass('public.feedback')
      AND conname = 'feedback_clerk_id_fkey'
  ) THEN
    ALTER TABLE public.feedback
      RENAME CONSTRAINT feedback_clerk_id_fkey TO feedback_user_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'feedback'
      AND indexname = 'idx_feedback_clerk_id'
  ) THEN
    ALTER INDEX public.idx_feedback_clerk_id RENAME TO idx_feedback_user_id;
  END IF;
END $$;

ALTER TABLE IF EXISTS public."DataSet"
  ALTER COLUMN user_id SET DEFAULT public.sub();

ALTER TABLE IF EXISTS public."Evaluator"
  ALTER COLUMN user_id SET DEFAULT public.sub();

ALTER TABLE IF EXISTS public."EvolutionRun"
  ALTER COLUMN user_id SET DEFAULT public.sub();

ALTER TABLE IF EXISTS public."Generation"
  ALTER COLUMN user_id SET DEFAULT public.sub();

DROP FUNCTION IF EXISTS public.current_clerk_id();
