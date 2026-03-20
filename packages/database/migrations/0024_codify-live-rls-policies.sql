-- Migration 0024: codify live production RLS and policy state
--
-- These tables/policies already exist in production. This migration makes the
-- repo describe that live state explicitly so fresh databases converge.

-- -----------------------------------------------------------------------------
-- app.errors
-- -----------------------------------------------------------------------------

ALTER TABLE app.errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert" ON app.errors;

CREATE POLICY "anyone can insert" ON app.errors
  FOR INSERT TO public
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- app.feedback
-- -----------------------------------------------------------------------------

ALTER TABLE app.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_insert_self_or_null_user ON app.feedback;

CREATE POLICY feedback_insert_self_or_null_user ON app.feedback
  FOR INSERT TO authenticated
  WITH CHECK ((sub() = user_id) OR (user_id IS NULL));

-- -----------------------------------------------------------------------------
-- app.gateway_settings
-- -----------------------------------------------------------------------------

ALTER TABLE app.gateway_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- app.templates
-- -----------------------------------------------------------------------------

ALTER TABLE app.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select all" ON app.templates;
DROP POLICY IF EXISTS "update" ON app.templates;

CREATE POLICY "select all" ON app.templates
  FOR SELECT TO public
  USING (true);

CREATE POLICY "update" ON app.templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- app.user_onboarding
-- -----------------------------------------------------------------------------

ALTER TABLE app.user_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_onboarding_self_delete ON app.user_onboarding;
DROP POLICY IF EXISTS user_onboarding_self_insert ON app.user_onboarding;
DROP POLICY IF EXISTS user_onboarding_self_select ON app.user_onboarding;
DROP POLICY IF EXISTS user_onboarding_self_update ON app.user_onboarding;

CREATE POLICY user_onboarding_self_delete ON app.user_onboarding
  FOR DELETE TO public
  USING (
    (sub() IS NOT NULL)
    AND (user_id = sub())
    AND EXISTS (
      SELECT 1
      FROM iam.users u
      WHERE u.user_id = sub()
    )
  );

CREATE POLICY user_onboarding_self_insert ON app.user_onboarding
  FOR INSERT TO public
  WITH CHECK (
    (sub() IS NOT NULL)
    AND (user_id = sub())
    AND EXISTS (
      SELECT 1
      FROM iam.users u
      WHERE u.user_id = sub()
    )
  );

CREATE POLICY user_onboarding_self_select ON app.user_onboarding
  FOR SELECT TO public
  USING (
    (sub() IS NOT NULL)
    AND (user_id = sub())
    AND EXISTS (
      SELECT 1
      FROM iam.users u
      WHERE u.user_id = sub()
    )
  );

CREATE POLICY user_onboarding_self_update ON app.user_onboarding
  FOR UPDATE TO public
  USING (
    (sub() IS NOT NULL)
    AND (user_id = sub())
    AND EXISTS (
      SELECT 1
      FROM iam.users u
      WHERE u.user_id = sub()
    )
  )
  WITH CHECK (
    (sub() IS NOT NULL)
    AND (user_id = sub())
  );

-- -----------------------------------------------------------------------------
-- app.user_profile
-- -----------------------------------------------------------------------------

ALTER TABLE app.user_profile ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- iam.users
-- -----------------------------------------------------------------------------

ALTER TABLE iam.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_same_org ON iam.users;
DROP POLICY IF EXISTS users_select_self ON iam.users;
DROP POLICY IF EXISTS users_update_self ON iam.users;

CREATE POLICY users_select_same_org ON iam.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM iam.org_memberships m_me
      JOIN iam.org_memberships m_them
        ON m_them.org_id = m_me.org_id
       AND m_them.user_id = users.user_id
      WHERE m_me.user_id = sub()
    )
  );

CREATE POLICY users_select_self ON iam.users
  FOR SELECT TO authenticated
  USING (user_id = sub());

CREATE POLICY users_update_self ON iam.users
  FOR UPDATE TO authenticated
  USING (user_id = sub())
  WITH CHECK (user_id = sub());

-- -----------------------------------------------------------------------------
-- app.automation_jobs / app.automation_runs
-- -----------------------------------------------------------------------------

ALTER TABLE app.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to jobs" ON app.automation_jobs;
DROP POLICY IF EXISTS "Service role full access to runs" ON app.automation_runs;

CREATE POLICY "Service role full access to jobs" ON app.automation_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to runs" ON app.automation_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- lockbox.secret_keys / lockbox.user_secrets
-- -----------------------------------------------------------------------------

ALTER TABLE lockbox.secret_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE lockbox.user_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_secret_keys ON lockbox.secret_keys;
DROP POLICY IF EXISTS svc_select_user_secrets ON lockbox.user_secrets;
DROP POLICY IF EXISTS svc_write_user_secrets ON lockbox.user_secrets;

CREATE POLICY svc_all_secret_keys ON lockbox.secret_keys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY svc_select_user_secrets ON lockbox.user_secrets
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY svc_write_user_secrets ON lockbox.user_secrets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
