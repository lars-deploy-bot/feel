# Error Management Documentation

This directory contains comprehensive documentation about error handling in Claude Bridge.

## Status: ✅ Complete

**All P0 critical fixes have been implemented and documented.**

## Documents

### 1. [Error System Analysis](./error-system-analysis.md)
**Status**: ✅ Complete - Initial analysis (November 5, 2025)

Complete analysis of the error messaging system including:
- **What's Good**: Strong error infrastructure design (ErrorCodes, streamHandler, ErrorResultMessage)
- **What's Bad**: 60% of routes didn't use ErrorCodes, no error boundaries, cleanup issues
- **Critical Issues**: 5 high-severity problems identified
- **Priority Fixes**: Detailed implementation guide for P0/P1/P2 fixes

**Original Findings**:
- Overall System Consistency: **42%** 🔴
- Error Code Adoption: Only **40%** of routes used ErrorCodes
- Risk Level: **MEDIUM-HIGH** - Worked for happy paths, degraded poorly on errors

### 2. [Implementation Progress](./implementation-progress.md)
**Status**: ✅ Complete - All P0 fixes implemented

Tracks implementation of all critical fixes:
- ✅ Added 13 new ErrorCodes
- ✅ Standardized all API routes (100% coverage)
- ✅ Created root error boundary
- ✅ Created message-level error boundary
- ✅ Implemented conversation lock timeouts
- ✅ Surfaced tool errors to users
- ✅ Added parse error circuit breaker
- ✅ Fixed child process cleanup

### 3. [Backend-Frontend Connection Fixes](./BACKEND-FRONTEND-FIXES.md)
**Status**: ✅ Complete - Type safety improvements

Fixed critical type mismatches between backend and frontend:
- ✅ Fixed ErrorEventData types (string → ErrorCode)
- ✅ Added 8 missing ErrorCodes to registry
- ✅ Fixed routes using string literals
- ✅ Frontend now uses getErrorMessage/getErrorHelp
- ✅ HTTP errors show user-friendly messages

### 4. [Actionable Error Messages](./ACTIONABLE-MESSAGES.md)
**Status**: ✅ Complete - All messages rewritten

Rewrote all 36 error messages to be user-friendly:
- ✅ Use "I" (Claude speaking directly)
- ✅ Explain why error happened
- ✅ Tell user what to do next
- ✅ Use plain English (no jargon)
- ✅ Be specific when possible

### 5. [User vs Backend Messages Analysis](./USER-VS-BACKEND-MESSAGES.md)
**Status**: ✅ Complete - Architecture clarified

Analyzed whether we need separate user-facing vs backend error messages:
- **Answer**: NO - One system used consistently
- **Solution**: Backend uses getErrorMessage() for responses
- **Backend logs**: Remain technical (for developers)
- **API responses**: User-friendly (for end users)

### 6. [Consistent Error Messages Implementation](./CONSISTENT-ERROR-MESSAGES.md)
**Status**: ✅ Complete - All routes updated

Implemented consistent error message usage across all routes:
- ✅ Updated 4 API routes (files, login, verify, manager/status)
- ✅ Changed 11 hardcoded messages to use getErrorMessage()
- ✅ Added optional help field to StructuredError
- ✅ Backend now consistently uses error registry

**Result**: 100% of routes now use ErrorCodes + getErrorMessage()

## Quick Links

### Critical Issues (P0 - Fix This Week)

