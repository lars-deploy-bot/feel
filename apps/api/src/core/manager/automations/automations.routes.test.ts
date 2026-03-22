import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { NotFoundError } from "../../../infra/errors"
import { errorHandler } from "../../../middleware/error-handler"
import type { AppBindings } from "../../../types/hono"

vi.mock("./automations.service", () => ({
  deleteJob: vi.fn(),
  listAutomations: vi.fn(),
  toggleJobActive: vi.fn(),
  updateJob: vi.fn(),
}))

vi.mock("./text-to-cron", () => ({
  textToCron: vi.fn(),
}))

import { automationsRoutes } from "./automations.routes"
import { deleteJob, toggleJobActive, updateJob } from "./automations.service"
import { textToCron } from "./text-to-cron"

function buildTestApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()
  app.onError(errorHandler)
  app.route("/api/manager/automations", automationsRoutes)
  return app
}

const successSchema = z.object({
  ok: z.literal(true),
})

const textToCronSuccessSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    cron: z.string(),
    timezone: z.string().nullable(),
  }),
})

const errorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

describe("automationsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates active state for a job", async () => {
    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/job_123/active", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    })

    expect(response.status).toBe(200)
    expect(successSchema.parse(await response.json()).ok).toBe(true)
    expect(toggleJobActive).toHaveBeenCalledWith("job_123", true)
  })

  it("rejects invalid active-state payloads", async () => {
    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/job_123/active", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: "yes" }),
    })

    expect(response.status).toBe(400)
    expect(errorSchema.parse(await response.json()).error.code).toBe("VALIDATION_ERROR")
    expect(toggleJobActive).not.toHaveBeenCalled()
  })

  it("updates editable job fields with a strict schema", async () => {
    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/job_123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Daily digest",
        description: "Runs every morning",
      }),
    })

    expect(response.status).toBe(200)
    expect(successSchema.parse(await response.json()).ok).toBe(true)
    expect(updateJob).toHaveBeenCalledWith("job_123", {
      name: "Daily digest",
      description: "Runs every morning",
    })
  })

  it("rejects empty or unknown update payloads", async () => {
    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/job_123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unsupported: "value" }),
    })

    expect(response.status).toBe(400)
    expect(errorSchema.parse(await response.json()).error.code).toBe("VALIDATION_ERROR")
    expect(updateJob).not.toHaveBeenCalled()
  })

  it("converts schedule text to cron", async () => {
    vi.mocked(textToCron).mockResolvedValueOnce({
      cron: "0 9 * * 1-5",
      description: "Weekdays at 9:00 AM",
      timezone: "Europe/Amsterdam",
    })

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/text-to-cron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "weekdays at 9am amsterdam time" }),
    })

    expect(response.status).toBe(200)
    const body = textToCronSuccessSchema.parse(await response.json())
    expect(body.data.cron).toBe("0 9 * * 1-5")
    expect(textToCron).toHaveBeenCalledWith("weekdays at 9am amsterdam time")
  })

  it("returns not found when deleting a missing job", async () => {
    vi.mocked(deleteJob).mockRejectedValueOnce(new NotFoundError("Automation job job_missing not found"))

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/automations/job_missing", {
      method: "DELETE",
    })

    expect(response.status).toBe(404)
    expect(errorSchema.parse(await response.json()).error.code).toBe("NOT_FOUND")
  })
})
