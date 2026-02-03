# Stream Cancellation Architecture

Complete flow of message cancellation from user click to cleanup.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CANCELLATION FLOW OVERVIEW                              │
└─────────────────────────────────────────────────────────────────────────────────┘

  User clicks Stop    Frontend            Cancel API         Stream Route       Child Process
  ───────────────     ────────            ──────────         ────────────       ─────────────
        │                 │                    │                   │                   │
        │  onClick        │                    │                   │                   │
        │────────────────▶│                    │                   │                   │
        │                 │                    │                   │                   │
        │                 │  POST /cancel      │                   │                   │
        │                 │───────────────────▶│                   │                   │
        │                 │                    │                   │                   │
        │                 │                    │  cancelStream()   │                   │
        │                 │                    │──────────────────▶│                   │
        │                 │                    │                   │                   │
        │                 │                    │                   │  reader.cancel()  │
        │                 │                    │                   │──────────────────▶│
        │                 │                    │                   │                   │
        │                 │                    │                   │◀──────────────────│
        │                 │                    │                   │  stream ends      │
        │                 │                    │◀──────────────────│                   │
        │                 │                    │  { ok: true }     │                   │
        │                 │◀───────────────────│                   │                   │
        │                 │                    │                   │                   │
        │                 │  abort()           │                   │                   │
        │                 │  (safety net)      │                   │                   │
        │                 │                    │                   │                   │
        │                 │  Clean exit        │                   │                   │
        │◀────────────────│  (no error)        │                   │                   │
```

---

## Detailed Component Flow

### 1. Frontend: User Clicks Stop Button

**File:** `apps/web/features/chat/components/ChatInput/SendButton.tsx`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      STOP BUTTON (SendButton.tsx)                            │
└──────────────────────────────────────────────────────────────────────────────┘

  Render Logic (line 9-19):
  ─────────────────────────

  if (busy && abortControllerRef.current) {
    return (
      <button onClick={onStop}>     ◀─── Calls stopStreaming()
        <Square />                        from chat/page.tsx
      </button>
    )
  }
```

### 2. Frontend: stopStreaming() Function

