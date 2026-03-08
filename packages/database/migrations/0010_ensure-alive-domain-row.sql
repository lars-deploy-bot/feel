-- Ensure the reserved "alive" domain row exists for superadmin automations (#177).
--
-- This row is the synthetic domain target that allows automation_jobs to reference
-- the alive workspace (SUPERADMIN.WORKSPACE_NAME = "alive") using the existing
-- site_id FK to app.domains. Without this row, the /api/sites endpoint returns
-- a 500 for superadmins and alive automations cannot be created.
--
-- The row must be associated with a valid org_id (superadmin's org) and the
-- correct server_id so that the scheduler's server-scoped due-job query picks
-- it up. Port 0 signals "not a real site" (no Caddy routing needed).
--
-- Fresh isolated E2E databases do not carry these deployment-specific seed
-- rows. Skip cleanly there so the migration chain remains replayable from
-- scratch; production/staging still insert the row when the referenced org +
-- server exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM iam.orgs WHERE org_id = 'org_9fd9dd861a5a7279')
     AND EXISTS (SELECT 1 FROM app.servers WHERE server_id = 'srv_alive_dot_best_138_201_56_93') THEN
    INSERT INTO app.domains (hostname, port, org_id, server_id)
    VALUES ('alive', 0, 'org_9fd9dd861a5a7279', 'srv_alive_dot_best_138_201_56_93')
    ON CONFLICT (hostname) DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipping alive domain seed: required org/server rows are not present in this environment.';
  END IF;
END $$;
