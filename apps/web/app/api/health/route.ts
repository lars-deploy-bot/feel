/**
 * Health Check Endpoint
 *
 * Two-tier health check: public (shallow) and authenticated (deep).
 *
 * GET /api/health
 *
 * Public response (unauthenticated):
 *   { status, timestamp, responseTimeMs }
 *
 * Deep response (superadmin session or X-Internal-Secret header):
 *   { status, build, services, system, timestamp, responseTimeMs }
 */

import * as Sentry from "@sentry/nextjs"
import { env, getRedisUrl } from "@webalive/env/server"
import { createRedisClient } from "@webalive/redis"
import { getSessionUser } from "@/features/auth/lib/auth"
import { timingSafeCompare } from "@/lib/auth/timing-safe"
import { getBuildInfo } from "@/lib/build-info"
import { getSupabaseCredentials } from "@/lib/env/server"

const buildInfo = getBuildInfo()

// Types
type ServiceStatus = "connected" | "disconnected" | "error"
type OverallStatus = "healthy" | "degraded" | "unhealthy"

interface ServiceHealth {
  status: ServiceStatus
  responseTimeMs: number
  error?: string
  details?: Record<string, unknown>
}

interface PublicHealthResponse {
  status: OverallStatus
  timestamp: string
  responseTimeMs: number
}

interface DeepHealthResponse extends PublicHealthResponse {
  build: {
    commit: string
    time: string
  }
  services: {
    redis: ServiceHealth
    database: ServiceHealth
  }
  system: {
    uptime: number
    memory: {
      used: number
      total: number
      percentUsed: number
    }
    nodeVersion: string
  }
}

type HealthResponse = PublicHealthResponse | DeepHealthResponse

/**
 * Check if the caller is authorized for the deep health response.
 * Superadmin session or valid X-Internal-Secret header.
 */
async function isAuthorizedForDeepHealth(req: Request): Promise<boolean> {
  // Check X-Internal-Secret header first (cheaper, no DB/cookie parsing)
  const secret = req.headers.get("X-Internal-Secret")
  const expectedSecret = process.env.JWT_SECRET
  if (secret && expectedSecret && timingSafeCompare(secret, expectedSecret)) {
    return true
  }

  // Check superadmin session
  try {
    const user = await getSessionUser()
    if (user?.isSuperadmin) {
      return true
    }
  } catch (_err) {
    // Auth failure = not authorized for deep health, but endpoint still works
  }

  return false
}

// Singleton Redis client for health checks (reuse connection)
// In standalone mode, this will be null (Redis not available)
let healthCheckRedis: ReturnType<typeof createRedisClient> | null = null
let healthCheckRedisInitialized = false

function getHealthCheckRedis() {
  if (!healthCheckRedisInitialized) {
    healthCheckRedis = createRedisClient(getRedisUrl())
    healthCheckRedisInitialized = true
  }
  return healthCheckRedis
}

// For testing: reset singleton
export function _resetHealthCheckRedis() {
  healthCheckRedis = null
  healthCheckRedisInitialized = false
}

/**
 * Check Redis connectivity
 * In standalone mode, Redis is not available and returns "skipped" status
 */
async function checkRedis(): Promise<ServiceHealth> {
  const start = performance.now()
  try {
    const redis = getHealthCheckRedis()

    // Redis absent: expected in standalone mode, misconfiguration otherwise
    if (!redis) {
      const isStandalone = env.STREAM_ENV === "standalone"
      return {
        status: isStandalone ? "connected" : "disconnected",
        responseTimeMs: Math.round(performance.now() - start),
        details: {
          mode: isStandalone ? "standalone" : "missing",
          message: isStandalone
            ? "Redis not available in standalone mode"
            : "Redis client unavailable - check REDIS_URL configuration",
        },
      }
    }

    const result = await redis.ping()
    const responseTimeMs = Math.round(performance.now() - start)

    if (result === "PONG") {
      return {
        status: "connected",
        responseTimeMs,
        details: {
          state: redis.status,
        },
      }
    }

    return {
      status: "error",
      responseTimeMs,
      error: `Unexpected ping response: ${result}`,
    }
  } catch (error) {
    Sentry.captureException(error)
    const responseTimeMs = Math.round(performance.now() - start)
    return {
      status: "disconnected",
      responseTimeMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check Supabase/PostgreSQL connectivity
 * Queries iam.users table to verify database connection.
 * In standalone mode, database is not available and returns "skipped" status.
 */
async function checkDatabase(): Promise<ServiceHealth> {
  // Standalone mode - no database available
  if (env.STREAM_ENV === "standalone") {
    return {
      status: "connected", // Report as "connected" since it's expected in standalone
      responseTimeMs: 0,
      details: {
        mode: "standalone",
        message: "Database not available in standalone mode",
      },
    }
  }

  const start = performance.now()
  try {
    const { url, key } = getSupabaseCredentials("service")

    // Query iam.users via PostgREST with schema header
    // Supabase requires the schema to be exposed in API settings,
    // or we use the Accept-Profile header for custom schemas
    const response = await fetch(`${url}/rest/v1/users?select=user_id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Accept-Profile": "iam", // Request from iam schema
      },
    })
    const responseTimeMs = Math.round(performance.now() - start)

    if (response.ok) {
      return {
        status: "connected",
        responseTimeMs,
        details: { schema: "iam", table: "users" },
      }
    }

    // Parse error response
    const errorBody = await response.text()
    let errorMsg = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(errorBody)
      errorMsg = parsed.message || parsed.error || parsed.hint || errorMsg
    } catch (_err) {
      // Expected: error body may not be valid JSON
      if (errorBody) errorMsg = errorBody.slice(0, 200)
    }

    return {
      status: "error",
      responseTimeMs,
      error: errorMsg,
    }
  } catch (error) {
    Sentry.captureException(error)
    const responseTimeMs = Math.round(performance.now() - start)
    return {
      status: "disconnected",
      responseTimeMs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get system information
 */
function getSystemInfo() {
  const memUsage = process.memoryUsage()
  const totalMem = memUsage.heapTotal
  const usedMem = memUsage.heapUsed

  return {
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(usedMem / 1024 / 1024), // MB
      total: Math.round(totalMem / 1024 / 1024), // MB
      percentUsed: Math.round((usedMem / totalMem) * 100),
    },
    nodeVersion: process.version,
  }
}

/**
 * Determine overall health status
 */
function determineOverallStatus(redis: ServiceHealth, database: ServiceHealth): OverallStatus {
  const allConnected = redis.status === "connected" && database.status === "connected"
  const anyDisconnected = redis.status === "disconnected" || database.status === "disconnected"

  if (allConnected) return "healthy"
  if (anyDisconnected) return "unhealthy"
  return "degraded"
}

export async function GET(req: Request) {
  const start = performance.now()

  // Check all services in parallel
  const [redis, database] = await Promise.all([checkRedis(), checkDatabase()])

  const responseTimeMs = Math.round(performance.now() - start)
  const status = determineOverallStatus(redis, database)
  const httpStatus = status === "unhealthy" ? 503 : 200

  const isDeep = await isAuthorizedForDeepHealth(req)

  const response: HealthResponse = isDeep
    ? {
        status,
        build: { commit: buildInfo.commit, time: buildInfo.buildTime },
        services: { redis, database },
        system: getSystemInfo(),
        timestamp: new Date().toISOString(),
        responseTimeMs,
      }
    : {
        status,
        timestamp: new Date().toISOString(),
        responseTimeMs,
      }

  return Response.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
