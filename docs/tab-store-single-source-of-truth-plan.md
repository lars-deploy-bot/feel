# Plan: Single Source of Truth for Tabs + Conversation Key

## Problem Statement
The current model uses multiple overlapping sources of truth and overloaded naming:
- `sessionStore.currentConversationId` ("session"/"conversation"),
- `tabStore.activeTabByWorkspace` and `Tab.conversationId` ("tab"),
- Dexie `currentTabId` / `currentConversationId` ("conversation").

These layers drift and are easy to miswire. The same conceptual ID is called
"session", "conversation", and "tab", and the system allows multiple stores to
mutate or cache the same identity. This makes the UI fragile (no-ops, wrong
active tab, mis-synced tabs/groups) and violates the requirement of *one source
of truth per abstraction*.

## Target Model (Single Source of Truth)
- **Single authoritative store:** `tabStore`.
- **Tab ID equals Claude conversation key** (no separate `conversationId` or
  `sessionId`).
- **Tab group ID** remains the sidebar grouping concept.
- All other state (Dexie current tab, streaming, UI selection) *derives from*
  `tabStore.activeTabByWorkspace` and `Tab.id`.

## Non‑Goals
- UX changes beyond renaming labels and wiring actions correctly.
- Changing Dexie schema design beyond necessary ID alignment.

## Plan Overview (Phased, Safe Migration)

### Phase 0 — Prep & Inventory (no behavior changes)
1. Add explicit types in a shared file (e.g. `apps/web/lib/types/ids.ts`):
   - `type TabId = string`
   - `type TabGroupId = string`
   - `type ConversationKey = string` (alias of `TabId` if desired)
2. Update imports to use these types in key files:
   - `apps/web/lib/stores/tabStore.ts`
   - `apps/web/features/chat/hooks/useActiveSession.ts`
   - `apps/web/app/chat/hooks/useTabs.ts`
   - `apps/web/app/chat/page.tsx`
   - `apps/web/lib/db/dexieMessageStore.ts`
3. Add TODO markers (short, scoped) where old naming will be replaced.

### Phase 1 — Make Tab.id the Conversation Key
**Goal:** The Claude key is `Tab.id` and there is no separate `Tab.conversationId`.

1. Update `Tab` shape in `tabStore`:
   - Remove `conversationId` field.
   - Ensure `id` is the Claude conversation key (UUID).
2. Update tab creation helpers:
   - `genId()` returns the conversation key.
   - `createTab()` uses `id = conversationKey` and **does not** generate a
     separate `conversationId`.
3. Update `addTab` and `createTabGroupWithTab` to accept `tabId` (conversation key)
   instead of `conversationId`.
4. Update all call sites to pass/expect `tabId` instead of `conversationId`.

### Phase 2 — Remove sessionStore as Source of Truth
**Goal:** No separate `sessionStore` state for active conversation.

1. Remove `useSessionActions` usage from `useActiveSession`.
2. Replace `useActiveSession` with a lightweight hook that reads from tabStore:
   - `activeTab` = `useActiveTab(workspace)`
   - `tabId` = `activeTab?.id` (Claude key)
   - `tabGroupId` = `activeTab?.tabGroupId`
   - `switchTab(tabId)` = set active tab in tabStore
3. Remove `sessionStore` module and references:
   - `apps/web/lib/stores/sessionStore.ts`
   - Any hooks that wrap it (`useTabSession`, `useConversationSession`)
4. Ensure any resume/rehydration logic now depends on tabStore hydration only.

### Phase 3 — Align Dexie with New Identity
**Goal:** Dexie tab ID equals Claude conversation key.

1. Update `ensureTabGroupWithTab(workspace, tabGroupId, tabId)` usage:
   - Use `tabId` from tabStore, not `conversationId`.
2. Update Dexie `DbTab` writes so `id === tabId` (Claude key).
3. Update Dexie selectors to read by `tabId` consistently.

### Phase 4 — Rename for Clarity
**Goal:** Remove overloaded naming in UI and code.

1. Replace labels:
   - “New Chat” → “New Tab Group”
   - Ensure tooltips/test IDs are semantic (`new-tab-group-button`).
2. Replace variable names and props:
   - `conversationId` → `tabId` or `conversationKey`
   - `session` → `activeTab` or `activeConversationKey`
3. Update comments/docs to reflect the new vocabulary.

### Phase 5 — Migration & Persistence Safety
**Goal:** No data loss across persisted tabStore data.

1. Add a tabStore migration (bump version):
   - For each tab: if `conversationId` exists and `id` is not a UUID or is a
     legacy `tab-*` id, replace `id` with `conversationId`.
   - Remove `conversationId` field.
2. Ensure `activeTabByWorkspace` points to the new `id`.
3. Validate that old persisted data loads into the new schema without breaking
   the active tab.

### Phase 6 — Tests (Minimum Set)
1. Update existing tab store tests for the new field names.
2. Add regression tests:
   - **Add Tab**: group count unchanged, new tab active, tabId used as Claude key.
   - **New Tab Group**: group count increases, active tab/group points to new.
   - **Migration**: old persisted tab with `conversationId` becomes `id`.

## Acceptance Criteria
- Exactly one source of truth: `tabStore`.
- A tab’s `id` is the Claude conversation key.
- No `sessionStore` state involved in tab selection or active conversation.
- UI actions behave deterministically:
  - **New Tab Group** creates group + first tab and switches active.
  - **Add Tab** adds tab to current group and switches active.
- Tests and typecheck pass.
- No data loss after migration.

## Risks & Mitigations
- **Risk:** Persisted data mismatch (old IDs vs new IDs).
  - **Mitigation:** migration step with careful mapping + tests.
- **Risk:** Dexie mismatch if IDs diverge.
  - **Mitigation:** align Dexie `DbTab.id` strictly with tabStore `Tab.id`.
- **Risk:** Hidden call sites still using old `conversationId` naming.
  - **Mitigation:** enforce type aliases + rename pass + `rg` audit.

## Implementation Notes
- Keep changes atomic per phase and re-run tests after each phase.
- Update dev tools/console logs to use “tabId” or “conversationKey”.
- Avoid dual-write logic at any time (one source of truth).

