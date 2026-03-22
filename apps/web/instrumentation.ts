/**
 * Next.js Instrumentation
 *
 * This file is loaded when the Next.js server starts.
 * Used to initialize Sentry and validate environment at startup.
 *
 * NOTE: CronService (automation scheduling) has moved to apps/worker,
 * a standalone Bun process managed by systemd. See CLAUDE.md for details.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry server-side
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  // Only run background services on nodejs runtime, not during build
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing server-side services...")

    // Validate critical environment variables at startup
    try {
      const { getSuperadminEmails, getRedisUrl } = await import("@webalive/env/server")
      const { startOAuthRefreshHeartbeat } = await import("./lib/anthropic-oauth")
      const { assertWorkspaceRuntimeContract } = await import("./lib/workspace-runtime-contract")

      // These will throw if not configured correctly in production/staging
      assertWorkspaceRuntimeContract()
      const superadmins = getSuperadminEmails()
      const _redisUrl = getRedisUrl()
      startOAuthRefreshHeartbeat()

      console.log(`[Instrumentation] Environment validated: ${superadmins.length} superadmin(s) configured`)
    } catch (error) {
      console.error("[Instrumentation] CRITICAL: Environment validation failed:", error)
      // In production, this is fatal - the app won't function correctly
      if (process.env.NODE_ENV === "production") {
        process.exit(1)
      }
    }

    // Verify database schema and server identity at startup
    try {
      const Sentry = await import("@sentry/nextjs")
      const db = await import("@webalive/database")
      const { getSupabaseCredentials } = await import("@/lib/env/server")
      const { getServerId } = await import("@webalive/shared")

      const { url, key } = getSupabaseCredentials("service")

      // 1. Schema: tables exist and are readable
      const schemaResult = await db.checkSchema(url, key)
      if (!schemaResult.ok) {
        const msg = db.formatSchemaFailure(schemaResult)
        console.error(`[Instrumentation] FATAL: ${msg}`)
        Sentry.captureMessage(msg, "fatal")
        await Sentry.flush(2000)
        process.exit(1)
      }

      // 2. Server identity: ensure this server's row exists in app.servers (upserts if missing)
      const serverId = getServerId()
      if (serverId) {
        const { DEFAULTS, DOMAINS } = await import("@webalive/shared")
        const serverResult = await db.ensureServerRow(url, key, {
          serverId,
          serverIp: DEFAULTS.SERVER_IP,
          hostname: DOMAINS.MAIN,
        })
        if (!serverResult.ok) {
          const msg = db.formatServerCheckFailure(serverResult)
          console.error(`[Instrumentation] FATAL: ${msg}`)
          Sentry.captureMessage(msg, "fatal")
          await Sentry.flush(2000)
          process.exit(1)
        }
      }
    } catch (error) {
      console.error("[Instrumentation] FATAL: Startup verification failed:", error)
      const Sentry = await import("@sentry/nextjs")
      Sentry.captureException(error)
      await Sentry.flush(2000)
      process.exit(1)
    }

    // Non-fatal: verify caddy-shell is reachable (terminal/watch WebSockets depend on it)
    try {
      const { SHELL } = await import("@webalive/shared")
      if (SHELL.LISTEN) {
        const net = await import("node:net")
        const port = Number.parseInt(SHELL.LISTEN.replace(/^.*:/, ""), 10)
        if (port) {
          await new Promise<void>((resolve, reject) => {
            const socket = net.createConnection({ host: "127.0.0.1", port, timeout: 2000 })
            socket.once("connect", () => {
              socket.destroy()
              resolve()
            })
            socket.once("timeout", () => {
              socket.destroy()
              reject(new Error("timeout"))
            })
            socket.once("error", err => {
              reject(err)
            })
          })
        }
      }
    } catch (err) {
      const Sentry = await import("@sentry/nextjs")
      Sentry.captureMessage(`caddy-shell is not reachable — terminal and file watch WebSockets will fail`, "warning")
    }

    console.log("[Instrumentation] Server-side services initialized")
  }
}

// Sentry captures server errors via its Next.js integration automatically
// (no need for onRequestError export — the SDK hooks into Next.js internally)
