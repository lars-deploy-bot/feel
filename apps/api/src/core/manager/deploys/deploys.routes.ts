import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  DEPLOY_ARTIFACT_KINDS,
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_DEPLOYMENT_ACTIONS,
  DEPLOY_ENVIRONMENT_NAMES,
  DEPLOY_EXECUTOR_BACKENDS,
  DEPLOY_TASK_STATUSES,
} from "@webalive/database"
import type { AppBindings } from "../../../types/hono"
import { listDeployApplications, queueBuild, queueDeployment, readBuildLog, readDeploymentLog } from "./deploys.service"

// =============================================================================
// Shared Zod schemas (reused across routes and emitted into the OpenAPI spec)
// =============================================================================

const TaskStatusSchema = z.enum(DEPLOY_TASK_STATUSES).openapi("TaskStatus")
const ArtifactKindSchema = z.enum(DEPLOY_ARTIFACT_KINDS).openapi("ArtifactKind")
const DeploymentActionSchema = z.enum(DEPLOY_DEPLOYMENT_ACTIONS).openapi("DeploymentAction")
const EnvironmentNameSchema = z.enum(DEPLOY_ENVIRONMENT_NAMES).openapi("EnvironmentName")
const ExecutorBackendSchema = z.enum(DEPLOY_EXECUTOR_BACKENDS).openapi("ExecutorBackend")

const BuildSchema = z
  .object({
    build_id: z.string(),
    application_id: z.string(),
    status: TaskStatusSchema,
    git_ref: z.string(),
    git_sha: z.string().nullable(),
    commit_message: z.string().nullable(),
    artifact_kind: ArtifactKindSchema,
    artifact_ref: z.string().nullable(),
    artifact_digest: z.string().nullable(),
    build_log_path: z.string().nullable(),
    error_message: z.string().nullable(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi("Build")

const ReleaseSchema = z
  .object({
    release_id: z.string(),
    application_id: z.string(),
    build_id: z.string(),
    git_sha: z.string(),
    commit_message: z.string().nullable(),
    artifact_kind: ArtifactKindSchema,
    artifact_ref: z.string(),
    artifact_digest: z.string(),
    created_at: z.string(),
    staging_status: TaskStatusSchema.nullable(),
    production_status: TaskStatusSchema.nullable(),
  })
  .openapi("Release")

const DeploymentSchema = z
  .object({
    deployment_id: z.string(),
    environment_id: z.string(),
    environment_name: EnvironmentNameSchema,
    environment_hostname: z.string(),
    environment_port: z.number().nullable(),
    release_id: z.string(),
    action: DeploymentActionSchema,
    status: TaskStatusSchema,
    deployment_log_path: z.string().nullable(),
    error_message: z.string().nullable(),
    healthcheck_status: z.number().nullable(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi("Deployment")

const EnvironmentSchema = z
  .object({
    environment_id: z.string(),
    application_id: z.string(),
    name: EnvironmentNameSchema,
    hostname: z.string(),
    port: z.number().nullable(),
    executor: ExecutorBackendSchema,
    healthcheck_path: z.string(),
    allow_email: z.boolean(),
    current_deployment: DeploymentSchema.nullable(),
  })
  .openapi("Environment")

const ApplicationSchema = z
  .object({
    application_id: z.string(),
    slug: z.string(),
    display_name: z.string(),
    repo_owner: z.string(),
    repo_name: z.string(),
    default_branch: z.string(),
    config_path: z.string(),
    environments: z.array(EnvironmentSchema),
    recent_builds: z.array(BuildSchema),
    recent_releases: z.array(ReleaseSchema),
    recent_deployments: z.array(DeploymentSchema),
  })
  .openapi("Application")

const ErrorSchema = z
  .object({
    ok: z.literal(false),
    error: z.string(),
  })
  .openapi("Error")

// =============================================================================
// Route definitions
// =============================================================================

const listApplicationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Deploys"],
  summary: "List all applications with environments, builds, releases, and deployments",
  responses: {
    200: {
      description: "Applications with full deploy state",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: z.array(ApplicationSchema) }) } },
    },
  },
})

