import { createMiddleware } from "hono/factory"
import { logger } from "../infra/logger"
import type { AppBindings } from "../types/hono"

export const requestLoggerMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const start = performance.now()

  await next()

  const durationMs = Math.round((performance.now() - start) * 100) / 100

  logger.info("request", {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration_ms: durationMs,
    requestId: c.get("requestId"),
  })
})
