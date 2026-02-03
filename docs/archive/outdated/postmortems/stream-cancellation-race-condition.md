# Conversation Lock Never Released: "Can't Send Second Message"

**Date**: November 9-10, 2025
**Severity**: Critical (Product Unusable)
**Status**: ✅ **RESOLVED**
**Affected Component**: `/api/claude/stream` endpoint, conversation locking, stream lifecycle

## Summary

Users could send first message successfully, but second message attempt would fail silently (no network request, button unresponsive). Root cause: **conversation lock was never released after successful completion**.

**Actual Root Cause Discovered:**
The backend's `ndjsonStream` handler was missing a `finally` block to:
1. Close the HTTP stream (`controller.close()`)
2. Release the conversation lock (`unlockConversation()`)

The lock was **only** released on error or abort, never on success. This meant after the first successful message, the conversation remained locked forever (until 5-minute timeout).

**Initial Misleading Symptoms:**
- Button appeared clickable but did nothing
- No network requests in DevTools
- `isSubmitting` stuck at `true` on frontend
- When forced to send, got `409 CONVERSATION_BUSY`

These were downstream effects of the backend never releasing the lock.

## Reproduction Steps (Before Fix)

1. Send first message → Works perfectly, get full response
2. Try to send second message → Click button, nothing happens
3. Check DevTools Network tab → No request made
4. Check console → `isSubmitting: true` (stuck)
5. Wait 5+ minutes → Suddenly works again (lock timeout cleanup)

**Expected**: Second message sends immediately
**Actual**: Chat completely broken after first message

## Technical Deep Dive

### The Actual Bug: Missing Cleanup on Success

**Lock Acquisition** (`/app/api/claude/stream/route.ts:260`):
```typescript
if (!tryLockConversation(convKey)) {
  return 409 // Conversation already locked
}
lockAcquired = true
```

**Lock Release Locations (Before Fix):**
1. ❌ Success path: **NEVER** - Lock held forever
2. ✅ Error path: `route.ts:356` - Only in catch block
3. ✅ Abort path: `abort-handler.ts:63` - Only on client cancel

**The Missing Finally Block:**

`/lib/stream/ndjson-stream-handler.ts` was structured like this:

```typescript
return new ReadableStream({
  async start(controller) {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Process data...
      }
      console.log("Stream complete")
      // ❌ MISSING: controller.close()
      // ❌ MISSING: onStreamComplete callback
    } catch (error) {
      controller.enqueue(errorMessage)
      // ❌ No finally block here either
    }
  }
})
```

When `done: true` arrives, the loop exits and `start()` returns. But:
- Stream never closes (`controller.close()` never called)
- Lock never released (no cleanup callback)
- Frontend hangs forever waiting for stream end
- Lock held until 5-minute timeout

### Why Frontend Appeared Broken

The frontend's `sendMessage()` guards against concurrent sends:

```typescript
async function sendMessage() {
  if (isSubmitting || busy || !msg.trim()) return  // ← Blocked here

  setIsSubmitting(true)
  // ... send request
} finally {
  setIsSubmitting(false)  // ← This finally never ran
}
```

The `finally` block only runs when the async function completes. Since the stream never closes:
- Frontend hangs on `reader.read()`
- Promise never settles
- Finally never runs
- `isSubmitting` stays `true` forever
- Second click silently blocked

### Cascading Failures That Confused Diagnosis

We initially pursued several red herrings:

**1. Hot Reload State Issue (Wrong, Made It Worse)**
- Symptom: `isSubmitting` ref stayed `true`
- Hypothesis: Fast Refresh preserved ref state
- Fix attempted: Changed `useRef` → `useState`
- Result: Didn't help - still broken
- **Learning**: Ref vs state wasn't the issue; the promise never settling was
- **Side Effect**: useState causes unnecessary re-renders since button doesn't use `isSubmitting` for UI
- **Resolution**: Reverted to `useRef` (correct for internal guard logic)

**2. Race Condition Between Frontend/Backend (Wrong)**
- Symptom: Got `409 CONVERSATION_BUSY` when forcing second send
- Hypothesis: Frontend completes before backend releases lock
- Fix attempted: Added 300ms `setTimeout` delay
- Result: Still broken - lock never released at all
- **Learning**: No amount of delay helps if lock is held forever

**3. Stream Not Closing (Partially Correct)**
- Symptom: Network tab shows "request not finished yet" forever
- Hypothesis: Need to break loop on `bridge_complete` event
- Fix attempted: Added `shouldStopReading` flag
- Result: Stream closed on frontend, but backend still locked
- **Learning**: Frontend cleanup is independent from backend cleanup

