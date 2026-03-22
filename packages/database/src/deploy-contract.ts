/**
 * Deploy Control Plane Contract — SINGLE SOURCE OF TRUTH
 *
 * Everything the deploy pipeline depends on is defined here:
 * enums, types, row shapes, column contracts, pipeline stages, Zod schemas.
 *
 * Consumers:
 *   - apps/api        → imports Zod schemas for OpenAPI route validation
 *   - apps/deployer-rs → Rust SQL must match the column contracts
 *   - scripts/deploy   → bash psql queries must match the polled columns
 *   - apps/manager     → TypeScript types for the deploy dashboard
 *
 * Everything derives from `deploy.generated.ts` (auto-generated from DB).
 * If you change the DB schema:
 *   1. Write the migration
 *   2. `bun run gen:types`
 *   3. This file auto-updates (types derived, not hand-written)
 *   4. Contract test catches any Rust/bash drift
 */

import { z } from "zod"
import type { Database as RawDeployDatabase } from "./deploy.generated.js"
import { Constants as DeployConstants } from "./deploy.generated.js"

// =============================================================================
// Re-export generated database type
// =============================================================================

export type DeployDatabase = RawDeployDatabase

// =============================================================================
// Row types — derived from generated schema, never hand-written
// =============================================================================

export type BuildRow = DeployDatabase["deploy"]["Tables"]["builds"]["Row"]
export type BuildInsert = DeployDatabase["deploy"]["Tables"]["builds"]["Insert"]
export type DeploymentRow = DeployDatabase["deploy"]["Tables"]["deployments"]["Row"]
export type DeploymentInsert = DeployDatabase["deploy"]["Tables"]["deployments"]["Insert"]
export type ReleaseRow = DeployDatabase["deploy"]["Tables"]["releases"]["Row"]
export type ApplicationRow = DeployDatabase["deploy"]["Tables"]["applications"]["Row"]
export type EnvironmentRow = DeployDatabase["deploy"]["Tables"]["environments"]["Row"]

// =============================================================================
// Enum types — derived from generated schema
// =============================================================================

export type DeployArtifactKind = DeployDatabase["deploy"]["Enums"]["artifact_kind"]
export type DeployDeploymentAction = DeployDatabase["deploy"]["Enums"]["deployment_action"]
export type DeployEnvironmentName = DeployDatabase["deploy"]["Enums"]["environment_name"]
export type DeployExecutorBackend = DeployDatabase["deploy"]["Enums"]["executor_backend"]
export type DeployGitProvider = DeployDatabase["deploy"]["Enums"]["git_provider"]
export type DeployTaskStatus = DeployDatabase["deploy"]["Enums"]["task_status"]

// =============================================================================
// Enum runtime values — derived from generated Constants
// =============================================================================

export const DEPLOY_ARTIFACT_KINDS = DeployConstants.deploy.Enums.artifact_kind
export const DEPLOY_DEPLOYMENT_ACTIONS = DeployConstants.deploy.Enums.deployment_action
export const DEPLOY_ENVIRONMENT_NAMES = DeployConstants.deploy.Enums.environment_name
export const DEPLOY_EXECUTOR_BACKENDS = DeployConstants.deploy.Enums.executor_backend
export const DEPLOY_GIT_PROVIDERS = DeployConstants.deploy.Enums.git_provider
export const DEPLOY_TASK_STATUSES = DeployConstants.deploy.Enums.task_status

// =============================================================================
// Enum sets (for O(1) validation)
// =============================================================================

export const DEPLOY_ARTIFACT_KIND_SET: ReadonlySet<string> = new Set(DEPLOY_ARTIFACT_KINDS)
export const DEPLOY_DEPLOYMENT_ACTION_SET: ReadonlySet<string> = new Set(DEPLOY_DEPLOYMENT_ACTIONS)
export const DEPLOY_ENVIRONMENT_NAME_SET: ReadonlySet<string> = new Set(DEPLOY_ENVIRONMENT_NAMES)
export const DEPLOY_EXECUTOR_BACKEND_SET: ReadonlySet<string> = new Set(DEPLOY_EXECUTOR_BACKENDS)
export const DEPLOY_GIT_PROVIDER_SET: ReadonlySet<string> = new Set(DEPLOY_GIT_PROVIDERS)
export const DEPLOY_TASK_STATUS_SET: ReadonlySet<string> = new Set(DEPLOY_TASK_STATUSES)

