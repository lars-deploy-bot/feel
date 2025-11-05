# Error Management Implementation Progress

**Date**: November 5, 2025
**Status**: 🟡 In Progress - 50% Complete (5/10 P0 fixes done)

---

## ✅ Completed P0 Fixes

### 1. ✅ Add New ErrorCodes to Registry
**Status**: ✅ **COMPLETED**
**File**: `apps/web/lib/error-codes.ts`

**Changes**:
- Added 13 new error codes:
  - `PATH_OUTSIDE_WORKSPACE` - File path security violations
  - `UNAUTHORIZED` - Permission denied errors
  - `INVALID_CREDENTIALS` - Login failures
  - `TOOL_NOT_ALLOWED` - Tool permission denials
  - `FILE_READ_ERROR`, `FILE_WRITE_ERROR` - File operation failures
  - `IMAGE_UPLOAD_FAILED`, `IMAGE_LIST_FAILED`, `IMAGE_DELETE_FAILED` - Image operations
  - `STREAM_ERROR`, `STREAM_PARSE_ERROR`, `RESPONSE_CREATION_FAILED` - Stream errors
  - `WORKSPACE_RESTART_FAILED` - Restart failures

- Added user-friendly messages for all new codes via `getErrorMessage()`
- Added recovery guidance via `getErrorHelp()`

**Impact**: ✅ Centralized error code registry now supports all error types

---

### 2. ✅ Standardize ErrorCodes in API Routes (Partial)
**Status**: ✅ **3/8 routes completed**

**Completed Routes**:

#### `/api/claude/route.ts` ✅
- Replaced `"no_session"` → `ErrorCodes.NO_SESSION`
- Replaced `"invalid_json"` → `ErrorCodes.INVALID_JSON`
- Replaced `"invalid_request"` → `ErrorCodes.INVALID_REQUEST`
- Replaced `"query_failed"` → `ErrorCodes.QUERY_FAILED`
- Replaced `"request_processing_failed"` → `ErrorCodes.REQUEST_PROCESSING_FAILED`
- Added `requestId` to all error responses
- Fixed `details` to be object format (was string in some places)

#### `/api/files/route.ts` ✅
- Replaced `"no_session"` → `ErrorCodes.NO_SESSION`
- Replaced `"path_outside_workspace"` → `ErrorCodes.PATH_OUTSIDE_WORKSPACE`
- Replaced `"read_error"` → `ErrorCodes.FILE_READ_ERROR`
- Replaced `"server_error"` → `ErrorCodes.REQUEST_PROCESSING_FAILED`
- Added full StructuredError format to all responses
- Added `requestId` to all errors
- Added contextual details (paths, error messages)

#### `/api/login/route.ts` ✅
- Replaced `"invalid_request"` → `ErrorCodes.INVALID_REQUEST`
- Replaced `"bad_passcode"` → `ErrorCodes.INVALID_CREDENTIALS`
- Replaced `"workspace_required"` → `ErrorCodes.WORKSPACE_MISSING`
- Added full StructuredError format
- Added `requestId` generation and inclusion

**Remaining Routes** (need updates):
- ❌ `/api/manager/route.ts` - Uses string literals
- ❌ `/api/images/upload/route.ts` - Partial ErrorCodes usage
- ❌ `/api/images/list/route.ts` - No ErrorCodes, wrong status codes
- ❌ `/api/images/delete/route.ts` - No ErrorCodes
- ❌ `/api/restart-workspace/route.ts` - No error field at all

**Impact**: ✅ 37.5% of routes now use consistent error codes (3/8)

---

### 3. ✅ Create Root Error Boundary
**Status**: ✅ **COMPLETED**
**File**: `apps/web/app/error.tsx` (NEW)

**Features**:
- Catches all unhandled errors in the application
- Prevents blank white screen crashes
- Provides user-friendly error UI with:
  - Clear error message
  - "Try again" button (calls reset())
  - "Return to chat" button (navigates to /chat)
  - Development-only error details (stack trace)
