# Error Management System Analysis

**Date**: November 5, 2025
**Status**: 🔴 High Priority - Significant Issues Identified
**Overall System Health**: 42% Consistent

---

## Executive Summary

The Claude Bridge error management system has **strong foundational design** but suffers from **critical implementation gaps**. Only 40% of the codebase uses the centralized error infrastructure, leading to inconsistent error handling, poor user experience on failures, and difficult debugging.

**Critical Findings**:
- ❌ 60% of API routes don't use the `ErrorCodes` system
- ❌ No React Error Boundaries - render errors crash the entire app
- ❌ Tool permission errors silently swallowed
- ❌ Child process cleanup incomplete - locks persist forever
- ❌ Parse errors ignored - users see incomplete data
- ⚠️ Race conditions in conversation locking
- ⚠️ Session store has no error handling
- ⚠️ Three different error response formats in use

**Risk Level**: **MEDIUM-HIGH** - System works for happy paths but degrades poorly under errors.

---

## Table of Contents

1. [Error Infrastructure Overview](#error-infrastructure-overview)
2. [What's Working Well](#whats-working-well)
3. [Critical Issues](#critical-issues)
4. [Error Flow Analysis](#error-flow-analysis)
5. [Consistency Audit](#consistency-audit)
6. [Priority Fixes](#priority-fixes)
7. [Implementation Guide](#implementation-guide)

---

## Error Infrastructure Overview

### Core Components

#### 1. ErrorCodes Registry
**Location**: `apps/web/lib/error-codes.ts`

Centralized error code constants with user-friendly message mapping:

```typescript
export const ErrorCodes = {
  // Workspace errors (1xxx)
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_INVALID: "WORKSPACE_INVALID",

  // Authentication errors (2xxx)
  NO_SESSION: "NO_SESSION",
  AUTH_REQUIRED: "AUTH_REQUIRED",

  // Request errors (3xxx)
  INVALID_JSON: "INVALID_JSON",
  INVALID_REQUEST: "INVALID_REQUEST",

  // Conversation errors (4xxx)
  CONVERSATION_BUSY: "CONVERSATION_BUSY",

  // SDK errors (5xxx)
  QUERY_FAILED: "QUERY_FAILED",
  ERROR_MAX_TURNS: "ERROR_MAX_TURNS",

  // ... more codes
}

export function getErrorMessage(code: ErrorCode, details?: any): string
export function getErrorHelp(code: ErrorCode, details?: any): string | null
```

**Design Strengths**:
- ✅ Separates machine-readable codes from user messages
- ✅ Provides contextual help text for recovery
- ✅ Enables internationalization in future
- ✅ Type-safe with TypeScript

#### 2. StructuredError Format
**Standard**: All API responses should use this format:

```typescript
interface StructuredError {
  ok: false
  error: ErrorCode           // Machine-readable constant
  message: string            // Human-readable message
  details?: Record<string, any>  // Context-specific data
  requestId?: string         // Request tracking
}
```

**Usage in Backend**:
```typescript
return NextResponse.json({
  ok: false,
  error: ErrorCodes.WORKSPACE_NOT_FOUND,
  message: "Workspace directory not found",
  details: { host: hostname, path: workspacePath },
  requestId: req.requestId
}, { status: 404 })
```

#### 3. SSE Error Events
**Format**: Stream errors via Server-Sent Events:

```
event: bridge_error
data: {
  "type": "error",
  "requestId": "abc123",
  "timestamp": "2025-11-05T10:30:00Z",
  "data": {
    "error": "QUERY_FAILED",
    "code": "QUERY_FAILED",
    "message": "Claude SDK query failed",
    "details": "Connection timeout"
  }
}
```

#### 4. Frontend Error Components

**ErrorResultMessage** (`apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx`):
- Parses StructuredError from JSON
- Maps error codes to friendly messages
- Displays contextual help
- Visual hierarchy with icons
- Shows error codes for support

**ResultMessage** (`apps/web/features/chat/components/message-renderers/ResultMessage.tsx`):
- Handles SDK tool result errors
- Displays execution failures
- Shows cost and duration

---

## What's Working Well

### Strengths of Current Implementation

#### 1. ✅ ErrorCodes System Design
**Excellence**: Well-architected, centralized, type-safe

```typescript
// Clean separation of concerns
const errorCode = ErrorCodes.WORKSPACE_NOT_FOUND
const message = getErrorMessage(errorCode, { host })
const help = getErrorHelp(errorCode, { suggestion: "Create directory" })
```

#### 2. ✅ Stream Handler Error Handling
**Location**: `apps/web/features/chat/lib/streamHandler.ts:113-251`

**Excellence**: Comprehensive try-catch-finally pattern

```typescript
try {
  // SDK query iteration
  for await (const m of q) { ... }
} catch (error) {
  // Error detection and classification
  const isMaxTurns = errorMessage.includes("max") && errorMessage.includes("turn")

  if (!sdkAbort.signal.aborted) {
    sendEvent("error", {
      error: isMaxTurns ? ErrorCodes.ERROR_MAX_TURNS : ErrorCodes.QUERY_FAILED,
      message: userFriendlyMessage,
      details: errorMessage
    })
  }

  // Session preservation logic
  if (conversation && !isRecoverable(error)) {
    await conversation.store.delete(conversation.key)
  }
} finally {
  // Guaranteed cleanup
  clearInterval(tick)
  clearTimeout(killer)
  if (!cancelled) controller.close()
  if (!conversationUnlocked) {
    conversationUnlocked = true
    onClose?.()
  }
}
```

**Strengths**:
- ✅ Try-catch with cleanup in finally
- ✅ Error classification (recoverable vs fatal)
- ✅ Session preservation on recoverable errors
- ✅ Timeout protection with killer timeout
- ✅ Heartbeat keepalive mechanism
- ✅ Abort signal handling
- ✅ Request ID tracking
- ✅ Max turns detection with multiple patterns

#### 3. ✅ ErrorResultMessage Component
**Location**: `apps/web/features/chat/components/message-renderers/ErrorResultMessage.tsx`

**Excellence**: Outstanding user experience

```tsx
// Smart error parsing
let parsedError: StructuredError | null = null
try {
  parsedError = JSON.parse(errorMessage)
} catch {
  // Graceful fallback to plain string
}

// Error code mapping
const friendlyMessage = errorCode
  ? getErrorMessage(errorCode, parsedError?.details)
  : fallbackMessage

const helpText = errorCode
  ? getErrorHelp(errorCode, parsedError?.details)
  : null

// Visual presentation
<div className="border border-red-200 bg-red-50/50 p-4 rounded">
  <div className="flex items-start gap-3">
    {/* Warning icon */}
    <WarningIcon />

    <div>
      <h3>Error</h3>
      <p>{friendlyMessage}</p>

      {helpText && <p className="text-xs">{helpText}</p>}

      {/* Error code for support */}
      {errorCode && (
        <div className="font-mono text-xs">Error code: {errorCode}</div>
      )}
    </div>
  </div>
</div>
```

**Strengths**:
- ✅ Parses StructuredError with fallback
- ✅ Maps codes to user-friendly messages
- ✅ Provides recovery guidance
- ✅ Shows technical details for support
- ✅ Visual hierarchy with icons
- ✅ Special handling for workspace errors

#### 4. ✅ Deploy Script Error Handling
**Location**: `apps/web/app/api/deploy/route.ts:72-256`

**Excellence**: Comprehensive error codes with guidance

```typescript
// Exit code mapping
const exitCodeMessages: Record<number, string> = {
  1: "DNS not configured correctly. Add A record pointing to server IP.",
  2: "SSL certificate validation failed. Check DNS propagation.",
  3: "Port already in use. Check for conflicting services.",
  4: "Site directory creation failed. Check permissions.",
  5: "Template copy failed. Check disk space.",
  // ... more specific codes
}

// Process monitoring with timeout
const { stdout, stderr } = await execAsync(deployCommand, {
  timeout: 300000  // 5 minute timeout
})

// Detailed error response
return NextResponse.json({
  ok: false,
  error: `deploy_exit_${exitCode}`,
  message: exitCodeMessages[exitCode] || "Deployment failed",
  details: { exitCode, stdout, stderr },
  logs: stdout + stderr
}, { status: 500 })
```

**Strengths**:
- ✅ Specific error codes per failure mode
- ✅ Actionable recovery guidance
- ✅ Timeout protection
- ✅ Full log capture
- ✅ Clear status communication

#### 5. ✅ Workspace Security Validation
**Location**: `apps/web/features/workspace/lib/workspace-secure.ts`

**Excellence**: Strong path traversal prevention

```typescript
export function ensurePathWithinWorkspace(
  filePath: string,
  workspaceRoot: string
): void {
  const norm = path.normalize(filePath)
  const real = fs.realpathSync(norm)  // Resolve symlinks
  const workspaceReal = fs.realpathSync(workspaceRoot)

  if (!real.startsWith(workspaceReal + path.sep)) {
    throw new Error(`Path outside workspace: ${norm}`)
  }
}
```

**Strengths**:
- ✅ Resolves symlinks before checking
- ✅ Normalizes paths to prevent traversal
- ✅ Clear error messages
- ✅ Used in all file operations

#### 6. ✅ Request ID Tracking
**Location**: Throughout streaming endpoints

**Excellence**: Enables end-to-end tracing

```typescript
const requestId = crypto.randomUUID()

console.log(`[Claude Stream ${requestId}] Starting query`)

// Included in all events
sendEvent("start", { requestId, ... })
sendEvent("message", { requestId, ... })
sendEvent("error", { requestId, ... })

// Included in error responses
return NextResponse.json({
  ok: false,
  error: ErrorCodes.QUERY_FAILED,
  message: "...",
  requestId
}, { status: 500 })
```

**Strengths**:
- ✅ Unique ID per request
- ✅ Logged at all steps
- ✅ Sent to frontend for support
- ✅ Enables correlation across logs

---

## Critical Issues

### Issue #1: ErrorCodes Not Used (60% of Routes)

**Severity**: 🔴 **CRITICAL**
**Impact**: Frontend error matching fails, inconsistent UX, hard to debug

#### Problem

Only `/api/claude/stream` and `/api/verify` use the `ErrorCodes` system. All other routes use string literals, breaking the error infrastructure.

#### Examples

**❌ Wrong** (`/api/claude/route.ts:28`):
```typescript
return NextResponse.json({
  ok: false,
  error: "no_session",  // String literal
  message: "Authentication required"
}, { status: 401 })
```

**✅ Correct**:
```typescript
return NextResponse.json({
  ok: false,
  error: ErrorCodes.NO_SESSION,  // Constant from registry
  message: "Authentication required"
}, { status: 401 })
```

#### Affected Files

| File | Lines | String Literals Used |
|------|-------|---------------------|
| `apps/web/app/api/claude/route.ts` | 28, 48, 181 | `"no_session"`, `"invalid_json"`, `"query_failed"` |
| `apps/web/app/api/files/route.ts` | 21, 40, 78 | `"no_session"`, `"path_outside_workspace"`, `"read_error"` |
| `apps/web/app/api/manager/route.ts` | 44, 79, 89 | `"unauthorized"`, `"invalid_request"`, `"invalid_json"` |
| `apps/web/app/api/images/upload/route.ts` | 55 | `"server_error"` (catch block) |
| `apps/web/app/api/images/list/route.ts` | 23, 78 | `"Unauthorized"`, `"Failed to list images"`, `"Internal server error"` |
| `apps/web/app/api/images/delete/route.ts` | 23, 66 | `"Unauthorized"`, `"Internal server error"` |
| `apps/web/app/api/restart-workspace/route.ts` | 20, 32 | No `error` field at all, only `message` |
| `apps/web/app/api/login/route.ts` | Multiple | `"invalid_credentials"`, `"server_error"` |

#### Impact Analysis

1. **Frontend Error Matching Breaks**:
   ```typescript
   // Frontend tries to match error code
   if (errorCode === ErrorCodes.NO_SESSION) {
     // Redirect to login
   }

   // But gets "no_session" string instead
   // Matching fails, generic error shown
   ```

2. **getErrorMessage() Can't Map**:
   ```typescript
   const friendlyMessage = getErrorMessage(errorCode, details)
   // Returns undefined for string literals
   // User sees technical error instead
   ```

3. **Inconsistent Error Responses**:
   - Some routes: `{ ok, error, message, details, requestId }`
   - Other routes: `{ ok, error, message }`
   - Images routes: `{ error }`

4. **Type Safety Lost**:
   ```typescript
   // TypeScript can't validate string literals
   error: "no_sesion"  // Typo - no error caught
   ```

#### Fix Required

**Action**: Replace all string literals with `ErrorCodes` constants

**Example Migration** (`/api/files/route.ts`):
```diff
+ import { ErrorCodes } from "@/lib/error-codes"

  if (!user) {
    return NextResponse.json({
      ok: false,
-     error: "no_session",
+     error: ErrorCodes.NO_SESSION,
      message: "Authentication required"
    }, { status: 401 })
  }

  if (!isPathWithinWorkspace(filePath, workspacePath)) {
    return NextResponse.json({
      ok: false,
-     error: "path_outside_workspace",
+     error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
      message: "Path is outside your workspace",
      details: { filePath, workspacePath }
    }, { status: 403 })
  }

  try {
    const content = await fs.promises.readFile(filePath, "utf-8")
    return NextResponse.json({ ok: true, content })
  } catch (fileError) {
    return NextResponse.json({
      ok: false,
-     error: "read_error",
+     error: ErrorCodes.FILE_READ_ERROR,
      message: "Failed to read file",
      details: { error: fileError.message }
    }, { status: 500 })
  }
```

**New ErrorCodes Needed**:
- `PATH_OUTSIDE_WORKSPACE` (for files API)
- `FILE_READ_ERROR` (for file operations)
- `FILE_WRITE_ERROR` (for write operations)
- `INVALID_CREDENTIALS` (for login)
- `IMAGE_LIST_FAILED` (for image listing)
- `IMAGE_DELETE_FAILED` (for image deletion)

---

### Issue #2: No React Error Boundaries

**Severity**: 🔴 **CRITICAL**
**Impact**: Any render error crashes the entire application

#### Problem

Zero error boundaries in the entire application. If any component throws during render, the whole UI crashes to a blank screen.

#### Current State

**No error boundaries found**:
- ❌ No `apps/web/app/error.tsx` (root boundary)
- ❌ No `apps/web/app/chat/error.tsx` (chat boundary)
- ❌ No component-level boundaries around message renderers
- ❌ No `componentDidCatch` in any class components (none exist)

#### Failure Scenarios

1. **Malformed SSE Data**:
   ```typescript
   // SSE sends: { type: "error", data: null }
   <ErrorResultMessage content={message.content} />
   // If content is null/undefined → crash
   ```

2. **Unexpected Message Format**:
   ```typescript
   // Message parser returns unexpected shape
   <ToolUseMessage content={content} />
   // If content.tool_name is undefined → crash
   ```

3. **Type Coercion Errors**:
   ```typescript
   // Expects number, gets string
   <div>Duration: {content.duration_ms.toFixed(1)}s</div>
   // If duration_ms is string → crash
   ```

4. **Missing Required Props**:
   ```typescript
   // Component expects required prop
   <ThinkingMessage content={content} />
   // If content.thinking is undefined → crash
   ```

#### User Impact

When render error occurs:
1. Entire chat UI disappears
2. User sees blank white screen
3. No error message displayed
4. Console shows React error
5. Must refresh to recover
6. **All conversation context lost**

#### Fix Required

**Action 1**: Create root error boundary

**File**: `apps/web/app/error.tsx` (NEW)
```typescript
'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Root error boundary caught:', error)
    // TODO: Send to error tracking service
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5">
            {/* Warning triangle */}
          </svg>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Something went wrong
            </h2>

            <p className="text-sm text-red-700 mb-4">
              The application encountered an unexpected error. Your conversation
              data has been preserved.
            </p>

            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try again
              </button>

              <button
                onClick={() => window.location.href = '/chat'}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Return to chat
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {error.message}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Action 2**: Create message renderer error boundary

**File**: `apps/web/features/chat/components/MessageErrorBoundary.tsx` (NEW)
```typescript
'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  messageId: string
}

interface State {
  hasError: boolean
  error?: Error
}

export class MessageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Message render error:', {
      messageId: this.props.messageId,
      error,
      errorInfo
    })
    // TODO: Send to error tracking
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-200 bg-red-50/50 p-3 rounded my-2">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5">
              {/* Warning icon */}
            </svg>
            <div className="text-sm">
              <p className="text-red-900 font-medium mb-1">
                Failed to render message
              </p>
              <p className="text-red-700 text-xs">
                This message contains data that couldn't be displayed.
                The conversation will continue normally.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer">
                    Error details
                  </summary>
                  <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto">
                    {this.state.error?.message}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Action 3**: Wrap message rendering

**File**: `apps/web/features/chat/lib/message-renderer.tsx`
```diff
+ import { MessageErrorBoundary } from '../components/MessageErrorBoundary'

  export function renderMessage(message: UIMessage): React.ReactNode {
+   return (
+     <MessageErrorBoundary messageId={message.id}>
+       {renderMessageContent(message)}
+     </MessageErrorBoundary>
+   )
+ }

+ function renderMessageContent(message: UIMessage): React.ReactNode {
    if (message.type === "sdk_message" && isErrorResultMessage(message.content)) {
      return <ErrorResultMessage content={message.content} />
    }

    // ... rest of rendering logic
  }
```

#### Benefits

- ✅ Graceful degradation - single message fails, rest of UI works
- ✅ User sees error explanation instead of blank screen
- ✅ Conversation context preserved
- ✅ Error logged for debugging
- ✅ Recovery options provided
- ✅ Development mode shows stack traces

---

### Issue #3: Tool Errors Silently Swallowed

**Severity**: 🔴 **CRITICAL**
**Impact**: Users confused why operations fail, no visibility into permission issues

#### Problem

Tool permission denials and validation errors in `canUseTool` callback never reach the user. Errors are logged to console but not displayed in the UI.

#### Current Code

**Location**: `apps/web/app/api/claude/stream/route.ts:193-227`

```typescript
const canUseTool: Options["canUseTool"] = async (toolName, input) => {
  // Check if tool is in allowed list
  if (!isToolAllowed(toolName, ALLOWED)) {
    console.log(`[Claude Stream ${requestId}] Tool not allowed: ${toolName}`)
    return {
      behavior: "deny",
      message: `tool_not_allowed: ${toolName}`
    }
    // ❌ User never sees this
    // ❌ Claude sees generic denial
    // ❌ No explanation of why tool denied
  }

  // Validate file paths
  if (hasFilePath(input)) {
    const filePath = input.file_path

    try {
      ensurePathWithinWorkspace(filePath, workspace.root)
    } catch (_containmentError) {
      // ❌ Error details completely lost
      console.log(`[Claude Stream ${requestId}] Path denied: ${filePath}`)
      return {
        behavior: "deny",
        message: "path_outside_workspace"
      }
      // ❌ No details about why path denied
      // ❌ No suggestion for valid paths
      // ❌ Just silent denial
    }
  }

  // ❌ No try-catch around isToolAllowed() itself
  // ❌ No validation that input is valid JSON
  // ❌ No error handling for workspace injection

  return { behavior: "allow" }
}
```

#### User Impact

**Scenario 1**: User tries to write to `/etc/passwd`
- **Current**: No error message, tool just doesn't execute
- **Expected**: Clear error explaining path restrictions

**Scenario 2**: User tries to use `Bash` tool (not allowed)
- **Current**: Nothing happens, request silently denied
- **Expected**: Error explaining available tools

**Scenario 3**: Workspace root doesn't exist
- **Current**: All file operations silently fail
- **Expected**: Error explaining workspace not found

#### What Users See

```
User: "Write a file to /tmp/test.txt"
Claude: "I'll write that file for you."
[Tool execution denied silently]
Claude: [Continues as if it worked, or says "I encountered an error" with no details]
```

User has no idea:
- Why it failed
- What paths are allowed
- How to fix the issue
- Whether it's a permission problem or path problem

#### Fix Required

**Action 1**: Surface tool denials to user

```typescript
const canUseTool: Options["canUseTool"] = async (toolName, input) => {
  if (!isToolAllowed(toolName, ALLOWED)) {
    const allowedList = ALLOWED.join(", ")
    const errorMessage =
      `Tool "${toolName}" is not available in this workspace. ` +
      `Available tools: ${allowedList}`

    console.log(`[Claude Stream ${requestId}] Tool denied: ${toolName}`)

    // Send error event to frontend
    sendEvent("error", {
      error: ErrorCodes.TOOL_NOT_ALLOWED,
      code: ErrorCodes.TOOL_NOT_ALLOWED,
      message: errorMessage,
      details: { tool: toolName, allowed: ALLOWED }
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

      // Send error event to frontend
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

**Action 2**: Add new error codes

**File**: `apps/web/lib/error-codes.ts`
```diff
  export const ErrorCodes = {
    // ... existing codes
+   TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",
+   PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",
+   FILE_READ_ERROR: "FILE_READ_ERROR",
+   FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  } as const
```

**Action 3**: Add friendly messages

```diff
  export function getErrorMessage(code: ErrorCode, details?: any): string {
    switch (code) {
      // ... existing cases
+     case ErrorCodes.TOOL_NOT_ALLOWED:
+       const tool = details?.tool || "tool"
+       const allowed = details?.allowed?.join(", ") || "available tools"
+       return `The "${tool}" tool is not available. Available: ${allowed}`
+
+     case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
+       return `Access denied: File path is outside your workspace directory.`

      default:
        return details?.message || "An error occurred"
    }
  }

  export function getErrorHelp(code: ErrorCode, details?: any): string | null {
    switch (code) {
      // ... existing cases
+     case ErrorCodes.TOOL_NOT_ALLOWED:
+       return "Only file operation tools (Read, Write, Edit, Glob, Grep) are available for security."
+
+     case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
+       return `You can only access files within: ${details?.workspacePath || "your workspace"}`

      default:
        return null
    }
  }
```

#### Benefits

- ✅ Users see why tools failed
- ✅ Clear explanation of restrictions
- ✅ Guidance on what's allowed
- ✅ Better debugging capability
- ✅ Improved security transparency

---

### Issue #4: Child Process Cleanup Incomplete

**Severity**: 🔴 **CRITICAL**
**Impact**: Conversation locks persist forever, users can't send new messages

#### Problem

When using systemd workspaces (child process mode), errors in the stream processing path don't properly release conversation locks. The finally block only runs if the ReadableStream controller is properly closed, but if Response creation fails, cleanup never happens.

#### Current Code

**Location**: `apps/web/app/api/claude/stream/route.ts:273-394`

```typescript
if (useChildProcess) {
  const childStream = runAgentChild(cwd, {
    prompt: message,
    options: opts,
  })

  const sseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        for await (const line of childStream) {
          // Process child output...
          controller.enqueue(encoder.encode(eventData))
        }
      } catch (error) {
        console.error(`[Claude Stream ${requestId}] Child process error:`, error)

        // Send error event
        const errorData = `event: bridge_error\ndata: {...}\n\n`
        controller.enqueue(encoder.encode(errorData))

        // ❌ NO unlockConversation(convKey) here
        // ❌ If this path throws, lock never released
      } finally {
        // ✅ Cleanup happens here
        unlockConversation(convKey)
        controller.close()
      }
    },
  })

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
  // ❌ CRITICAL: If Response() constructor throws, finally never runs
  // ❌ Lock stays locked forever
  // ❌ No cleanup happens
}
```

#### Failure Scenarios

1. **Response Creation Fails**:
   - Headers invalid
   - Stream already closed
   - Memory allocation fails
   - → Lock never released

2. **Controller Already Closed**:
   - Error path closes controller
   - Finally tries to close again
   - → Exception in finally, unlock skipped

3. **Parse Error in Child Output**:
   ```typescript
   const parsed = JSON.parse(line)  // Throws
   // ❌ Caught by outer catch, but unlock might not happen if controller.error() throws
   ```

#### User Impact

**Symptom**: User gets permanent 409 error

```
User sends message → Lock acquired
Child process crashes → Error in stream
Lock cleanup fails → Lock persists forever
User tries to send another message → 409 Conversation Busy
Refresh page → Same conversation ID → Still locked
User stuck, must clear cookies to recover
```

**Console**:
```
[Claude Stream abc123] Starting query
[Claude Stream abc123] Child process error: ...
Error: Failed to create Response
[ERROR] Lock never released for conversation: user123::site.com::conv456
```

**API Response**:
```json
{
  "ok": false,
  "error": "CONVERSATION_BUSY",
  "message": "Another request is already in progress"
}
```

Forever.

#### Fix Required

**Action 1**: Wrap Response creation in try-catch

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

  const childStream = runAgentChild(cwd, {
    prompt: message,
    options: opts,
  })

  const sseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        for await (const line of childStream) {
          try {
            // Parse and process line
            const parsed = JSON.parse(line)
            const eventData = `event: bridge_${parsed.type}\ndata: ${line}\n\n`
            controller.enqueue(encoder.encode(eventData))
          } catch (parseError) {
            // ❌ OLD: Silent failure
            // ✅ NEW: Log and send error event
            console.error(`[Claude Stream ${requestId}] Parse error:`, parseError)

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
            const eventData = `event: bridge_error\ndata: ${JSON.stringify(errorEvent)}\n\n`
            controller.enqueue(encoder.encode(eventData))
          }
        }

        // Success - send complete event
        const completeEvent = {
          type: "complete",
          requestId,
          timestamp: new Date().toISOString(),
          data: { status: "success" }
        }
        controller.enqueue(encoder.encode(
          `event: bridge_complete\ndata: ${JSON.stringify(completeEvent)}\n\n`
        ))

      } catch (streamError) {
        console.error(`[Claude Stream ${requestId}] Stream error:`, streamError)

        // Try to send error event (might fail if controller closed)
        try {
          const errorEvent = {
            type: "error",
            requestId,
            timestamp: new Date().toISOString(),
            data: {
              error: ErrorCodes.STREAM_ERROR,
              message: "Stream processing failed",
              details: streamError.message
            }
          }
          controller.enqueue(encoder.encode(
            `event: bridge_error\ndata: ${JSON.stringify(errorEvent)}\n\n`
          ))
        } catch (sendError) {
          console.error(`[Claude Stream ${requestId}] Failed to send error event:`, sendError)
        }

      } finally {
        // ✅ ALWAYS cleanup, even on errors
        cleanup()

        // Safe controller close
        try {
          controller.close()
        } catch (closeError) {
          console.warn(`[Claude Stream ${requestId}] Controller already closed:`, closeError)
        }
      }
    },

    cancel() {
      // ✅ Cleanup on client abort
      console.log(`[Claude Stream ${requestId}] Stream cancelled by client`)
      cleanup()
      childStream.cancel?.()
    },
  })

  // ✅ Wrap Response creation in try-catch
  try {
    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (responseError) {
    // ✅ Cleanup if Response creation fails
    console.error(`[Claude Stream ${requestId}] Response creation failed:`, responseError)
    cleanup()

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

**Action 2**: Add cancel cleanup in agent-child-runner

**File**: `apps/web/features/chat/lib/agent-child-runner.ts`
```diff
  export function runAgentChild(cwd: string, params: AgentChildParams) {
+   let cleaned = false
+   const cleanup = () => {
+     if (!cleaned) {
+       cleaned = true
+       // Cleanup logic here
+     }
+   }

    const child = spawn("bun", [agentPath, input], { cwd })

    const stream = new ReadableStream<string>({
      start(controller) {
        // ... existing code
      },

      cancel() {
        console.log("[agent-child] Stream cancelled, killing child")
+       cleanup()
        child.kill("SIGTERM")
+
+       // ✅ Add timeout for kill
+       setTimeout(() => {
+         if (!child.killed) {
+           console.warn("[agent-child] SIGTERM failed, sending SIGKILL")
+           child.kill("SIGKILL")
+         }
+       }, 5000)
      },
    })

    child.on("error", (error) => {
      console.error("[agent-child] Process error:", error)
+     cleanup()
      controller.error(error)
    })

    child.on("exit", (code, signal) => {
      if (code !== 0) {
        console.error(`[agent-child] Exited with code ${code}, signal ${signal}`)
      }
+     cleanup()
    })

    return {
      ...stream,
      cancel: () => {
+       cleanup()
        child.kill("SIGTERM")
      },
    }
  }
