# Chat & Cancellation Requirements

This document defines the expected behavior for chat messaging and stream cancellation. These requirements are verified through code review and automated tests.

All sequence diagrams show frontend behavior, treating backend as a black box that returns expected responses.

---

## 1. Basic Messaging

### 1.1 Send Message → Receive Response
**Requirement:** When a user sends a message, they MUST always receive a response (or an error message).

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Type + Enter       │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guard checks:       │
     │                     │ - !isSubmitting     │
     │                     │ - !busy             │
     │                     │ - !isStopping       │
     │                     │ - msg.trim()        │
     │                     │                     │
     │                     │ isSubmitting = true │
     │                     │ busy = true         │
     │                     │                     │
     │  See user message   │                     │
     │<────────────────────│                     │
     │                     │                     │
     │  See thinking...    │                     │
     │<────────────────────│                     │
     │                     │                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: chunks...      │
     │                     │<────────────────────│
     │                     │                     │
     │  See response       │                     │
     │  streaming in       │                     │
     │<────────────────────│                     │
     │                     │                     │
     │                     │ SSE: done           │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ finally block:      │
     │                     │ busy = false        │
     │                     │ isSubmitting = false│
     │                     │                     │
     │  Thinking gone,     │                     │
     │  can send again     │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- User types message and presses Enter/clicks Send
- Message appears in chat as user message
- "Thinking" indicator shows while waiting for response
- Response streams in and displays
- Thinking indicator disappears when response completes

### 1.2 Empty Message Prevention
**Requirement:** Empty or whitespace-only messages MUST NOT be sent.

```
┌──────────┐          ┌──────────┐
│   User   │          │ Frontend │
└────┬─────┘          └────┬─────┘
     │                     │
     │  Press Enter        │
     │  (empty input)      │
     │────────────────────>│
     │                     │
     │                     │ Guard: !msg.trim()
     │                     │ return (do nothing)
     │                     │
     │  Nothing happens    │
     │<────────────────────│
     │                     │
```

**Verified behavior:**
- Send button is disabled when message is empty
- Pressing Enter with empty input does nothing
- Guard: `if (!msg.trim()) return`

### 1.3 Double-Submit Prevention
**Requirement:** User MUST NOT be able to send multiple messages simultaneously.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send "Hello"       │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ isSubmitting = true │
     │                     │ busy = true         │
     │                     │                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │  Spam Enter x5      │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guard: isSubmitting │
     │                     │ return x5 (blocked) │
     │                     │                     │
     │  Only 1 message     │                     │
     │  sent               │ SSE: response...    │
     │<────────────────────│<────────────────────│
     │                     │                     │