**4. Finally: The Actual Bug**
- Investigation: Searched codebase for `unlockConversation()` calls
- Discovery: Only 2 locations - error handler and abort handler
- Realization: **Nothing releases lock on success**
- Validation: `controller.close()` also never called

## The Solution

### Pattern: Cleanup Callback with Finally Block

Following the pattern established in `/lib/agent-child-runner.ts` (lines 104-121), we implemented a cleanup callback:

**1. Added `onStreamComplete` callback to stream config:**

```typescript
interface StreamHandlerConfig {
  // ... existing fields
  onStreamComplete?: () => void  // Called when stream ends (any reason)
}
```

**2. Added `finally` block to stream handler:**

```typescript
// /lib/stream/ndjson-stream-handler.ts
return new ReadableStream({
  async start(controller) {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Process data...
      }
    } catch (error) {
      controller.enqueue(errorMessage)
    } finally {
      // ✅ Guaranteed cleanup - runs on success, error, AND abort
      controller.close()              // Close HTTP stream
      onStreamComplete?.()            // Release lock + any other cleanup
      console.log("Stream finalized")
    }
  }
})
```

**3. Registered cleanup callback in route handler:**

```typescript
// /app/api/claude/stream/route.ts
const ndjsonStream = createNDJSONStream({
  // ... existing config
  onStreamComplete: () => {
    unlockConversation(convKey)
    console.log("Released conversation lock")
  }
})
```

### Why This Solution is Robust

**1. JavaScript Guarantee**
- `finally` blocks **always** run when `start()` exits
- Success, error, or abort - doesn't matter
- No timing dependencies, no race conditions

**2. Idempotent Safety**
- Abort handler also calls `unlockConversation()`
- `Set.delete()` is idempotent - safe to call multiple times
- Defensive redundancy, not a code smell

**3. All Paths Covered**
```
Success:  done:true → finally → close + unlock
Error:    throw     → finally → close + unlock
Abort:    cancel()  → abort-handler unlocks + finally → close + unlock (redundant)
```

**4. Follows Existing Patterns**
- Same callback pattern as `onSessionIdReceived`
- Same cleanup pattern as `agent-child-runner.ts`
- Consistent with codebase conventions

## Debugging Techniques That Worked

### What Helped

1. **Systematic Search for Lock Release**
   ```bash
   grep -rn "unlockConversation" apps/web --include="*.ts"
   ```
   Found only 2 call sites - revealed the missing success path

2. **Tracing Promise Lifecycle**
   - Added logging to `finally` block → never appeared
   - Confirmed: async function never completes
   - Led to investigation of stream closure

3. **Checking Network Tab State**
   - "CAUTION: request is not finished yet!"
   - Proved backend stream still open
   - Indicated missing `controller.close()`

4. **Following Existing Patterns**
   - Examined `agent-child-runner.ts` cleanup
   - Found established pattern for cleanup callbacks
   - Adopted same approach for consistency

### What Didn't Help (Wasted Time)

1. **Console Logging Everything**
   - Added logs in 10+ places
   - Cluttered output, hard to trace
   - **Better**: Focused search for specific evidence

2. **Guessing at Timing**
   - Tried 100ms, 300ms, 500ms delays
   - No principled basis for values
   - **Better**: Traced actual execution flow

3. **Focusing on Symptoms**
   - Spent time on `isSubmitting` state management
   - Tried to "fix" the frontend guard logic
   - **Better**: Found root cause first

## Lessons Learned

### Key Insights

**1. Resource Acquisition Must Have Corresponding Release**

Every lock acquisition needs a guaranteed release path:
```typescript
// ❌ WRONG - No cleanup on success
try {
  acquireLock()
  doWork()
} catch (error) {
  releaseLock()
}

// ✅ CORRECT - Always releases
try {
  acquireLock()
  doWork()
} finally {
  releaseLock()
}
```

**2. Streaming Cleanup Requires Finally Blocks**

ReadableStream `start()` is async. Without `finally`:
- Stream never closes (`controller.close()`)
- Cleanup callbacks never called
- Resources leak indefinitely

**3. Frontend Symptoms Can Mask Backend Bugs**

Frontend appeared broken (button unresponsive), but:
- Frontend code was fine
- Backend held lock forever
- Frontend was correctly waiting

**Don't assume frontend bug when UI doesn't respond.**

**4. Defensive Redundancy is Good**

Both abort-handler AND finally block call `unlockConversation()`:
- Not a bug, it's safety
- Idempotent operations allow this
- Multiple safety nets prevent leaks

**5. Existing Patterns Are Documentation**

