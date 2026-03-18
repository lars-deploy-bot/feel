import { OpenAPIHono } from "@hono/zod-openapi"
import { buildRoutes } from "../core"
import { corsMiddleware } from "../middleware/cors"
import { errorHandler } from "../middleware/error-handler"
import { rateLimitMiddleware } from "../middleware/rate-limit"
import { requestIdMiddleware } from "../middleware/request-id"
import { requestLoggerMiddleware } from "../middleware/request-logger"
import type { AppBindings } from "../types/hono"

export function createApp(): OpenAPIHono<AppBindings> {
  const app = new OpenAPIHono<AppBindings>()

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