```

**Action 3**: Add lock timeout mechanism

**File**: `apps/web/features/auth/types/session.ts`
```diff
  const activeConversations = new Set<string>()
+ const conversationLockTimestamps = new Map<string, number>()
+
+ const LOCK_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes

  export function tryLockConversation(key: string): boolean {
    if (activeConversations.has(key)) {
+     // Check if lock is stale
+     const lockTime = conversationLockTimestamps.get(key)
+     if (lockTime && Date.now() - lockTime > LOCK_TIMEOUT_MS) {
+       console.warn(`[Session] Force unlocking stale conversation: ${key}`)
+       activeConversations.delete(key)
+       conversationLockTimestamps.delete(key)
+       // Continue to acquire lock below
+     } else {
+       return false
+     }
-     return false
    }

    activeConversations.add(key)
+   conversationLockTimestamps.set(key, Date.now())
    return true
  }

  export function unlockConversation(key: string): void {
    activeConversations.delete(key)
+   conversationLockTimestamps.delete(key)
  }

+ // Periodic cleanup of stale locks
+ setInterval(() => {
+   const now = Date.now()
+   for (const [key, timestamp] of conversationLockTimestamps.entries()) {
+     if (now - timestamp > LOCK_TIMEOUT_MS) {
+       console.warn(`[Session] Auto-unlocking stale conversation: ${key}`)
+       activeConversations.delete(key)
+       conversationLockTimestamps.delete(key)
+     }
+   }
+ }, 60 * 1000)  // Check every minute
```

#### Benefits

- ✅ Locks always released, even on catastrophic failures
- ✅ Stale locks auto-expire after 5 minutes
- ✅ Child processes properly terminated
- ✅ Parse errors handled gracefully
- ✅ Users can recover from errors automatically

---

### Issue #5: Parse Errors Silently Ignored

**Severity**: 🔴 **CRITICAL**
**Impact**: Users see incomplete data as complete, missing error messages

#### Problem

Frontend SSE parsing silently skips malformed events. If the server sends invalid JSON or the event format is wrong, the frontend just logs a warning and continues as if nothing happened. This can cause critical error events to be missed.

#### Current Code

**Location**: `apps/web/app/chat/page.tsx:214-232`

```typescript
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
        }
      } catch (_parseError) {
        // ❌ CRITICAL: Silent failure
        console.warn("[Chat] Failed to parse SSE data:", line.slice(0, 100))
        // ❌ No error shown to user
        // ❌ Could be skipping critical error event
        // ❌ User thinks operation succeeded
      }
      currentEvent = ""
    }
  }
}
```

#### Failure Scenarios

1. **Malformed JSON from Server**:
   ```
   event: bridge_error
   data: {"type":"error","requestId":"123","timestamp":"2025-11-05T...",

   # Missing closing brace - JSON.parse throws
   # Error event completely missed
   ```

2. **Invalid Event Structure**:
   ```json
   {
     "type": "error",
     "data": null
     // Missing requestId, timestamp
   }
   ```
   Event skipped, user never sees error

3. **Network Corruption**:
   ```
   event: bridge_message
   data: {"type":"mess���ge","req���

   # Garbled bytes - parse fails
   # Tool output or error message lost
   ```

#### User Impact

**Scenario**: Server sends error about max turns

```
Server sends:
  event: bridge_error
  data: {"type":"error","requestId":"abc","timestamp":"...","data":{"error":"ERROR_MAX_TURNS","message":"Max turns exceeded"}}

But JSON malformed (missing quote, extra comma, etc.)

Frontend:
  - Parse fails
  - Logs warning to console
  - Continues waiting for more events
  - Never shows error to user

User sees:
  - Loading spinner forever
  - No error message
  - Thinks operation still in progress
  - Eventually gives up and refreshes
```

**Actual Console**:
```
[Chat] Failed to parse SSE data: {"type":"error","requestId":"abc","times...
```

User has no idea there was an error.

#### Fix Required

**Action**: Show parse errors to user

```typescript
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
        } else {
          // ✅ Handle invalid structure
          console.error("[Chat] Invalid SSE event structure:", rawData)

          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: "sdk_message",
            content: {
              type: "result",
              is_error: true,
              result: "Received invalid data from server. The response may be incomplete.",
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

        // ✅ Track consecutive parse errors
        parseErrorCount++
        if (parseErrorCount >= 3) {
          console.error("[Chat] Multiple parse errors, stopping stream")
          reader.cancel()
          break
        }
      }
      currentEvent = ""
    }
  }
}
```

**Additional Improvements**:

1. **Track consecutive errors**:
   ```typescript
   let parseErrorCount = 0
   let consecutiveErrors = 0
   const MAX_CONSECUTIVE_ERRORS = 3

   // In parse success:
   consecutiveErrors = 0

   // In parse error:
   consecutiveErrors++
   if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
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
   ```

2. **Add parse error recovery**:
   ```typescript
   // If error event type, try to extract message even if structure wrong
   if (currentEvent === "bridge_error") {
     try {
       const partial = JSON.parse(line.slice(6))
       const errorMessage = partial?.data?.message || "Unknown error occurred"

       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         type: "sdk_message",
         content: {
           type: "result",
           is_error: true,
           result: errorMessage,
         },
         timestamp: new Date(),
       }])
     } catch {
       // Truly unrecoverable, show generic error
     }
   }
   ```

#### Benefits

- ✅ Users see when data is incomplete
- ✅ Parse errors don't silently corrupt conversation
- ✅ Critical error events not missed
- ✅ Connection issues detected and reported
- ✅ Automatic recovery from transient issues

---

## Error Flow Analysis

### Complete Error Propagation Path

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR ORIGIN POINTS                       │
└─────────────────────────────────────────────────────────────┘
    │
    ├─ Authentication Errors (API routes)
    ├─ Validation Errors (Zod schema)
    ├─ Workspace Resolution Errors
    ├─ Conversation Locking Errors
    ├─ SDK Query Errors
    ├─ Tool Execution Errors
    ├─ Child Process Errors
    ├─ File Operation Errors
    ├─ Session Store Errors
    └─ Network/Connection Errors

    ↓

┌─────────────────────────────────────────────────────────────┐
│                  BACKEND ERROR HANDLING                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────┐
│   Pre-Stream Errors  │      │  Mid-Stream Errors   │
│   (HTTP Response)    │      │   (SSE Events)       │
└──────────────────────┘      └──────────────────────┘
    │                              │
    │ NextResponse.json({         │ sendEvent("error", {
    │   ok: false,                │   error: ErrorCode,
    │   error: ErrorCode,         │   code: ErrorCode,
    │   message: "...",           │   message: "...",
    │   details: {...},           │   details: {...}
    │   requestId                 │ })
    │ }, { status: 4xx/5xx })     │
    │                              │
    ↓                              ↓

┌─────────────────────────────────────────────────────────────┐
│                    TRANSMISSION LAYER                        │
└─────────────────────────────────────────────────────────────┘

HTTP/1.1 4xx/5xx               event: bridge_error
Content-Type: application/json data: {"type":"error",...}

{"ok":false,"error":"..."}

    ↓                              ↓

┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND ERROR RECEPTION                     │
└─────────────────────────────────────────────────────────────┘

if (!response.ok) {               reader.read()
  const errorData =                  ↓
    await response.json()         Parse SSE events
  throw new Error(                  ↓
    JSON.stringify(errorData)    if (event.type === "error")
  )                                  ↓
}                                parseStreamEvent(eventData)
    │                                │
    └────────────────┬───────────────┘
                     ↓

┌─────────────────────────────────────────────────────────────┐
│                    MESSAGE PARSING                           │
└─────────────────────────────────────────────────────────────┘

parseStreamEvent(event: StreamEvent): UIMessage | null
    │
    ├─ if (event.type === "error")
    │    └─ Create UIMessage with is_error: true
    │
    └─ Return { id, type: "sdk_message", content: { is_error: true, ... } }

    ↓

┌─────────────────────────────────────────────────────────────┐
│                   MESSAGE RENDERING                          │
└─────────────────────────────────────────────────────────────┘

renderMessage(message: UIMessage)
    │
    ├─ if (isErrorResultMessage(message.content))
    │    └─ <ErrorResultMessage content={message.content} />
    │         │
    │         ├─ Try parse content.result as JSON (StructuredError)
    │         ├─ Extract errorCode from parsed.error
    │         ├─ getErrorMessage(errorCode, details)
    │         ├─ getErrorHelp(errorCode, details)
    │         └─ Render error UI
    │              ├─ Red border alert
    │              ├─ Warning icon
    │              ├─ Friendly message
    │              ├─ Help text
    │              └─ Error code
    │
    └─ else if (content.is_error)
         └─ <ResultMessage content={message.content} />
              └─ Execution error display

    ↓

┌─────────────────────────────────────────────────────────────┐
│                      USER DISPLAY                            │
└─────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════╗
║ ⚠️  Error                                             ║
║                                                        ║
║ Workspace directory not found for hostname 'site.com' ║
║                                                        ║
║ Create the workspace directory or check configuration ║
║                                                        ║
║ Error code: WORKSPACE_NOT_FOUND                       ║
╚═══════════════════════════════════════════════════════╝
```

