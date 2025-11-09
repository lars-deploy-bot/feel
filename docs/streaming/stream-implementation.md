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

## Known Issues

### Stream Cancellation Race Condition

**Status**: Under Investigation (RCA Complete)
**Severity**: High
**Symptom**: User clicks "stop" button, but sending another message immediately results in "I'm still working on your previous request" error

**Root Cause**: When the client abort signal fires, the conversation lock is released but the child process (running the SDK query) continues executing. This creates a race condition where a new request can acquire the lock before the old child process finishes.

**Technical Details**:
- The abort listener (line 298-308 in `route.ts`) only releases the lock, it doesn't cancel the `ndjsonStream` or the child process
- The `ndjsonStream` has no `cancel()` handler to stop reading and kill the child
- The child process continues executing the SDK `query()` method even after the parent stops reading
- Process termination (SIGTERM) is required to interrupt the SDK mid-execution

**Impact**:
- Users can't reliably interrupt long operations
- Creating a new request while old child is still running causes session conflicts
- Orphaned child processes consume resources until they exit naturally (2-10+ seconds)

**Mitigation** (Current):
- 5-minute lock timeout prevents indefinite deadlock
- Periodic cleanup removes stale locks every 60 seconds
- Graceful shutdown (SIGTERM) with 5-second timeout before forced kill (SIGKILL)

**For Implementation**: See `docs/postmortems/stream-cancellation-race-condition.md` (full RCA) and `docs/postmortems/sdk-investigation-findings.md` (SDK behavior details)

**Files Affected**:
- `app/api/claude/stream/route.ts` - Missing stream cancel handler (lines 369-483)
- `lib/agent-child-runner.ts` - Has correct cancel implementation (reference, lines 134-147)
- `app/chat/page.tsx` - Client stop button handler
