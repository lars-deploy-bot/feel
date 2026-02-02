# RFC: Graceful Error Handling for Network Issues

**Status:** Draft
**RFC ID:** RFC-2026-010
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Classify errors intelligently so transient network issues don't crash services. Retry automatically where appropriate. Give users clear, non-technical error messages. Keep the system resilient.

## Problem

Currently, unhandled promise rejections can crash our services. A temporary network hiccup shouldn't bring down the whole system. Users see cryptic error messages they don't understand.

**Current behavior:** Network timeout → unhandled rejection → service crash → user sees "Something went wrong"

**Desired behavior:** Network timeout → automatic retry → if still failing, graceful degradation → user sees "Having trouble connecting, trying again..."

## Error Classification

Following OpenClaw's pattern from `unhandled-rejections.ts`:

```typescript
// Errors that should crash (unrecoverable)
const FATAL_ERROR_CODES = new Set([
  'ERR_OUT_OF_MEMORY',
  'ERR_SCRIPT_EXECUTION_TIMEOUT',
  'ERR_WORKER_OUT_OF_MEMORY',
])

// Configuration errors (user needs to fix)
const CONFIG_ERROR_CODES = new Set([
  'INVALID_CONFIG',
  'MISSING_API_KEY',
  'MISSING_CREDENTIALS',
])

// Transient network errors (retry, don't crash)
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNABORTED',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  // Undici (Node's fetch) specific
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_DNS_RESOLVE_FAILED',
  'UND_ERR_CONNECT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
])
```

## Implementation

### 1. Error Classification Utility

```typescript
// packages/shared/src/errors/classify.ts

export type ErrorCategory =
  | 'fatal'           // Should crash, unrecoverable
  | 'config'          // User needs to fix configuration
  | 'transient'       // Temporary, will likely resolve
  | 'client'          // User error (bad input)
  | 'server'          // Our bug
  | 'unknown'         // Can't classify

export function classifyError(error: unknown): ErrorCategory {
  const code = extractErrorCode(error)

  if (code && FATAL_ERROR_CODES.has(code)) {
    return 'fatal'
  }

  if (code && CONFIG_ERROR_CODES.has(code)) {
    return 'config'
  }

  if (isTransientNetworkError(error)) {
    return 'transient'
  }

  if (isClientError(error)) {
    return 'client'
  }

  if (isServerError(error)) {
    return 'server'
  }

  return 'unknown'
}

export function isTransientNetworkError(error: unknown): boolean {
  if (!error) return false

  const code = extractErrorCode(error)
  if (code && TRANSIENT_NETWORK_CODES.has(code)) {
    return true
  }

  // Check for "fetch failed" from undici
  if (error instanceof TypeError && error.message === 'fetch failed') {
    const cause = (error as any).cause
    if (cause) {
      return isTransientNetworkError(cause)
    }
    return true
  }

  // Check cause chain
  const cause = (error as any)?.cause
  if (cause && cause !== error) {
    return isTransientNetworkError(cause)
  }

  return false
}

function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  return (error as any).code
}
```

### 2. Global Unhandled Rejection Handler

```typescript
// packages/shared/src/errors/unhandled.ts

export function installUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason, _promise) => {
    const category = classifyError(reason)

    switch (category) {
      case 'fatal':
        console.error('[FATAL] Unrecoverable error:', formatError(reason))
        process.exit(1)
        break

      case 'config':
        console.error('[CONFIG] Configuration error - requires fix:', formatError(reason))
        process.exit(1)
        break

      case 'transient':
        // Log but don't crash - these resolve on their own
        console.warn('[TRANSIENT] Network issue (continuing):', formatError(reason))
        break

      case 'client':
        console.warn('[CLIENT] Client error:', formatError(reason))
        break

      default:
        // Unknown errors should probably crash in production
        console.error('[ERROR] Unhandled rejection:', formatError(reason))
        if (process.env.NODE_ENV === 'production') {
          process.exit(1)
        }
    }
  })
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message
  }
  return String(error)
}
```

### 3. Retry Utility with Classification