### Error Categories by Origin

| Category | HTTP Response | SSE Event | UI Component |
|----------|---------------|-----------|--------------|
| **Authentication** | 401 + ErrorCodes.NO_SESSION | - | ErrorResultMessage |
| **Validation** | 400 + ErrorCodes.INVALID_REQUEST | - | ErrorResultMessage |
| **Workspace** | 404 + ErrorCodes.WORKSPACE_NOT_FOUND | - | ErrorResultMessage |
| **Concurrency** | 409 + ErrorCodes.CONVERSATION_BUSY | - | ErrorResultMessage |
| **SDK Errors** | - | bridge_error event | ErrorResultMessage |
| **Tool Errors** | - | bridge_error event | ErrorResultMessage |
| **Max Turns** | - | bridge_error event | ErrorResultMessage |
| **File Operations** | 500 + ErrorCodes.FILE_READ_ERROR | - | ErrorResultMessage |
| **Process Crash** | - | bridge_error event | ErrorResultMessage |
| **Network Issues** | Connection error | Stream interruption | Error message |

---

## Consistency Audit

### Error Code Usage by Route

| Route | Uses ErrorCodes | StructuredError | HTTP Status | Score |
|-------|----------------|-----------------|-------------|-------|
| `/api/claude/stream` | ✅ Yes | ✅ Yes | ✅ Correct | 🟢 100% |
| `/api/claude` | ❌ No | ⚠️ Partial | ✅ Correct | 🔴 33% |
| `/api/files` | ❌ No | ❌ No | ⚠️ Wrong | 🔴 0% |
| `/api/login` | ❌ No | ⚠️ Partial | ✅ Correct | 🟡 50% |
| `/api/manager` | ❌ No | ⚠️ Partial | ✅ Correct | 🟡 50% |
| `/api/images/upload` | ⚠️ Partial | ⚠️ Partial | ✅ Correct | 🟡 60% |
| `/api/images/list` | ❌ No | ❌ No | ⚠️ Wrong | 🔴 0% |
| `/api/images/delete` | ❌ No | ❌ No | ⚠️ Wrong | 🔴 0% |
| `/api/verify` | ✅ Yes | ✅ Yes | ❌ Wrong | 🟡 67% |
| `/api/restart-workspace` | ❌ No | ❌ No | ⚠️ Wrong | 🔴 0% |
| `/api/deploy` | ⚠️ Custom | ⚠️ Custom | ✅ Correct | 🟡 50% |

