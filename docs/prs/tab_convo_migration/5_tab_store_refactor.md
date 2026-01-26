# PR 5: Tab Store Refactor

**Status**: ⏳ pending
**Depends on**: PR 4 (delete messageStore)
**Estimated time**: 1.5 hours

## Goal

Make Tab the primary entity. Every tab has a required `conversationId`. Update Tab interface and tabStore.

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. lib/stores/tabStore.ts - Interface Update

- [ ] Read current file
- [ ] Update `Tab` interface:
  ```typescript
  interface Tab {
    id: string                  // UUID, this is the tabId
    conversationId: string      // Required - every tab belongs to a conversation
    tabNumber: number           // Sequential: 1, 2, 3...
    name: string                // "Tab 1", "Tab 2", etc.
    createdAt: number
    inputDraft?: string
  }
  ```
- [ ] Verify changes compile: `bun run type-check`

### 2. lib/stores/tabStore.ts - Update createTab

- [ ] Update `createTab()` to require `conversationId` parameter
- [ ] Ensure `tabNumber` is auto-incremented per conversation
- [ ] Ensure `name` is auto-generated as "Tab {tabNumber}"
- [ ] Verify changes compile: `bun run type-check`

### 3. lib/stores/tabStore.ts - Add conversation helpers

- [ ] Add `getTabsForConversation(conversationId)` selector
- [ ] Add `createConversationWithTab(workspace)` action that:
  - Creates a new conversation (generate UUID)
  - Creates Tab 1 inside it
  - Returns both IDs
- [ ] Verify changes compile: `bun run type-check`

### 4. lib/stores/sessionStore.ts - Simplify or Delete

- [ ] Read current file
- [ ] Determine if any unique functionality remains
- [ ] If not, delete and migrate any remaining consumers to tabStore
- [ ] If yes, simplify to only track active tab per workspace
- [ ] Verify changes compile: `bun run type-check`

### 5. Update callers

- [ ] Search: `grep -r "tabStore\|useTabStore\|useTabs" apps/web --include="*.ts" --include="*.tsx"`
- [ ] Update each caller for new interface (required conversationId)
- [ ] Update any `createTab` calls to provide `conversationId`
- [ ] Verify changes compile: `bun run type-check`

### 6. Update "New Chat" flow

- [ ] Find where "New Chat" button is handled
- [ ] Update to call `createConversationWithTab()` instead of old flow
- [ ] Ensure conversation title is still auto-generated from first message
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] "New Chat" creates conversation + tab
- [ ] Adding tabs within conversation works

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 5 status to ✅ complete
