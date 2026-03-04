import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { AUTH } from "../../config/constants"
import { UnauthorizedError } from "../../infra/errors"
import { validate } from "../../shared/validation"
import type { AppBindings } from "../../types/hono"
import { loginBodySchema, resetPasswordBodySchema } from "./auth.schemas"
import { consumePasswordResetToken, verifyPasscode } from "./auth.service"

export const authRoutes = new Hono<AppBindings>()

authRoutes.post("/login", async c => {
  const body = await c.req.json()
  const { passcode } = validate(loginBodySchema, body)

  if (!verifyPasscode(passcode)) {
    throw new UnauthorizedError("Invalid passcode")
  }

  setCookie(c, AUTH.COOKIE_NAME, passcode, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: AUTH.COOKIE_MAX_AGE,
    path: "/",
  })

  return c.json({ ok: true, message: "Authenticated" })
})

authRoutes.post("/logout", c => {
  deleteCookie(c, AUTH.COOKIE_NAME, {
    path: "/",
  })

  return c.json({ ok: true, message: "Logged out" })
})

authRoutes.get("/me", c => {
  const cookieValue = getCookie(c, AUTH.COOKIE_NAME)
  if (!cookieValue || !verifyPasscode(cookieValue)) {
    throw new UnauthorizedError()
  }
  return c.json({ ok: true })
})

authRoutes.post("/password-reset", async c => {
  const body = validate(resetPasswordBodySchema, await c.req.json())
  const data = await consumePasswordResetToken(body.token, body.newPassword)
  return c.json({ ok: true, data })
})