```

**Verified behavior:**
- `isSubmitting.current` ref guards against concurrent submits
- `busy` state disables send button during request
- Guard: `if (isSubmitting.current || busy) return`

---

## 2. Stream Cancellation (Stop Button)

### 2.1 Basic Stop Functionality
**Requirement:** When user clicks Stop, the current stream MUST stop and the UI MUST reset to allow new messages.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: streaming...   │
     │                     │<────────────────────│
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ isStopping = true   │
     │                     │ abortController     │
     │                     │   .abort()          │
     │                     │                     │
     │  See spinner on     │                     │
     │  stop button        │                     │
     │<────────────────────│                     │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │    (backend waits   │
     │                     │     for cleanup)    │
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ finishCancellation: │
     │                     │ busy = false        │
     │                     │ isStopping = false  │
     │                     │ isSubmitting = false│
     │                     │                     │
     │  Can send again     │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Stop button appears during streaming
- Clicking Stop triggers client-side abort
- Cancel request sent to backend with `requestId`
- Backend releases conversation lock
- Cancel endpoint waits for cleanup before responding
- Frontend resets states after cancel response received
- User can immediately send new message

### 2.2 Stop → Send New Message
**Requirement:** After clicking Stop, user MUST be able to send a new message that works normally.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send "Question 1"  │                     │
     │────────────────────>│ POST /stream        │
     │                     │────────────────────>│
     │                     │ SSE: streaming...   │
     │                     │<────────────────────│
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │ abort() + POST      │
     │                     │ /cancel             │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ All states reset    │
     │                     │                     │
     │  Send "Question 2"  │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guards pass:        │
     │                     │ !isSubmitting ✓     │
     │                     │ !busy ✓             │
     │                     │ !isStopping ✓       │
     │                     │                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: full response  │
     │                     │<────────────────────│
     │                     │                     │
     │  See full response  │                     │
     │  to Question 2      │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- `isStopping` state prevents sending during cancel cleanup
- Cancel endpoint awaits lock release before responding
- Frontend resets `busy`, `isStopping`, `isSubmitting` after response
- No hardcoded delay - backend signals when ready
- New message proceeds normally

### 2.3 Repeated Stop-Send Cycles
**Requirement:** User MUST be able to do: message → stop → message → stop → message → stop → message, and the final message MUST return a normal response.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │ ═══ CYCLE 1 ═══════════════════════════  │
     │                     │                     │
     │  Send msg 1         │ POST /stream        │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Click STOP         │ POST /cancel        │
     │────────────────────>│────────────────────>│
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │ States reset ✓      │
     │                     │                     │
     │ ═══ CYCLE 2 ═══════════════════════════  │
     │                     │                     │
     │  Send msg 2         │ POST /stream        │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Click STOP         │ POST /cancel        │
     │────────────────────>│────────────────────>│
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │ States reset ✓      │
     │                     │                     │
     │ ═══ CYCLE 3 ═══════════════════════════  │
     │                     │                     │
     │  Send msg 3         │ POST /stream        │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Click STOP         │ POST /cancel        │
     │────────────────────>│────────────────────>│
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │ States reset ✓      │
     │                     │                     │
     │ ═══ FINAL MESSAGE ═════════════════════  │
     │                     │                     │
     │  Send msg 4         │                     │
     │────────────────────>│                     │
     │                     │ Guards pass ✓       │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: full response  │
     │                     │<────────────────────│
     │                     │                     │
     │  See complete       │                     │
     │  response to msg 4  │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Each cancel properly releases conversation lock
- Each cancel endpoint response confirms cleanup complete
- States properly reset after each cancel
- No accumulation of stuck state
- Final message has clean slate

### 2.4 Double-Click Stop Protection
**Requirement:** Clicking Stop multiple times in quick succession MUST NOT cause errors or stuck state.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Streaming...       │                     │
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ isStoppingRef=true  │
     │                     │ isStopping=true     │
     │                     │ abort()             │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │  Click STOP again   │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guard: isStoppingRef│
     │                     │ return (blocked)    │
     │                     │                     │
     │  Click STOP again   │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guard: isStoppingRef│
     │                     │ return (blocked)    │
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ finishCancellation  │
     │                     │ isStoppingRef=false │
     │                     │                     │
     │  Normal state       │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- `isStoppingRef.current` guards against re-entry (sync check)
- `isStopping` state for UI visibility
- Guard: `if (isStoppingRef.current) return`
- Only first click executes, subsequent clicks ignored
- `cancelStream` is idempotent (second call returns false)

### 2.5 Stop During Cancel Prevention
**Requirement:** User MUST NOT be able to send messages while Stop is being processed.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Streaming...       │                     │
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │ isStopping = true   │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │  Type new message   │                     │
     │  Press Enter        │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guard: isStopping   │
     │                     │ return (blocked)    │
     │                     │                     │
     │  Nothing happens    │                     │
     │  (can keep typing)  │                     │
     │<────────────────────│                     │
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ isStopping = false  │
     │                     │                     │
     │  NOW press Enter    │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Guards pass ✓       │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
```

**Verified behavior:**
- `isStopping` check in `sendMessage` guard
- Guard: `if (isStopping) return`
- Send button shows spinner during `isStopping`
- Input field remains typeable (UX: prepare next message)

---

## 3. Super-Early Stop (Edge Case)

### 3.1 Stop Before Response Headers
**Requirement:** If user clicks Stop before receiving the first response byte, cancellation MUST still work.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ (waiting for        │
     │                     │  response headers)  │
     │                     │                     │
     │  Click STOP         │                     │
     │  (< 100ms)          │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ requestId = null    │
     │                     │ (not received yet)  │
     │                     │                     │
     │                     │ abort()             │
     │                     │                     │
     │                     │ POST /cancel with   │
     │                     │ { conversationId,   │
     │                     │   workspace }       │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ Backend finds by    │
     │                     │ conversationKey     │
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │  Cancel succeeded   │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Cancel callback registered BEFORE stream starts
- Fallback: cancel by `conversationId` when `requestId` not yet available
- Guard: `if (!requestIdToCancel && conversationId && workspace)` uses fallback path
- Backend searches registry by `conversationKey`

