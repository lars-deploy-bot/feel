# Stream Cancellation Race Condition: "Still Working on Previous Request"

**Date**: November 9, 2025
**Severity**: High
**Status**: Under Investigation (RCA Complete, Solution Pending)
**Affected Component**: `/api/claude/stream` endpoint, conversation locking, child process management

## Summary

When a user clicks the "stop" button to interrupt a Claude conversation while tool calls are in progress, the stream appears to stop (client state resets) but the server-side conversation lock is released prematurely. This creates a race condition where:

1. The client can immediately send a new message
2. The new request acquires the conversation lock
3. But the **old child process is still executing** with the Claude SDK
4. User receives: `"I'm still working on your previous request. Please wait for me to finish..."`

The root cause is a **missing stream cancellation handler** that allows the child process (and SDK query) to continue running after the client abort signal fires.

## Reproduction Steps

1. Start a Claude conversation with a message that triggers tool calls
2. While Claude is executing tools (you see tool output), click the "stop" button
3. Wait 1-2 seconds (while the child process is still executing)
4. Send a new message (e.g., "ok")
5. **Expected**: New response starts
   **Actual**: Error message about conversation being busy

## Technical Deep Dive

### The Abort Signal Flow

When user clicks stop:

```
User clicks STOP button
    ↓
Client: abortController.abort() [page.tsx:611]
    ↓
Fetch request aborts
    ↓
Server req.signal fires "abort" event [route.ts:298]
    ↓
Abort listener calls unlockConversation(convKey) [route.ts:302]
    ↓
Lock is RELEASED
```

**Problem**: The lock is released but nothing cancels the child process or the reading loop.

### The Core Issue: Missing Stream Cancellation

In `/app/api/claude/stream/route.ts`, the abort listener (lines 298-308) only unlocks:

```typescript
req.signal?.addEventListener(
  "abort",
  () => {
    try {
      unlockConversation(convKey)  // ← Releases lock only
      // MISSING: Cancel childStream and reader!
    } catch (error) {
      console.error(...)
    }
  },
  { once: true },
)
```

The `ndjsonStream` (lines 369-483) is a ReadableStream with:
- A `start()` function that creates a reader from `childStream` (line 371)
- A `while (true)` loop that continuously reads data (line 375)
- **NO `cancel()` handler** that would stop the loop or kill the child process

### What Should Happen vs What Does Happen

