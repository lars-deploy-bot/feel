# PR 1: Backend Session Keys

## Status: [x] Complete

## Checklist

- [x] Update `types/guards/api.ts` - Make `tabId` required in Zod schema
- [x] Update `features/auth/lib/sessionStore.ts` - Add `tabKey()` function
- [x] Update `app/api/claude/stream/route.ts` - Use `tabKey()` for session and lock
- [x] Update `app/api/claude/stream/cancel/route.ts` - Use `tabId` for fallback cancellation
- [x] Update `app/api/claude/stream/reconnect/route.ts` - Use `tabKey()` for lookup
- [x] Test: Type check passes

## Files Modified

### 1. `apps/web/types/guards/api.ts`
- Made `tabId` required (was optional)

### 2. `apps/web/features/auth/lib/sessionStore.ts`
- Added `tabKey({ userId, workspace, tabId })` function
- Key format: `${userId}::${workspace}::${tabId}`

### 3. `apps/web/app/api/claude/stream/route.ts`
- Session key now uses `tabKey()` with `tabId`
- Lock key is now identical to session key

### 4. `apps/web/app/api/claude/stream/cancel/route.ts`
- Fallback cancellation now uses `tabId` instead of `conversationId`
- Builds `tabKey` for registry lookup

### 5. `apps/web/app/api/claude/stream/reconnect/route.ts`
- Uses `tabKey()` for stream buffer lookup

## Notes

- Tests for cancel endpoint still use `conversationId` - deferred to PR 8
- The `sessionKey()` function is deprecated, use `tabKey()` instead
