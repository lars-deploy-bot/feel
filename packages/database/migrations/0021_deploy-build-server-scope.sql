-- Deploy control plane: make builds server-scoped and releases one-per-build.
--
-- Why:
-- - deploy.builds were globally claimable while Docker artifacts are local to a server
-- - reusable release lookup crossed server boundaries
-- - digest fallback in deploy scripts hid missing release rows for reused builds
--
-- This migration makes the live schema safe to upgrade:
-- - adds deploy.builds.server_id for routing new builds
-- - requires server_id on new pending/running builds, while allowing historical terminal rows to stay null
-- - removes global digest uniqueness from deploy.releases so each build can record its own release row
-- - scopes the running-build uniqueness to (application_id, server_id)
--
-- Fresh installs should use the final schema already encoded in 0020.

ALTER TABLE deploy.builds
  ADD COLUMN IF NOT EXISTS server_id text REFERENCES app.servers(server_id);

WITH inferred_server_ids AS (
  SELECT
    releases.build_id,
    MIN(environments.server_id) AS server_id,
    COUNT(DISTINCT environments.server_id) AS server_count
  FROM deploy.releases AS releases
  INNER JOIN deploy.deployments AS deployments
    ON deployments.release_id = releases.release_id
  INNER JOIN deploy.environments AS environments
    ON environments.environment_id = deployments.environment_id
  GROUP BY releases.build_id
)
UPDATE deploy.builds AS builds
SET server_id = inferred_server_ids.server_id
FROM inferred_server_ids
WHERE inferred_server_ids.build_id = builds.build_id
  AND inferred_server_ids.server_count = 1
  AND builds.server_id IS NULL;

ALTER TABLE deploy.builds
  DROP CONSTRAINT IF EXISTS deploy_builds_server_id_required_for_active_states;

ALTER TABLE deploy.builds
  ADD CONSTRAINT deploy_builds_server_id_required_for_active_states
  CHECK (
    server_id IS NOT NULL
    OR status IN (
      'succeeded'::deploy.task_status,
      'failed'::deploy.task_status,
      'cancelled'::deploy.task_status
    )
  );

DROP INDEX IF EXISTS deploy.deploy_builds_status_created_idx;

CREATE INDEX IF NOT EXISTS deploy_builds_server_status_created_idx
  ON deploy.builds (server_id, status, created_at DESC);

DROP INDEX IF EXISTS deploy.deploy_builds_one_running_per_application_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS deploy_builds_one_running_per_application_server_uidx
  ON deploy.builds (application_id, server_id)
  WHERE status = 'running';

ALTER TABLE deploy.releases
  DROP CONSTRAINT IF EXISTS deploy_releases_application_digest_key;

CREATE INDEX IF NOT EXISTS deploy_releases_application_fingerprint_created_idx
  ON deploy.releases (application_id, (metadata->>'build_fingerprint'), created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_releases_application_digest_idx
  ON deploy.releases (application_id, artifact_digest, created_at DESC);