**File:** `apps/web/app/chat/page.tsx` (lines 834-908)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    stopStreaming() - Full Flow                               │
└──────────────────────────────────────────────────────────────────────────────┘

  function stopStreaming() {
    │
    │ ① Double-click guard (prevents race condition)
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ if (isStopping.current) {                                   │
  │   console.log("Already stopping, ignoring")                 │
  │   return  ◀─── Exit early on rapid double-clicks            │
  │ }                                                           │
  │ isStopping.current = true                                   │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ② Log to dev terminal (dev mode only)
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ if (isDevelopment()) {                                       │
  │   addDevEvent({                                              │
  │     eventName: ClientRequest.INTERRUPT,                      │
  │     event: { message: "Response interrupted by user", ... }  │
  │   })                                                         │
  │ }                                                            │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ③ Fire-and-forget cancel endpoint (NON-BLOCKING)
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ // Capture requestId before clearing it                     │
  │ const requestIdToCancel = currentRequestIdRef.current       │
  │                                                             │
  │ if (requestIdToCancel) {                                    │
  │   void fetch("/cancel", { requestId })  ◀─── No await!      │
  │     .catch(e => console.error("Cancel failed"))             │
  │ } else {                                                    │
  │   void fetch("/cancel", { conversationId, workspace })      │
  │     .catch(e => console.error("Cancel failed"))             │
  │ }                                                           │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ④ Immediately abort + clear refs (don't wait for cancel)
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ if (abortControllerRef.current) {                           │
  │   abortControllerRef.current.abort()  ◀─── Sets signal.aborted = true
  │   abortControllerRef.current = null                          │
  │ }                                                            │
  │ currentRequestIdRef.current = null                          │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ⑤ Add completion marker (stops thinking animation)
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ const interruptMessage: UIMessage = {                       │
  │   id: Date.now().toString(),                                │
  │   type: "complete",        ◀─── Marks ThinkingGroup as complete
  │   content: {},                                               │
  │   timestamp: new Date(),                                     │
  │ }                                                            │
  │ addMessage(interruptMessage)                                │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ⑥ Reset UI state
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ setBusy(false)                                              │
  │ setShowCompletionDots(true)                                 │
  │ isSubmitting.current = false                                │
  │ isStopping.current = false  ◀─── Ready for next stop        │
  └─────────────────────────────────────────────────────────────┘
```

### 3. Backend: Cancel Endpoint

**File:** `apps/web/app/api/claude/stream/cancel/route.ts`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              POST /api/claude/stream/cancel                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  Request Body:
  ─────────────
  PRIMARY:   { requestId: "req-abc-123" }
  FALLBACK:  { conversationId: "conv-xyz", workspace: "example.com" }

  ┌─────────────────────────────────────────────────────────────┐
  │ async function POST(req: NextRequest) {                     │
  │   │                                                         │
  │   │ ① Authenticate user                                     │
  │   ▼                                                         │
  │   const user = await requireSessionUser()                   │
  │   │                                                         │
  │   │ ② Parse request                                         │
  │   ▼                                                         │
  │   const { requestId, conversationId } = await req.json()    │
  │   │                                                         │
  │   ├─── requestId provided? ───────────────────────────────┐ │
  │   │    YES                                                 │ │
  │   ▼                                                        │ │
  │   cancelStream(requestId, user.id)  ◀─── Primary path      │ │
  │   │                                                        │ │
  │   ├─── OR conversationId provided? ───────────────────────┤ │
  │   │    YES                                                 │ │
  │   ▼                                                        │ │
  │   // Build conversationKey: userId::workspace::convId      │ │
  │   const convKey = sessionKey({ userId, workspace, convId })│ │
  │   cancelStreamByConversationKey(convKey, user.id)          │ │
  │   │                                                        │ │
  │   ├─────────────────────────────────────────────────────────┘ │
  │   ▼                                                         │
  │   return { ok: true, status: "cancelled" | "already_complete" }
  │ }                                                           │
  └─────────────────────────────────────────────────────────────┘

  Security:
  ─────────
  • User must be authenticated (session cookie)
  • User can only cancel their OWN streams (userId check)
  • Workspace access verified for fallback path
```

### 4. Backend: Cancellation Registry

**File:** `apps/web/lib/stream/cancellation-registry.ts`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CANCELLATION REGISTRY (In-Memory)                         │
└──────────────────────────────────────────────────────────────────────────────┘

  Data Structure:
  ───────────────
  Map<requestId, CancelEntry>

  interface CancelEntry {
    cancel: () => void       // Callback to stop the stream
    userId: string           // Owner (for authorization)
    conversationKey: string  // For fallback lookup
    createdAt: number        // For TTL cleanup
  }

  ┌─────────────────────────────────────────────────────────────┐
  │ LIFECYCLE                                                   │
  │                                                             │
  │ 1. REGISTER (stream starts)                                 │
  │    registerCancellation(requestId, userId, convKey, cancel) │
  │    └── Stores cancel callback before stream begins          │
  │                                                             │
  │ 2. CANCEL (user stops)                                      │
  │    cancelStream(requestId, userId)                          │
  │    └── Calls entry.cancel(), then registry.delete(id)       │
  │                                                             │
  │    cancelStreamByConversationKey(convKey, userId)           │
  │    └── Iterates registry to find matching convKey           │
  │                                                             │
  │ 3. UNREGISTER (stream completes normally)                   │
  │    unregisterCancellation(requestId)                        │
  │    └── Simply deletes from registry                         │
  │                                                             │
  │ 4. TTL CLEANUP (safety net for orphaned entries)            │
  │    Every 5 minutes, removes entries older than 10 minutes   │
  └─────────────────────────────────────────────────────────────┘
```

### 5. Backend: Stream Route Registration

**File:** `apps/web/app/api/claude/stream/route.ts` (lines 326-367)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                STREAM ROUTE - Cancellation Setup                             │
└──────────────────────────────────────────────────────────────────────────────┘

  // Shared cancellation state (passed to stream handler)
  const cancelState: CancelState = {
    requested: false,    // Set to true when cancel called
    reader: null,        // Stream reader reference
  }

  // Register BEFORE starting stream (handles early cancellation)
  registerCancellation(requestId, user.id, convKey, () => {
    cancelState.requested = true    ◀─── Signals stream to stop
    cancelState.reader?.cancel()    ◀─── Interrupts blocked read
  })

  // Start child process with Claude SDK
  const childStream = runAgentChild(cwd, { message, model, ... })

  // Create NDJSON stream handler
  const ndjsonStream = createNDJSONStream({
    childStream,
    cancelState,           ◀─── Shared reference
    onStreamComplete: () => {
      unregisterCancellation(requestId)  ◀─── Cleanup on completion
      unlockConversation(convKey)
    },
  })

  // Return response with X-Request-Id header
  return new Response(ndjsonStream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "X-Request-Id": requestId,   ◀─── Client stores for cancel call
    },
  })
```

### 6. Frontend: Stream Reader Abort Handling

**File:** `apps/web/app/chat/page.tsx` (lines 597-635)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│             READER CATCH BLOCK - Clean Abort Handling                        │
└──────────────────────────────────────────────────────────────────────────────┘

  } catch (readerError) {
    │
    │ ① Check if user-initiated abort
    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ if (abortController.signal.aborted) {                       │
  │   console.log("[Chat] Stream aborted by user")              │
  │   if (conversationId) {                                     │
  │     streamingActions.endStream(conversationId)              │
  │   }                                                         │
  │   return  ◀─── CLEAN EXIT, NO ERROR SHOWN                   │
  │ }                                                           │
  └─────────────────────────────────────────────────────────────┘
    │
    │ ② Not user abort → real error, handle normally
    ▼
    // Record error, throw if no messages received
  }

  // After try-catch: also check abort before throwing
  if (!receivedAnyMessage && !abortController.signal.aborted) {
    throw new Error("Server closed connection...")  ◀─── Only for real errors
  }
```

---

## Timing Scenarios

### Scenario 1: Normal Cancellation (Most Common)

```
Timeline:
─────────
  0ms    User sends message
  50ms   Server responds with X-Request-Id header
  100ms  Client stores requestId in currentRequestIdRef
  500ms  User clicks Stop
         │
         ├── stopStreaming() called
         ├── POST /cancel with { requestId }
         ├── Registry finds entry, calls cancel callback
         ├── cancelState.requested = true
         ├── reader.cancel() interrupts stream
         ├── Client abort() called (safety net)
         ├── Reader throws → caught → signal.aborted = true → return
         └── Clean exit, no error shown
```

### Scenario 2: Super-Early Stop (Before X-Request-Id Received)

```
Timeline:
─────────
  0ms    User sends message
  30ms   User clicks Stop (before header arrives!)
         │
         ├── stopStreaming() called
         ├── currentRequestIdRef.current is null
         ├── POST /cancel with { conversationId, workspace }
         ├── Server builds convKey, searches registry
         ├── Registry finds entry by convKey, calls cancel
         ├── ... rest same as normal cancellation
         └── Clean exit, no error shown
```

### Scenario 3: Already Complete When Cancel Called

```
Timeline:
─────────
  0ms    User sends message
  2000ms Stream completes naturally
         onStreamComplete() → unregisterCancellation()
  2100ms User clicks Stop (too late)
         │
         ├── stopStreaming() called
         ├── POST /cancel with { requestId }
         ├── Registry lookup returns false (not found)
         ├── Response: { ok: true, status: "already_complete" }
         └── No error, stream already done
```

---

## Request ID Propagation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    REQUEST ID FLOW                                           │
└──────────────────────────────────────────────────────────────────────────────┘

  Server (route.ts)                             Client (page.tsx)
  ─────────────────                             ─────────────────
        │                                              │
        │  Generate requestId                          │
        │  const requestId = generateRequestId()       │
        │                                              │
        │  Register in cancellation registry           │
        │  registerCancellation(requestId, ...)        │
        │                                              │
        │  Return in response header                   │
        │ ─────────────────────────────────────────────▶
        │  headers: { "X-Request-Id": requestId }      │
        │                                              │
        │                                              │  Read from header
        │                                              │  const headerRequestId =
        │                                              │    response.headers.get("X-Request-Id")
        │                                              │
        │                                              │  Store for later cancellation
        │                                              │  currentRequestIdRef.current = headerRequestId
        │                                              │
        │                                              │  Use in cancel call
        │ ◀─────────────────────────────────────────────
        │  POST /cancel { requestId }                  │
```

---

## Error vs Cancellation: Display Behavior

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    WHAT THE USER SEES                                        │
└──────────────────────────────────────────────────────────────────────────────┘

  USER CANCELLATION (signal.aborted = true):
  ──────────────────────────────────────────
  ┌────────────────────────────────────────┐
  │ [Message content so far...]            │
  │                                        │
  │ • • •                                  │  ← ThreeDotsComplete
  └────────────────────────────────────────┘

  No error message. Clean completion dots.


  REAL ERROR (signal.aborted = false):
  ────────────────────────────────────
  ┌────────────────────────────────────────┐
  │ ⚠ Error                                │
  │                                        │
  │ Server closed the connection           │
  │ unexpectedly. Please try again.        │
  │                                        │
  │ This can happen due to network issues  │
  │ or server maintenance.                 │
  └────────────────────────────────────────┘

  Red error box with helpful message.
```

---

## Key Files Reference

| Component | File | Key Lines |
|-----------|------|-----------|
| Stop Button | `features/chat/components/ChatInput/SendButton.tsx` | 9-19 |
| stopStreaming() | `app/chat/page.tsx` | 824-893 |
| Reader abort check | `app/chat/page.tsx` | 597-635 |
| Cancel endpoint | `app/api/claude/stream/cancel/route.ts` | 29-113 |
| Cancellation registry | `lib/stream/cancellation-registry.ts` | 1-146 |
| Stream route setup | `app/api/claude/stream/route.ts` | 326-367 |

---

## Why This Architecture?

### Problem: Proxy Layers Break req.signal

```
User ──▶ Cloudflare ──▶ Caddy ──▶ Next.js ──▶ Stream Route
                │
                └── Connection termination doesn't propagate!
                    req.signal.addEventListener("abort") doesn't fire
```

### Solution: Explicit HTTP Cancellation

```
1. Separate /cancel endpoint (POST request, not connection-based)
2. In-memory registry maps requestId → cancel callback
3. Cancel callback sets flag + interrupts reader
4. Stream checks flag and exits cleanly
```

### Why Both Paths (requestId + conversationKey)?

- **Primary (requestId):** Most reliable, exact match
- **Fallback (conversationKey):** Handles race condition when user clicks Stop
  before X-Request-Id header arrives (super-early Stop, < 100ms)

---

## Race Conditions & Fixes

### Fixed: Double-Click on Stop Button

```
PROBLEM:
─────────
  User clicks Stop twice rapidly
    │
    ├── First click: sends cancel request, resets state
    ├── Second click: sends ANOTHER cancel request, adds DUPLICATE completion message
    └── Result: Multiple API calls, duplicate messages in chat

SOLUTION:
─────────
  isStopping ref guards against re-entry

  function stopStreaming() {
    if (isStopping.current) return  // ◀─── Exit early
    isStopping.current = true

    // ... do work ...

    isStopping.current = false      // ◀─── Reset for next request
  }
```

### Fixed: Slow Cancel Endpoint Blocks UI

```
PROBLEM:
─────────
  await fetch("/cancel", ...)  // Network round-trip: 100-500ms
  setBusy(false)               // UI finally updates

  User waits unnecessarily for server response

SOLUTION:
─────────
  Fire-and-forget pattern:

  void fetch("/cancel", ...).catch(...)  // Non-blocking
  abortControllerRef.current.abort()     // Immediate
  setBusy(false)                         // UI updates instantly

  Server-side cancel is best-effort; abort() is the reliable path
```

### Edge Case: Stream Completes While Stopping

```
SCENARIO:
─────────
  0ms    Stream is processing
  100ms  Stream naturally completes
         └── onStreamComplete() runs:
             - unregisterCancellation(requestId)
             - unlockConversation(convKey)
  105ms  User clicks Stop
         └── stopStreaming() runs:
             - Fire cancel request (registry lookup returns false - already gone)
             - abort() called (already completed, no effect)
             - Adds completion message (duplicate!)

CURRENT BEHAVIOR:
─────────────────
  Mostly harmless - duplicate completion message is ignored by UI
  (ThinkingGroup already complete, extra message just filtered)

  Registry returns { status: "already_complete" } - not an error
```

### Edge Case: Cancel Before Registration

```
SCENARIO:
─────────
  0ms    User sends message
  5ms    User clicks Stop (before server even receives request!)
         └── Cancel request sent with conversationId (no requestId yet)
         └── Registry lookup: nothing registered yet → returns false
  50ms   Server receives message, registers cancellation
         └── But cancel already fired, stream continues!

CURRENT BEHAVIOR:
─────────────────
  abort() is the safety net - it will interrupt the fetch itself
  Stream never fully starts because fetch is aborted client-side

  This is working correctly - abort() handles the super-early case
```

---

## Performance Characteristics

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    CANCELLATION TIMING                                       │
└──────────────────────────────────────────────────────────────────────────────┘

  User clicks Stop
        │
        │ 0ms   isStopping guard check
        │ 0ms   Fire cancel request (async, non-blocking)
        │ 0ms   abort() called
        │ 0ms   Completion message added
        │ 0ms   setBusy(false) - UI updates
        │
        ▼
  User sees immediate response (< 16ms, single frame)

  Meanwhile (async):
        │
        │ ~50-200ms  Cancel request reaches server
        │ ~1ms       Registry lookup + cancel callback
        │ ~50-200ms  Response returns (ignored)
        │
        ▼
  Server cleanup happens in background
```

### Registry Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `registerCancellation()` | O(1) | Map.set() |
| `cancelStream(requestId)` | O(1) | Map.get() + delete() |
| `cancelStreamByConversationKey()` | O(n) | Iterates registry |
| `unregisterCancellation()` | O(1) | Map.delete() |

**Note:** `cancelStreamByConversationKey()` is O(n) but only used for super-early
Stop (< 100ms after request), which is rare. Could optimize with secondary index
if this becomes a bottleneck with many concurrent users.
