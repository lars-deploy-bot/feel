-- ============================================================================
-- DEPLOY CONTROL PLANE SCHEMA
-- ============================================================================
--
-- Purpose:
-- - Store immutable build/release/deployment records for Docker-based deploys
-- - Preserve Alive's existing invariant: build once, promote same artifact
-- - Keep deployment state isolated from app/iam schemas
-- Notes:
-- - `deploy.environments` references existing app.servers / app.domains
-- - staging email is hard-blocked at the schema level
-- - service_role is the only runtime role granted access initially

CREATE SCHEMA IF NOT EXISTS deploy;

REVOKE ALL ON SCHEMA deploy FROM PUBLIC;
GRANT USAGE ON SCHEMA deploy TO service_role;

DO $$
BEGIN
  CREATE TYPE deploy.git_provider AS ENUM ('github');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE deploy.environment_name AS ENUM ('staging', 'production');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE deploy.executor_backend AS ENUM ('docker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE deploy.task_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE deploy.artifact_kind AS ENUM ('docker_image');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE deploy.deployment_action AS ENUM ('deploy', 'promote', 'rollback');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS deploy.applications (
  application_id text PRIMARY KEY NOT NULL DEFAULT public.gen_prefixed_id('dep_app_'::text),
  slug text NOT NULL,
  display_name text NOT NULL,
  git_provider deploy.git_provider NOT NULL DEFAULT 'github',
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  config_path text NOT NULL DEFAULT 'alive.toml',
  created_by_user_id text REFERENCES iam.users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deploy_applications_slug_key UNIQUE (slug),
  CONSTRAINT deploy_applications_repo_key UNIQUE (git_provider, repo_owner, repo_name)
);

CREATE TABLE IF NOT EXISTS deploy.environments (
  environment_id text PRIMARY KEY NOT NULL DEFAULT public.gen_prefixed_id('dep_env_'::text),
  application_id text NOT NULL REFERENCES deploy.applications(application_id) ON DELETE CASCADE,
  name deploy.environment_name NOT NULL,
  server_id text NOT NULL REFERENCES app.servers(server_id),
  domain_id text REFERENCES app.domains(domain_id) ON DELETE SET NULL,
  hostname text NOT NULL,
  port integer,
  executor deploy.executor_backend NOT NULL DEFAULT 'docker',
  healthcheck_path text NOT NULL DEFAULT '/',
  allow_email boolean NOT NULL DEFAULT false,
  runtime_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deploy_environments_application_name_key UNIQUE (application_id, name),
  CONSTRAINT deploy_environments_staging_no_email_check
    CHECK (name <> 'staging'::deploy.environment_name OR allow_email = false)
);

CREATE TABLE IF NOT EXISTS deploy.builds (
  build_id text PRIMARY KEY NOT NULL DEFAULT public.gen_prefixed_id('dep_build_'::text),
  application_id text NOT NULL REFERENCES deploy.applications(application_id) ON DELETE CASCADE,
  server_id text NOT NULL REFERENCES app.servers(server_id),
  requested_by_user_id text REFERENCES iam.users(user_id) ON DELETE SET NULL,
  status deploy.task_status NOT NULL DEFAULT 'pending',
  git_ref text NOT NULL,
  git_sha text,
  commit_message text,
  alive_toml_snapshot text,
  artifact_kind deploy.artifact_kind NOT NULL DEFAULT 'docker_image',
  artifact_ref text,
  artifact_digest text,
  build_log_path text,
  builder_hostname text,
  error_message text,
  lease_token text,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deploy.releases (
  release_id text PRIMARY KEY NOT NULL DEFAULT public.gen_prefixed_id('dep_rel_'::text),
  application_id text NOT NULL REFERENCES deploy.applications(application_id) ON DELETE CASCADE,
  build_id text NOT NULL REFERENCES deploy.builds(build_id) ON DELETE RESTRICT,
  git_sha text NOT NULL,
  commit_message text,
  artifact_kind deploy.artifact_kind NOT NULL DEFAULT 'docker_image',
  artifact_ref text NOT NULL,
  artifact_digest text NOT NULL,
  alive_toml_snapshot text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deploy_releases_build_id_key UNIQUE (build_id)
);

CREATE TABLE IF NOT EXISTS deploy.deployments (
  deployment_id text PRIMARY KEY NOT NULL DEFAULT public.gen_prefixed_id('dep_deploy_'::text),
  environment_id text NOT NULL REFERENCES deploy.environments(environment_id) ON DELETE CASCADE,
  release_id text NOT NULL REFERENCES deploy.releases(release_id) ON DELETE RESTRICT,
  requested_by_user_id text REFERENCES iam.users(user_id) ON DELETE SET NULL,
  status deploy.task_status NOT NULL DEFAULT 'pending',
  action deploy.deployment_action NOT NULL DEFAULT 'deploy',
  promoted_from_deployment_id text REFERENCES deploy.deployments(deployment_id) ON DELETE SET NULL,
  rollback_of_deployment_id text REFERENCES deploy.deployments(deployment_id) ON DELETE SET NULL,
  previous_deployment_id text REFERENCES deploy.deployments(deployment_id) ON DELETE SET NULL,
  deployment_log_path text,
  healthcheck_status integer,
  healthcheck_checked_at timestamptz,
  error_message text,
  lease_token text,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deploy_environments_hostname_ci_uidx
  ON deploy.environments (lower(hostname));

CREATE INDEX IF NOT EXISTS deploy_environments_server_idx
  ON deploy.environments (server_id);

CREATE INDEX IF NOT EXISTS deploy_environments_domain_idx
  ON deploy.environments (domain_id);

CREATE INDEX IF NOT EXISTS deploy_builds_application_created_idx
  ON deploy.builds (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_builds_server_status_created_idx
  ON deploy.builds (server_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_builds_lease_idx
  ON deploy.builds (lease_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS deploy_builds_one_running_per_application_server_uidx
  ON deploy.builds (application_id, server_id)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS deploy_releases_application_created_idx
  ON deploy.releases (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_releases_application_fingerprint_created_idx
  ON deploy.releases (application_id, (metadata->>'build_fingerprint'), created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_releases_application_digest_idx
  ON deploy.releases (application_id, artifact_digest, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_releases_git_sha_idx
  ON deploy.releases (git_sha);

CREATE INDEX IF NOT EXISTS deploy_deployments_environment_created_idx
  ON deploy.deployments (environment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_deployments_release_idx
  ON deploy.deployments (release_id);

CREATE INDEX IF NOT EXISTS deploy_deployments_status_created_idx
  ON deploy.deployments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS deploy_deployments_lease_idx
  ON deploy.deployments (lease_expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS deploy_deployments_one_running_per_environment_uidx
  ON deploy.deployments (environment_id)
  WHERE status = 'running';

GRANT USAGE ON TYPE deploy.git_provider TO service_role;
GRANT USAGE ON TYPE deploy.environment_name TO service_role;
GRANT USAGE ON TYPE deploy.executor_backend TO service_role;
GRANT USAGE ON TYPE deploy.task_status TO service_role;
GRANT USAGE ON TYPE deploy.artifact_kind TO service_role;
GRANT USAGE ON TYPE deploy.deployment_action TO service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA deploy TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA deploy TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA deploy TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA deploy
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA deploy
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA deploy
  GRANT EXECUTE ON FUNCTIONS TO service_role;
