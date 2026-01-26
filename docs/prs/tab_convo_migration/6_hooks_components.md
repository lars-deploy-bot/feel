# PR 6: Hooks & Components Update

**Status**: ⏳ pending
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

### 1. features/chat/hooks/useConversationSession.ts

- [ ] Read current file
- [ ] Rename file to `useTabSession.ts`
- [ ] Update hook to manage tab sessions instead of conversation sessions
- [ ] Return `tabId` instead of `conversationId` as the session identifier
- [ ] Update all exports
- [ ] Verify changes compile: `bun run type-check`

### 2. app/chat/hooks/useTabs.ts

- [ ] Read current file
- [ ] Simplify: tab is now primary, conversationId is grouping
- [ ] Update to work with new Tab interface (required conversationId)
- [ ] Verify changes compile: `bun run type-check`

### 3. app/chat/hooks/useChatMessaging.ts

- [ ] Read current file
- [ ] Change `conversationId` usage to `tabId` where it's the session key
- [ ] Keep `conversationId` where it's the grouping
- [ ] Update API calls to send `tabId` as primary identifier
- [ ] Verify changes compile: `bun run type-check`

### 4. app/chat/hooks/useTabIsolatedMessages.ts

- [ ] Read current file
- [ ] Should already be mostly correct (uses tabId)
- [ ] Verify it queries Dexie by tabId
- [ ] Clean up any old conversationId references
- [ ] Verify changes compile: `bun run type-check`

### 5. features/chat/hooks/useStreamCancellation.ts

- [ ] Read current file
- [ ] Change `conversationId` parameter to `tabId`
- [ ] Update cancel API call to use `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 6. features/chat/hooks/useStreamReconnect.ts

- [ ] Read current file
- [ ] Change `conversationId` parameter to `tabId`
- [ ] Update reconnect API call to use `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 7. features/chat/components/ConversationSidebar.tsx

- [ ] Read current file
- [ ] Update to show Conversations as groups
- [ ] Add expand/collapse to show Tabs within a Conversation
- [ ] Query tabs from tabStore grouped by conversationId
- [ ] Conversation title from first message in Tab 1
- [ ] Verify changes compile: `bun run type-check`

### 8. app/chat/page.tsx

- [ ] Read current file
- [ ] Update import from `useConversationSession` to `useTabSession`
- [ ] Change `conversationId` variable name to `tabId` where appropriate
- [ ] Keep `conversationId` for grouping context
- [ ] Update all hook calls with new parameter names
- [ ] Verify changes compile: `bun run type-check`

### 9. features/chat/components/PendingToolsIndicator.tsx

- [ ] Read current file
- [ ] Update any `conversationId` prop to `tabId`
- [ ] Verify changes compile: `bun run type-check`

### 10. features/chat/components/ThinkingGroup.tsx

- [ ] Read current file
- [ ] Update any `conversationId` prop to `tabId`
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] Chat page loads without errors
- [ ] Sidebar shows conversations correctly
- [ ] Clicking conversation shows tabs

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 6 status to ✅ complete
