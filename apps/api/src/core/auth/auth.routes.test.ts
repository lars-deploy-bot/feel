import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { UnauthorizedError } from "../../infra/errors"
import { errorHandler } from "../../middleware/error-handler"
import type { AppBindings } from "../../types/hono"
import { authRoutes } from "./auth.routes"
import { consumePasswordResetToken } from "./auth.service"

vi.mock("./auth.service", () => ({
  verifyPasscode: vi.fn(() => true),
  consumePasswordResetToken: vi.fn(),
}))

function buildTestApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()
  app.onError(errorHandler)
  app.route("/api/auth", authRoutes)
  return app
}

const successSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    user_id: z.string(),
  }),
})

const errorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

describe("authRoutes password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 when request body is invalid", async () => {
    const app = buildTestApp()

    const response = await app.request("http://localhost/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "too-short", newPassword: "123" }),
    })

    expect(response.status).toBe(400)
    const body = errorSchema.parse(await response.json())
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("resets password when token is valid", async () => {
    const mockConsume = vi.mocked(consumePasswordResetToken)
    mockConsume.mockResolvedValueOnce({ user_id: "user_123" })

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "prt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        newPassword: "new-password-123",
      }),
    })

    expect(response.status).toBe(200)
    const body = successSchema.parse(await response.json())
    expect(body.ok).toBe(true)
    expect(body.data.user_id).toBe("user_123")
    expect(mockConsume).toHaveBeenCalledWith(
      "prt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "new-password-123",
    )
  })

  it("returns 401 when token is invalid or expired", async () => {
    const mockConsume = vi.mocked(consumePasswordResetToken)
    mockConsume.mockRejectedValueOnce(new UnauthorizedError("Invalid or expired reset token"))

    const app = buildTestApp()
    const response = await app.request("http://localhost/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "prt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        newPassword: "new-password-123",
      }),
    })

    expect(response.status).toBe(401)
    const body = errorSchema.parse(await response.json())
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe("UNAUTHORIZED")
  })
})