1. **ErrorCodes Not Used** → [Issue #1](./error-system-analysis.md#issue-1-errorcodes-not-used-60-of-routes)
   - 60% of routes use string literals instead of ErrorCodes constants
   - Frontend error matching breaks
   - 8 files need updating

2. **No React Error Boundaries** → [Issue #2](./error-system-analysis.md#issue-2-no-react-error-boundaries)
   - Any render error crashes entire app
   - Users see blank screen
   - Need to create `apps/web/app/error.tsx`

3. **Tool Errors Silently Swallowed** → [Issue #3](./error-system-analysis.md#issue-3-tool-errors-silently-swallowed)
   - Permission denials never shown to users
   - File path validation errors invisible
   - Need to surface errors via SSE events

4. **Child Process Cleanup Incomplete** → [Issue #4](./error-system-analysis.md#issue-4-child-process-cleanup-incomplete)
   - Conversation locks persist forever on errors
   - Users get permanent 409 errors
   - Response creation needs try-catch

5. **Parse Errors Silently Ignored** → [Issue #5](./error-system-analysis.md#issue-5-parse-errors-silently-ignored)
   - Malformed SSE data skipped silently
   - Critical error events can be missed
   - Users see incomplete data as complete

### Implementation Guides

- [Quick Start: Fix One Route](./error-system-analysis.md#quick-start-fix-one-route)
- [Testing Error Scenarios](./error-system-analysis.md#testing-error-scenarios)
- [Error Handling Checklist](./error-system-analysis.md#error-handling-checklist)
- [Metrics & Monitoring](./error-system-analysis.md#metrics--monitoring)

### Reference

- [Error Code Reference](./error-system-analysis.md#error-code-reference) - All error codes with descriptions
- [Error Flow Analysis](./error-system-analysis.md#error-flow-analysis) - Complete propagation path
- [Consistency Audit](./error-system-analysis.md#consistency-audit) - Route-by-route scorecard
- [File Change Summary](./error-system-analysis.md#file-change-summary) - All files needing updates

## Error Handling Standards

All API routes should follow these standards:

### ✅ Required

1. **Use ErrorCodes constants** - No string literals
2. **Return StructuredError format** - `{ ok, error, message, details, requestId }`
3. **Include requestId** - For tracing and debugging
4. **Use correct HTTP status codes** - 401/400/403/404/409/500
5. **Try-catch around async ops** - No unhandled rejections
6. **Finally block for cleanup** - Release locks, close streams
7. **User-friendly messages** - Via `getErrorMessage()`
8. **Recovery guidance** - Via `getErrorHelp()`

### ❌ Avoid

1. String literal error codes
2. Exposing internal paths/stack traces in production
3. Generic error messages like "Something went wrong"
4. Silently catching errors without logging
5. Missing cleanup in error paths
6. Leaving resources locked on errors

## Example: Proper Error Handling

```typescript
import { ErrorCodes, getErrorMessage, getErrorHelp } from "@/lib/error-codes"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const requestId = crypto.randomUUID()
  let convKey: string | null = null

  try {
    // Validation
    const body = await req.json()

    // Acquire lock
    convKey = `${user.id}::${workspace}::${conversationId}`
    if (!tryLockConversation(convKey)) {
      return NextResponse.json({
        ok: false,
        error: ErrorCodes.CONVERSATION_BUSY,
        message: getErrorMessage(ErrorCodes.CONVERSATION_BUSY),
        requestId
      }, { status: 409 })
    }

    // Operation
    const result = await doOperation()

    return NextResponse.json({ ok: true, result })

  } catch (error) {
    console.error(`[API ${requestId}] Error:`, error)

    return NextResponse.json({
      ok: false,
      error: ErrorCodes.OPERATION_FAILED,
      message: getErrorMessage(ErrorCodes.OPERATION_FAILED),
      details: { error: error.message },
      requestId
    }, { status: 500 })

  } finally {
    // Always cleanup
    if (convKey) {
      unlockConversation(convKey)
    }
  }
}
```

## Testing

Before committing error handling changes:

```bash
# Run error handling tests
bun test tests/api/error-handling.test.ts

# Check consistency
bun run lint

# Manual testing checklist:
# - [ ] Error shows user-friendly message
# - [ ] Error includes recovery guidance
# - [ ] Conversation lock released on error
# - [ ] No unhandled promise rejections
# - [ ] Stack trace not exposed in production
# - [ ] RequestId logged for tracing
```

## Monitoring

Key metrics to track:

- **Error Rate by Route**: Target < 3%
- **Error Rate by Code**: `QUERY_FAILED` target < 5%
- **Lock Timeout Rate**: Target < 0.1%
- **Parse Error Rate**: Target < 0.01%
- **Error Boundary Triggers**: Root boundary target = 0

See [Metrics & Monitoring](./error-system-analysis.md#metrics--monitoring) for dashboard queries.

## Getting Help

- **For implementation questions**: See [Implementation Guide](./error-system-analysis.md#implementation-guide)
- **For error code questions**: See [Error Code Reference](./error-system-analysis.md#error-code-reference)
- **For debugging**: Check `requestId` in logs and error responses

## Current Status

**Last Updated**: November 5, 2025
**Overall Health**: ✅ **95% Consistent** (was 42%)
**P0 Fixes Completed**: 10/10 ✅
**ErrorCode Adoption**: **100%** (was 40%)
**Type Safety**: **100%** (all routes typed)
**User-Friendly Messages**: **100%** (all 36 messages rewritten)

### Summary of Achievements

1. ✅ **ErrorCodes Standardization**: All 10 API routes now use ErrorCodes constants
2. ✅ **Error Boundaries**: Root and message-level boundaries prevent app crashes
3. ✅ **Conversation Locking**: Lock timeouts prevent permanent 409 errors
4. ✅ **Tool Errors**: Now surfaced to users via SSE events
5. ✅ **Parse Errors**: Circuit breaker after 3 consecutive failures
6. ✅ **Backend-Frontend Types**: ErrorEventData now uses ErrorCode type
7. ✅ **Actionable Messages**: All 36 messages rewritten from Claude's perspective
8. ✅ **Consistent Message Usage**: All routes use getErrorMessage()
9. ✅ **Help Text**: Optional help field added to StructuredError
10. ✅ **Child Process Cleanup**: Precise listener removal + cleanup flags

### Remaining Optional Enhancements

- [ ] Backend routes optionally include help field in responses
- [ ] E2E tests for all error scenarios
- [ ] Metrics dashboard for error monitoring
- [ ] Redis-based SessionStore (currently in-memory)

---

**All critical (P0) error handling issues have been resolved.**
