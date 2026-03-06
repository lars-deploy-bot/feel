DO $$
BEGIN
  CREATE TYPE app.execution_mode AS ENUM ('systemd', 'e2b');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE app.sandbox_status AS ENUM ('creating', 'running', 'dead');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE app.domains
  ADD COLUMN IF NOT EXISTS execution_mode app.execution_mode NOT NULL DEFAULT 'systemd',
  ADD COLUMN IF NOT EXISTS sandbox_id text,
  ADD COLUMN IF NOT EXISTS sandbox_status app.sandbox_status;

GRANT USAGE ON TYPE app.execution_mode TO authenticated, service_role;
GRANT USAGE ON TYPE app.sandbox_status TO authenticated, service_role;
