import { Hono } from "hono"
import type { AppBindings } from "../types/hono"
import { healthRoutes } from "./health/health.routes"
import { authRoutes } from "./auth/auth.routes"
import { orgsRoutes } from "./manager/orgs/orgs.routes"
import { usersRoutes } from "./manager/users/users.routes"
import { domainsRoutes } from "./manager/domains/domains.routes"
import { feedbackRoutes } from "./manager/feedback/feedback.routes"
import { templatesRoutes } from "./manager/templates/templates.routes"
import { authMiddleware } from "../middleware/auth"

/**
 * Mount all route groups onto a single Hono app.
 *
 * - Health and auth routes are public (no auth required)
 * - Manager routes require authentication via authMiddleware
 */
export function buildRoutes(): Hono<AppBindings> {
  const api = new Hono<AppBindings>()

  // Public routes (outside /api for direct access)
  api.route("/health", healthRoutes)

  // All /api routes
  const apiGroup = new Hono<AppBindings>()

  // Public auth routes
  apiGroup.route("/auth", authRoutes)

  // Protected manager routes
  const manager = new Hono<AppBindings>()
  manager.use("/*", authMiddleware)
  manager.route("/orgs", orgsRoutes)
  manager.route("/users", usersRoutes)
  manager.route("/domains", domainsRoutes)
  manager.route("/feedback", feedbackRoutes)
  manager.route("/templates", templatesRoutes)

  apiGroup.route("/manager", manager)

  api.route("/api", apiGroup)

  return api
}