- Preserves conversation data
- Logs errors to console (TODO: add Sentry integration)

**Impact**: ✅ **CRITICAL** - App no longer crashes to blank screen on render errors

---

### 4. ✅ Create MessageErrorBoundary Component
**Status**: ✅ **COMPLETED**
**File**: `apps/web/features/chat/components/MessageErrorBoundary.tsx` (NEW)

**Features**:
- Per-message error isolation
- Graceful degradation (single message fails, rest of UI works)
- User-friendly fallback UI showing:
  - "Failed to render message" header
  - Explanation that conversation continues normally
  - Development-only error details
- Logs errors with message ID context
- TODO: Sentry integration

**Impact**: ✅ **CRITICAL** - Malformed messages no longer crash entire chat

---

### 5. ✅ Update Message Renderer to Use Error Boundary
**Status**: ✅ **COMPLETED**
**File**: `apps/web/features/chat/lib/message-renderer.tsx`

**Changes**:
- Wrapped `renderMessage()` return with `<MessageErrorBoundary>`
- Extracted rendering logic to `renderMessageContent()` helper
- All message types now protected by error boundary
- Passes `message.id` to boundary for error tracking

**Before**:
```typescript
export function renderMessage(message: UIMessage): React.ReactNode {
  if (message.type === "sdk_message" && isErrorResultMessage(message.content)) {
    return <ErrorResultMessage content={message.content} />
  }
  // ... direct rendering
}
```

**After**:
```typescript
export function renderMessage(message: UIMessage): React.ReactNode {
  return (
    <MessageErrorBoundary messageId={message.id}>
      {renderMessageContent(message)}
    </MessageErrorBoundary>
  )
}

function renderMessageContent(message: UIMessage): React.ReactNode {
  // ... rendering logic
}
```

**Impact**: ✅ Every message now has error protection

---

## ⏳ Remaining P0 Fixes (Critical)

### 6. ❌ Fix Child Process Cleanup in Stream Route
**Status**: ⏳ **PENDING** - Highest priority remaining fix
**Severity**: 🔴 **CRITICAL** - Locks persist forever on errors

**File**: `apps/web/app/api/claude/stream/route.ts:273-394`

**Problem**:
When using systemd workspaces (child process mode), errors in stream processing don't release conversation locks. If `Response()` constructor throws, the finally block never runs.

**Required Changes**:

1. **Move requestId and lock cleanup outside stream creation**:
   ```typescript
   if (useChildProcess) {
     let conversationUnlocked = false

     const cleanup = () => {
       if (!conversationUnlocked) {
         conversationUnlocked = true
         unlockConversation(convKey)
         console.log(`[Claude Stream ${requestId}] Conversation unlocked`)
       }
     }

     // ... stream setup ...

     // ✅ Wrap Response creation in try-catch
     try {
       return new Response(sseStream, { headers })
     } catch (responseError) {
       cleanup()  // ✅ Ensure unlock even if Response() fails
       return NextResponse.json({
         ok: false,
         error: ErrorCodes.RESPONSE_CREATION_FAILED,
         message: "Failed to create streaming response",
         details: { error: responseError.message },
         requestId
       }, { status: 500 })
     }
   }
   ```

2. **Add cleanup to stream controller**:
   ```typescript
   const sseStream = new ReadableStream({
     async start(controller) {
       try {
         // ... processing
       } catch (streamError) {
         // Send error event + cleanup
       } finally {
         cleanup()  // ✅ Always cleanup
         try {
           controller.close()
         } catch (closeError) {
           console.warn(`Controller already closed`)
         }
       }
     },

     cancel() {
       cleanup()  // ✅ Cleanup on client abort
       childStream.cancel?.()
     }
   })
   ```