`agent-child-runner.ts` already showed the correct pattern:
- Cleanup callback in config
- Finally block guarantees execution
- Should have referenced it sooner

**6. Don't Thrash on the Frontend When Backend is Broken**

We spent significant time "fixing" frontend issues:
- Changed ref to state (worse performance, no benefit)
- Added timeouts (band-aid for backend bug)
- These were symptoms, not causes

**Better approach:**
1. Trace the actual bug first (grep for lock release)
2. Verify frontend is doing the right thing (waiting for stream)
3. Fix the root cause (backend cleanup)
4. Then evaluate if frontend changes are still needed

**Rule:** If frontend works once but fails twice, suspect backend resource leak, not frontend state management.

### What to Look Out For Next Time

**Red Flags in Stream Code:**

1. **Missing `controller.close()`**
   - Stream loops should always close controller
   - Frontend waits indefinitely otherwise

2. **Lock Without Finally Block**
   - Any resource acquisition needs guaranteed release
   - `try-finally` is non-negotiable for locks

3. **Cleanup Only in Error Handlers**
   - If you see `catch { cleanup() }` without `finally { cleanup() }`
   - Success path likely leaks resources

4. **Frontend "Stuck" on Second Action**
   - First action works, second doesn't
   - Screams "resource leak" - backend probably didn't clean up

**Diagnostic Questions:**

When debugging "can't send second message":

1. ✅ **Check lock release**: `grep -rn "unlockConversation"` - how many call sites?
2. ✅ **Check stream closure**: Does `start()` have `finally` with `controller.close()`?
3. ✅ **Check network tab**: Does previous request show as "pending" or "finished"?
4. ✅ **Check promise state**: Does frontend's `finally` block log appear?

## Testing Verification

**Manual Test:**
1. Send message "hi" → Wait for complete response
2. Immediately send "test" → Should work instantly
3. Send 5 messages rapid-fire → All should succeed

**Automated Test (Future):**
```typescript
test("releases lock after successful completion", async () => {
  const convKey = "user::workspace::conv1"

  // First request
  await POST("/api/claude/stream", { message: "hi", conversationId: "conv1" })

  // Immediately try second request (should not be blocked)
  const res = await POST("/api/claude/stream", { message: "test", conversationId: "conv1" })

  expect(res.status).not.toBe(409)  // Not locked
})
```

## Files Modified

### Backend (Actual Fixes)

1. `/lib/stream/ndjson-stream-handler.ts`
   - Added `onStreamComplete?:() => void` to interface
   - Added `finally` block with `controller.close()` and callback
   - **This was the core fix**

2. `/app/api/claude/stream/route.ts`
   - Registered cleanup callback: `onStreamComplete: () => unlockConversation(convKey)`
   - **This releases the lock properly**

### Frontend (Necessary vs Unnecessary Changes)

3. `/app/chat/page.tsx`

**✅ Kept (Necessary):**
- `shouldStopReading` flag - Required to exit nested while/for loops on completion
- Without this, frontend hangs waiting for backend cleanup

**❌ Reverted (Unnecessary, Caused Performance Regression):**
- `isSubmitting` useState → reverted back to `useRef`
- Reason: Button doesn't use `isSubmitting` for visual feedback (uses `busy` instead)
- useState caused unnecessary re-renders on every state change
- `useRef` is correct for internal guard logic that doesn't affect UI

**✅ Removed (Was a Hack):**
- 300ms `setTimeout` delay before re-enabling send
- No longer needed with proper backend cleanup

## Test Coverage

**Comprehensive regression tests added** to prevent this bug from recurring:

- 6 new tests in `/lib/stream/__tests__/ndjson-stream-handler.test.ts`
- Test suite: "Stream Cleanup (Regression Test for Lock Bug)"
- Coverage: Success path, error path, malformed data, backward compatibility, idempotency
- All tests pass (46/46 in affected test suites)

**Key tests:**
1. ✅ `onStreamComplete` called on success
2. ✅ `onStreamComplete` called on error (finally block)
3. ✅ `controller.close()` called (stream ends properly)
4. ✅ Callback optional (backward compatible)
5. ✅ Called exactly once (no double-cleanup)

See `docs/postmortems/TESTING_SUMMARY.md` for detailed test documentation.

## References

- **Testing**: `docs/postmortems/TESTING_SUMMARY.md` (regression test details)
- **Session Management**: `docs/sessions/session-management.md`
- **Stream Implementation**: `docs/streaming/stream-implementation.md`
- **Cleanup Pattern Reference**: `/lib/agent-child-runner.ts:104-121`
