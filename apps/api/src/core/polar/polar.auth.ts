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
  const secret = env.JWT_SECRET
  if (!secret) {
    throw new UnauthorizedError("JWT_SECRET not configured")
  }

  const token = getCookie(c, COOKIE_NAMES.SESSION)
  if (!token) {
    throw new UnauthorizedError("No session cookie")
  }

  try {
    const decoded = jwt.verify(token, secret)
    if (typeof decoded !== "object" || decoded === null) {
      throw new UnauthorizedError("Invalid token payload")
    }

    const payload = decoded as Record<string, unknown>
    const userId = payload.userId ?? payload.sub
    const email = payload.email

    if (typeof userId !== "string" || !userId) {
      throw new UnauthorizedError("Token missing userId")
    }

    c.set("polarUserId", userId)
    c.set("polarUserEmail", typeof email === "string" ? email : "")
    c.set("authenticated", true)
    return next()
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err
    throw new UnauthorizedError("Invalid session token")
  }
})