**Expected behavior:**
1. Abort signal fires
2. `ndjsonStream.cancel()` is invoked (if implemented)
3. Reader is cancelled: `reader.cancel()`
4. `childStream.cancel()` is called (triggers agent-child-runner's cancel handler)
5. Child process receives SIGTERM
6. Child process terminates (or forced SIGKILL after 5s)
7. Lock is released
8. New request can proceed cleanly

**Actual behavior:**
1. Abort signal fires
2. Lock is released immediately
3. Reader is still pending on `reader.read()` (line 376)
4. While loop is still running (line 375)
5. Child process is still executing (spawned at line 358)
6. SDK `query()` in child is still iterating (run-agent.mjs:135)
7. New request acquires lock (because it was released)
8. New SDK instance starts before old one finishes
9. Session system detects conflict → "conversation busy" error

### Evidence from Code

**Missing cancel handler in ndjsonStream:**
```typescript
const ndjsonStream = new ReadableStream({
  async start(controller) {
    const reader = childStream.getReader()
    let buffer = ""

    try {
      while (true) {  // ← Runs forever
        const { done, value } = await reader.read()
        if (done) break
        // ... process value
      }
    } finally {
      unlockConversation(convKey)
      controller.close()
    }
  },
  // NO cancel() handler defined!
  // Should be: cancel() { reader.cancel(); childStream.cancel(); }
})
```

**Compare with agent-child-runner.ts which HAS proper cancellation (lines 134-147):**
```typescript
const stream = new ReadableStream<Uint8Array>({
  start(ctrl) {
    controller = ctrl
    // ... attach listeners
  },

  cancel() {  // ← This handler EXISTS
    console.log("[agent-child] Stream cancelled, killing child")
    cleanup()
    child.kill("SIGTERM")  // ← Sends SIGTERM to child process

    killTimeoutId = setTimeout(() => {
      if (!child.killed) {
        console.warn(`[agent-child] SIGTERM timeout, sending SIGKILL`)
        child.kill("SIGKILL")  // ← Force kill after 5s
      }
    }, 5000)
  },
})
```

The child process runner has proper cancellation, but the parent stream never calls it.

### Why This Causes the "Still Working" Error

The error comes from `features/auth/types/session.ts:22-56` (`tryLockConversation()`):

```typescript
if (activeConversations.has(conversationKey)) {
  return false  // Conversation already locked
}
```

Timeline:
1. **Request A** starts, acquires lock (time: T+0)
2. Child process spawned, SDK starts querying
3. User clicks stop at T+2 (during tool calls)
4. Abort listener fires, **releases lock** (T+2.1)
5. User sends message immediately (T+2.2)
6. **Request B** attempts lock check at T+2.3
7. Lock check passes (because A released it)
8. Request B acquires lock and starts new SDK query
9. **But Request A's child process is STILL RUNNING** (tools take time)
10. Two concurrent SDK instances in separate child processes
11. Session system detects overlap → error to user

The lock was released before the child process (and SDK query) actually finished.

### Claude SDK Context

The child process (`run-agent.mjs:135`) executes:
```typescript
for await (const message of agentQuery) {
  messageCount++
  // ... process message
  process.stdout.write(...)  // Write to parent's stdout
}
```

This async iteration **continues running** even after the parent stops reading from it. The SDK keeps executing until the `for await` loop completes naturally (when `agentQuery` returns the final `result` message).

Sending SIGTERM to the child process is the only way to interrupt this loop mid-execution.

## Lock Timing Issue

The abort listener (line 298) releases the lock BEFORE the `finally` block (line 478) runs:

```
Abort fires → listener runs → unlockConversation() [line 302]
    ↓
Meanwhile, finally block is still pending...
    ↓
finally block runs → unlockConversation() [line 479] (idempotent)
```

This creates a window where the lock is released but the stream is still being read.

**Ideal timing would be:**
1. Abort signal fires
2. Cancel the stream (stop reading, kill child)
3. Wait for stream to fully close
4. Then release lock

## What We Learned About Claude SDK

1. **SDK is running in a separate child process** - The `runAgentChild()` spawns a Node.js process (`run-agent.mjs`) that calls `query()` from the SDK
2. **SDK query is async iterable** - It yields messages as they come from the API
3. **SDK iteration continues until completion** - Even if the parent stops reading, the child process continues executing
4. **Process termination is required for interruption** - Can't just stop reading; must kill the child process via SIGTERM/SIGKILL
5. **Graceful shutdown takes time** - The child has a 5-second grace period before forced kill

## System State Snapshot

### Files Involved

| File | Lines | Role |
|------|-------|------|
| `app/api/claude/stream/route.ts` | 298-308 | Abort listener (missing cancellation) |
| `app/api/claude/stream/route.ts` | 369-483 | ReadableStream (missing cancel handler) |
| `app/api/claude/stream/route.ts` | 358-365 | Child process spawn |
| `lib/agent-child-runner.ts` | 134-147 | Stream cancel handler (correctly implemented) |
| `lib/agent-child-runner.ts` | 43-156 | Child process wrapper |
| `scripts/run-agent.mjs` | 115-170 | SDK query execution in child |
| `features/auth/types/session.ts` | 22-56 | Lock check (working as designed) |
| `app/chat/page.tsx` | 611-617 | Client stop button handler |

### Key Locations

**Abort listener:** `/root/webalive/claude-bridge/apps/web/app/api/claude/stream/route.ts:298-308`

**Missing cancel handler in ndjsonStream:** `/root/webalive/claude-bridge/apps/web/app/api/claude/stream/route.ts:369-483` (specifically missing between lines 482-483 or after line 482)

**Child process cancel implementation (reference):** `/root/webalive/claude-bridge/apps/web/lib/agent-child-runner.ts:134-147`

**Lock mechanism:** `/root/webalive/claude-bridge/apps/web/features/auth/types/session.ts:22-56`

**Client stop handler:** `/root/webalive/claude-bridge/apps/web/app/chat/page.tsx:592-618`

## Timeline of Events

```
T+0s    User sends message to Claude
        → POST /api/claude/stream
        → tryLockConversation(convKey) succeeds
        → lockAcquired = true
        → Abort listener registered (line 298)
        → childStream spawned (line 358)
        → ndjsonStream created (line 369)
        → Response sent with ndjsonStream

T+2s    Claude executing tool calls
        → Child process in middle of SDK query
        → ndjsonStream while loop reading stdout

T+2.1s  User clicks STOP button
        → abortController.abort() fires on client
        → req.signal "abort" event fires on server
        → Abort listener calls unlockConversation(convKey)
        → Lock is RELEASED

T+2.2s  User sends new message "ok"
        → Client sends new request to /api/claude/stream

T+2.3s  New request reaches server
        → tryLockConversation(convKey) at line 283
        → CHECK PASSES (lock was released at T+2.1)
        → lockAcquired = true (for new request)
        → New child process spawned
        → New SDK query starts

T+2.5s  OLD child process still executing
        → Still writing tool results to stdout
        → (Would continue until T+4s or so)

T+3s    Server detects session conflict
        → Session system sees two active SDK instances
        → Error response sent to user
        → "I'm still working on your previous request..."
```

## Impact Assessment

| Aspect | Impact | Severity |
|--------|--------|----------|
| **UX** | User can't interrupt long operations; gets confusing error | High |
| **Reliability** | Concurrent SDK instances can corrupt session state | High |
| **Resource** | Orphaned child processes consume memory/CPU | Medium |
| **Debugging** | Race condition is timing-dependent, hard to reproduce | High |

## Prevention / Mitigation (Current)

- **5-minute lock timeout** - Auto-unlocks stale locks (line 13, session.ts)
- **Periodic cleanup** - `cleanupStaleLocks()` runs every 60s (lines 95-114, session.ts)
- **Prevents complete deadlock** but doesn't fix the race condition

## Related Code Patterns

### How Abort Should Work (Missing from ndjsonStream)

Reference implementation from `agent-child-runner.ts`:

```typescript
const stream = new ReadableStream<Uint8Array>({
  start(ctrl) {
    controller = ctrl
    child.stdout.on("data", dataHandler)
    child.on("exit", exitHandler)
  },

  cancel() {
    console.log("[agent-child] Stream cancelled, killing child")
    cleanup()
    child.kill("SIGTERM")
    killTimeoutId = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL")
      }
    }, 5000)
  },
})
```

### Proper Lock Release Pattern (Currently Missing)

Lock should not be released until stream is fully cancelled:

```typescript
// WRONG (current):
req.signal?.addEventListener("abort", () => {
  unlockConversation(convKey)  // Released immediately
})

// RIGHT (should be):
// Wait for stream cancellation before releasing lock
ndjsonStream.cancel()
  .then(() => unlockConversation(convKey))
```

## Test Case for Verification

```bash
# 1. Start conversation with tool calls
curl -X POST http://localhost:8999/api/claude/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: session=JWT" \
  -d '{
    "message": "read package.json",
    "conversationId": "test-123"
  }'

# 2. While stream is active, in another terminal:
# Send abort via early close (simulates stop button)
sleep 2 && curl -X POST http://localhost:8999/api/claude/stream \
  -H "Content-Type: application/json" \
  -H "Cookie: session=JWT" \
  -d '{
    "message": "ok",
    "conversationId": "test-123"
  }'

# EXPECTED: Second request completes successfully
# ACTUAL: Error about conversation being busy
```

## Next Steps

1. **Implement ndjsonStream.cancel() handler** - Call `reader.cancel()` and `childStream.cancel()`
2. **Verify child process termination** - Ensure SIGTERM/SIGKILL are sent and received
3. **Test abort signal propagation** - Trace signal through: client → HTTP abort → req.signal → stream.cancel() → child.kill()
4. **Validate lock timing** - Ensure lock not released until stream fully closed
5. **Add integration test** - Test stop button with concurrent requests
6. **Monitor for orphaned processes** - Check that child processes exit cleanly

## References

- **Session Management Guide**: `docs/sessions/session-management.md`
- **Stream Implementation Guide**: `docs/streaming/stream-implementation.md`
- **Child Process Runner**: `/root/webalive/claude-bridge/apps/web/lib/agent-child-runner.ts`
- **SDK Query Loop**: `/root/webalive/claude-bridge/apps/web/scripts/run-agent.mjs:115-170`
- **Lock Mechanism**: `/root/webalive/claude-bridge/apps/web/features/auth/types/session.ts:22-56`
