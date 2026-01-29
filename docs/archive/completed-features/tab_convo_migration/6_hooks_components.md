# PR 6: Hooks & Components Update

**Status**: 🚧 in progress
**Depends on**: PR 5 (tab store refactor)
**Estimated time**: 2.5 hours

## Goal

Update hooks/components for **tabgroup + tab session** model:
- Left panel = tabgroup (Dexie conversation)
- Tabs hold per‑tab session ids (`conversationId`)

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. features/chat/hooks/useConversationSession.ts → useTabSession.ts

- [x] Read current file
- [x] Created new `useTabSession.ts` (kept old file for backwards compat)
- [x] Returns `tabId` instead of `conversationId`
- [x] Returns `startNewTab` instead of `startNewConversation`
- [x] Returns `switchTab` instead of `switchConversation`
- [x] Updated all exports
- [x] Verify changes compile: `bun run type-check`

### 2. app/chat/hooks/useTabs.ts

- [x] Read current file
- [x] Update hook interface to accept `tabGroupId` + `activeConversationId`
- [x] Ensure tab selection only switches tab session (not tabgroup)

### 3. app/chat/hooks/useChatMessaging.ts

- [x] Read current file
- [x] `conversationId` param is still appropriate here (passed from page.tsx as `tabId`)
- [x] Uses `activeTab?.conversationId` for tabId in request body (tabStore id is UI-only)
- [x] No interface changes needed - the caller (page.tsx) passes `tabId` as `conversationId`
- [x] Verify changes compile: `bun run type-check`

### 4. app/chat/hooks/useTabIsolatedMessages.ts

- [x] Read current file
- [x] Uses `activeTab.conversationId` as tabId for Dexie message lookup
- [x] Uses Dexie message store (messageStore already removed on this branch)
- [x] Verify changes compile: `bun run type-check`

### 5. features/chat/hooks/useStreamCancellation.ts

- [x] Read current file
- [x] Renamed `conversationId` parameter to `tabId` in interface
- [x] Updated all internal references from `conversationId` to `tabId`
- [x] Updated comments to reference `tabId`
- [x] Updated JSDoc example
- [x] Verify changes compile: `bun run type-check`

### 6. features/chat/hooks/useStreamReconnect.ts

- [x] Read current file
- [x] Renamed `conversationId` parameter to `tabId` in interface
- [x] Updated `checkForBufferedMessages` to use `tabId`
- [x] Updated `pollForRemainingMessages` param from `convId` to `pollTabId`
- [x] API body still sends `conversationId: tabId` (backend expects this key)
- [x] Verify changes compile: `bun run type-check`

### 7. features/chat/components/ConversationSidebar.tsx

- [x] Read current file
- [x] Update UI copy to "tab groups" (left panel shows tabgroups)
- [x] Uses Dexie conversations store (tabgroup layer)

### 8. app/chat/page.tsx

- [x] Read current file
- [x] Updated import: `useConversationSession` → `useTabSession`
- [x] Destructured: `{ tabId, startNewTab, switchTab }` instead of `{ conversationId, startNewConversation, switchConversation }`
- [x] Updated all hook calls: `conversationId` → `tabId` where appropriate
- [x] Updated `useStreamCancellation` call: `{ tabId }`
- [x] Updated `useStreamReconnect` call: `{ tabId }`
- [x] Updated `useChatMessaging` call: `{ conversationId: tabId }`
- [x] Updated `useTabsManagement` call: `{ tabGroupId, activeConversationId: tabId, onStartNewTab: startNewTab }`
- [x] Updated `handleConversationSelect` to open tabgroup in a tab (not switch tabgroup directly)
- [x] Updated `handleDeleteConversation` to remove tabgroup + open next tabgroup
- [x] Updated `FeedbackModal` prop: `conversationId={tabId}`
- [x] Verify changes compile: `bun run type-check`

### 9. ChatInput readiness

- [x] Keep `isReady` gating on Dexie session + tabgroup/tab sync

### 10. features/chat/components/PendingToolsIndicator.tsx

- [x] Read current file
- [x] Renamed `conversationId` prop to `tabId`
- [x] Updated component to use `usePendingTools(tabId)`
- [x] Verify changes compile: `bun run type-check`

### 11. features/chat/components/ThinkingGroup.tsx

- [x] Read current file
- [x] Aliased import: `useCurrentConversationId as useCurrentTabId`
- [x] Renamed local variable: `conversationId` → `tabId`
- [x] Updated `usePendingTools(tabId)`
- [x] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check`
- [ ] `bun run lint`
- [ ] Chat page loads without errors
- [ ] Sidebar shows tabgroups correctly

---

## Notes

**Key decisions:**
1. `useChatMessaging` interface kept `conversationId` param name - the caller (page.tsx) passes `tabId` as the value. This avoids a cascade of internal changes in the messaging hook.
2. `useStreamReconnect` API body still sends `{ conversationId: tabId }` because the backend endpoint expects that key name.
3. `ConversationSidebar` shows tabgroups (Dexie conversations) – it is the grouping layer.
4. `tabStore.id` is UI-only; use `tabStore.conversationId` as the session key when talking to Dexie/API.
5. Old `useConversationSession.ts` file kept for now - will be deleted in PR 8 (cleanup).

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 6 status to ✅ complete
