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

// ============================================================================
// Circuit Breaker
// ============================================================================

type CircuitState = "closed" | "open" | "half-open"

interface CircuitBreakerStatus {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  openedAt: number | null
}

/** How many failures within the window trigger the circuit to open */
const FAILURE_THRESHOLD = 5
/** Time window for counting failures (ms) */
const FAILURE_WINDOW_MS = 30_000
/** How long the circuit stays open before moving to half-open (ms) */
const OPEN_DURATION_MS = 10_000

class CircuitBreaker {
  private state: CircuitState = "closed"
  private failures: number[] = []
  private openedAt: number | null = null

  getStatus(): CircuitBreakerStatus {
    this.maybeTransitionToHalfOpen()
    return {
      state: this.state,
      failureCount: this.failures.length,
      lastFailureAt: this.failures.length > 0 ? this.failures[this.failures.length - 1] : null,
      openedAt: this.openedAt,
    }
  }

  isOpen(): boolean {
    this.maybeTransitionToHalfOpen()
    return this.state === "open"
  }

  recordSuccess(): void {
    if (this.state === "half-open" || this.state === "closed") {
      this.state = "closed"
      this.failures = []
      this.openedAt = null
    }
  }

  recordFailure(): void {
    const now = Date.now()

    if (this.state === "half-open") {
      // Failed during probe — re-open
      this.state = "open"
      this.openedAt = now
      return
    }

    // Prune failures outside the window
    const cutoff = now - FAILURE_WINDOW_MS
    this.failures = this.failures.filter(t => t > cutoff)
    this.failures.push(now)

    if (this.failures.length >= FAILURE_THRESHOLD) {
      this.state = "open"
      this.openedAt = now
      console.error(
        `[Redis] Circuit breaker OPEN after ${this.failures.length} failures in ${FAILURE_WINDOW_MS / 1000}s`,
      )
    }
  }

  /** For tests only */
  _reset(): void {
    this.state = "closed"
    this.failures = []
    this.openedAt = null
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.state === "open" && this.openedAt !== null) {
      if (Date.now() - this.openedAt >= OPEN_DURATION_MS) {
        this.state = "half-open"
      }
    }
  }
}

const circuitBreaker = new CircuitBreaker()

export function getCircuitBreakerStatus(): CircuitBreakerStatus {
  return circuitBreaker.getStatus()
}

export function recordSharedSuccess(): void {
  circuitBreaker.recordSuccess()
}

export function recordSharedFailure(): void {
  circuitBreaker.recordFailure()
}

// ============================================================================
// Shared Client (lazy singleton with bounded retries + circuit breaker)
// ============================================================================

let sharedClient: Redis | null = null
let sharedClientUrl: string | null = null

/**
 * Get or create a shared Redis client with bounded retries and command timeout.
 *
 * Returns null when:
 * - redisUrl is null (standalone mode)
 * - circuit breaker is open (Redis recently failed repeatedly)
 *
 * Callers should use recordSharedSuccess() / recordSharedFailure() after
 * each Redis operation to feed the circuit breaker.
 */
export function getSharedClient(redisUrl: string | null): Redis | null {
  if (redisUrl === null) {
    return null
  }

  if (circuitBreaker.isOpen()) {
    return null
  }

  if (sharedClient && sharedClientUrl === redisUrl) {
    return sharedClient
  }

  // URL changed or first call — create new client
  if (sharedClient) {
    sharedClient.disconnect()
  }

  let authErrorCount = 0
  const MAX_AUTH_ERRORS = 3

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    commandTimeout: 5000,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (authErrorCount >= MAX_AUTH_ERRORS) {
        console.error("[Redis/Shared] FATAL: Too many auth errors. Stopping retries.")
        return null
      }
      return Math.min(times * 50, 2000)
    },
  })

  client.on("error", err => {
    const errorMessage = err?.message || String(err)
    const isAuthError = AUTH_ERROR_CODES.some(code => errorMessage.includes(code))

    if (isAuthError) {
      authErrorCount++
      console.error(`[Redis/Shared] Auth error (${authErrorCount}/${MAX_AUTH_ERRORS}):`, errorMessage)
      if (authErrorCount >= MAX_AUTH_ERRORS) {
        client.disconnect()
      }
    } else {
      console.error("[Redis/Shared] Client Error:", err)
    }
  })

  client.on("ready", () => {
    console.log("[Redis/Shared] Client Ready")
    authErrorCount = 0
  })

  sharedClient = client
  sharedClientUrl = redisUrl
  return sharedClient
}

/**
 * Reset shared client state. For tests only.
 */
export function _resetSharedClient(): void {
  if (sharedClient) {
    sharedClient.disconnect()
  }
  sharedClient = null
  sharedClientUrl = null
  circuitBreaker._reset()
}
