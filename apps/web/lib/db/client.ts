/**
 * @deprecated Since 2025-11-16 - SQLite completely unused in production
 * All data storage migrated to Supabase PostgreSQL:
 * - Sessions: iam.sessions table (see features/auth/lib/sessionStore.ts)
 * - Users: iam.users table
 * - Organizations: iam.orgs table
 * - Domains: app.domains table
 * - Feedback: app.feedback table
 *
 * This entire lib/db/ directory can be removed once testing is complete.
 *
 * Database client for SQLite with Drizzle ORM
 * Provides singleton connection with WAL mode for better concurrency
 * Uses Bun's built-in SQLite for better compatibility
 *
 * IMPORTANT: Falls back to stubs during Next.js build (Node.js runtime)
 * Works correctly when running in Bun (production)
 */

import * as schema from "./schema"

const DATABASE_PATH = process.env.DATABASE_PATH || "/var/lib/claude-bridge/database.sqlite"

// Check if we're running in Bun
const isBunRuntime = typeof Bun !== "undefined"

// Type-safe stub creator
const createStub = (name: string): any => {
  return new Proxy(
    {},
    {
      get() {
        if (!isBunRuntime) {
          // During Next.js build, accessing db properties is expected to fail
          // This is normal and will be ignored
          return undefined
        }
        throw new Error(`[Database] ${name} accessed but database not initialized. This should not happen at runtime.`)
      },
    },
  )
}

let db: any
let rawDb: any

if (isBunRuntime) {
  try {
    // Dynamic import to avoid Next.js build errors
    const { Database } = require("bun:sqlite")
    const { drizzle } = require("drizzle-orm/bun-sqlite")

    // Create SQLite connection with optimizations
    const sqlite = new Database(DATABASE_PATH, { create: true })

    // Enable WAL mode for better concurrency
    sqlite.exec("PRAGMA journal_mode = WAL")

    // Set busy timeout to 5 seconds
    const busyTimeout = Number.parseInt(process.env.DATABASE_BUSY_TIMEOUT || "5000", 10)
    sqlite.exec(`PRAGMA busy_timeout = ${busyTimeout}`)

    // Enable foreign keys
    sqlite.exec("PRAGMA foreign_keys = ON")

    // Create Drizzle instance
    db = drizzle(sqlite, { schema })
    rawDb = sqlite

    console.log("[Database] SQLite connection initialized successfully")
  } catch (error) {
    console.error("[Database] Failed to initialize:", error)
    db = createStub("db")
    rawDb = createStub("rawDb")
  }
} else {
  // Not in Bun runtime (Next.js build in Node.js)
  console.log("[Database] Not in Bun runtime - using stub database client (build-time only)")
  db = createStub("db")
  rawDb = createStub("rawDb")
}

export { db, rawDb }

// Health check function
export function isDatabaseHealthy(): boolean {
  if (!isBunRuntime) {
    return false
  }

  try {
    const result = rawDb.query("SELECT 1").get()
    return !!result
  } catch (error) {
    console.error("[Database] Health check failed:", error)
    return false
  }
}

// Graceful shutdown
export function closeDatabase(): void {
  if (!isBunRuntime) {
    return
  }

  try {
    rawDb.close()
    console.log("[Database] Connection closed gracefully")
  } catch (error) {
    console.error("[Database] Error closing connection:", error)
  }
}

// Handle process termination
if (isBunRuntime) {
  process.on("SIGINT", closeDatabase)
  process.on("SIGTERM", closeDatabase)
}
