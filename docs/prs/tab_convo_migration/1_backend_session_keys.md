# PR 1: Backend Session Keys

**Status**: ⏳ pending
**Depends on**: Nothing
**Estimated time**: 2 hours

## Goal

Change the session key from `conversationId` to `tabId` in all backend code.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. types/guards/api.ts

- [ ] Read current file
- [ ] Change `conversationId: z.string().uuid()` to `conversationId: z.string().uuid().optional()`
- [ ] Change `tabId: z.string().optional()` to `tabId: z.string().uuid()`
- [ ] Update `ValidatedBody` type if needed
- [ ] Verify changes compile: `bun run type-check`

### 2. features/auth/lib/sessionStore.ts

- [ ] Read current file
- [ ] Rename `sessionKey()` to `tabKey()`
- [ ] Update signature: remove `conversationId`, require `tabId`
- [ ] Update key format: `${userId}::${workspace}::${tabId}`
- [ ] Remove `lockKey()` function (now identical to tabKey)
- [ ] Update `parseKey()` to parse `tabId` instead of `conversationId`
- [ ] Update all exports
- [ ] Verify changes compile: `bun run type-check`

### 3. app/api/claude/stream/route.ts

- [ ] Read current file
- [ ] Find all `conversationId` usages
- [ ] Change session lookup to use `tabId` from request body
- [ ] Update calls to `sessionKey()` → `tabKey()` with `tabId`
- [ ] Remove `conversationId` from required fields validation
- [ ] Update session storage to use `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 4. app/api/claude/stream/cancel/route.ts

- [ ] Read current file
- [ ] Change fallback cancellation from `conversationId` to `tabId`
- [ ] Update any session key lookups
- [ ] Verify changes compile: `bun run type-check`

### 5. app/api/claude/stream/reconnect/route.ts

- [ ] Read current file
- [ ] Update inline `ReconnectSchema`: `conversationId` → `tabId`
- [ ] Update session key lookup to use `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 6. lib/api/schemas.ts

- [ ] Read current file
- [ ] Update `claude/stream/cancel` schema: `conversationId` → `tabId`
- [ ] Update `feedback` schema if it has `conversationId`
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] Backend tests pass (may need updates - note failures for PR 8)

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 1 status to ✅ complete
