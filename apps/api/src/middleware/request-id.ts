import { createMiddleware } from "hono/factory"
import type { AppBindings } from "../types/hono"

export const requestIdMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const existing = c.req.header("X-Request-Id")
  const requestId = existing ?? crypto.randomUUID()

  c.set("requestId", requestId)

  await next()

  c.header("X-Request-Id", requestId)
})
