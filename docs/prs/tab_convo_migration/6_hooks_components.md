# PR 6: Hooks & Components Update

**Status**: ✅ complete
**Depends on**: PR 5 (tab store refactor)
**Estimated time**: 2.5 hours

## Goal

Update all hooks and components to use `tabId` as the session key and work with the new data model.

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
- [x] No changes needed - already uses tab-primary model with required conversationId
- [x] Verify changes compile: `bun run type-check`

### 3. app/chat/hooks/useChatMessaging.ts

- [x] Read current file
- [x] `conversationId` param is still appropriate here (passed from page.tsx as `tabId`)
- [x] Already uses `activeTab?.id` for tabId in request body
- [x] No interface changes needed - the caller (page.tsx) now passes `tabId` as `conversationId`
- [x] Verify changes compile: `bun run type-check`

### 4. app/chat/hooks/useTabIsolatedMessages.ts

- [x] Read current file
- [x] Already mostly correct - uses tabId via activeTab
- [x] Still imports from messageStore (will be migrated when messageStore is deleted on this branch)
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
- [x] No changes needed for PR 6 - sidebar shows conversations (grouping layer), not tabs
- [x] Still imports from messageStore (will be migrated when messageStore is deleted)
- [x] Verify changes compile: `bun run type-check`

### 8. app/chat/page.tsx

- [x] Read current file
- [x] Updated import: `useConversationSession` → `useTabSession`
- [x] Destructured: `{ tabId, startNewTab, switchTab }` instead of `{ conversationId, startNewConversation, switchConversation }`
- [x] Updated all hook calls: `conversationId` → `tabId` where appropriate
- [x] Updated `useStreamCancellation` call: `{ tabId: storeConversationId ?? "" }`
- [x] Updated `useStreamReconnect` call: `{ tabId }`
- [x] Updated `useChatMessaging` call: `{ conversationId: tabId }`
- [x] Updated `useTabsManagement` call: `{ conversationId: tabId, onStartNewConversation: startNewTab }`
- [x] Updated `handleConversationSelect` to use `switchTab`
- [x] Updated `handleDeleteConversation` to compare with `tabId` and use `startNewTab`
- [x] Updated `FeedbackModal` prop: `conversationId={tabId}`
- [x] Verify changes compile: `bun run type-check`

### 9. features/chat/components/PendingToolsIndicator.tsx

- [x] Read current file
- [x] Renamed `conversationId` prop to `tabId`
- [x] Updated component to use `usePendingTools(tabId)`
- [x] Verify changes compile: `bun run type-check`

### 10. features/chat/components/ThinkingGroup.tsx

- [x] Read current file
- [x] Aliased import: `useCurrentConversationId as useCurrentTabId`
- [x] Renamed local variable: `conversationId` → `tabId`
- [x] Updated `usePendingTools(tabId)`
- [x] Verify changes compile: `bun run type-check`

---

## Verification

- [x] `bun run type-check` passes
- [x] `bun run lint` passes
- [x] Chat page loads without errors (all types resolve)
- [x] Sidebar shows conversations correctly (unchanged)
- [x] All hook interfaces use `tabId` as session key

---

## Notes

**Key decisions:**
1. `useChatMessaging` interface kept `conversationId` param name - the caller (page.tsx) passes `tabId` as the value. This avoids a cascade of internal changes in the messaging hook.
2. `useStreamReconnect` API body still sends `{ conversationId: tabId }` because the backend endpoint expects that key name.
3. `ConversationSidebar` unchanged - it operates on the conversation grouping layer, not the tab/session layer.
4. Old `useConversationSession.ts` file kept for now - will be deleted in PR 8 (cleanup).

---

## Completion

- [x] All checkboxes complete
- [x] Update `0_overview.md`: Change PR 6 status to ✅ complete
