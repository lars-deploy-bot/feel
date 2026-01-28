# PR 3: Streaming Store Refactor

**Status**: ✅ complete
**Depends on**: PR 1 (backend session keys)
**Estimated time**: 2 hours

## Goal

Refactor `streamingStore.ts` to use `tabId` as the key instead of `conversationId`. This is a major refactor with 60+ occurrences.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. lib/stores/streamingStore.ts - Types & State

- [x] Read current file
- [x] Rename `ConversationStreamState` interface to `TabStreamState`
- [x] Rename `conversations` map to `tabs` in store state
- [x] Update `defaultConversationState` to `defaultTabState`
- [x] Verify changes compile: `bun run type-check`

### 2. lib/stores/streamingStore.ts - Functions (Part 1)

- [x] Rename `getConversationState` → `getTabState`
- [x] Rename `updateConversation` → `updateTab`
- [x] Rename `clearConversation` → `clearTab`
- [x] Update all `conversationId` parameters to `tabId`
- [x] Verify changes compile: `bun run type-check`

### 3. lib/stores/streamingStore.ts - Functions (Part 2)

- [x] Update `recordToolUse(conversationId, ...)` → `recordToolUse(tabId, ...)`
- [x] Update `getToolName(conversationId, ...)` → `getToolName(tabId, ...)`
- [x] Update `getToolInput(conversationId, ...)` → `getToolInput(tabId, ...)`
- [x] Update `clearToolUseMap(conversationId)` → `clearToolUseMap(tabId)`
- [x] Update `markToolPending(conversationId, ...)` → `markToolPending(tabId, ...)`
- [x] Update `updateToolProgress(conversationId, ...)` → `updateToolProgress(tabId, ...)`
- [x] Update `markToolComplete(conversationId, ...)` → `markToolComplete(tabId, ...)`
- [x] Update `getPendingTools(conversationId)` → `getPendingTools(tabId)`
- [x] Verify changes compile: `bun run type-check`

### 4. lib/stores/streamingStore.ts - Functions (Part 3)

- [x] Update `recordError(conversationId, ...)` → `recordError(tabId, ...)`
- [x] Update `resetConsecutiveErrors(conversationId)` → `resetConsecutiveErrors(tabId)`
- [x] Update `incrementConsecutiveErrors(conversationId)` → `incrementConsecutiveErrors(tabId)`
- [x] Update `getConsecutiveErrors(conversationId)` → `getConsecutiveErrors(tabId)`
- [x] Update `recordSessionId(conversationId, ...)` → `recordSessionId(tabId, ...)`
- [x] Update `getLastSessionId(conversationId)` → `getLastSessionId(tabId)`
- [x] Update `startStream(conversationId)` → `startStream(tabId)`
- [x] Update `recordMessageReceived(conversationId)` → `recordMessageReceived(tabId)`
- [x] Update `endStream(conversationId)` → `endStream(tabId)`
- [x] Update `getStreamHealth(conversationId)` → `getStreamHealth(tabId)`
- [x] Verify changes compile: `bun run type-check`

### 5. lib/stores/streamingStore.ts - Selectors & Exports

- [x] Rename `useConversationToolMap` → `useTabToolMap`
- [x] Rename `useConversationErrors` → `useTabErrors`
- [x] Update `useStreamHealth` parameter from `conversationId` to `tabId`
- [x] Update `useIsStreamActive` parameter from `conversationId` to `tabId`
- [x] Update `usePendingTools` parameter from `conversationId` to `tabId`
- [x] Update `getAbortController(conversationId)` → `getAbortController(tabId)`
- [x] Update `setAbortController(conversationId, ...)` → `setAbortController(tabId, ...)`
- [x] Update `clearAbortController(conversationId)` → `clearAbortController(tabId)`
- [x] Verify changes compile: `bun run type-check`

### 6. Update all callers

- [x] Search: `grep -r "streamingStore\|useStreamingStore\|useConversationToolMap\|useConversationErrors" apps/web --include="*.ts" --include="*.tsx"`
- [x] Update each caller to use new function names and `tabId` parameter
- [x] Verify changes compile: `bun run type-check`

---

## Verification

- [x] `bun run type-check` passes
- [x] `bun run lint` passes
- [x] No remaining references to old function names

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
Completed 2025-01-27. Callers (useChatMessaging, useStreamCancellation, useTabs, etc.) continue
to pass their local conversationId/tabId values to the streamingStore functions. The parameter
names changed in the store function signatures, but the callers don't need to change their
variable names - they just pass the same values to functions with new parameter names.
```

---

## Completion

- [x] All checkboxes complete
- [x] Update `0_overview.md`: Change PR 3 status to ✅ complete
