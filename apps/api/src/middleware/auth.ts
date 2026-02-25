import { createMiddleware } from "hono/factory"
import { getCookie } from "hono/cookie"
import { timingSafeEqual } from "node:crypto"
import { env } from "../config/env"
import { AUTH } from "../config/constants"
import { UnauthorizedError } from "../infra/errors"
import type { AppBindings } from "../types/hono"

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.byteLength !== bufB.byteLength) {
    // Still compare to keep timing constant
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  // Check Authorization Bearer header first
  const authHeader = c.req.header("Authorization")
  if (authHeader) {
    const parts = authHeader.split(" ")
    if (parts.length === 2 && parts[0] === "Bearer") {
      const token = parts[1]
      if (token && timingSafeCompare(token, env.ALIVE_PASSCODE)) {
        c.set("authenticated", true)
        return next()
      }
    }
  }

  // Check cookie
  const cookieValue = getCookie(c, AUTH.COOKIE_NAME)
  if (cookieValue && timingSafeCompare(cookieValue, env.ALIVE_PASSCODE)) {
    c.set("authenticated", true)
    return next()
  }

  throw new UnauthorizedError()
})