### 3.2 Stop Before Request ID Received
**Requirement:** If user clicks Stop before X-Request-Id header is received, cancellation MUST still work.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ currentRequestId    │
     │                     │   = null            │
     │                     │                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │  Click STOP         │                     │
     │  (before headers)   │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ Check requestId:    │
     │                     │ null → use fallback │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │ { conversationId:   │
     │                     │   "conv-123",       │
     │                     │   workspace:        │
     │                     │   "example.com" }   │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
```

**Verified behavior:**
- `currentRequestIdRef` may be null at Stop time
- Cancel request falls back to `conversationId + workspace`
- Backend builds `conversationKey` and finds matching stream

---

## 4. Error Recovery

### 4.1 Cancel Request Failure
**Requirement:** If the cancel request fails, UI MUST still recover.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ abort() ✓           │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ 500 Server Error    │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ catch: log error    │
     │                     │ (don't throw)       │
     │                     │                     │
     │                     │ finishCancellation  │
     │                     │ still called ✓      │
     │                     │                     │
     │  UI recovered       │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- 5-second timeout fallback in `useStreamCancellation`
- If cancel POST hangs, timeout forces state reset
- Client-side abort already triggered regardless of POST result

### 4.2 Network Error During Cancel
**Requirement:** Network errors during cancel MUST NOT leave UI stuck.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ abort() ✓           │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ (network timeout)   │
     │                     │      ...            │
     │                     │      ...            │
     │                     │      ... 5 seconds  │
     │                     │                     │
     │                     │ Fallback timeout    │
     │                     │ triggers            │
     │                     │                     │
     │                     │ finishCancellation  │
     │                     │ (forced)            │
     │                     │                     │
     │  UI recovered       │                     │
     │  after 5s max       │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- `sendCancelRequest` wrapped in try-catch
- Errors logged but not thrown
- `finishCancellation()` called regardless of POST success
- Timeout fallback as safety net

### 4.3 409 Conflict Recovery
**Requirement:** If 409 CONVERSATION_BUSY error occurs, UI MUST recover and allow retry.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ 409 CONVERSATION    │
     │                     │ _BUSY               │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ catch: show error   │
     │                     │                     │
     │  See error toast    │                     │
     │<────────────────────│                     │
     │                     │                     │
     │                     │ finally block:      │
     │                     │ setBusy(false)      │
     │                     │ isSubmitting=false  │
     │                     │                     │
     │  Can retry now      │                     │
     │<────────────────────│                     │
     │                     │                     │
     │  Send message       │                     │
     │  (retry)            │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
```

**Verified behavior:**
- `setBusy(false)` always called in `sendMessage` finally block
- `isSubmitting.current = false` always reset
- Error displayed to user
- User can retry after error

---

## 5. Conversation Lock Integrity

### 5.1 Lock Released on Cancel
**Requirement:** Conversation lock MUST be released when Stop is clicked.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Click STOP         │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │   ┌───────────────┐ │
     │                     │   │ Backend:      │ │
     │                     │   │ 1. abort()    │ │
     │                     │   │ 2. finally    │ │
     │                     │   │    runs       │ │
     │                     │   │ 3. unlock()   │ │
     │                     │   │ 4. resolve    │ │
     │                     │   │    Promise    │ │
     │                     │   └───────────────┘ │
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │ (lock released)     │
     │                     │<────────────────────│
     │                     │                     │
     │  Response means     │                     │
     │  lock is released   │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Cancel triggers `workerAbortController.abort()`
- Worker pool Promise resolves immediately on abort
- NDJSON finally block calls `onStreamComplete()`
- `onStreamComplete` calls `unlockConversation(convKey)`
- Cancel endpoint awaits this before responding

### 5.2 Lock Released on Error
**Requirement:** Conversation lock MUST be released when stream errors.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: error event    │
     │                     │<────────────────────│
     │                     │                     │
     │                     │   ┌───────────────┐ │
     │                     │   │ Backend:      │ │
     │                     │   │ finally runs  │ │
     │                     │   │ unlock()      │ │
     │                     │   └───────────────┘ │
     │                     │                     │
     │  See error message  │                     │
     │<────────────────────│                     │
     │                     │                     │
     │  Can send new msg   │                     │
     │  (lock released)    │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- NDJSON stream has finally block that always runs
- `onStreamComplete` called in finally (wrapped in try-catch)
- Lock released regardless of error type

