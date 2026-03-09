/**
 * Startup verification.
 *
 * Two levels of checks, both fail-fast on ALL environments:
 *
 * 1. Schema check — proves required tables exist and are readable.
 *    If the schema is broken, nothing works.
 *
 * 2. Server identity check — proves this server's row exists in app.servers.
 *    Without it, domain registration fails (FK constraint on domains.server_id)
 *    and automation job claiming silently returns nothing.
 *
 * Seed data beyond the server row is a deploy concern (`bun run db:seed`),
 * not a runtime concern.
 *
 * Retries with exponential backoff to survive transient Supabase blips during deploy.
 */

interface SchemaCheckResult {
  ok: boolean
  missing: string[]
}

const SCHEMA_CHECK_TIMEOUT_MS = 10_000
const SCHEMA_CHECK_RETRIES = 2
const SCHEMA_CHECK_BASE_DELAY_MS = 1_000

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      v => {
        clearTimeout(timer)
        resolve(v)
      },
      e => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verify required database tables are accessible.
 * Queries each table with LIMIT 0 — zero rows returned, but proves the table exists
 * and the client has permission to read it.
 *
 * Includes a 10s timeout per attempt and 2 retries with exponential backoff
 * to prevent crash-loops when Supabase is temporarily unreachable during deploys.
 */
export async function checkSchema(supabaseUrl: string, supabaseKey: string): Promise<SchemaCheckResult> {
  let lastError: unknown

  for (let attempt = 0; attempt <= SCHEMA_CHECK_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = SCHEMA_CHECK_BASE_DELAY_MS * 2 ** (attempt - 1)
      console.warn(`[schema-check] Retry ${attempt}/${SCHEMA_CHECK_RETRIES} after ${delay}ms...`)
      await sleep(delay)
    }

    try {
      return await withTimeout(checkSchemaOnce(supabaseUrl, supabaseKey), SCHEMA_CHECK_TIMEOUT_MS, "Schema check")
    } catch (err) {
      lastError = err
      console.warn(`[schema-check] Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err)
    }
  }

  throw lastError
}

async function checkSchemaOnce(supabaseUrl: string, supabaseKey: string): Promise<SchemaCheckResult> {
  const { createAppClient } = await import("./client")
  const app = createAppClient(supabaseUrl, supabaseKey)
  const missing: string[] = []

  const requiredTables = ["servers", "domains"] as const

  for (const table of requiredTables) {
    const { error } = await app.from(table).select("*", { count: "exact", head: true }).limit(0)
    if (error) {
      missing.push(`app.${table} (${error.code}: ${error.message})`)
    }
  }

  return { ok: missing.length === 0, missing }
}

/**
 * Format a schema check failure into a human-readable message.
 */
export function formatSchemaFailure(result: SchemaCheckResult): string {
  return [
    "Database schema verification failed — required tables not accessible:",
    ...result.missing.map(m => `  - ${m}`),
    "",
    "This means migrations haven't been applied or Supabase permissions are wrong.",
    "Fix: bun run --cwd packages/database db:migrate",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Server identity check
// ---------------------------------------------------------------------------

interface ServerCheckResult {
  ok: boolean
  error?: string
}

/**
 * Server identity fields extracted from server-config.json.
 * Passed by the caller so this module stays free of config imports.
 */
export interface ServerIdentity {
  serverId: string
  serverIp: string
  hostname: string
}

/**
 * Ensure this server's row exists in app.servers, upserting if missing.
 *
 * Previous behaviour: crash on startup if the row was missing, requiring
 * a manual `bun run db:seed`. This was fragile — a fresh Supabase instance
 * or a PostgREST cache miss would take down the service.
 *
 * Now: the app self-heals by inserting its own row (ON CONFLICT DO NOTHING).
 * The seed file remains the canonical source for all servers, but startup
 * no longer depends on it having been run first.
 *
 * Uses the same retry/timeout strategy as checkSchema.
 */
export async function ensureServerRow(
  supabaseUrl: string,
  supabaseKey: string,
  server: ServerIdentity,
): Promise<ServerCheckResult> {
  let lastError: unknown

  for (let attempt = 0; attempt <= SCHEMA_CHECK_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = SCHEMA_CHECK_BASE_DELAY_MS * 2 ** (attempt - 1)
      console.warn(`[server-check] Retry ${attempt}/${SCHEMA_CHECK_RETRIES} after ${delay}ms...`)
      await sleep(delay)
    }

    try {
      return await withTimeout(
        ensureServerRowOnce(supabaseUrl, supabaseKey, server),
        SCHEMA_CHECK_TIMEOUT_MS,
        "Server identity check",
      )
    } catch (err) {
      lastError = err
      console.warn(`[server-check] Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err)
    }
  }

  throw lastError
}

async function ensureServerRowOnce(
  supabaseUrl: string,
  supabaseKey: string,
  server: ServerIdentity,
): Promise<ServerCheckResult> {
  const { createAppClient } = await import("./client")
  const app = createAppClient(supabaseUrl, supabaseKey)

  // Try to read first (fast path — row usually exists)
  const { data, error: selectError } = await app
    .from("servers")
    .select("server_id")
    .eq("server_id", server.serverId)
    .maybeSingle()

  if (selectError) {
    return { ok: false, error: `Failed to query app.servers: ${selectError.code}: ${selectError.message}` }
  }

  if (data) {
    return { ok: true }
  }

  // Row missing — upsert it
  console.log(`[server-check] Server "${server.serverId}" not in app.servers, inserting...`)
  const { error: insertError } = await app.from("servers").upsert(
    {
      server_id: server.serverId,
      name: server.hostname,
      ip: server.serverIp,
      hostname: server.hostname,
    },
    { onConflict: "server_id", ignoreDuplicates: true },
  )

  if (insertError) {
    return { ok: false, error: `Failed to insert server row: ${insertError.code}: ${insertError.message}` }
  }

  console.log(`[server-check] Inserted server "${server.serverId}" into app.servers`)
  return { ok: true }
}

/** @deprecated Use ensureServerRow instead — it self-heals rather than just checking. */
export async function checkServerRow(
  supabaseUrl: string,
  supabaseKey: string,
  serverId: string,
): Promise<ServerCheckResult> {
  // Extract hostname/ip from serverId for backwards compat
  // Format: srv_<domain_underscored>_<ip_underscored>
  return ensureServerRow(supabaseUrl, supabaseKey, {
    serverId,
    serverIp: "",
    hostname: "",
  })
}

/**
 * Format a server check failure into a human-readable message.
 */
export function formatServerCheckFailure(result: ServerCheckResult): string {
  return [
    "Server identity verification failed:",
    `  ${result.error}`,
    "",
    "Without this row, domain registration will fail (FK constraint)",
    "and automation jobs will not be claimed by this server.",
  ].join("\n")
}
