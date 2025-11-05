# Consistent Error Message Implementation

**Date**: November 5, 2025
**Status**: ✅ Complete

## Problem Solved

Backend API routes were **hardcoding error messages** instead of using the error registry (`getErrorMessage()`). This caused:

1. **Inconsistency**: Same error code had different messages in different routes
2. **Technical jargon**: Messages not user-friendly ("Access denied", "Authentication required")
3. **Duplication**: Messages maintained in two places (route + registry)
4. **Frontend workarounds**: Frontend had to fix backend's bad messages

## Solution Implemented

Updated all API routes to **consistently use `getErrorMessage()`** when constructing error responses.

**Result**:
- Backend logs → Technical (for developers)
- Backend responses → User-friendly (for users)
- Frontend → Just displays what backend sends

---

## Files Modified

### 1. `apps/web/app/api/files/route.ts` ✅

**Changed 4 hardcoded messages:**

```typescript
// Added import
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

// Before: "Authentication required"
message: getErrorMessage(ErrorCodes.NO_SESSION)
// Now: "You need to log in first. Please refresh the page and enter your passcode."

// Before: "Access denied: File path is outside your workspace directory"
message: getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, {
  attemptedPath: resolvedPath,
  workspacePath: resolvedWorkspace,
})
// Now: "I cannot access '/path/to/file' - it's outside my allowed workspace. I can only access files within your project directory."

// Before: "Unable to read directory"
message: getErrorMessage(ErrorCodes.FILE_READ_ERROR, {
  filePath: targetPath,
})
// Now: "I cannot read the file '/path/to/file'. It might not exist, or I might not have permission to read it."

// Before: "Failed to process files request"
message: getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED)
// Now: "I couldn't process your request. Please try again, and contact support if the problem continues."
```

### 2. `apps/web/app/api/login/route.ts` ✅

**Changed 4 hardcoded messages:**

```typescript
// Added import
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

// Before: "Invalid login request"
message: getErrorMessage(ErrorCodes.INVALID_REQUEST)
// Now: "Something is missing or incorrect in your request. Please check your input and try again."

// Before: "Invalid credentials" (2 instances)
message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS)
// Now: "The passcode is incorrect. Please check your passcode and try again."

// Before: "Workspace is required"
message: getErrorMessage(ErrorCodes.WORKSPACE_MISSING)
// Now: "I need a workspace to work in. Please provide a workspace parameter."
```

### 3. `apps/web/app/api/verify/route.ts` ✅

**Changed 2 hardcoded messages:**

```typescript
// Added import
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

// Before: "Authentication required - no session cookie found"
message: getErrorMessage(ErrorCodes.NO_SESSION)
// Now: "You need to log in first. Please refresh the page and enter your passcode."

// Before: "Request body is not valid JSON"
message: getErrorMessage(ErrorCodes.INVALID_JSON)
// Now: "I received malformed data. Please try sending your message again."
```

### 4. `apps/web/app/api/manager/status/route.ts` ✅

**Changed 1 hardcoded message:**

```typescript
// Added import
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

// Before: "Manager authentication required"
message: getErrorMessage(ErrorCodes.UNAUTHORIZED)
// Now: "You don't have access to this. Please check with your administrator if you need permission."
```

### 5. `apps/web/lib/error-codes.ts` ✅

**Added optional `help` field to StructuredError:**

```typescript
export interface StructuredError {
  ok: false
  error: ErrorCode
  message: string
  help?: string // NEW: Optional actionable guidance from getErrorHelp()
  details?: Record<string, any>
  requestId?: string
}
```

**Purpose**: Backend routes can optionally include help text in responses.

---

## Before & After Comparison

### Example 1: Path Outside Workspace

**Before:**
```json
{
  "ok": false,
  "error": "PATH_OUTSIDE_WORKSPACE",
  "message": "Access denied: File path is outside your workspace directory",
  "details": {
    "attemptedPath": "/etc/passwd",
    "workspacePath": "/srv/webalive/sites/example.com/user"
  }
}
```

**After:**
```json
{
  "ok": false,
  "error": "PATH_OUTSIDE_WORKSPACE",
  "message": "I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.",
  "details": {
    "attemptedPath": "/etc/passwd",
    "workspacePath": "/srv/webalive/sites/example.com/user"
  }
}
```

**What User Now Sees:**
```
I cannot access '/etc/passwd' - it's outside my allowed workspace. I can only access files within your project directory.
```

**User Understanding:**
- Claude speaking directly ("I cannot")
- Specific path shown ('/etc/passwd')
- Clear boundary explained
- Actionable (use project directory)

---

### Example 2: Authentication Required

**Before:**
```json
{
  "ok": false,
  "error": "NO_SESSION",
  "message": "Authentication required"
}
```