### 5.3 Lock Released on Normal Completion
**Requirement:** Conversation lock MUST be released when stream completes normally.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ SSE: chunks...      │
     │                     │<────────────────────│
     │                     │                     │
     │                     │ SSE: done           │
     │                     │<────────────────────│
     │                     │                     │
     │                     │   ┌───────────────┐ │
     │                     │   │ Backend:      │ │
     │                     │   │ stream ends   │ │
     │                     │   │ finally runs  │ │
     │                     │   │ unlock()      │ │
     │                     │   └───────────────┘ │
     │                     │                     │
     │  Response complete  │                     │
     │<────────────────────│                     │
     │                     │                     │
     │  Can send new msg   │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Stream iteration completes
- Finally block runs
- `onStreamComplete` releases lock

### 5.4 No Orphan Locks
**Requirement:** Conversation locks MUST NOT be left in locked state indefinitely.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send message       │                     │
     │────────────────────>│ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │  (browser crash     │                     │
     │   or tab close)     │                     │
     │        X            │                     │
     │                     │                     │
     │                     │   ┌───────────────┐ │
     │                     │   │ Backend:      │ │
     │                     │   │ Lock stuck?   │ │
     │                     │   │               │ │
     │                     │   │ TTL cleanup   │ │
     │                     │   │ runs every    │ │
     │                     │   │ 5 minutes     │ │
     │                     │   │               │ │
     │                     │   │ Entries >10m  │ │
     │                     │   │ auto-cleaned  │ │
     │                     │   └───────────────┘ │
     │                     │                     │
     │  (later, new tab)   │                     │
     │────────────────────>│                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ (lock was cleaned)  │
     │                     │ SSE: response       │
     │                     │<────────────────────│
     │                     │                     │
```

**Verified behavior:**
- TTL cleanup runs every 5 minutes
- Entries older than 10 minutes auto-cleaned
- Safety net for crashed streams

---

## 6. UI State Consistency

### 6.1 Thinking Indicator Lifecycle
**Requirement:** Thinking indicator MUST appear during request and disappear when complete/cancelled/errored.

```
┌──────────┐          ┌──────────┐
│   User   │          │ Frontend │
└────┬─────┘          └────┬─────┘
     │                     │
     │  Send message       │
     │────────────────────>│
     │                     │
     │                     │ busy = true
     │                     │
     │  See "Thinking..."  │
     │<────────────────────│
     │                     │
     │      ...            │
     │                     │
     │  (response done     │
     │   OR error          │
     │   OR stop)          │
     │                     │
     │                     │ busy = false
     │                     │ (in finally block
     │                     │  or finishCancel)
     │                     │
     │  Thinking gone      │
     │<────────────────────│
     │                     │
```

**Verified behavior:**
- `busy` state controls thinking indicator
- Set true when message sent
- Set false in finally block and finishCancellation

### 6.2 Completion Dots After Cancel
**Requirement:** Brief completion indicator MUST show after Stop to signal cancel complete.

```
┌──────────┐          ┌──────────┐
│   User   │          │ Frontend │
└────┬─────┘          └────┬─────┘
     │                     │
     │  Click STOP         │
     │────────────────────>│
     │                     │
     │                     │ showCompletionDots
     │                     │   = true
     │                     │
     │  See •••            │
     │<────────────────────│
     │                     │
     │  (cancel completes) │
     │                     │
     │                     │ showCompletionDots
     │                     │   = false
     │                     │
     │  Dots gone          │
     │<────────────────────│
     │                     │
```

**Verified behavior:**
- `showCompletionDots` set true when Stop clicked
- Set false in `finishCancellation()` after cancel completes
- Provides visual feedback that cancel succeeded

### 6.3 Send Button State
**Requirement:** Send button MUST reflect current state correctly.

```
┌──────────────────────────────────────────────────────┐
│                 SEND BUTTON STATES                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  State: IDLE                                         │
│  ┌─────────────────────┐                             │
│  │      [Send →]       │  Blue, enabled              │
│  └─────────────────────┘                             │
│  Condition: !busy && canSubmit                       │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  State: DISABLED                                     │
│  ┌─────────────────────┐                             │
│  │      [Send →]       │  Gray, disabled             │
│  └─────────────────────┘                             │
│  Condition: !canSubmit (empty message)               │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  State: STREAMING (can stop)                         │
│  ┌─────────────────────┐                             │
│  │      [Stop ■]       │  Red, enabled               │
│  └─────────────────────┘                             │
│  Condition: busy && abortControllerRef.current       │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  State: STOPPING                                     │
│  ┌─────────────────────┐                             │
│  │      [    ◌   ]     │  Spinner, disabled          │
│  └─────────────────────┘                             │
│  Condition: isStopping                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Verified behavior:**
- Disabled when `busy` or `!canSubmit`
- Shows Stop icon when streaming (`busy && abortControllerRef.current`)
- Shows spinner when `isStopping`
- Shows Send icon when ready