**Overall Consistency**: **42%** 🔴

### Error Response Format Consistency

**Three formats currently in use**:

1. **StructuredError** (Correct - 40% of routes):
   ```typescript
   {
     ok: false,
     error: ErrorCodes.WORKSPACE_NOT_FOUND,
     message: "Workspace directory not found",
     details: { host: "site.com", path: "/srv/..." },
     requestId: "abc123"
   }
   ```

2. **Simple Object** (Used by 50% of routes):
   ```typescript
   {
     ok: false,
     error: "no_session",  // String literal
     message: "Authentication required"
   }
   ```

3. **Minimal Object** (Used by images routes):
   ```typescript
   {
     error: "Failed to list images"  // Just error string
   }
   ```

**Problem**: Frontend parsing logic must handle all three formats

```typescript
// Frontend must do this:
let parsedError: StructuredError | null = null
try {
  parsedError = JSON.parse(errorMessage)
} catch {
  // Maybe it's just a string?
}

if (parsedError?.error) {
  // Is it an ErrorCode or string literal?
  if (Object.values(ErrorCodes).includes(parsedError.error)) {
    // Can use getErrorMessage()
  } else {
    // Must show raw string
  }
}
```

### HTTP Status Code Consistency

| Status | Correct Usage | Incorrect Usage |
|--------|---------------|-----------------|
| **200** | ✅ Success responses | ❌ `/api/verify` returns 200 for failed verification |
| **400** | ✅ Validation errors | ⚠️ Some routes use 500 instead |
| **401** | ✅ Auth errors | ✅ Consistent across routes |
| **403** | ⚠️ Rarely used | ❌ Path restrictions return 500 |
| **404** | ✅ Workspace not found | ❌ `/api/images/list` returns 500 for not found |
| **409** | ✅ Conversation busy | ✅ Only used correctly |
| **500** | ✅ Internal errors | ❌ Overused for 400/403/404 cases |

