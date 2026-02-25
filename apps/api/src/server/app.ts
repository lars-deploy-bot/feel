import { Hono } from "hono"
import type { AppBindings } from "../types/hono"
import { requestIdMiddleware } from "../middleware/request-id"
import { corsMiddleware } from "../middleware/cors"
import { requestLoggerMiddleware } from "../middleware/request-logger"
import { rateLimitMiddleware } from "../middleware/rate-limit"
import { errorHandler } from "../middleware/error-handler"
import { buildRoutes } from "../core"

export function createApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>()

  // Apply global middleware in order
  app.use("*", requestIdMiddleware)
  app.use("*", corsMiddleware)
  app.use("*", requestLoggerMiddleware)
  app.use("*", rateLimitMiddleware)

  // Set error handler
  app.onError(errorHandler)

  // Mount all routes
  const routes = buildRoutes()
  app.route("/", routes)

  return app
}

export const app = createApp()
