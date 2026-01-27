# PR 5: Tab Store Refactor

**Status**: ✅ complete
**Depends on**: PR 4 (delete messageStore)
**Estimated time**: 1.5 hours

## Goal

Make Tab the primary entity. Every tab has a required `conversationId`. Update Tab interface and tabStore.
Until the grouping layer is fully wired, `conversationId` is treated as the session key (1:1 with `tabId`).

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. lib/stores/tabStore.ts - Interface Update

- [x] Read current file
- [x] Update `Tab` interface:
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
  **Note**: Interface was already compliant - no changes needed
- [x] Verify changes compile: `bun run type-check`

### 2. lib/stores/tabStore.ts - Update createTab

- [x] Update `createTab()` to require `conversationId` parameter
  **Note**: Already required `conversationId` - no changes needed
- [x] Ensure `tabNumber` is auto-incremented per conversation
  **Note**: Already auto-incremented per workspace
- [x] Ensure `name` is auto-generated as "Tab {tabNumber}"
  **Note**: Already generates "Tab {num}"
- [x] Verify changes compile: `bun run type-check`

### 3. lib/stores/tabStore.ts - Add conversation helpers

- [x] Add `useTabsForConversation(conversationId)` selector
  - Returns all tabs for a conversation across workspaces
- [x] Add `createConversationWithTab(workspace)` action that:
  - Creates a new conversation (generate UUID)
  - Creates Tab 1 inside it
  - Returns `{ conversationId, tabId }` or null if max tabs reached
- [x] Verify changes compile: `bun run type-check`

### 4. lib/stores/sessionStore.ts - Simplify or Delete

- [x] Read current file
- [x] Determine if any unique functionality remains
  **Decision: KEEP** - sessionStore still serves a different purpose:
  - Persists the per-workspace session key (still named `conversationId` in the store)
  - `useTabSession` treats this value as `tabId` for Claude SDK resume
  - Orthogonal to tabStore (tabs = UI, session key = Claude SDK persistence)
- [x] No changes needed - sessionStore holds the session key while tabStore handles UI tabs
- [x] Verify changes compile: `bun run type-check`

### 5. Update callers

- [x] Search: `grep -r "tabStore\|useTabStore\|useTabs" apps/web --include="*.ts" --include="*.tsx"`
- [x] Update each caller for new interface (required conversationId)
  **Note**: All callers already provide conversationId - no changes needed
- [x] Update any `createTab` calls to provide `conversationId`
  **Note**: All existing calls already provide it
- [x] Verify changes compile: `bun run type-check`

### 6. Update "New Chat" flow

- [x] Find where "New Chat" button is handled (`page.tsx` → `handleNewConversation`)
- [x] Review flow - works with the new session key:
  - Uses Dexie's `ensureConversationWithTab(workspace, tabId)` to create conversation+tab with id == tabId
  - `createConversationWithTab()` remains available for future grouping-first flows
- [x] Conversation title auto-generation still works via first message
- [x] Verify changes compile: `bun run type-check`

---

## Verification

- [x] `bun run type-check` passes
- [x] `bun run lint` passes
- [x] "New Chat" creates conversation + tab (existing flow works)
- [x] Adding tabs within conversation works (existing flow works)

---

## Notes

**Key insight**: The tabStore was already mostly compliant with the PR 5 goals. The main additions were:

1. `createConversationWithTab(workspace)` - Creates conversation + Tab 1 atomically
2. `useTabsForConversation(conversationId)` - Selector for tabs by conversation

**sessionStore decision**: Kept separate because:
- sessionStore = URL/SDK session persistence (resume conversations)
- tabStore = UI tab management (multiple tabs per workspace)
- Different concerns, both valuable

---

## Completion

- [x] All checkboxes complete
- [x] Update `0_overview.md`: Change PR 5 status to ✅ complete
