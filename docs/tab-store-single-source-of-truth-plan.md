# STRICT PLAN: Single Source of Truth for Tabs + Conversation Key

## PROBLEM STATEMENT (NON‑NEGOTIABLE)
The system currently violates the rule of **one source of truth per abstraction**. There are multiple overlapping stores and overloaded names (`session`, `conversation`, `tab`). This is **unacceptable** for stability. The same conceptual ID is tracked in **multiple places** (sessionStore, tabStore, Dexie), leading to drift, broken UI behavior, and fragile wiring. This must be eliminated.

## REQUIRED TARGET MODEL
- **Only one source of truth:** `tabStore`.
- **Tab ID equals the Claude conversation key.** There is no separate `conversationId` or `sessionId`.
- **Tab group ID** remains the sidebar grouping concept.
- Everything else **derives from** `tabStore.activeTabByWorkspace` and `Tab.id`.

Any additional store that tries to maintain “current conversation” state is **forbidden**.

## PHASED EXECUTION (FOLLOW EXACTLY)

### PHASE 0 — PREP & INVENTORY (NO LOGIC CHANGES)
1. Create explicit types in a shared file (e.g., `apps/web/lib/types/ids.ts`):
   - `type TabId = string`
   - `type TabGroupId = string`
   - `type ConversationKey = TabId`
2. Add these types to all relevant files:
   - `apps/web/lib/stores/tabStore.ts`
   - `apps/web/features/chat/hooks/useActiveSession.ts`
   - `apps/web/app/chat/hooks/useTabs.ts`
   - `apps/web/app/chat/page.tsx`
   - `apps/web/lib/db/dexieMessageStore.ts`
3. Do **not** change behavior in Phase 0.

### PHASE 1 — TAB.ID IS THE CONVERSATION KEY
1. Delete `Tab.conversationId`. It must not exist.
2. Ensure `Tab.id` is generated as the conversation key (UUID).
3. Update tab creation:
   - `createTab()` assigns `id = conversationKey`.
   - `addTab()` and `createTabGroupWithTab()` accept `tabId` (conversation key).
4. Update all call sites to pass `tabId` instead of `conversationId`.
5. Compile. Fix all type errors. **No exceptions.**

### PHASE 2 — REMOVE sessionStore AS A SOURCE OF TRUTH
1. Remove `sessionStore` usage from `useActiveSession`.
2. `useActiveSession` becomes a thin wrapper over `tabStore`:
   - `tabId = activeTab?.id`
   - `tabGroupId = activeTab?.tabGroupId`
   - `switchTab(tabId)` sets the active tab in `tabStore`.
3. Remove `sessionStore` and all dependent hooks:
   - `apps/web/lib/stores/sessionStore.ts`
   - `apps/web/features/chat/hooks/useTabSession.ts`
   - `apps/web/features/chat/hooks/useConversationSession.ts`
4. Rebuild. Fix every reference. **No dead code left.**

### PHASE 3 — DEXIE MUST MATCH TABSTORE
1. Dexie `DbTab.id` must equal `tabStore.Tab.id` (conversation key).
2. Update `ensureTabGroupWithTab(...)` and related calls to use `tabId`.
3. If any Dexie field is still named `conversationId` but represents a group, rename it.

### PHASE 4 — RENAME FOR CLARITY (MANDATORY)
1. **Labels:** “New Chat” → “New Tab Group”.
2. **Props/variables:**
   - `conversationId` → `tabId` or `conversationKey` (where appropriate)
   - `session` → `activeTab` or `activeConversationKey`
3. Audit all occurrences using `rg`. If any legacy naming remains, it’s a bug.

### PHASE 5 — MIGRATION (NO DATA LOSS)
1. Bump `tabStore` persistence version.
2. Add migration:
   - If a tab has a legacy `conversationId`, **replace** `id` with it.
   - Remove legacy `conversationId` field entirely.
3. Ensure `activeTabByWorkspace` points to the new `id`.
4. Add tests for the migration.

### PHASE 6 — TESTS (REQUIRED)
1. Update existing tests to the new model.
2. Add **minimum** regression tests:
   - Add Tab does **not** create a new group.
   - New Tab Group **does** create a new group and switches active.
   - Migration maps legacy IDs correctly.
3. Run:
   - `bun run type-check`
   - `bun run test`
   Both must pass.

## ACCEPTANCE CRITERIA (ALL MUST BE TRUE)
- Only `tabStore` is the source of truth for active tab.
- `Tab.id` is the Claude conversation key.
- No `sessionStore` state exists.
- UI actions behave deterministically (Add Tab vs New Tab Group).
- Migration is correct and does not drop data.
- Tests pass. Zero type errors.

## ZERO TOLERANCE RULES
- No duplicate stores for the same concept.
- No ambiguous naming.
- No silent failures (e.g., ignored `null` returns) without explicit UI feedback.