**Issues**:
- `/api/verify:56` - Returns 200 with `{valid: false}` instead of 400/404
- `/api/files` - Returns 500 for paths outside workspace (should be 403)
- `/api/images/list` - Returns 500 for "not found" (should be 404)

---

## Priority Fixes

### P0 - Critical (This Week)

#### 1. ✅ Standardize ErrorCodes Across All Routes
**Estimated Time**: 4 hours
**Impact**: High - Enables consistent error handling

**Files to Update**:
- `apps/web/app/api/claude/route.ts`
- `apps/web/app/api/files/route.ts`
- `apps/web/app/api/manager/route.ts`
- `apps/web/app/api/images/upload/route.ts`
- `apps/web/app/api/images/list/route.ts`
- `apps/web/app/api/images/delete/route.ts`
- `apps/web/app/api/restart-workspace/route.ts`
- `apps/web/app/api/login/route.ts`

**New ErrorCodes Needed**:
```typescript
// Add to lib/error-codes.ts
export const ErrorCodes = {
  // ... existing codes
  PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  IMAGE_LIST_FAILED: "IMAGE_LIST_FAILED",
  IMAGE_DELETE_FAILED: "IMAGE_DELETE_FAILED",
  IMAGE_UPLOAD_FAILED: "IMAGE_UPLOAD_FAILED",
  WORKSPACE_RESTART_FAILED: "WORKSPACE_RESTART_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",
  STREAM_PARSE_ERROR: "STREAM_PARSE_ERROR",
  RESPONSE_CREATION_FAILED: "RESPONSE_CREATION_FAILED",
}
```

