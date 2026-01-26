# PR 3: Streaming Store Refactor

**Status**: ⏳ pending
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

- [ ] Read current file
- [ ] Rename `ConversationStreamState` interface to `TabStreamState`
- [ ] Rename `conversations` map to `tabs` in store state
- [ ] Update `defaultConversationState` to `defaultTabState`
- [ ] Verify changes compile: `bun run type-check`

### 2. lib/stores/streamingStore.ts - Functions (Part 1)

- [ ] Rename `getConversationState` → `getTabState`
- [ ] Rename `updateConversation` → `updateTab`
- [ ] Rename `clearConversation` → `clearTab`
- [ ] Update all `conversationId` parameters to `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 3. lib/stores/streamingStore.ts - Functions (Part 2)

- [ ] Update `recordToolUse(conversationId, ...)` → `recordToolUse(tabId, ...)`
- [ ] Update `getToolName(conversationId, ...)` → `getToolName(tabId, ...)`
- [ ] Update `getToolInput(conversationId, ...)` → `getToolInput(tabId, ...)`
- [ ] Update `clearToolUseMap(conversationId)` → `clearToolUseMap(tabId)`
- [ ] Update `markToolPending(conversationId, ...)` → `markToolPending(tabId, ...)`
- [ ] Update `updateToolProgress(conversationId, ...)` → `updateToolProgress(tabId, ...)`
- [ ] Update `markToolComplete(conversationId, ...)` → `markToolComplete(tabId, ...)`
- [ ] Update `getPendingTools(conversationId)` → `getPendingTools(tabId)`
- [ ] Verify changes compile: `bun run type-check`

### 4. lib/stores/streamingStore.ts - Functions (Part 3)

- [ ] Update `recordError(conversationId, ...)` → `recordError(tabId, ...)`
- [ ] Update `resetConsecutiveErrors(conversationId)` → `resetConsecutiveErrors(tabId)`
- [ ] Update `incrementConsecutiveErrors(conversationId)` → `incrementConsecutiveErrors(tabId)`
- [ ] Update `getConsecutiveErrors(conversationId)` → `getConsecutiveErrors(tabId)`
- [ ] Update `recordSessionId(conversationId, ...)` → `recordSessionId(tabId, ...)`
- [ ] Update `getLastSessionId(conversationId)` → `getLastSessionId(tabId)`
- [ ] Update `startStream(conversationId)` → `startStream(tabId)`
- [ ] Update `recordMessageReceived(conversationId)` → `recordMessageReceived(tabId)`
- [ ] Update `endStream(conversationId)` → `endStream(tabId)`
- [ ] Update `getStreamHealth(conversationId)` → `getStreamHealth(tabId)`
- [ ] Verify changes compile: `bun run type-check`

### 5. lib/stores/streamingStore.ts - Selectors & Exports

- [ ] Rename `useConversationToolMap` → `useTabToolMap`
- [ ] Rename `useConversationErrors` → `useTabErrors`
- [ ] Update `useStreamHealth` parameter from `conversationId` to `tabId`
- [ ] Update `useIsStreamActive` parameter from `conversationId` to `tabId`
- [ ] Update `usePendingTools` parameter from `conversationId` to `tabId`
- [ ] Update `getAbortController(conversationId)` → `getAbortController(tabId)`
- [ ] Update `setAbortController(conversationId, ...)` → `setAbortController(tabId, ...)`
- [ ] Update `clearAbortController(conversationId)` → `clearAbortController(tabId)`
- [ ] Verify changes compile: `bun run type-check`

### 6. Update all callers

- [ ] Search: `grep -r "streamingStore\|useStreamingStore\|useConversationToolMap\|useConversationErrors" apps/web --include="*.ts" --include="*.tsx"`
- [ ] Update each caller to use new function names and `tabId` parameter
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] No remaining references to old function names

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 3 status to ✅ complete
