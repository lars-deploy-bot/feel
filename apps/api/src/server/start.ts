import { env } from "../config/env"
import { logger } from "../infra/logger"
import { app } from "./app"

export function start(): void {
  const port = env.PORT

  Bun.serve({
    fetch: app.fetch,
    port,
  })

  logger.info("server_started", {
    port,
    env: env.NODE_ENV,
    message: `API server listening on http://localhost:${port}`,
  })
}