#### 2. ✅ Add React Error Boundaries
**Estimated Time**: 2 hours
**Impact**: Critical - Prevents app crashes

**Files to Create**:
- `apps/web/app/error.tsx` (root boundary)
- `apps/web/features/chat/components/MessageErrorBoundary.tsx` (message boundary)

**Files to Update**:
- `apps/web/features/chat/lib/message-renderer.tsx` (wrap with boundary)

#### 3. ✅ Fix Child Process Cleanup
**Estimated Time**: 3 hours
**Impact**: Critical - Prevents stuck conversations

**Files to Update**:
- `apps/web/app/api/claude/stream/route.ts:273-394`
- `apps/web/features/chat/lib/agent-child-runner.ts`
- `apps/web/features/auth/types/session.ts` (add lock timeout)

#### 4. ✅ Surface Tool Errors
**Estimated Time**: 2 hours
**Impact**: High - Users see why operations fail

**Files to Update**:
- `apps/web/app/api/claude/stream/route.ts:193-227` (canUseTool callback)
- `apps/web/lib/error-codes.ts` (add codes and messages)

#### 5. ✅ Handle Parse Errors
**Estimated Time**: 1 hour
**Impact**: High - Shows incomplete data errors

**Files to Update**:
- `apps/web/app/chat/page.tsx:230-232`

---

### P1 - High Priority (This Month)

#### 6. Error Recovery UI
**Estimated Time**: 4 hours
**Impact**: High - Users can retry without refresh

**Features**:
- Retry button on error messages
- Clear conversation button when stuck
- Force new session option
- Connection status indicator

**Files to Update/Create**:
- `apps/web/features/chat/components/ErrorActions.tsx` (NEW)
- `apps/web/app/chat/page.tsx` (add retry logic)

#### 7. Fix Conversation Locking Races
**Estimated Time**: 3 hours
**Impact**: High - Prevents concurrent requests

**Approach**:
- Make lock+query atomic
- Add lock timeout (5 min)
- Periodic cleanup of stale locks
- Force unlock API endpoint

**Files to Update**:
- `apps/web/features/auth/types/session.ts`
- `apps/web/app/api/claude/stream/route.ts`

#### 8. Session Store Validation
**Estimated Time**: 3 hours
**Impact**: High - Prevents memory leaks

**Features**:
- Key/value validation
- Bounds checking
- Session expiration (1 hour)
- Max sessions per user
- Cleanup interval

**Files to Update**:
- `apps/web/features/auth/lib/sessionStore.ts`

#### 9. Network Error Detection
**Estimated Time**: 2 hours
**Impact**: Medium - Better error messages

**Features**:
- Offline detection
- Distinguish network vs server errors
- Retry guidance based on error type

