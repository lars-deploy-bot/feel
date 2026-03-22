import {
  DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE,
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_ENVIRONMENT_STAGING,
  DEPLOY_TASK_STATUS_PENDING,
} from "@webalive/database"
import { PORTS } from "@webalive/shared"
import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { NotFoundError } from "../../../infra/errors"
import { errorHandler } from "../../../middleware/error-handler"
import type { AppBindings } from "../../../types/hono"

vi.mock("./deploys.service", () => ({
  listDeployApplications: vi.fn(),
  queueBuild: vi.fn(),
  queueDeployment: vi.fn(),
  readBuildLog: vi.fn(),
  readDeploymentLog: vi.fn(),
}))

import { deploysRoutes } from "./deploys.routes"
import { listDeployApplications, queueBuild, queueDeployment, readBuildLog, readDeploymentLog } from "./deploys.service"

function buildTestApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()
  app.onError(errorHandler)
  app.route("/api/manager/deploys", deploysRoutes)
  return app
}

const okSchema = z.object({
  ok: z.literal(true),
})

const errorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

describe("deploysRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists deploy applications", async () => {
    vi.mocked(listDeployApplications).mockResolvedValueOnce([])

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/deploys")

    expect(response.status).toBe(200)
    expect(okSchema.parse(await response.json()).ok).toBe(true)
    expect(listDeployApplications).toHaveBeenCalledTimes(1)
  })

  it("queues a build", async () => {
    vi.mocked(queueBuild).mockResolvedValueOnce({
      build_id: "dep_build_123",
      application_id: "dep_app_123",
      status: DEPLOY_TASK_STATUS_PENDING,
      git_ref: "HEAD",
      git_sha: null,
      commit_message: null,
      artifact_kind: DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE,
      artifact_ref: null,
      artifact_digest: null,
      build_log_path: null,
      error_message: null,
      started_at: null,
      finished_at: null,
      created_at: "2026-03-10T12:00:00.000Z",
    })

    const app = buildTestApp()
    const body = {
      application_id: "dep_app_123",
      server_id: "srv_test",
      git_ref: "main",
      git_sha: "abc123",
      commit_message: "test commit",
    }
    const response = await app.request("http://localhost/api/manager/deploys/builds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(201)
    expect(okSchema.parse(await response.json()).ok).toBe(true)
    expect(queueBuild).toHaveBeenCalledWith(body)
  })

  it("rejects invalid deployment payloads", async () => {
    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/deploys/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release_id: "dep_rel_123" }),
    })

    expect(response.status).toBe(400)
    expect(errorSchema.parse(await response.json()).error.code).toBe("VALIDATION_ERROR")
    expect(queueDeployment).not.toHaveBeenCalled()
  })

  it("queues a deployment with the default deploy action", async () => {
    vi.mocked(queueDeployment).mockResolvedValueOnce({
      deployment_id: "dep_deploy_123",
      environment_id: "dep_env_123",
      environment_name: DEPLOY_ENVIRONMENT_STAGING,
      environment_hostname: "staging.test.example",
      environment_port: PORTS.STAGING,
      release_id: "dep_rel_123",
      action: DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
      status: DEPLOY_TASK_STATUS_PENDING,
      deployment_log_path: null,
      error_message: null,
      healthcheck_status: null,
      started_at: null,
      finished_at: null,
      created_at: "2026-03-10T12:00:00.000Z",
    })

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/deploys/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        environment_id: "dep_env_123",
        release_id: "dep_rel_123",
      }),
    })

    expect(response.status).toBe(201)
    expect(okSchema.parse(await response.json()).ok).toBe(true)
    expect(queueDeployment).toHaveBeenCalledWith("dep_env_123", "dep_rel_123", undefined)
  })

  it("requires auth on the fully wired manager route", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key"
    process.env.ALIVE_PASSCODE = "test-passcode"
    process.env.NODE_ENV = "development"
    process.env.E2B_API_KEY = "e2b_test_key"
    process.env.GROQ_API_SECRET = "groq-secret"
    process.env.POSTHOG_API_KEY = "posthog-key"
    process.env.POSTHOG_HOST = "https://posthog.example.com"
    process.env.POSTHOG_PROJECT_ID = "2"
    vi.resetModules()

    const { createApp } = await import("../../../server/app")
    const app = createApp()
    const response = await app.request("http://localhost/api/manager/deploys")

    expect(response.status).toBe(401)
    expect(errorSchema.parse(await response.json()).error.code).toBe("UNAUTHORIZED")
    expect(listDeployApplications).not.toHaveBeenCalled()
  })

  it("returns plain text logs for builds and deployments", async () => {
    vi.mocked(readBuildLog).mockResolvedValueOnce("build log")
    vi.mocked(readDeploymentLog).mockResolvedValueOnce("deployment log")

    const app = buildTestApp()
    const buildResponse = await app.request("http://localhost/api/manager/deploys/builds/dep_build_123/log")
    const deploymentResponse = await app.request("http://localhost/api/manager/deploys/deployments/dep_deploy_123/log")

    expect(buildResponse.status).toBe(200)
    expect(await buildResponse.text()).toBe("build log")
    expect(deploymentResponse.status).toBe(200)
    expect(await deploymentResponse.text()).toBe("deployment log")
  })

  it("returns 404 when a build log is missing", async () => {
    vi.mocked(readBuildLog).mockRejectedValueOnce(new NotFoundError("Build log is not available yet"))

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/deploys/builds/dep_build_123/log")

    expect(response.status).toBe(404)
    expect(errorSchema.parse(await response.json()).error.code).toBe("NOT_FOUND")
  })
})