```typescript
// packages/shared/src/errors/retry.ts

export interface RetryOptions {
  maxAttempts?: number
  minDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
  onRetry?: (error: unknown, attempt: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  minDelayMs: 300,
  maxDelayMs: 10000,
  shouldRetry: (error) => isTransientNetworkError(error),
  onRetry: () => {},
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= opts.maxAttempts || !opts.shouldRetry(error)) {
        throw error
      }

      opts.onRetry(error, attempt)

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.minDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
        opts.maxDelayMs
      )

      await sleep(delay)
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### 4. User-Friendly Error Messages

```typescript
// packages/shared/src/errors/messages.ts

const USER_MESSAGES: Record<string, string> = {
  // Network
  'ECONNREFUSED': 'Unable to connect to the server. Please try again.',
  'ETIMEDOUT': 'The request timed out. Please try again.',
  'ENOTFOUND': 'Could not reach the server. Check your internet connection.',
  'ECONNRESET': 'Connection was interrupted. Please try again.',

  // API
  'INVALID_API_KEY': 'There\'s a problem with the API configuration.',
  'RATE_LIMITED': 'Too many requests. Please wait a moment and try again.',
  'QUOTA_EXCEEDED': 'Usage limit reached. Please upgrade or wait for reset.',

  // Auth
  'UNAUTHORIZED': 'Please log in to continue.',
  'FORBIDDEN': 'You don\'t have permission to do this.',
  'SESSION_EXPIRED': 'Your session expired. Please log in again.',

  // Validation
  'VALIDATION_ERROR': 'Please check your input and try again.',
  'FILE_TOO_LARGE': 'That file is too large. Maximum size is 10MB.',

  // Default
  'UNKNOWN': 'Something went wrong. Please try again.',
}

export function getUserMessage(error: unknown): string {
  const code = extractErrorCode(error)

  if (code && USER_MESSAGES[code]) {
    return USER_MESSAGES[code]
  }

  if (isTransientNetworkError(error)) {
    return 'Having trouble connecting. Trying again...'
  }

  return USER_MESSAGES['UNKNOWN']
}

export function getErrorDetails(error: unknown): {
  userMessage: string
  technicalMessage: string
  code?: string
  retryable: boolean
} {
  return {
    userMessage: getUserMessage(error),
    technicalMessage: error instanceof Error ? error.message : String(error),
    code: extractErrorCode(error),
    retryable: isTransientNetworkError(error),
  }
}
```

### 5. Integration with SSE Streaming

```typescript
// In Claude streaming endpoint
async function streamClaude(req, res) {
  try {
    // ... streaming logic
  } catch (error) {
    const { userMessage, retryable } = getErrorDetails(error)

    // Send error through SSE
    res.write(`event: error\n`)
    res.write(`data: ${JSON.stringify({
      message: userMessage,
      retryable,
    })}\n\n`)

    // Log appropriately
    if (!isTransientNetworkError(error)) {
      console.error('[Stream Error]', error)
    }
  }
}
```

## Frontend Error Handling

```typescript
// On the client side
async function sendMessage(message: string) {
  try {
    const response = await fetch('/api/claude/stream', { ... })
    // ... handle response
  } catch (error) {
    const details = getErrorDetails(error)

    if (details.retryable) {
      toast.info('Connection interrupted, retrying...')
      return retryAsync(() => sendMessage(message))
    }

    toast.error(details.userMessage)
  }
}
```

## Database Schema (Optional)

Track errors for monitoring:

```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,  -- 'fatal', 'transient', 'client', etc.
  code TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  user_id UUID,
  workspace_id UUID,
  endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_category ON error_logs(category);
CREATE INDEX idx_error_logs_time ON error_logs(created_at);
```

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Error classification utility | 1 day |
| Phase 2 | Global unhandled rejection handler | 0.5 day |
| Phase 3 | Retry utility with backoff | 0.5 day |
| Phase 4 | User-friendly message mapping | 1 day |
| Phase 5 | Integration with existing code | 1-2 days |
| Total | Complete error handling | ~1 week |

## Success Metrics

- Reduction in service crashes from transient errors
- Improved user experience (clearer messages)
- Automatic recovery rate for transient issues
- Time to recovery for network issues

## References

- [OpenClaw unhandled-rejections.ts](https://github.com/openclaw/openclaw)
- [OpenClaw retry.ts](https://github.com/openclaw/openclaw)
- Node.js error handling best practices
- Our existing `@webalive/shared` retry implementation
