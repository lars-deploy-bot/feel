import { COOKIE_NAMES } from "@webalive/shared"
import { getCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import jwt from "jsonwebtoken"
import { env } from "../../config/env"
import { UnauthorizedError } from "../../infra/errors"
import type { AppBindings } from "../../types/hono"

export type PolarAuthBindings = AppBindings & {
  Variables: AppBindings["Variables"] & {
    polarUserId: string
    polarUserEmail: string
  }
}

/**
 * Middleware that verifies the web app's JWT session cookie.
 * Extracts userId and email from the token for Polar billing routes.
 */
export const polarSessionAuth = createMiddleware<PolarAuthBindings>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAMES.SESSION)
  if (!token) {
    throw new UnauthorizedError("No session cookie")
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET)
    if (typeof decoded !== "object" || decoded === null) {
      throw new UnauthorizedError("Invalid token payload")
    }

    const userId = "userId" in decoded && typeof decoded.userId === "string" ? decoded.userId : null
    const sub = "sub" in decoded && typeof decoded.sub === "string" ? decoded.sub : null
    const resolvedUserId = userId ?? sub

    if (!resolvedUserId) {
      throw new UnauthorizedError("Token missing userId")
    }

    const email = "email" in decoded && typeof decoded.email === "string" ? decoded.email : ""

    c.set("polarUserId", resolvedUserId)
    c.set("polarUserEmail", email)
    c.set("authenticated", true)
    return next()
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError("Invalid session token")
  }
})
