/**
 * Environment File Loader (SIDE EFFECT MODULE)
 *
 * This module MUST be imported first in playwright.config.ts.
 * It loads the env file so other modules can read process.env.
 *
 * Usage: import "./e2e-tests/lib/load-env" // First import!
 *
 * ENV_FILE selects which environment:
 * - .env.test       → local (default)
 * - .env.staging    → staging
 * - .env.production → production
 */

import { existsSync } from "node:fs"
import dotenv from "dotenv"

const ENV_FILE = process.env.ENV_FILE || ".env.test"

if (!existsSync(ENV_FILE)) {
  throw new Error(
    `\n❌ Missing env file: ${ENV_FILE}\n   Available: .env.test (local), .env.staging, .env.production\n   Usage: ENV_FILE=.env.staging bun run test:e2e\n`,
  )
}

const result = dotenv.config({ path: ENV_FILE, override: true })

if (result.error) {
  throw new Error(`Failed to load ${ENV_FILE}: ${result.error.message}`)
}

// Verify TEST_ENV was loaded
if (!process.env.TEST_ENV) {
  throw new Error(
    `\n❌ ${ENV_FILE} is missing TEST_ENV\n   Each .env file must declare: TEST_ENV=local|staging|production\n`,
  )
}

console.log(`📁 [E2E] Loaded ${ENV_FILE} (TEST_ENV=${process.env.TEST_ENV})`)