3. **Add parse error handling**:
   ```typescript
   try {
     const parsed = JSON.parse(line)
     // ...
   } catch (parseError) {
     // ✅ Send error event instead of silent failure
     const errorEvent = {
       type: "error",
       requestId,
       timestamp: new Date().toISOString(),
       data: {
         error: ErrorCodes.STREAM_PARSE_ERROR,
         message: "Failed to parse server response",
         details: parseError.message
       }
     }
     controller.enqueue(encoder.encode(
       `event: bridge_error\ndata: ${JSON.stringify(errorEvent)}\n\n`
     ))
   }
   ```

**Impact**: 🔴 **CRITICAL** - Prevents permanent conversation locks

---

### 7. ❌ Add Cleanup in Agent Child Runner
**Status**: ⏳ **PENDING**
**Severity**: 🔴 **HIGH**

**File**: `apps/web/features/chat/lib/agent-child-runner.ts`

**Required Changes**:

```typescript
export function runAgentChild(cwd: string, params: AgentChildParams) {
  let cleaned = false
  const cleanup = () => {
    if (!cleaned) {
      cleaned = true
      // Add cleanup logic here
    }
  }

  const child = spawn("bun", [agentPath, input], { cwd })

  const stream = new ReadableStream<string>({
    start(controller) {
      // ... existing code
    },

    cancel() {
      console.log("[agent-child] Stream cancelled, killing child")
      cleanup()
      child.kill("SIGTERM")

      // ✅ Add timeout for kill
      setTimeout(() => {
        if (!child.killed) {
          console.warn("[agent-child] SIGTERM failed, sending SIGKILL")
          child.kill("SIGKILL")
        }
      }, 5000)
    },
  })

  child.on("error", (error) => {
    console.error("[agent-child] Process error:", error)
    cleanup()  // ✅ Add cleanup
    controller.error(error)
  })

  child.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(`[agent-child] Exited with code ${code}, signal ${signal}`)
    }
    cleanup()  // ✅ Add cleanup
  })

  return {
    ...stream,
    cancel: () => {
      cleanup()
      child.kill("SIGTERM")
    },
  }
}
```

**Impact**: Ensures child processes are properly terminated and resources released

---

### 8. ❌ Add Lock Timeout Mechanism
**Status**: ⏳ **PENDING**
**Severity**: 🔴 **HIGH**

**File**: `apps/web/features/auth/types/session.ts`

**Problem**: Locks never expire. If cleanup fails, conversation permanently locked.

**Required Changes**:

```typescript
const activeConversations = new Set<string>()
const conversationLockTimestamps = new Map<string, number>()

const LOCK_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes

export function tryLockConversation(key: string): boolean {
  if (activeConversations.has(key)) {
    // ✅ Check if lock is stale
    const lockTime = conversationLockTimestamps.get(key)
    if (lockTime && Date.now() - lockTime > LOCK_TIMEOUT_MS) {
      console.warn(`[Session] Force unlocking stale conversation: ${key}`)
      activeConversations.delete(key)
      conversationLockTimestamps.delete(key)
      // Continue to acquire lock below
    } else {
      return false
    }
  }

  activeConversations.add(key)
  conversationLockTimestamps.set(key, Date.now())  // ✅ Track lock time
  return true
}

export function unlockConversation(key: string): void {
  activeConversations.delete(key)
  conversationLockTimestamps.delete(key)  // ✅ Remove timestamp
}

// ✅ Periodic cleanup of stale locks
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of conversationLockTimestamps.entries()) {
    if (now - timestamp > LOCK_TIMEOUT_MS) {
      console.warn(`[Session] Auto-unlocking stale conversation: ${key}`)
      activeConversations.delete(key)
      conversationLockTimestamps.delete(key)
    }
  }
}, 60 * 1000)  // Check every minute
```

**Impact**: Stale locks auto-expire, users can recover from errors

---

### 9. ❌ Surface Tool Errors in canUseTool Callback
**Status**: ⏳ **PENDING**
**Severity**: 🔴 **CRITICAL**

**File**: `apps/web/app/api/claude/stream/route.ts:193-227`

**Problem**: Tool permission denials never reach the user. Errors silently swallowed.

**Required Changes**:

