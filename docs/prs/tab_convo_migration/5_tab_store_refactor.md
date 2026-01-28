# PR 5: Tab Store Refactor

**Status**: 🚧 in progress
**Depends on**: PR 4 (delete messageStore)
**Estimated time**: 1.5 hours

## Goal

Introduce a **tabgroup** layer for the left panel while keeping **per‑tab session ids**:
- `conversationId` = per‑tab session key (Claude resume)
- `tabGroupId` = grouping id for the left panel (Dexie conversation id)
- Tabs live inside a tabgroup; multiple tabs per tabgroup

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
    id: string                  // UI-only id
    conversationId: string      // Per-tab session key (Claude resume)
    tabGroupId: string          // Grouping id for left panel
    tabNumber: number           // Sequential: 1, 2, 3...
    name: string                // "Tab 1", "Tab 2", etc.
    createdAt: number
    inputDraft?: string
  }
  ```
  **Note**: tabGroupId added; conversationId now explicitly the per‑tab session id

### 2. lib/stores/tabStore.ts - Update createTab

- [x] Update `createTab()` to require `conversationId` parameter
  **Note**: Already required `conversationId` - no changes needed
- [x] Ensure `tabNumber` is auto-incremented per conversation
  **Note**: Already auto-incremented per workspace
- [x] Ensure `name` is auto-generated as "Tab {tabNumber}"
  **Note**: Already generates "Tab {num}"
- [x] Verify changes compile: `bun run type-check`

### 3. lib/stores/tabStore.ts - Add tabgroup helpers

- [x] Add `useTabsForTabGroup(tabGroupId)` selector
  - Returns all tabs for a tabgroup across workspaces
- [x] Add `createTabGroupWithTab(workspace, conversationIdOverride?)` action that:
  - Creates a new tabgroup id
  - Creates Tab 1 inside it (conversationId = per‑tab session key)
  - Returns `{ tabGroupId, conversationId, tabId }` or null if max tabs reached

### 4. lib/stores/sessionStore.ts - Keep session store (still required)

- [x] Read current file
- [x] Determine if any unique functionality remains
  **Decision: KEEP** - sessionStore persists the per‑tab session key (named `conversationId` in the store)
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
- [x] Review flow - works with tabgroups:
  - Uses `createTabGroupWithTab(workspace, tabId)` to create tabgroup + tab
  - Uses Dexie's `ensureTabGroupWithTab(workspace, tabGroupId, tabId)`
- [x] Conversation title auto-generation still works via first message
- [x] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check`
- [ ] `bun run lint`
- [ ] "New Chat" creates tabgroup + tab
- [ ] Adding tabs stays within the same tabgroup

---

## Notes

**Key insight**: The tabStore was already mostly compliant with the PR 5 goals. The main additions were:

1. `createTabGroupWithTab(workspace)` - Creates tabgroup + Tab 1 atomically
2. `useTabsForTabGroup(tabGroupId)` - Selector for tabs by tabgroup

**sessionStore decision**: Kept separate because:
- sessionStore = URL/SDK session persistence (resume conversations)
- tabStore = UI tab management (multiple tabs per workspace)
- Different concerns, both valuable

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 5 status to ✅ complete