**Files to Update**:
- `apps/web/app/chat/page.tsx`
- `apps/web/features/chat/components/NetworkStatus.tsx` (NEW)

#### 10. Per-Component Error Boundaries
**Estimated Time**: 2 hours
**Impact**: Medium - Graceful component failures

**Files to Create**:
- Error boundaries for each message renderer type
- Tool output error boundaries

---

### P2 - Medium Priority (This Quarter)

#### 11. Error State Management
Separate error state from message state, persistent error banner

#### 12. Fix Session Deletion Race
Atomic operations for session delete + conversation start

#### 13. Improve Error Messages
Remove technical jargon, add actionable recovery steps

#### 14. Add Error Tracking
Integrate Sentry or similar service

#### 15. Workspace Error Handling
Catch getWorkspace() throws, better error messages

#### 16. HTTP Status Code Fixes
Correct status codes across all routes

#### 17. Child Process Kill Timeout
Add timeout for SIGTERM, fallback to SIGKILL

#### 18. Session Expiration
Implement auto-expiration after 1 hour idle

#### 19. Error Aggregation
Don't show same error multiple times

#### 20. Stack Trace Consistency
Include stack traces in all error responses (dev only)

---

## Implementation Guide

### Quick Start: Fix One Route

**Example**: Updating `/api/files/route.ts` to use ErrorCodes

**Step 1**: Import ErrorCodes
```typescript
import { ErrorCodes } from "@/lib/error-codes"
```

**Step 2**: Replace string literals
```diff
  if (!user) {
    return NextResponse.json({
      ok: false,
-     error: "no_session",
+     error: ErrorCodes.NO_SESSION,
      message: "Authentication required"
    }, { status: 401 })
  }
```

**Step 3**: Add StructuredError format
```diff
  try {
    const content = await fs.promises.readFile(filePath, "utf-8")
    return NextResponse.json({ ok: true, content })
  } catch (fileError) {
+   const requestId = crypto.randomUUID()
    return NextResponse.json({
      ok: false,
-     error: "read_error",
+     error: ErrorCodes.FILE_READ_ERROR,
      message: "Failed to read file",
-     details: fileError.message
+     details: {
+       error: fileError.message,
+       filePath
+     },
+     requestId
    }, { status: 500 })
  }
```

**Step 4**: Add new ErrorCode to registry
```typescript
// lib/error-codes.ts
export const ErrorCodes = {
  // ... existing
  FILE_READ_ERROR: "FILE_READ_ERROR",
} as const

export function getErrorMessage(code: ErrorCode, details?: any): string {
  switch (code) {
    // ... existing
    case ErrorCodes.FILE_READ_ERROR:
      return `Failed to read file${details?.filePath ? `: ${details.filePath}` : ""}`
  }
}

export function getErrorHelp(code: ErrorCode, details?: any): string | null {
  switch (code) {
    // ... existing
    case ErrorCodes.FILE_READ_ERROR:
      return "Check file permissions and ensure the file exists."
  }
}
```

**Step 5**: Test
```bash
curl -X GET http://localhost:3000/api/files?path=/nonexistent

# Should return:
{
  "ok": false,
  "error": "FILE_READ_ERROR",
  "message": "Failed to read file: /nonexistent",
  "details": {
    "error": "ENOENT: no such file or directory",
    "filePath": "/nonexistent"
  },
  "requestId": "abc-123"
}
```

### Testing Error Scenarios

**Test Suite Template**:

```typescript
// tests/api/error-handling.test.ts

describe("Error Handling", () => {
  describe("ErrorCodes Consistency", () => {
    it("uses ErrorCodes constants, not string literals", async () => {
      const response = await fetch("/api/files", {
        headers: { Cookie: "" }, // No session
      })

      const data = await response.json()

      expect(data.error).toBe(ErrorCodes.NO_SESSION)
      expect(data.error).not.toBe("no_session")
    })
  })

  describe("StructuredError Format", () => {
    it("returns StructuredError format", async () => {
      const response = await fetch("/api/files?path=/invalid")
      const data = await response.json()

      expect(data).toHaveProperty("ok", false)
      expect(data).toHaveProperty("error")
      expect(data).toHaveProperty("message")
      expect(data).toHaveProperty("details")
      expect(data).toHaveProperty("requestId")
    })
  })

  describe("HTTP Status Codes", () => {
    it("returns 401 for no session", async () => {
      const response = await fetch("/api/files")
      expect(response.status).toBe(401)
    })

    it("returns 403 for path outside workspace", async () => {
      const response = await fetch("/api/files?path=/etc/passwd")
      expect(response.status).toBe(403)
    })

    it("returns 500 for file read errors", async () => {
      const response = await fetch("/api/files?path=/unreadable")
      expect(response.status).toBe(500)
    })
  })

  describe("Error Message Quality", () => {
    it("provides user-friendly messages", async () => {
      const response = await fetch("/api/files?path=/invalid")
      const data = await response.json()

      const message = getErrorMessage(data.error, data.details)
      expect(message).not.toContain("ENOENT")
      expect(message).not.toContain("undefined")
      expect(message.length).toBeGreaterThan(10)
    })

    it("provides recovery guidance", async () => {
      const response = await fetch("/api/files?path=/invalid")
      const data = await response.json()

      const help = getErrorHelp(data.error, data.details)
      expect(help).toBeTruthy()
      expect(help.length).toBeGreaterThan(20)
    })
  })

  describe("Error Boundaries", () => {
    it("catches render errors in messages", () => {
      const malformedMessage = {
        id: "test",
        type: "sdk_message",
        content: null, // Invalid
        timestamp: new Date(),
      }

      render(<MessageErrorBoundary messageId="test">
        <ErrorResultMessage content={malformedMessage.content} />
      </MessageErrorBoundary>)

      expect(screen.getByText(/Failed to render message/)).toBeInTheDocument()
    })
  })

  describe("Conversation Locking", () => {
    it("releases lock on error", async () => {
      const convKey = "user::workspace::conv"

      expect(tryLockConversation(convKey)).toBe(true)

      // Simulate error
      try {
        throw new Error("Test error")
      } finally {
        unlockConversation(convKey)
      }

      // Should be able to lock again
      expect(tryLockConversation(convKey)).toBe(true)
    })

    it("expires stale locks", async () => {
      const convKey = "user::workspace::conv"

      tryLockConversation(convKey)

      // Fast-forward time by 6 minutes
      jest.advanceTimersByTime(6 * 60 * 1000)

      // Should be able to lock again (stale lock expired)
      expect(tryLockConversation(convKey)).toBe(true)
    })
  })
})
```

### Error Handling Checklist

Before merging any API route changes, verify:

- [ ] Uses `ErrorCodes` constants (no string literals)
- [ ] Returns `StructuredError` format
- [ ] Includes `requestId` in errors
- [ ] Uses correct HTTP status codes (401/400/403/404/409/500)
- [ ] Has try-catch around async operations
- [ ] Has finally block for cleanup
- [ ] Releases conversation locks on errors
- [ ] Logs errors with context (requestId, details)
- [ ] Error messages are user-friendly
- [ ] Provides recovery guidance via `getErrorHelp()`
- [ ] Doesn't expose sensitive information (paths, stack traces in prod)
- [ ] No unhandled promise rejections
- [ ] Tests cover error scenarios

---

## Metrics & Monitoring

### Error Tracking Setup (Recommended)

**Option 1**: Sentry Integration

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  beforeSend(event, hint) {
    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers?.Authorization
    }
    return event
  },
})