```typescript
const canUseTool: Options["canUseTool"] = async (toolName, input) => {
  if (!isToolAllowed(toolName, ALLOWED)) {
    const allowedList = Array.from(ALLOWED).join(", ")
    const errorMessage =
      `Tool "${toolName}" is not available in this workspace. ` +
      `Available tools: ${allowedList}`

    console.log(`[Claude Stream ${requestId}] Tool denied: ${toolName}`)

    // ✅ Send error event to frontend
    sendEvent("error", {
      error: ErrorCodes.TOOL_NOT_ALLOWED,
      code: ErrorCodes.TOOL_NOT_ALLOWED,
      message: errorMessage,
      details: { tool: toolName, allowed: Array.from(ALLOWED) }
    })

    return { behavior: "deny", message: errorMessage }
  }

  if (hasFilePath(input)) {
    const filePath = input.file_path

    try {
      ensurePathWithinWorkspace(filePath, workspace.root)
    } catch (containmentError) {
      const errorMessage =
        `Access denied: "${filePath}" is outside your workspace. ` +
        `You can only access files within: ${workspace.root}`

      console.error(`[Claude Stream ${requestId}] Path containment failed:`, {
        filePath,
        workspaceRoot: workspace.root,
        error: containmentError.message
      })

      // ✅ Send error event to frontend
      sendEvent("error", {
        error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
        code: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
        message: errorMessage,
        details: {
          attemptedPath: filePath,
          workspacePath: workspace.root,
          reason: containmentError.message
        }
      })

      return { behavior: "deny", message: errorMessage }
    }
  }

  return { behavior: "allow" }
}
```

**Impact**: Users see why file operations and tools fail

---

### 10. ❌ Handle Parse Errors in Chat Page
**Status**: ⏳ **PENDING**
**Severity**: 🔴 **CRITICAL**

**File**: `apps/web/app/chat/page.tsx:230-232`

**Problem**: SSE parse errors silently ignored. Users see incomplete data as complete.

**Required Changes**:

```typescript
let parseErrorCount = 0
let consecutiveErrors = 0
const MAX_CONSECUTIVE_ERRORS = 3

for (const line of lines) {
  if (line.startsWith("event: ")) {
    currentEvent = line.slice(7).trim()
  } else if (line.startsWith("data: ")) {
    if (currentEvent.startsWith("bridge_")) {
      try {
        const rawData = JSON.parse(line.slice(6))

        if (rawData.requestId && rawData.timestamp && rawData.type) {
          const eventData: StreamEvent = rawData
          const message = parseStreamEvent(eventData)

          if (message) {
            setMessages(prev => [...prev, message])
          }
          consecutiveErrors = 0  // ✅ Reset on success
        } else {
          // ✅ Handle invalid structure
          console.error("[Chat] Invalid SSE event structure:", rawData)
          consecutiveErrors++

          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "sdk_message",
            content: {
              type: "result",
              is_error: true,
              result: JSON.stringify({
                ok: false,
                error: ErrorCodes.STREAM_PARSE_ERROR,
                message: "Received invalid data from server. The response may be incomplete.",
                details: { dataPreview: JSON.stringify(rawData).slice(0, 100) }
              }),
            },
            timestamp: new Date(),
          }])
        }
      } catch (parseError) {
        // ✅ Show parse error to user
        console.error("[Chat] Failed to parse SSE data:", {
          line: line.slice(0, 200),
          error: parseError
        })

        consecutiveErrors++
        parseErrorCount++

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: "sdk_message",
          content: {
            type: "result",
            is_error: true,
            result: JSON.stringify({
              ok: false,
              error: ErrorCodes.STREAM_PARSE_ERROR,
              message: "Failed to parse server response. The conversation may be incomplete.",
              details: {
                parseError: parseError.message,
                dataPreview: line.slice(0, 100)
              }
            }),
          },
          timestamp: new Date(),
        }])

        // ✅ Stop stream if too many errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error("[Chat] Multiple consecutive parse errors, stopping stream")
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "sdk_message",
            content: {
              type: "result",
              is_error: true,
              result: "Connection unstable. Multiple parse errors detected. Please try again.",
            },
            timestamp: new Date(),
          }])
          reader.cancel()
          break
        }
      }
      currentEvent = ""
    }
  }
}
```

