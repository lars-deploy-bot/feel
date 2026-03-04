import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { NotFoundError } from "../../../infra/errors"
import { errorHandler } from "../../../middleware/error-handler"
import type { AppBindings } from "../../../types/hono"
import { usersRoutes } from "./users.routes"
import { createPasswordResetToken } from "./users.service"

vi.mock("./users.service", () => ({
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  updateEnabledModels: vi.fn(),
  createPasswordResetToken: vi.fn(),
}))

vi.mock("../../../infra/posthog", () => ({
  fetchUserEvents: vi.fn(),
  fetchUserProfile: vi.fn(),
}))

function buildTestApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()
  app.onError(errorHandler)
  app.route("/api/manager/users", usersRoutes)
  return app
}

const successSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    token: z.string(),
    expires_at: z.string(),
  }),
})

const errorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

describe("usersRoutes password reset token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("issues a reset token for a user", async () => {
    const mockCreate = vi.mocked(createPasswordResetToken)
    mockCreate.mockResolvedValueOnce({
      token: "prt_abcdefghijklmnopqrstuvwxyz0123456789",
      expires_at: "2026-03-04T22:00:00.000Z",
    })

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/users/user_123/password-reset-token", {
      method: "POST",
    })

    expect(response.status).toBe(200)
    const body = successSchema.parse(await response.json())
    expect(body.ok).toBe(true)
    expect(body.data.token).toContain("prt_")
    expect(mockCreate).toHaveBeenCalledWith("user_123")
  })

  it("returns 404 when user does not exist", async () => {
    const mockCreate = vi.mocked(createPasswordResetToken)
    mockCreate.mockRejectedValueOnce(new NotFoundError("User user_missing not found"))

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/manager/users/user_missing/password-reset-token", {
      method: "POST",
    })

    expect(response.status).toBe(404)
    const body = errorSchema.parse(await response.json())
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe("NOT_FOUND")
  })
})