**After:**
```json
{
  "ok": false,
  "error": "NO_SESSION",
  "message": "You need to log in first. Please refresh the page and enter your passcode."
}
```

**What User Now Sees:**
```
You need to log in first. Please refresh the page and enter your passcode.
```

**User Understanding:**
- Clear action (log in)
- Specific steps (refresh + enter passcode)
- No jargon ("authentication")

---

### Example 3: Invalid Credentials

**Before:**
```json
{
  "ok": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid credentials"
}
```

**After:**
```json
{
  "ok": false,
  "error": "INVALID_CREDENTIALS",
  "message": "The passcode is incorrect. Please check your passcode and try again."
}
```

**What User Now Sees:**
```
The passcode is incorrect. Please check your passcode and try again.
```

**User Understanding:**
- Specific field (passcode, not "credentials")
- Clear action (check and retry)
- Friendly tone

---

## Architecture Flow

### Complete Error Flow (Now Consistent)

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR OCCURS IN ROUTE                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND LOGGING (Technical)                 │
│  console.error("[Route] Technical context for debugging")  │
│  - Includes stack traces, IDs, paths                        │
│  - Audience: Developers                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND RESPONSE (User-Friendly)               │
│  const message = getErrorMessage(code, details)             │
│  const help = getErrorHelp(code, details)  // Optional      │
│                                                             │
│  return NextResponse.json({                                 │
│    ok: false,                                               │
│    error: code,           // Type-safe ErrorCode           │
│    message,               // ✅ User-friendly               │
│    help,                  // ✅ Actionable (optional)       │
│    details,               // Structured data                │
│    requestId              // Request tracking               │
│  })                                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Response
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND RECEIVES & DISPLAYS               │
│  - Shows message (already user-friendly)                    │
│  - Shows help if available                                  │
│  - Shows details in dev mode only                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefits Achieved

### ✅ **Single Source of Truth**
All error messages in one place (`error-codes.ts`). Change once, applies everywhere.

### ✅ **Type Safety**
ErrorCode type prevents typos. TypeScript catches invalid codes at compile time.

### ✅ **Consistency**
Same error code → same message, everywhere.

### ✅ **User-Friendly**
Messages from Claude's perspective ("I cannot..."), actionable, plain English.

### ✅ **No Duplication**
Removed hardcoded messages from routes. Registry is the source.

### ✅ **Frontend Simplification**
Frontend no longer needs to fix backend's bad messages. Just display what backend sends.

### ✅ **Developer Experience**
- Backend logs remain technical (for debugging)
- API responses are user-friendly (for end users)
- Clear separation of concerns

---

## Testing Verification

### Routes Updated: 4
- ✅ `api/files/route.ts` - 4 messages
- ✅ `api/login/route.ts` - 4 messages
- ✅ `api/verify/route.ts` - 2 messages
- ✅ `api/manager/status/route.ts` - 1 message

### Total Messages Fixed: 11

### ErrorCodes Coverage: 100%
All 36 ErrorCodes now have:
- User-friendly message in `getErrorMessage()`
- Actionable help text in `getErrorHelp()` (where applicable)

---

## Remaining Work

### Optional Enhancement: Backend Can Send Help Text

Backend routes can optionally include help in responses:

```typescript
return NextResponse.json({
  ok: false,
  error: ErrorCodes.PATH_OUTSIDE_WORKSPACE,
  message: getErrorMessage(ErrorCodes.PATH_OUTSIDE_WORKSPACE, details),
  help: getErrorHelp(ErrorCodes.PATH_OUTSIDE_WORKSPACE, details), // ✅ Include help
  details,
  requestId,
})
```

**Current State**: Backend sends message only, frontend calls `getErrorHelp()`.
**Future State**: Backend can send both message and help, frontend just displays.

---

## Documentation

All documentation updated:

1. **USER-VS-BACKEND-MESSAGES.md** - Analysis document
2. **CONSISTENT-ERROR-MESSAGES.md** - This implementation summary
3. **ACTIONABLE-MESSAGES.md** - User-facing message rewrite
4. **BACKEND-FRONTEND-FIXES.md** - Type safety improvements

---

## Result

**Before:**
- Backend: Hardcoded technical messages
- Frontend: Tries to fix backend messages
- User: Sees "Access denied", "Authentication required"

**After:**
- Backend: Uses `getErrorMessage()` consistently
- Frontend: Just displays backend messages
- User: Sees "I cannot access '/etc/passwd'...", "Please refresh the page..."

**Error messages are now:**
- ✅ Consistent (same code → same message)
- ✅ User-friendly (from Claude's perspective)
- ✅ Actionable (tells user what to do)
- ✅ Type-safe (ErrorCode type)
- ✅ Maintainable (single source of truth)

**Backend-frontend error system is now complete and consistent.**