// =============================================================================
// Enum constants (typed singletons)
// =============================================================================

export const DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE: DeployArtifactKind = "docker_image"
export const DEPLOY_DEPLOYMENT_ACTION_DEPLOY: DeployDeploymentAction = "deploy"
export const DEPLOY_DEPLOYMENT_ACTION_PROMOTE: DeployDeploymentAction = "promote"
export const DEPLOY_DEPLOYMENT_ACTION_ROLLBACK: DeployDeploymentAction = "rollback"
export const DEPLOY_ENVIRONMENT_STAGING: DeployEnvironmentName = "staging"
export const DEPLOY_ENVIRONMENT_PRODUCTION: DeployEnvironmentName = "production"
export const DEPLOY_EXECUTOR_DOCKER: DeployExecutorBackend = "docker"
export const DEPLOY_GIT_PROVIDER_GITHUB: DeployGitProvider = "github"
export const DEPLOY_TASK_STATUS_PENDING: DeployTaskStatus = "pending"
export const DEPLOY_TASK_STATUS_RUNNING: DeployTaskStatus = "running"
export const DEPLOY_TASK_STATUS_SUCCEEDED: DeployTaskStatus = "succeeded"
export const DEPLOY_TASK_STATUS_FAILED: DeployTaskStatus = "failed"
export const DEPLOY_TASK_STATUS_CANCELLED: DeployTaskStatus = "cancelled"

// =============================================================================
// Type guards
// =============================================================================

export function isDeployArtifactKind(v: string): v is DeployArtifactKind {
  return DEPLOY_ARTIFACT_KIND_SET.has(v)
}
export function isDeployDeploymentAction(v: string): v is DeployDeploymentAction {
  return DEPLOY_DEPLOYMENT_ACTION_SET.has(v)
}
export function isDeployEnvironmentName(v: string): v is DeployEnvironmentName {
  return DEPLOY_ENVIRONMENT_NAME_SET.has(v)
}
export function isDeployExecutorBackend(v: string): v is DeployExecutorBackend {
  return DEPLOY_EXECUTOR_BACKEND_SET.has(v)
}
export function isDeployGitProvider(v: string): v is DeployGitProvider {
  return DEPLOY_GIT_PROVIDER_SET.has(v)
}
export function isDeployTaskStatus(v: string): v is DeployTaskStatus {
  return DEPLOY_TASK_STATUS_SET.has(v)
}

// =============================================================================
// Zod schemas — THE schemas the API routes must use
// =============================================================================
// These are derived from the generated enum arrays, so they can't drift.
// The API routes import these instead of defining their own.

export const TaskStatusZ = z.enum(DEPLOY_TASK_STATUSES)
export const ArtifactKindZ = z.enum(DEPLOY_ARTIFACT_KINDS)
export const DeploymentActionZ = z.enum(DEPLOY_DEPLOYMENT_ACTIONS)
export const EnvironmentNameZ = z.enum(DEPLOY_ENVIRONMENT_NAMES)
export const ExecutorBackendZ = z.enum(DEPLOY_EXECUTOR_BACKENDS)

export const BuildZ = z.object({
  build_id: z.string(),
  application_id: z.string(),
  status: TaskStatusZ,
  git_ref: z.string(),
  git_sha: z.string().nullable(),
  commit_message: z.string().nullable(),
  artifact_kind: ArtifactKindZ,
  artifact_ref: z.string().nullable(),
  artifact_digest: z.string().nullable(),
  build_log_path: z.string().nullable(),
  error_message: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  created_at: z.string(),
})

export const ReleaseZ = z.object({
  release_id: z.string(),
  application_id: z.string(),
  build_id: z.string(),
  git_sha: z.string(),
  commit_message: z.string().nullable(),
  artifact_kind: ArtifactKindZ,
  artifact_ref: z.string(),
  artifact_digest: z.string(),
  created_at: z.string(),
  staging_status: TaskStatusZ.nullable(),
  production_status: TaskStatusZ.nullable(),
})

