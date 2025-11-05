# User-Facing vs Backend Error Messages Analysis

**Date**: November 5, 2025
**Question**: Should we have separate user-facing and backend error messages?

## Current State Analysis

### 1. Backend Logging (Technical - For Developers)

**Example from `apps/web/app/api/claude/stream/route.ts:220-223`:**
```typescript
console.error(`[Claude Stream ${requestId}] Path containment check failed`)
console.error(`[Claude Stream ${requestId}] Attempted path: ${filePath}`)
console.error(`[Claude Stream ${requestId}] Workspace root: ${workspace.root}`)
console.error(`[Claude Stream ${requestId}] Error: ${containmentError instanceof Error ? containmentError.message : String(containmentError)}`)
```

**Purpose**: Server logs for debugging
**Audience**: Developers
**Content**: Technical details, stack traces, context

### 2. Backend API Responses (Should Be User-Friendly)

**Current Implementation - INCONSISTENT:**

#### ❌ **Bad Example** - Hardcoded Technical Message
`apps/web/app/api/files/route.ts:54`:
```typescript
return NextResponse.json({
  ok: false,
  error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
  message: "Access denied: File path is outside your workspace directory", // ❌ Hardcoded
  details: {
    attemptedPath: resolvedPath,
    workspacePath: resolvedWorkspace,
  },
  requestId,
}, { status: 403 })
```

**Problem**: Message uses technical jargon ("access denied", "workspace directory"), not user-friendly.

#### ✅ **Good Example** - Should Use Registry
`apps/web/lib/error-codes.ts:95-98`:
```typescript
case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
  return details?.attemptedPath
    ? `I cannot access '${details.attemptedPath}' - it's outside my allowed workspace. I can only access files within your project directory.`
    : "I cannot access this file - it's outside my allowed workspace. I can only access files within your project directory."
```

**Benefits**: User-friendly, actionable, from Claude's perspective.

### 3. Frontend Display (Shows Backend Response)

**Example from `apps/web/features/chat/lib/message-parser.ts:154`:**
```typescript
const userMessage = getErrorMessage(errorCode, errorData.details) || errorData.message
const helpText = getErrorHelp(errorCode, errorData.details)
```

**Frontend tries to fix backend's technical messages by calling getErrorMessage().**

This is a **workaround** for backend sending wrong messages.

---

## The Problem: Backend Routes Hardcode Messages

### Routes with Hardcoded Messages

Found **18 hardcoded messages** in API routes:

| File | Line | Hardcoded Message | Should Use |
|------|------|-------------------|------------|
| `api/files/route.ts` | 28 | `"Authentication required"` | `getErrorMessage(ErrorCodes.NO_SESSION)` |
| `api/files/route.ts` | 54 | `"Access denied: File path is outside..."` | `getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, details)` |
| `api/files/route.ts` | 102 | `"Unable to read directory"` | `getErrorMessage(ErrorCodes.FILE_READ_ERROR, details)` |
| `api/files/route.ts` | 118 | `"Failed to process files request"` | `getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED)` |
| `api/login/route.ts` | 17 | `"Invalid login request"` | `getErrorMessage(ErrorCodes.INVALID_REQUEST, details)` |
| `api/login/route.ts` | 47 | `"Invalid credentials"` | `getErrorMessage(ErrorCodes.INVALID_CREDENTIALS)` |
| `api/login/route.ts` | 61 | `"Invalid credentials"` | `getErrorMessage(ErrorCodes.INVALID_CREDENTIALS)` |
| `api/login/route.ts` | 74 | `"Workspace is required"` | `getErrorMessage(ErrorCodes.WORKSPACE_MISSING)` |
| `api/verify/route.ts` | 18 | `"Authentication required - no session cookie found"` | `getErrorMessage(ErrorCodes.NO_SESSION)` |
| `api/verify/route.ts` | 34 | `"Request body is not valid JSON"` | `getErrorMessage(ErrorCodes.INVALID_JSON)` |
| `api/manager/status/route.ts` | 127 | `"Manager authentication required"` | `getErrorMessage(ErrorCodes.UNAUTHORIZED)` |

**Impact**: Users see technical jargon instead of actionable messages.

---

## The Solution: Backend Uses Error Registry

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Error Occurs                                            │
│     └─> console.error("[Route] Technical context...")      │
│         └─> For developers in server logs                  │
│                                                             │
│  2. Build API Response                                      │
│     └─> const message = getErrorMessage(code, details)     │
│     └─> const helpText = getErrorHelp(code, details)       │
│     └─> return NextResponse.json({                         │
│           ok: false,                                        │
│           error: code,                                      │
│           message,  // ✅ User-friendly from registry      │
│           help: helpText,  // ✅ Actionable steps          │
│           details,  // ✅ Structured data                  │
│           requestId                                         │
│         })                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/SSE
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Receive Error Response                                  │
│     └─> { error, message, help, details }                  │
│                                                             │
│  2. Display To User                                         │
│     └─> Show message (already user-friendly)               │
│     └─> Show help text (actionable steps)                  │
│     └─> Show details in dev mode only                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**:
- Backend logs → Technical (for developers)
- Backend responses → User-friendly (for end users)
- Frontend → Just displays what backend sends

---

## Do We Need Two Message Systems?

**Answer: NO - We need ONE system used CONSISTENTLY**

**Why One System Is Better:**

1. **Single Source of Truth**: All error messages in one place (`error-codes.ts`)
2. **Type Safety**: ErrorCode type ensures consistency
3. **Reusability**: Both backend and frontend use same registry
4. **Maintainability**: Change message once, applies everywhere
5. **No Duplication**: Don't maintain two sets of messages

**What Changes:**

1. **Backend routes** must STOP hardcoding messages
2. **Backend routes** must CALL `getErrorMessage(code, details)`
3. **Frontend** can simplify (just display backend's message)

---

## Implementation Plan

### Phase 1: Add getErrorMessage to All Routes ✅ (In Progress)

Update all API routes to use error registry:

```typescript
// BEFORE (apps/web/app/api/files/route.ts:54)
message: "Access denied: File path is outside your workspace directory"

