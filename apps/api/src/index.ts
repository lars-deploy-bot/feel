// Entry point for the Alive API service
// Validates env, registers shutdown hooks, starts the server

import "./infra/sentry"
import { env } from "./config/env"
import { logger } from "./infra/logger"
import { registerShutdownHooks } from "./server/hooks"
import { start } from "./server/start"
import { verifySeedData } from "./server/verify-seed"

// Validate configuration eagerly (env is validated on import via loadEnv)
void env

// Register graceful shutdown handlers
registerShutdownHooks()

// Verify seed data, then start
verifySeedData(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, logger).then(() => start())
