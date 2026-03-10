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
      status: "pending",
      git_ref: "HEAD",
      git_sha: null,
      commit_message: null,
      artifact_kind: "docker_image",
      artifact_ref: null,
      artifact_digest: null,
      build_log_path: null,
      error_message: null,
      started_at: null,
      finished_at: null,
      created_at: "2026-03-10T12:00:00.000Z",
    })

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/deploys/builds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: "dep_app_123" }),
    })

    expect(response.status).toBe(201)
    expect(okSchema.parse(await response.json()).ok).toBe(true)
    expect(queueBuild).toHaveBeenCalledWith("dep_app_123", undefined)
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
