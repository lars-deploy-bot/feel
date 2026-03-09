// Entry point for the Alive API service
// Validates env, registers shutdown hooks, starts the server

import "./infra/sentry"
import { env } from "./config/env"
import { registerShutdownHooks } from "./server/hooks"
import { start } from "./server/start"

// Validate configuration eagerly (env is validated on import via loadEnv)
void env

// Register graceful shutdown handlers
registerShutdownHooks()

// Start the HTTP server
start()
