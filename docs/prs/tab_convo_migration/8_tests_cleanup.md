# PR 8: Tests & Cleanup

**Status**: ⏳ pending
**Depends on**: PR 7 (Supabase migration)
**Estimated time**: 3 hours

## Goal

Update all tests to use new `tabId` session key. Delete old code. Update documentation.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. Find all test files with conversationId

- [ ] Run: `grep -r "conversationId" apps/web --include="*.test.ts" --include="*.test.tsx" --include="*.spec.ts"`
- [ ] List all test files below

**Test files to update:**
```
(fill in after grep)
```

### 2. Update backend tests

- [ ] `features/auth/__tests__/sessionStore.test.ts`
  - [ ] Update to test `tabKey()` instead of `sessionKey()`
  - [ ] Update test data to use `tabId`
  - [ ] Verify tests pass

- [ ] `app/api/claude/stream/cancel/__tests__/route.test.ts`
  - [ ] Update to use `tabId` in test requests
  - [ ] Verify tests pass

- [ ] `types/__tests__/api-guards.test.ts`
  - [ ] Update for new schema (tabId required, conversationId optional)
  - [ ] Verify tests pass

- [ ] `types/__tests__/api-key-validation.test.ts`
  - [ ] Update if affected
  - [ ] Verify tests pass

### 3. Update frontend tests

- [ ] `app/chat/hooks/__tests__/tab-isolation.test.ts`
  - [ ] Update for new data model
  - [ ] Verify tests pass

- [ ] `features/chat/hooks/__tests__/useStreamCancellation.test.ts`
  - [ ] Update `conversationId` to `tabId`
  - [ ] Verify tests pass

- [ ] (Add more test files as discovered)

### 4. Update integration tests

- [ ] `lib/stream/__tests__/explicit-cancellation-integration.test.ts`
  - [ ] Update for tabId
  - [ ] Verify tests pass

- [ ] `lib/__tests__/stream-http-abort-integration.test.ts`
  - [ ] Update for tabId
  - [ ] Verify tests pass

- [ ] `lib/__tests__/real-cancellation-e2e.test.ts`
  - [ ] Update for tabId
  - [ ] Verify tests pass

- [ ] `lib/__tests__/stream-abort-then-send.test.ts`
  - [ ] Update for tabId
  - [ ] Verify tests pass

### 5. Update E2E tests

- [ ] `e2e-tests/protection-verification.spec.ts`
  - [ ] Update for tabId if affected
  - [ ] Verify tests pass

- [ ] `e2e-tests/chat-genuine.spec.ts`
  - [ ] Update for tabId if affected
  - [ ] Verify tests pass

### 6. Bump Dexie schema version

- [ ] Find Dexie schema definition in `lib/db/messageDb.ts`
- [ ] Increment schema version number
- [ ] This forces IndexedDB migration on next load

### 7. Delete old code

- [ ] Verify `lib/stores/messageStore.ts` is deleted (from PR 4)
- [ ] Verify `lib/stores/sessionStore.ts` is deleted or simplified (from PR 5)
- [ ] Delete `lib/db/migrateLegacyStorage.ts` if no longer needed
- [ ] Search for any orphaned imports and fix

### 8. Update documentation

- [ ] Update `CLAUDE.md` session management section
- [ ] Update any architecture docs that mention conversationId as session key
- [ ] Update `docs/prs/tab_becomes_conversation.md` - mark as implemented

### 9. Final verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes (all unit tests)
- [ ] `bun run test:e2e` passes (if applicable)
- [ ] Manual smoke test: create chat, send message, switch tabs, reconnect

---

## Test Run Log

Record test results here:

```
bun run test:
(paste output)

bun run test:e2e:
(paste output)
```

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] All tests pass
- [ ] Update `0_overview.md`: Change PR 8 status to ✅ complete
- [ ] Update `0_overview.md`: Mark entire migration as complete
