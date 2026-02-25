import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import type { AppBindings } from "../../types/hono"
import { AUTH } from "../../config/constants"
import { UnauthorizedError } from "../../infra/errors"
import { validate } from "../../shared/validation"
import { loginBodySchema } from "./auth.schemas"
import { verifyPasscode } from "./auth.service"

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
  const authenticated = cookieValue ? verifyPasscode(cookieValue) : false
  return c.json({ ok: true, authenticated })
})
