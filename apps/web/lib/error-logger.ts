/**
 * Centralized Error Logger
 *
 * Captures errors from both frontend and backend with structured data.
 * Stores in-memory ring buffer for recent errors + optional persistence.
 *
 * Usage:
 * - Backend: errorLogger.capture({ ... })
 * - Frontend: POST /api/logs/error { ... }
 * - Query: GET /api/logs/error?category=oauth&limit=50
 */

export interface ErrorLogEntry {
  id: string
  timestamp: string
  category: string // 'oauth', 'api', 'claude', 'frontend', etc.
  source: "frontend" | "backend"
  message: string
  details?: Record<string, unknown>
  stack?: string
  userId?: string
  requestId?: string
  url?: string
  userAgent?: string
}

// Ring buffer for recent errors (in-memory, survives for server lifetime)
const MAX_ERRORS = 500
const errorBuffer: ErrorLogEntry[] = []

/**
 * Add an error to the log
 */
export function captureError(entry: Omit<ErrorLogEntry, "id" | "timestamp">): ErrorLogEntry {
  const fullEntry: ErrorLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  }

  // Add to ring buffer
  errorBuffer.push(fullEntry)
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.shift()
  }

  // Also log to console for journalctl
  console.error(`[ErrorLogger:${entry.category}]`, {
    message: entry.message,
    details: entry.details,
    userId: entry.userId,
    requestId: entry.requestId,
  })

  return fullEntry
}

/**
 * Query recent errors
 */
export function queryErrors(options?: {
  category?: string
  source?: "frontend" | "backend"
  userId?: string
  since?: Date
  limit?: number
}): ErrorLogEntry[] {
  let results = [...errorBuffer]

  if (options?.category) {
    results = results.filter(e => e.category === options.category)
  }

  if (options?.source) {
    results = results.filter(e => e.source === options.source)
  }

  if (options?.userId) {
    results = results.filter(e => e.userId === options.userId)
  }

  if (options?.since) {
    const sinceTime = options.since.getTime()
    results = results.filter(e => new Date(e.timestamp).getTime() >= sinceTime)
  }

  // Most recent first
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (options?.limit) {
    results = results.slice(0, options.limit)
  }

  return results
}

/**
 * Get error count by category (for dashboard)
 */
export function getErrorStats(): Record<string, { count: number; lastSeen: string | null }> {
  const stats: Record<string, { count: number; lastSeen: string | null }> = {}

  for (const entry of errorBuffer) {
    if (!stats[entry.category]) {
      stats[entry.category] = { count: 0, lastSeen: null }
    }
    stats[entry.category].count++
    if (!stats[entry.category].lastSeen || entry.timestamp > stats[entry.category].lastSeen!) {
      stats[entry.category].lastSeen = entry.timestamp
    }
  }

  return stats
}

/**
 * Clear all errors (for testing)
 */
export function clearErrors(): void {
  errorBuffer.length = 0
}

/**
 * Convenience logger for specific categories
 */
export const errorLogger = {
  capture: captureError,
  query: queryErrors,
  stats: getErrorStats,
  clear: clearErrors,

  // Typed convenience methods for common categories
  oauth: (message: string, details?: Record<string, unknown>, meta?: Partial<ErrorLogEntry>) =>
    captureError({ category: "oauth", source: "backend", message, details, ...meta }),

  api: (message: string, details?: Record<string, unknown>, meta?: Partial<ErrorLogEntry>) =>
    captureError({ category: "api", source: "backend", message, details, ...meta }),

  claude: (message: string, details?: Record<string, unknown>, meta?: Partial<ErrorLogEntry>) =>
    captureError({ category: "claude", source: "backend", message, details, ...meta }),

  frontend: (message: string, details?: Record<string, unknown>, meta?: Partial<ErrorLogEntry>) =>
    captureError({ category: "frontend", source: "frontend", message, details, ...meta }),
}