const createBuildRoute = createRoute({
  method: "post",
  path: "/builds",
  tags: ["Deploys"],
  summary: "Queue a new build",
  description:
    "Inserts a pending build row. The deployer-rs worker picks it up, runs the build (bun build or docker build depending on alive.toml runtime.kind), and records a release on success.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              application_id: z.string().trim().min(1).openapi({
                description: "The application to build",
                example: "dep_app_bd57129d0218c50d",
              }),
              server_id: z.string().trim().min(1).openapi({
                description: "Server to build on (from server-config.json serverId)",
                example: "srv_alive_dot_best_138_201_56_93",
              }),
              git_ref: z.string().trim().min(1).openapi({
                description: "Git ref (branch name or SHA)",
                example: "main",
              }),
              git_sha: z.string().trim().min(1).openapi({
                description: "Resolved git commit SHA",
                example: "7f92e71a...",
              }),
              commit_message: z.string().trim().min(1).openapi({
                description: "Commit message for the build",
                example: "feat: add systemd runtime adapter",
              }),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Build queued",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: BuildSchema }) } },
    },
    409: {
      description: "A build is already running for this application",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

const createDeploymentRoute = createRoute({
  method: "post",
  path: "/deployments",
  tags: ["Deploys"],
  summary: "Queue a new deployment",
  description:
    "Inserts a pending deployment row. The deployer-rs worker picks it up, activates the release on the target environment (symlink swap + systemctl restart, or docker run), runs health checks, and marks success or rolls back. Production deployments require a successful staging deployment of the same release.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z
            .object({
              environment_id: z
                .string()
                .trim()
                .min(1)
                .openapi({ description: "Target environment", example: "dep_env_staging_abc123" }),
              release_id: z
                .string()
                .trim()
                .min(1)
                .openapi({ description: "Release to deploy", example: "dep_rel_def456" }),
              action: DeploymentActionSchema.optional().default(DEPLOY_DEPLOYMENT_ACTION_DEPLOY).openapi({
                description: "deploy = fresh deploy, promote = promote from staging, rollback = revert to previous",
              }),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Deployment queued",
      content: { "application/json": { schema: z.object({ ok: z.literal(true), data: DeploymentSchema }) } },
    },
    409: {
      description: "A deployment is already running, or promotion preconditions not met",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

const getBuildLogRoute = createRoute({
  method: "get",
  path: "/builds/{id}/log",
  tags: ["Deploys"],
  summary: "Get build log",
  request: {
    params: z.object({ id: z.string().openapi({ description: "Build ID" }) }),
  },
  responses: {
    200: {
      description: "Build log (plain text, last 400 lines)",
      content: { "text/plain": { schema: z.string() } },
    },
    404: {
      description: "Build not found or log not available yet",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

const getDeploymentLogRoute = createRoute({
  method: "get",
  path: "/deployments/{id}/log",
  tags: ["Deploys"],
  summary: "Get deployment log",
  request: {
    params: z.object({ id: z.string().openapi({ description: "Deployment ID" }) }),
  },
  responses: {
    200: {
      description: "Deployment log (plain text, last 400 lines)",
      content: { "text/plain": { schema: z.string() } },
    },
    404: {
      description: "Deployment not found or log not available yet",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
})

// =============================================================================
// Wire routes to handlers
// =============================================================================

export const deploysRoutes = new OpenAPIHono<AppBindings>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", "),
          },
        },
        400,
      )
    }
  },
})
  .openapi(listApplicationsRoute, async c => {
    const data = await listDeployApplications()
    return c.json({ ok: true as const, data }, 200)
  })
  .openapi(createBuildRoute, async c => {
    const body = c.req.valid("json")
    const build = await queueBuild(body)
    return c.json({ ok: true as const, data: build }, 201)
  })
  .openapi(createDeploymentRoute, async c => {
    const body = c.req.valid("json")
    const deployment = await queueDeployment(body.environment_id, body.release_id, body.action)
    return c.json({ ok: true as const, data: deployment }, 201)
  })
  .openapi(getBuildLogRoute, async c => {
    const { id } = c.req.valid("param")
    const log = await readBuildLog(id)
    c.header("Content-Type", "text/plain; charset=utf-8")
    return c.text(log, 200)
  })
  .openapi(getDeploymentLogRoute, async c => {
    const { id } = c.req.valid("param")
    const log = await readDeploymentLog(id)
    c.header("Content-Type", "text/plain; charset=utf-8")
    return c.text(log, 200)
  })