---

## 7. Cancellation Registry

### 7.1 Registration Before Stream
**Requirement:** Cancel callback MUST be registered before stream starts.

```
┌──────────┐          ┌─────────┐
│ Frontend │          │ Backend │
└────┬─────┘          └────┬────┘
     │                     │
     │ POST /stream        │
     │────────────────────>│
     │                     │
     │                     │ 1. registerCancel()
     │                     │    ↓
     │                     │ 2. createNDJSONStream()
     │                     │    ↓
     │                     │ 3. start streaming
     │                     │
     │ SSE: ...            │
     │<────────────────────│
     │                     │
```

**Verified behavior:**
- `registerCancellation()` called before `createNDJSONStream()`
- Early Stop can find and cancel stream

### 7.2 Auto-Unregister After Cancel
**Requirement:** Registry entry MUST be removed after cancellation.

```
┌──────────┐          ┌─────────┐
│ Frontend │          │ Backend │
└────┬─────┘          └────┬────┘
     │                     │
     │ POST /cancel        │
     │────────────────────>│
     │                     │
     │                     │ cancelStream():
     │                     │ 1. find entry
     │                     │ 2. call callback
     │                     │ 3. delete entry ✓
     │                     │
     │ { ok: true }        │
     │<────────────────────│
     │                     │
     │ POST /cancel again  │
     │────────────────────>│
     │                     │
     │                     │ entry not found
     │                     │
     │ { status:           │
     │   "already_complete"│
     │ }                   │
     │<────────────────────│
     │                     │
```

**Verified behavior:**
- `cancelStream()` deletes entry after calling callback
- Prevents double-cancellation
- Second cancel returns false (idempotent)

### 7.3 Auto-Unregister After Complete
**Requirement:** Registry entry MUST be removed after normal completion.

```
┌──────────┐          ┌─────────┐
│ Frontend │          │ Backend │
└────┬─────┘          └────┬────┘
     │                     │
     │ SSE: done           │
     │<────────────────────│
     │                     │
     │                     │ onStreamComplete():
     │                     │ unregisterCancel()
     │                     │
     │ (entry removed)     │
     │                     │
```

**Verified behavior:**
- `onStreamComplete` calls `unregisterCancellation(requestId)`
- Entry cleaned up whether cancelled or completed

### 7.4 Security: Owner-Only Cancellation
**Requirement:** User MUST only be able to cancel their own streams.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│  User A  │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  (User B is         │                     │
     │   streaming)        │                     │
     │                     │                     │
     │  Try to cancel      │                     │
     │  User B's stream    │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ POST /cancel        │
     │                     │ { requestId:        │
     │                     │   "user-b-request"} │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ entry.userId        │
     │                     │   !== userId        │
     │                     │                     │
     │                     │ 403 Forbidden       │
     │                     │<────────────────────│
     │                     │                     │
     │  Access denied      │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Registry stores `userId` with each entry
- `cancelStream` checks `entry.userId !== userId`
- Throws "Unauthorized" if mismatch
- Cancel endpoint returns 403 on unauthorized attempt

---

## 8. Worker Pool Integration

### 8.1 Immediate Abort Response
**Requirement:** Worker pool MUST respond immediately when abort signal received.

```
┌──────────┐          ┌─────────────┐          ┌────────┐
│ Route.ts │          │ Worker Pool │          │ Worker │
└────┬─────┘          └──────┬──────┘          └───┬────┘
     │                       │                     │
     │ abort signal          │                     │
     │──────────────────────>│                     │
     │                       │                     │
     │                       │ abortHandler:       │
     │                       │ 1. resolve Promise  │
     │                       │    IMMEDIATELY      │
     │                       │                     │
     │ Promise resolved      │                     │
     │<──────────────────────│                     │
     │                       │                     │
     │ (can proceed to       │                     │
     │  release lock)        │                     │
     │                       │                     │
     │                       │ 2. setTimeout       │
     │                       │    (500ms) for      │
     │                       │    worker cleanup   │
     │                       │                     │
     │                       │         ...         │
     │                       │                     │
     │                       │ 3. reset worker     │
     │                       │    state if needed  │
     │                       │────────────────────>│
     │                       │                     │
```