export const DeploymentZ = z.object({
  deployment_id: z.string(),
  environment_id: z.string(),
  environment_name: EnvironmentNameZ,
  environment_hostname: z.string(),
  environment_port: z.number().nullable(),
  release_id: z.string(),
  action: DeploymentActionZ,
  status: TaskStatusZ,
  deployment_log_path: z.string().nullable(),
  error_message: z.string().nullable(),
  healthcheck_status: z.number().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  created_at: z.string(),
})

export const EnvironmentZ = z.object({
  environment_id: z.string(),
  application_id: z.string(),
  name: EnvironmentNameZ,
  hostname: z.string(),
  port: z.number().nullable(),
  executor: ExecutorBackendZ,
  healthcheck_path: z.string(),
  allow_email: z.boolean(),
  current_deployment: DeploymentZ.nullable(),
})

export const ApplicationZ = z.object({
  application_id: z.string(),
  slug: z.string(),
  display_name: z.string(),
  repo_owner: z.string(),
  repo_name: z.string(),
  default_branch: z.string(),
  config_path: z.string(),
  environments: z.array(EnvironmentZ),
  recent_builds: z.array(BuildZ),
  recent_releases: z.array(ReleaseZ),
  recent_deployments: z.array(DeploymentZ),
})

export const CreateBuildBodyZ = z
  .object({
    application_id: z.string().trim().min(1),
    server_id: z.string().trim().min(1),
    git_ref: z.string().trim().min(1),
    git_sha: z.string().trim().min(1),
    commit_message: z.string().trim().min(1),
  })
  .strict()

export const CreateDeploymentBodyZ = z
  .object({
    environment_id: z.string().trim().min(1),
    release_id: z.string().trim().min(1),
    action: DeploymentActionZ.optional(),
  })
  .strict()

// =============================================================================
// Column contracts — which columns each consumer depends on
// =============================================================================
// These compile-time assertions ensure the columns exist in the generated types.
// If a migration removes a column, TypeScript will error HERE, not in production.

type AssertColumnsExist<Cols extends string, Row> = {
  [K in Cols]: K extends keyof Row ? true : never
}

// -- Columns the bash deploy script polls via psql --
const _scriptBuilds: AssertColumnsExist<
  "build_id" | "status" | "artifact_ref" | "error_message" | "server_id" | "application_id",
  BuildRow
> = { build_id: true, status: true, artifact_ref: true, error_message: true, server_id: true, application_id: true }
const _scriptDeploys: AssertColumnsExist<
  "deployment_id" | "status" | "error_message" | "healthcheck_status" | "environment_id" | "release_id",
  DeploymentRow
> = {
  deployment_id: true,
  status: true,
  error_message: true,
  healthcheck_status: true,
  environment_id: true,
  release_id: true,
}
const _scriptApps: AssertColumnsExist<"application_id" | "slug", ApplicationRow> = { application_id: true, slug: true }
const _scriptEnvs: AssertColumnsExist<"environment_id" | "application_id" | "name" | "server_id", EnvironmentRow> = {
  environment_id: true,
  application_id: true,
  name: true,
  server_id: true,
}
const _scriptRels: AssertColumnsExist<"release_id" | "build_id" | "git_sha", ReleaseRow> = {
  release_id: true,
  build_id: true,
  git_sha: true,
}

// -- Columns the deployer-rs reads/writes via tokio-postgres --
const _rsBuilds: AssertColumnsExist<
  | "build_id"
  | "application_id"
  | "git_ref"
  | "git_sha"
  | "commit_message"
  | "status"
  | "artifact_ref"
  | "artifact_digest"
  | "build_log_path"
  | "error_message"
  | "started_at"
  | "finished_at"
  | "server_id"
  | "attempt_count"
  | "builder_hostname"
  | "lease_token"
  | "lease_expires_at"
  | "alive_toml_snapshot"
  | "updated_at",
  BuildRow