// AFTER
message: getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
  attemptedPath: resolvedPath,
  workspacePath: resolvedWorkspace,
})
```

### Phase 2: Add Optional help Field to StructuredError

Update error type to include help text:

```typescript
export interface StructuredError {
  ok: false
  error: ErrorCode
  message: string  // User-friendly from getErrorMessage()
  help?: string    // NEW: Actionable steps from getErrorHelp()
  details?: Record<string, any> | string
  requestId?: string
}
```

### Phase 3: Simplify Frontend Error Handling

Frontend can trust backend messages:

```typescript
// BEFORE - Frontend had to fix backend's bad messages
const userMessage = getErrorMessage(errorCode, errorData.details) || errorData.message

// AFTER - Just use what backend sent
const userMessage = errorData.message  // Already user-friendly
const helpText = errorData.help || getErrorHelp(errorCode, errorData.details)  // Backend can send or we compute
```

---

## Example: Complete Error Flow

### Scenario: User tries to access `/etc/passwd`

#### 1. Backend Logs (Technical)
```typescript
console.error(`[Claude Stream ${requestId}] Path containment check failed`)
console.error(`[Claude Stream ${requestId}] Attempted path: /etc/passwd`)
console.error(`[Claude Stream ${requestId}] Workspace root: /srv/webalive/sites/example.com/user`)
console.error(`[Claude Stream ${requestId}] Error: Path traversal attempt detected`)
```

**Audience**: Developers
**Purpose**: Debugging, security monitoring

#### 2. Backend Response (User-Friendly)
```typescript
return NextResponse.json({
  ok: false,
  error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
  message: getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
    attemptedPath: '/etc/passwd',
    workspacePath: '/srv/webalive/sites/example.com/user'
  }),
  // Result: "I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory."

  help: getErrorHelp(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
    workspacePath: '/srv/webalive/sites/example.com/user'
  }),
  // Result: "I can only work with files in: /srv/webalive/sites/example.com/user"

  details: {
    attemptedPath: '/etc/passwd',
    workspacePath: '/srv/webalive/sites/example.com/user'
  },
  requestId: 'abc-123'
}, { status: 403 })
```

**Audience**: End users (via frontend)
**Purpose**: Actionable error message

#### 3. Frontend Display
```typescript
<ErrorResultMessage>
  <h3>Error</h3>
  <p>I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.</p>
  <p className="help-text">I can only work with files in: /srv/webalive/sites/example.com/user</p>
  {devMode && <pre>{JSON.stringify(details, null, 2)}</pre>}
</ErrorResultMessage>
```

**What User Sees:**
```
Error
I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.

I can only work with files in: /srv/webalive/sites/example.com/user
```

**What User Understands:**
- Claude cannot access system files
- Only project files are accessible
- The specific workspace path they can use

---

## Benefits of Single System

### Before (Current - Inconsistent):

❌ Backend hardcodes technical messages
❌ Frontend tries to fix them with getErrorMessage()
❌ Duplication (message in route + message in registry)
❌ Risk of mismatch (route message doesn't match registry)
❌ Hard to maintain (change in 2 places)

### After (Proposed - Consistent):

✅ Backend calls getErrorMessage() → sends user-friendly message
✅ Frontend just displays backend's message
✅ Single source of truth (error-codes.ts)
✅ Type-safe (ErrorCode type)
✅ Easy to maintain (change once, applies everywhere)
✅ Backend logs remain technical (console.error)
✅ API responses are user-friendly (getErrorMessage)

---

## When to Use Each Layer

| Layer | Purpose | Audience | Example |
|-------|---------|----------|---------|
| **Backend Logs** (console.error) | Debugging, monitoring | Developers | `[Claude Stream abc-123] Path containment check failed. Attempted: /etc/passwd. Workspace: /srv/...` |
| **Backend Response** (message field) | User communication | End users | `I cannot access '/etc/passwd' - it's outside my allowed workspace...` |
| **Frontend Display** | Visual presentation | End users | Red box with icon, formatted message, help text |

---

## Conclusion

**Answer**: NO, we do NOT need two separate error message systems.

**What We Need**:
1. Backend logs stay technical (already correct)
2. Backend responses use error registry (needs fixing)
3. Frontend trusts backend responses (can simplify)

**Action Required**:
- Fix all 18 routes with hardcoded messages
- Make them call getErrorMessage()
- Optionally add help field to StructuredError
- Simplify frontend error parsing

**Result**:
- ONE message system (error-codes.ts)
- Used consistently by backend and frontend
- Backend logs remain technical for developers
- API responses are user-friendly for end users
- No duplication, no confusion, type-safe

---

## Next Steps

1. Update all API routes to use getErrorMessage()
2. Optionally add help field to StructuredError interface
3. Test all error flows (HTTP errors + SSE errors + tool errors)
4. Document the pattern in CLAUDE.md
5. Verify frontend can simplify error parsing
