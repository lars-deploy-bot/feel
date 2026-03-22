import { OpenAPIHono } from "@hono/zod-openapi"
import { authMiddleware } from "../middleware/auth"
import type { AppBindings } from "../types/hono"
import { authRoutes } from "./auth/auth.routes"
import { avatarsRoutes } from "./avatars/avatars.routes"
import { faviconRoutes } from "./favicon/favicon.routes"
import { healthRoutes } from "./health/health.routes"
import { automationsRoutes } from "./manager/automations/automations.routes"
import { deploysRoutes } from "./manager/deploys/deploys.routes"
import { diskRoutes } from "./manager/disk/disk.routes"
import { dockerRoutes } from "./manager/docker/docker.routes"
import { domainsRoutes } from "./manager/domains/domains.routes"
import { feedbackRoutes } from "./manager/feedback/feedback.routes"
import { orgsRoutes } from "./manager/orgs/orgs.routes"
import { portsRoutes } from "./manager/ports/ports.routes"
import { processesRoutes } from "./manager/processes/processes.routes"
import { sdkLogsRoutes } from "./manager/sdk-logs/sdk-logs.routes"
import { servicesRoutes } from "./manager/services/services.routes"
import { templatesRoutes } from "./manager/templates/templates.routes"
import { transfersRoutes } from "./manager/transfers/transfers.routes"
import { usersRoutes } from "./manager/users/users.routes"
import { polarRoutes } from "./polar/polar.routes"
import { voiceRoutes } from "./voice/voice.routes"

/**
 * Mount all route groups onto a single Hono app.
 *
 * - Health and auth routes are public (no auth required)
 * - Manager routes require authentication via authMiddleware
 * - OpenAPI spec is served at GET /api/doc (JSON)
 */
export function buildRoutes(): OpenAPIHono<AppBindings> {
  const api = new OpenAPIHono<AppBindings>()

  // Public routes (outside /api for direct access)
  api.route("/health", healthRoutes)

  // All /api routes
  const apiGroup = new OpenAPIHono<AppBindings>()

  // Public routes
  apiGroup.route("/auth", authRoutes)
  apiGroup.route("/favicon", faviconRoutes)

  // Protected manager routes
  const manager = new OpenAPIHono<AppBindings>()
  manager.use("/*", authMiddleware)
  manager.route("/automations", automationsRoutes)
  manager.route("/deploys", deploysRoutes)
  manager.route("/orgs", orgsRoutes)
  manager.route("/users", usersRoutes)
  manager.route("/domains", domainsRoutes)
  manager.route("/feedback", feedbackRoutes)
  manager.route("/templates", templatesRoutes)
  manager.route("/transfers", transfersRoutes)
  manager.route("/sdk-logs", sdkLogsRoutes)
  manager.route("/ports", portsRoutes)
  manager.route("/services", servicesRoutes)
  manager.route("/disk", diskRoutes)
  manager.route("/processes", processesRoutes)
  manager.route("/docker", dockerRoutes)
  manager.route("/avatars", avatarsRoutes)

  // Protected voice routes
  const voice = new OpenAPIHono<AppBindings>()
  voice.use("/*", authMiddleware)
  voice.route("/", voiceRoutes)
  apiGroup.route("/voice", voice)

  // Polar billing routes — webhook is public, checkout/portal/billing use web app session auth
  apiGroup.route("/polar", polarRoutes)

  apiGroup.route("/manager", manager)

  // OpenAPI spec endpoint
  apiGroup.doc("/doc", {
    openapi: "3.1.0",
    info: {
      title: "Alive Deploy API",
      version: "1.0.0",
      description:
        "API for the Alive deploy control plane. Queue builds, trigger deployments, " +
        "read logs. The deployer-rs worker processes queued tasks via the RuntimeAdapter " +
        "interface (systemd or Docker).",
    },
    tags: [
      {
        name: "Deploys",
        description: "Build, release, and deploy applications. All routes require authentication.",
      },
    ],
  })

  api.route("/api", apiGroup)

  return api
}
