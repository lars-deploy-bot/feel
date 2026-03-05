import Redis from "ioredis"

/**
 * Auth-related error codes that should NOT be retried
 */
const AUTH_ERROR_CODES = ["WRONGPASS", "NOAUTH", "ERR invalid password"]

/**
 * Creates a Redis client with automatic connection and error handling.
 *
 * @param connectionUrl - Redis connection URL. Use getRedisUrl() from @webalive/env.
 *                        Pass null to explicitly indicate Redis is not available (standalone mode).
 * @returns Configured Redis client instance, or null if connectionUrl is null
 */
export const createRedisClient = (connectionUrl?: string | null): Redis | null => {
  // Explicit null means Redis is not available (standalone mode)
  if (connectionUrl === null) {
    return null
  }
  const url = connectionUrl || process.env.REDIS_URL
  if (!url) {
    throw new Error("[Redis] REDIS_URL is required. Set it in your .env file.")
  }

  let authErrorCount = 0
  const MAX_AUTH_ERRORS = 3

  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      // If we've hit too many auth errors, stop retrying
      if (authErrorCount >= MAX_AUTH_ERRORS) {
        console.error(
          `[Redis] FATAL: Authentication failed ${MAX_AUTH_ERRORS} times. ` +
            "Check REDIS_URL environment variable and Redis server password. " +
            "Stopping retry attempts.",
        )
        return null // Stop retrying
      }
      const delay = Math.min(times * 50, 2000)
      return delay
    },
  })

  client.on("error", err => {
    const errorMessage = err?.message || String(err)
    const isAuthError = AUTH_ERROR_CODES.some(code => errorMessage.includes(code))

    if (isAuthError) {
      authErrorCount++
      console.error(`[Redis] Authentication error (${authErrorCount}/${MAX_AUTH_ERRORS}):`, errorMessage)

      if (authErrorCount >= MAX_AUTH_ERRORS) {
        console.error(
          "[Redis] FATAL: Too many authentication errors. " +
            "This usually means REDIS_URL password does not match Redis server config. " +
            "Please check your environment variables.",
        )
        // Disconnect to prevent endless retry loop
        client.disconnect()
      }
    } else {
      console.error("[Redis] Client Error:", err)
    }
  })

  client.on("connect", () => {
    console.log("[Redis] Client Connected")
  })

  client.on("ready", () => {
    console.log("[Redis] Client Ready")
    // Reset auth error count on successful connection
    authErrorCount = 0
  })

  return client
}

// Export the type for reuse in apps
export type RedisClient = Redis
