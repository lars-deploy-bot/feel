/**
 * Environment File Loader (SIDE EFFECT MODULE)
 *
 * This module MUST be imported first in playwright.config.ts.
 * It loads the env file so other modules can read process.env.
 *
 * Usage: import "./e2e-tests/lib/load-env" // First import!
 */

import { existsSync } from "node:fs"
import dotenv from "dotenv"

const DEFAULT_ENV_FILE = ".env.e2e.local"
const ENV_FILE = (process.env.ENV_FILE || DEFAULT_ENV_FILE).trim()

if (ENV_FILE.length === 0) {
  throw new Error("\n❌ ENV_FILE must not be empty.\n   Typical values: .env.e2e.local, .env.preview, .env.staging\n")
}

if (!existsSync(ENV_FILE)) {
  throw new Error(
    `\n❌ Missing env file: ${ENV_FILE}\n   Typical values: .env.e2e.local, .env.preview, .env.staging\n   Example: ENV_FILE=.env.e2e.local bun run test:e2e\n`,
  )
}

const result = dotenv.config({ path: ENV_FILE, override: true, quiet: true })

if (result.error) {
  throw new Error(`Failed to load ${ENV_FILE}: ${result.error.message}`)
}

// Verify TEST_ENV was loaded
if (!process.env.TEST_ENV) {
  throw new Error(
    `\n❌ ${ENV_FILE} is missing TEST_ENV\n   The file must declare one of: TEST_ENV=local|preview|staging\n`,
  )
}

console.log(`📁 [E2E] Loaded ${ENV_FILE} (TEST_ENV=${process.env.TEST_ENV})`)