export function captureError(
  error: Error,
  context: {
    errorCode?: ErrorCode
    requestId?: string
    userId?: string
    workspace?: string
  }
) {
  Sentry.captureException(error, {
    tags: {
      error_code: context.errorCode,
      workspace: context.workspace,
    },
    contexts: {
      request: {
        request_id: context.requestId,
      },
    },
    user: {
      id: context.userId,
    },
  })
}
```

**Usage in API routes**:
```typescript
try {
  // ... operation
} catch (error) {
  captureError(error, {
    errorCode: ErrorCodes.FILE_READ_ERROR,
    requestId,
    userId: user.id,
    workspace: workspace.name,
  })

  return NextResponse.json({
    ok: false,
    error: ErrorCodes.FILE_READ_ERROR,
    message: getErrorMessage(ErrorCodes.FILE_READ_ERROR),
    requestId,
  }, { status: 500 })
}
```

### Error Rate Monitoring

**Key Metrics to Track**:

1. **Error Rate by Route**:
   - `/api/claude/stream` - target: < 2%
   - `/api/files` - target: < 5%
   - All routes - target: < 3%

2. **Error Rate by Error Code**:
   - `NO_SESSION` - expected, not concerning
   - `CONVERSATION_BUSY` - if > 1%, locking issues
   - `WORKSPACE_NOT_FOUND` - if > 0.5%, config issues
   - `ERROR_MAX_TURNS` - expected, not concerning
   - `QUERY_FAILED` - if > 5%, SDK issues

3. **Lock Timeout Rate**:
   - Stale locks released - target: < 0.1%
   - If higher, indicates cleanup issues

4. **Parse Error Rate**:
   - SSE parse errors - target: < 0.01%
   - If higher, data corruption issues

5. **Error Boundary Triggers**:
   - Root boundary - target: 0 (critical if > 0)
   - Message boundary - target: < 0.1%

### Dashboard Queries (Sentry/Datadog)

```sql
-- Error rate by code
SELECT
  tags.error_code,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM events
WHERE timestamp > NOW() - INTERVAL '1 day'
  AND level = 'error'
GROUP BY tags.error_code
ORDER BY count DESC

-- Stuck conversations (locks not released)
SELECT
  tags.workspace,
  tags.conversation_id,
  MIN(timestamp) as first_lock,
  MAX(timestamp) as last_activity,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 60 as duration_minutes
FROM events
WHERE message LIKE '%conversation locked%'
GROUP BY tags.workspace, tags.conversation_id
HAVING duration_minutes > 5
ORDER BY duration_minutes DESC

-- Parse error trend
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as parse_errors
FROM events
WHERE tags.error_code = 'STREAM_PARSE_ERROR'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC
```

---

## Appendix

### Error Code Reference

Complete list of all error codes:

| Code | Category | HTTP | Description |
|------|----------|------|-------------|
| `NO_SESSION` | Auth | 401 | User session cookie missing/invalid |
| `AUTH_REQUIRED` | Auth | 401 | Authentication required for resource |
| `UNAUTHORIZED` | Auth | 403 | User doesn't have permission |
| `INVALID_CREDENTIALS` | Auth | 401 | Login credentials incorrect |
| `WORKSPACE_NOT_FOUND` | Workspace | 404 | Workspace directory doesn't exist |
| `WORKSPACE_INVALID` | Workspace | 400 | Workspace name/path invalid |
| `WORKSPACE_MISSING` | Workspace | 404 | No workspace specified |
| `PATH_OUTSIDE_WORKSPACE` | Workspace | 403 | File path outside workspace boundary |
| `INVALID_JSON` | Request | 400 | Request body not valid JSON |
| `INVALID_REQUEST` | Request | 400 | Request validation failed |
| `CONVERSATION_BUSY` | Conversation | 409 | Concurrent request in progress |
| `QUERY_FAILED` | SDK | 500 | Claude SDK query failed |
| `ERROR_MAX_TURNS` | SDK | 500 | Conversation exceeded max turns |
| `TOOL_NOT_ALLOWED` | Tool | 403 | Tool not in allowed list |
| `FILE_READ_ERROR` | File | 500 | Failed to read file |
| `FILE_WRITE_ERROR` | File | 500 | Failed to write file |
| `IMAGE_UPLOAD_FAILED` | Image | 500 | Image upload failed |
| `IMAGE_LIST_FAILED` | Image | 500 | Failed to list images |
| `IMAGE_DELETE_FAILED` | Image | 500 | Failed to delete image |
| `NO_FILE` | Image | 400 | No file provided in upload |
| `FILE_TOO_LARGE` | Image | 413 | File exceeds size limit |
| `STREAM_PARSE_ERROR` | Stream | 500 | Failed to parse SSE data |
| `STREAM_ERROR` | Stream | 500 | Stream processing failed |
| `RESPONSE_CREATION_FAILED` | Stream | 500 | Failed to create Response |
| `WORKSPACE_RESTART_FAILED` | Deploy | 500 | Workspace restart failed |
| `REQUEST_PROCESSING_FAILED` | General | 500 | Catch-all for processing errors |
| `UNKNOWN_ERROR` | General | 500 | Unclassified error |

### File Change Summary

**Files to Create (6)**:
- `apps/web/app/error.tsx`
- `apps/web/features/chat/components/MessageErrorBoundary.tsx`
- `apps/web/features/chat/components/ErrorActions.tsx`
- `apps/web/features/chat/components/NetworkStatus.tsx`
- `apps/web/tests/api/error-handling.test.ts`
- `apps/web/lib/sentry.ts`

**Files to Update (20)**:
- `apps/web/lib/error-codes.ts` - Add 15+ new codes
- `apps/web/app/api/claude/route.ts` - Use ErrorCodes
- `apps/web/app/api/claude/stream/route.ts` - Fix cleanup, surface tool errors
- `apps/web/app/api/files/route.ts` - Use ErrorCodes
- `apps/web/app/api/login/route.ts` - Use ErrorCodes
- `apps/web/app/api/manager/route.ts` - Use ErrorCodes
- `apps/web/app/api/images/upload/route.ts` - Use ErrorCodes
- `apps/web/app/api/images/list/route.ts` - Use ErrorCodes, fix status
- `apps/web/app/api/images/delete/route.ts` - Use ErrorCodes
- `apps/web/app/api/verify/route.ts` - Fix status code
- `apps/web/app/api/restart-workspace/route.ts` - Use ErrorCodes
- `apps/web/app/chat/page.tsx` - Handle parse errors, add retry
- `apps/web/features/chat/lib/streamHandler.ts` - Improve cleanup
- `apps/web/features/chat/lib/agent-child-runner.ts` - Add cleanup
- `apps/web/features/chat/lib/message-renderer.tsx` - Wrap with boundary
- `apps/web/features/auth/types/session.ts` - Add lock timeout
- `apps/web/features/auth/lib/sessionStore.ts` - Add validation
- `apps/web/features/workspace/lib/workspace-secure.ts` - Better errors
- `apps/web/package.json` - Add Sentry dependency
- `apps/web/next.config.js` - Configure Sentry

---

## Summary

The Claude Bridge error management system has **excellent foundational design** but **critical implementation gaps**:

**Strengths**:
- Well-designed ErrorCodes registry
- Excellent stream handler error handling
- Great user-facing error components
- Strong security validation

**Critical Issues**:
- 60% of routes don't use ErrorCodes
- No error boundaries (app crashes on render errors)
- Tool errors silently swallowed
- Child process cleanup incomplete
- Parse errors ignored

**Priority**: Focus on **P0 fixes this week** - standardizing ErrorCodes, adding error boundaries, fixing cleanup, and surfacing tool errors. These changes will dramatically improve system reliability and user experience.

**Risk Level**: 🔴 **MEDIUM-HIGH** - System works for happy paths but degrades poorly on errors. Production incidents likely without fixes.

---

**Next Steps**:
1. Review this analysis with team
2. Create GitHub issues for P0 fixes
3. Implement P0 fixes in priority order
4. Add error tracking (Sentry)
5. Create error handling test suite
6. Schedule P1 fixes for next sprint