> = {
  build_id: true,
  application_id: true,
  git_ref: true,
  git_sha: true,
  commit_message: true,
  status: true,
  artifact_ref: true,
  artifact_digest: true,
  build_log_path: true,
  error_message: true,
  started_at: true,
  finished_at: true,
  server_id: true,
  attempt_count: true,
  builder_hostname: true,
  lease_token: true,
  lease_expires_at: true,
  alive_toml_snapshot: true,
  updated_at: true,
}
const _rsDeploys: AssertColumnsExist<
  | "deployment_id"
  | "environment_id"
  | "release_id"
  | "status"
  | "deployment_log_path"
  | "error_message"
  | "healthcheck_status"
  | "healthcheck_checked_at"
  | "started_at"
  | "finished_at"
  | "attempt_count"
  | "lease_token"
  | "lease_expires_at"
  | "updated_at",
  DeploymentRow
> = {
  deployment_id: true,
  environment_id: true,
  release_id: true,
  status: true,
  deployment_log_path: true,
  error_message: true,
  healthcheck_status: true,
  healthcheck_checked_at: true,
  started_at: true,
  finished_at: true,
  attempt_count: true,
  lease_token: true,
  lease_expires_at: true,
  updated_at: true,
}
const _rsReleases: AssertColumnsExist<
  | "release_id"
  | "application_id"
  | "build_id"
  | "git_sha"
  | "commit_message"
  | "artifact_kind"
  | "artifact_ref"
  | "artifact_digest"
  | "alive_toml_snapshot"
  | "metadata",
  ReleaseRow
> = {
  release_id: true,
  application_id: true,
  build_id: true,
  git_sha: true,
  commit_message: true,
  artifact_kind: true,
  artifact_ref: true,
  artifact_digest: true,
  alive_toml_snapshot: true,
  metadata: true,
}
const _rsApps: AssertColumnsExist<
  "application_id" | "slug" | "display_name" | "repo_owner" | "repo_name" | "default_branch" | "config_path",
  ApplicationRow
> = {
  application_id: true,
  slug: true,
  display_name: true,
  repo_owner: true,
  repo_name: true,
  default_branch: true,
  config_path: true,
}
const _rsEnvs: AssertColumnsExist<
  | "environment_id"
  | "application_id"
  | "server_id"
  | "domain_id"
  | "name"
  | "hostname"
  | "port"
  | "healthcheck_path"
  | "allow_email"
  | "runtime_overrides",
  EnvironmentRow
> = {
  environment_id: true,
  application_id: true,
  server_id: true,
  domain_id: true,
  name: true,
  hostname: true,
  port: true,
  healthcheck_path: true,
  allow_email: true,
  runtime_overrides: true,
}

// Suppress unused-variable warnings — these exist purely for compile-time checking
void _scriptBuilds, _scriptDeploys, _scriptApps, _scriptEnvs, _scriptRels
void _rsBuilds, _rsDeploys, _rsReleases, _rsApps, _rsEnvs

// =============================================================================
// Pipeline stages — must match deployer-rs TaskStage enum
// =============================================================================

export const DEPLOYER_BUILD_STAGES = [
  "resolve_commit",
  "prepare_source",
  "reuse_release",
  "build_image",
  "publish_artifact",
  "record_release",
] as const

export const DEPLOYER_DEPLOYMENT_STAGES = [
  "prepare_runtime",
  "pull_artifact",
  "reserve_rollback",
  "start_container",
  "local_health",
  "stability",
  "public_health",
] as const

export type DeployerBuildStage = (typeof DEPLOYER_BUILD_STAGES)[number]
export type DeployerDeploymentStage = (typeof DEPLOYER_DEPLOYMENT_STAGES)[number]

// =============================================================================
// Health endpoint contract (deployer-rs GET /health)
// =============================================================================

export const DEPLOYER_WORKER_STATUSES = ["starting", "idle", "building", "deploying", "error"] as const
export type DeployerWorkerStatus = (typeof DEPLOYER_WORKER_STATUSES)[number]

export const DeployerHealthZ = z.object({
  ok: z.boolean(),
  worker: z.object({
    status: z.enum(DEPLOYER_WORKER_STATUSES),
    last_poll_at: z.string().nullable(),
    current_build_id: z.string().nullable(),
    current_deployment_id: z.string().nullable(),
    last_error: z.string().nullable(),
  }),
})

export type DeployerHealthResponse = z.infer<typeof DeployerHealthZ>
