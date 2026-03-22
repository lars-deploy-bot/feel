import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { ApplicationZ, BuildZ, CreateBuildBodyZ, CreateDeploymentBodyZ, DeploymentZ } from "@webalive/database"
import type { AppBindings } from "../../../types/hono"
import { listDeployApplications, queueBuild, queueDeployment, readBuildLog, readDeploymentLog } from "./deploys.service"

// =============================================================================
// Shared schemas — imported from @webalive/database/deploy-contract
// =============================================================================
// Shapes come from the deploy contract (plain Zod). This file wraps them
// with .openapi() metadata for the generated spec but MUST NOT redefine
// the schema fields — that would create drift.

const BuildSchema = z.object(BuildZ.shape).openapi("Build")
const DeploymentSchema = z.object(DeploymentZ.shape).openapi("Deployment")
const ApplicationSchema = z.object(ApplicationZ.shape).openapi("Application")

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
          schema: z.object(CreateBuildBodyZ.shape).strict().openapi("CreateBuildBody"),
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
          schema: z.object(CreateDeploymentBodyZ.shape).strict().openapi("CreateDeploymentBody"),
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
