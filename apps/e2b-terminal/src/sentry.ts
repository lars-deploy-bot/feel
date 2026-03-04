/**
 * Sentry initialization for the E2B terminal bridge.
 *
 * Same pattern as automation-worker: resolve release from git at startup.
 */

import { execSync } from "node:child_process"
import * as Sentry from "@sentry/node"
import { SENTRY as SENTRY_CONFIG } from "@webalive/shared"

let release = "unknown"
try {
  release = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
} catch {
  // Not in a git repo or git not available
}

if (SENTRY_CONFIG.DSN) {
  Sentry.init({
    dsn: SENTRY_CONFIG.DSN,
    release,
    environment: process.env.STREAM_ENV ?? process.env.NODE_ENV ?? "unknown",
    serverName: "e2b-terminal",
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
