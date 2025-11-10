# Streaming Implementation

## Files

- `app/api/claude/stream/route.ts`
- `features/chat/lib/streamHandler.ts`

## SSE Format

Each event:
```
event: ${type}
data: ${JSON.stringify(event)}

```

Encoded as UTF-8 bytes via `new TextEncoder().encode()`

**Response headers:**
```typescript
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',  // Disable nginx buffering
}
```

## Event Sequence

1. **start** – Initialization with host, cwd, message, messageLength, isResume
2. **message** – Repeats for each SDK message (messageCount, messageType, content)
3. **session** – Once per query (sessionId extracted from system:init)
4. **complete** – Final result (totalMessages, result)
5. **error** – If error occurs instead of complete

## Query Loop Example

```typescript
const q = query({ prompt: message, options: claudeOptions })

let messageCount = 0
let queryResult = null
let sessionSaved = false

for await (const m of q) {
  // Extract and save session ID on first system message
  if (m.type === 'system' && !sessionSaved) {
    const sessionId = extractSessionId(m)
    await sessionStore.set(conversationKey, sessionId)
    sendEvent('session', { sessionId })
    sessionSaved = true
  }

  // Send every message to client
  messageCount++
  sendEvent('message', {
    messageCount,
    messageType: m.type,
    content: m,
  })

  // Track final result
  if (m.type === 'result') {
    queryResult = m
  }
}

// Send completion
sendEvent('complete', {
  totalMessages: messageCount,
  result: queryResult,
})
```

## Session Resumption

If sessionId exists from prior query:

```typescript
const sessionId = await sessionStore.get(conversationKey)

const claudeOptions = {
  resume: sessionId,  // SDK resumes context
  // ... other options
}
```

SDK skips re-executing prior tools.

## Error Handling

```typescript
try {
  for await (const m of q) { /* ... */ }
} catch (error) {
  sendEvent('error', {
    error: error.name,
    message: error.message,
    details: error.details,
    stack: error.stack,
  })
}
```

## Non-Streaming (Deprecated)

`POST /api/claude` uses polling instead of SSE. Use streaming for real-time feedback.

## Testing SSE Stream

**Manual test:**

```bash
curl -X POST http://localhost:8999/api/claude/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_JWT" \
  -d '{
    "message": "read package.json",
    "conversationId": "test-123",
    "workspace": "test"
  }'
```

**Expected output:**
```
event: start
data: {...}

event: message
data: {...}

event: session
data: {"sessionId":"..."}

event: complete
data: {...}
```

**Verify:**
- [ ] Session event received (sessionId exists)
- [ ] Message events interleaved (not buffered)
- [ ] Complete event last
- [ ] No error event

**Common issues:**
- No session event: sessionStore not saving
- Buffered messages: check X-Accel-Buffering header
- Connection closes early: error in loop, check logs
- Messages misordered: concurrency issue, check locking

## Stream Cleanup Best Practices

### Critical Pattern: Finally Block with controller.close()

**REQUIRED**: Every ReadableStream `start()` function MUST have a `finally` block:

```typescript
return new ReadableStream({
  async start(controller) {
    try {
      // Read from source
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        controller.enqueue(value)
      }
    } catch (error) {
      controller.enqueue(errorMessage)
    } finally {
      // ✅ CRITICAL: Always runs on success, error, AND abort
      controller.close()           // Close HTTP stream to client
      onStreamComplete?.()         // Release locks, cleanup resources
    }
  }
})
```

**Why This Matters:**

Without `finally`:
- ❌ HTTP stream never closes → Client hangs on `reader.read()`
- ❌ Locks never released → Second request gets 409
- ❌ Resources leak → Memory/file descriptor exhaustion

**What Goes in Finally:**

1. **Stream Closure**: `controller.close()` - Signals client that stream is done
2. **Lock Release**: Callback to release conversation locks
3. **Resource Cleanup**: Close file handles, database connections, etc.

### Cleanup Callback Pattern

For operations that need cleanup (locks, connections, etc.), use callback pattern:

```typescript
// 1. Define callback in config interface
interface StreamConfig {
  onStreamComplete?: () => void
}

// 2. Call in finally block
export function createStream(config: StreamConfig) {
  const { onStreamComplete } = config

  return new ReadableStream({
    async start(controller) {
      try {
        // ... stream processing
      } finally {
        controller.close()
        onStreamComplete?.()  // Guaranteed to run
      }
    }
  })
}

// 3. Register cleanup when creating stream
const stream = createStream({
  onStreamComplete: () => {
    unlockConversation(key)
    closeDatabase()
  }
})
```

**Benefits:**
- Separation of concerns (stream logic vs cleanup)
- Testable (can verify callback gets called)
- Idempotent (safe to call multiple times)
- Follows existing patterns (`agent-child-runner.ts`)

### Red Flags to Watch For

**⚠️ Missing Cleanup:**
```typescript
// ❌ BAD - No finally block
try {
  while (true) {
    const { done } = await reader.read()
    if (done) break  // ← Just exits, no cleanup
  }
} catch (error) {
  // cleanup here  ← Only on error, not success
}
```

**⚠️ Cleanup Only in Error Handler:**
```typescript
// ❌ BAD - Success path leaks
try {
  doWork()
} catch (error) {
  releaseLock()  // ← Only releases on error
}
```

**✅ Correct:**
```typescript
// ✅ GOOD - Always cleans up
try {
  doWork()
} finally {
  releaseLock()  // ← Always releases
}
```

### Diagnostic Checklist

When debugging stream issues:

1. ✅ Does `start()` have `try-catch-finally`?
2. ✅ Does `finally` call `controller.close()`?
3. ✅ Are locks/resources released in `finally`?
4. ✅ Is cleanup idempotent (safe to call twice)?
5. ✅ Check Network tab: Does request show "finished" or "pending"?

**If request shows "pending" forever → Missing `controller.close()`**

## Past Issues (Resolved)

### Conversation Lock Never Released (Nov 2025)

**Status**: ✅ **RESOLVED**
**Severity**: Critical
**Symptom**: First message works, second message completely unresponsive

**Root Cause**: Missing `finally` block in `ndjsonStream` - lock only released on error/abort, never on success.

**Fix**: Added `finally { controller.close(); onStreamComplete?.() }` to guarantee cleanup.

**Full Details**: See `docs/postmortems/stream-cancellation-race-condition.md`