**Impact**: Users see when data is incomplete, parse errors reported

---

## 📊 Progress Summary

### Overall Progress: 50% Complete

**Completed** (5/10):
- ✅ ErrorCodes registry expanded
- ✅ 3/8 API routes standardized
- ✅ Root error boundary created
- ✅ Message error boundary created
- ✅ Message renderer wrapped with boundary

**Remaining** (5/10):
- ❌ Child process cleanup fixes
- ❌ Agent child runner cleanup
- ❌ Lock timeout mechanism
- ❌ Tool error surfacing
- ❌ Parse error handling

**Additional Tasks** (Not Started):
- ❌ Remaining 5 API routes to standardize
- ❌ Error tracking integration (Sentry)
- ❌ P1 and P2 fixes from implementation guide

---

## 🎯 Next Steps (Priority Order)

1. **Immediately**: Fix child process cleanup (#6) - Prevents stuck conversations
2. **Immediately**: Add lock timeout mechanism (#8) - Recovery from stuck locks
3. **Today**: Surface tool errors (#9) - User feedback on permission issues
4. **Today**: Handle parse errors (#10) - Users see incomplete data errors
5. **Today**: Add child runner cleanup (#7) - Resource cleanup
6. **This Week**: Standardize remaining 5 API routes
7. **This Week**: Add Sentry error tracking

---

## 🚀 Testing Checklist

After completing remaining P0 fixes:

- [ ] Test child process error path (kill process mid-stream)
- [ ] Verify conversation locks released on all error paths
- [ ] Test stale lock auto-expiration (wait 5+ minutes)
- [ ] Try to use disallowed tool (verify error shown)
- [ ] Try to access file outside workspace (verify error shown)
- [ ] Send malformed SSE data (verify error shown, not silent)
- [ ] Test message render error (verify only message fails, not app)
- [ ] Test root error boundary (throw error, verify recovery UI)
- [ ] Verify all API routes use ErrorCodes constants
- [ ] Check error messages are user-friendly
- [ ] Verify requestId in all error responses

---

## 📝 Files Modified

### Created (3):
1. `apps/web/app/error.tsx` - Root error boundary
2. `apps/web/features/chat/components/MessageErrorBoundary.tsx` - Message error boundary
3. `docs/error-management/implementation-progress.md` - This file

### Modified (5):
1. `apps/web/lib/error-codes.ts` - Added 13 new codes + messages
2. `apps/web/app/api/claude/route.ts` - Standardized ErrorCodes
3. `apps/web/app/api/files/route.ts` - Standardized ErrorCodes
4. `apps/web/app/api/login/route.ts` - Standardized ErrorCodes
5. `apps/web/features/chat/lib/message-renderer.tsx` - Wrapped with boundary

### Pending Modifications (7):
1. `apps/web/app/api/claude/stream/route.ts` - Child cleanup + tool errors
2. `apps/web/features/chat/lib/agent-child-runner.ts` - Add cleanup
3. `apps/web/features/auth/types/session.ts` - Lock timeout
4. `apps/web/app/chat/page.tsx` - Parse error handling
5. `apps/web/app/api/manager/route.ts` - Standardize ErrorCodes
6. `apps/web/app/api/images/**/*.ts` - 3 routes need ErrorCodes
7. `apps/web/app/api/restart-workspace/route.ts` - Standardize ErrorCodes

---

## 🔗 Related Documentation

- [Error System Analysis](./error-system-analysis.md) - Full analysis and findings
- [README](./README.md) - Quick navigation and standards
- [Implementation Guide](./error-system-analysis.md#implementation-guide) - Detailed instructions

---

**Last Updated**: November 5, 2025
**Next Review**: After completing remaining P0 fixes
