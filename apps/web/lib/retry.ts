/**
 * Retry utility with exponential backoff
 */

export interface RetryConfig {
  maxRetries: number
  initialDelay: number // ms
  maxDelay: number // ms
  backoffMultiplier: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * config.backoffMultiplier ** attempt
  const clampedDelay = Math.min(exponentialDelay, config.maxDelay)
  // Add jitter (±20%) to prevent thundering herd
  const jitter = clampedDelay * 0.2 * (Math.random() * 2 - 1)
  return Math.max(0, clampedDelay + jitter)
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(operation: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  let lastError: unknown

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt < finalConfig.maxRetries) {
        // Custom retry logic if provided
        if (finalConfig.shouldRetry && !finalConfig.shouldRetry(error, attempt)) {
          throw error
        }

        // Don't retry AbortErrors (user cancelled)
        if (error instanceof Error && error.name === "AbortError") {
          throw error
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt, finalConfig)
        console.log(
          `[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries} failed, retrying in ${Math.round(delay)}ms...`,
        )
        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  throw lastError
}

/**
 * Check if an error is retryable (network errors, 5xx, timeouts)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check if it's an HttpError with status field (custom error class)
    if ("status" in error && typeof error.status === "number") {
      const status = error.status
      // Retry server errors (5xx) and rate limits (429), but not client errors (4xx)
      return status >= 500 || status === 429
    }

    // Network errors (e.g., fetch failed, connection refused)
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return true
    }

    // Timeout errors
    if (error.message.includes("timeout")) {
      return true
    }
  }

  return false
}