**Verified behavior:**
- `abortHandler` resolves Promise immediately
- Worker state cleanup happens async after 500ms timeout
- Caller not blocked waiting for worker cleanup

### 8.2 Worker State Reset
**Requirement:** Worker state MUST reset after cancellation.

```
┌─────────────┐          ┌────────┐
│ Worker Pool │          │ Worker │
└──────┬──────┘          └───┬────┘
       │                     │
       │ state: "busy"       │
       │                     │
       │ abort signal        │
       │                     │
       │ (500ms timeout)     │
       │      ...            │
       │                     │
       │ Check: still busy   │
       │ for same requestId? │
       │                     │
       │ Yes → force reset   │
       │                     │
       │ state = "ready"     │
       │ activeRequestId     │
       │   = null            │
       │                     │
       │ Worker available    │
       │ for next request    │
       │                     │
```

**Verified behavior:**
- 500ms cancel timeout in worker pool
- If worker doesn't respond, state force-reset to "ready"
- Worker available for next request

---

## 9. Stress Scenarios

### 9.1 Rapid Stop-Send-Stop-Send
**Requirement:** Rapid alternating Stop/Send MUST NOT cause stuck state or errors.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send               │                     │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Stop (0.5s)        │                     │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Send (0.1s later)  │                     │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Stop (0.3s)        │                     │
     │────────────────────>│────────────────────>│
     │                     │<────────────────────│
     │  Send (0.2s later)  │                     │
     │────────────────────>│────────────────────>│
     │                     │                     │
     │  Full response      │                     │
     │<────────────────────│<────────────────────│
     │                     │                     │
```

**Expected behavior:**
- Each cycle: message → (brief response) → stop → states reset
- Guard prevents sending during `isStopping`
- Lock properly released between cycles
- Final message works normally

### 9.2 Stop Immediately After Send
**Requirement:** Clicking Stop within 100ms of Send MUST work correctly.

```
┌──────────┐          ┌──────────┐          ┌─────────┐
│   User   │          │ Frontend │          │ Backend │
└────┬─────┘          └────┬─────┘          └────┬────┘
     │                     │                     │
     │  Send + Stop        │                     │
     │  (near-instant)     │                     │
     │────────────────────>│                     │
     │                     │                     │
     │                     │ POST /stream        │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ (< 50ms)            │
     │                     │                     │
     │                     │ abort()             │
     │                     │ POST /cancel        │
     │                     │ (fallback path)     │
     │                     │────────────────────>│
     │                     │                     │
     │                     │ { ok: true }        │
     │                     │<────────────────────│
     │                     │                     │
     │  Cancel succeeded   │                     │
     │<────────────────────│                     │
     │                     │                     │
```

**Verified behavior:**
- Cancel callback registered before stream starts
- Fallback path uses conversationId if requestId not yet received
- Backend finds stream by conversationKey

### 9.3 Multiple Tabs Same Conversation
**Requirement:** Opening same conversation in multiple tabs MUST handle gracefully.

```
┌─────────┐  ┌─────────┐          ┌─────────┐
│  Tab 1  │  │  Tab 2  │          │ Backend │
└────┬────┘  └────┬────┘          └────┬────┘
     │            │                    │
     │  Send      │                    │
     │───────────────────────────────>│
     │            │                    │
     │            │  Send (same conv)  │
     │            │───────────────────>│
     │            │                    │
     │            │  409 CONVERSATION  │
     │            │  _BUSY             │
     │            │<───────────────────│
     │            │                    │
     │            │  Error shown       │
     │            │  (can retry)       │
     │            │                    │
     │  Response  │                    │
     │<───────────────────────────────│
     │            │                    │
     │            │  Retry now         │
     │            │───────────────────>│
     │            │                    │
     │            │  Response          │
     │            │<───────────────────│
     │            │                    │
```

**Verified behavior:**
- Conversation lock prevents concurrent requests
- Second tab gets 409 CONVERSATION_BUSY
- First tab's stream continues or cancels normally
- Lock released allows second tab to retry

---

## Test Coverage

These requirements are covered by:
- `useStreamCancellation.test.ts` - 14 tests for hook behavior
- `cancellation-registry.test.ts` - 11 tests for registry operations
- `explicit-cancellation-integration.test.ts` - 8 tests for full flow
- `cancellation.test.ts` - Worker pool cancellation tests

Total: 717 unit tests passing, 104 worker pool tests passing.
