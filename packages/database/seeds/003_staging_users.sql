-- Staging bootstrap user: lars@alive.best
-- Creates a user + org + membership so you can log into staging immediately.
--
-- Password comes from SEED_PASSWORD env var (passed via psql -v).
-- Requires pgcrypto extension (enabled by default in Supabase).
-- Idempotent: skips if user already exists.

DO $$
DECLARE
  v_password text := current_setting('seed.password', true);
  v_user_id  text;
  v_org_id   text;
BEGIN
  -- Require password from env
  IF v_password IS NULL OR v_password = '' THEN
    RAISE NOTICE 'SEED_PASSWORD not set — skipping staging user seed.';
    RETURN;
  END IF;

  -- Skip if user already exists
  IF EXISTS (SELECT 1 FROM iam.users WHERE email = 'lars@alive.best') THEN
    -- Update password in case it changed
    UPDATE iam.users
    SET password_hash = crypt(v_password, gen_salt('bf', 12))
    WHERE email = 'lars@alive.best';
    RAISE NOTICE 'lars@alive.best already exists — updated password.';
    RETURN;
  END IF;

  -- Create org
  INSERT INTO iam.orgs (org_id, name, credits)
  VALUES ('org_lars_staging', 'Lars Staging', 99999)
  ON CONFLICT (org_id) DO NOTHING;

  -- Create user with bcrypt-hashed password
  INSERT INTO iam.users (user_id, email, display_name, password_hash, email_verified, status)
  VALUES (
    'user_lars_staging',
    'lars@alive.best',
    'Lars',
    crypt(v_password, gen_salt('bf', 12)),
    true,
    'active'
  );

  -- Link user to org as owner
  INSERT INTO iam.org_memberships (org_id, user_id, role)
  VALUES ('org_lars_staging', 'user_lars_staging', 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RAISE NOTICE 'Created staging user lars@alive.best';
END $$;
