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
-- Idempotent: ON CONFLICT does nothing if the row already exists.

INSERT INTO app.domains (hostname, port, org_id, server_id)
VALUES ('alive', 0, 'org_9fd9dd861a5a7279', 'srv_alive_dot_best_138_201_56_93')
ON CONFLICT (hostname) DO NOTHING;
