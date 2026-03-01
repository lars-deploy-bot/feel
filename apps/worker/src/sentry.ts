/**
 * Sentry initialization for the automation worker.
 *
 * Resolves release from git at startup (worker is a standalone Bun process,
 * decoupled from the web app's build-time NEXT_PUBLIC_SENTRY_RELEASE).
 */

import { execSync } from "node:child_process"
import * as Sentry from "@sentry/node"
import { SENTRY as SENTRY_CONFIG } from "@webalive/shared"

let release = "unknown"
try {
  release = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
} catch {
  // Not in a git repo or git not available — fall back to "unknown"
}

if (SENTRY_CONFIG.DSN) {
  Sentry.init({
    dsn: SENTRY_CONFIG.DSN,
    release,
    environment: process.env.STREAM_ENV ?? process.env.NODE_ENV ?? "unknown",
    serverName: "automation-worker",
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,

    beforeSend(event) {
      if (event.environment === "local") {
        return null
      }
      return event
    },
  })
}

export { Sentry }
