# PR 4: Delete localStorage messageStore

**Status**: ⏳ pending
**Depends on**: PR 3 (streaming store)
**Estimated time**: 2 hours

## Goal

Delete `lib/stores/messageStore.ts` entirely. Migrate all consumers to use Dexie (`lib/db/dexieMessageStore.ts`).

## Self-Update Instructions

After completing each checkbox, update this file immediately:
```
- [ ] Task  →  - [x] Task
```
This ensures crash recovery - the file IS the source of truth.

---

## Checklist

### 1. Find all messageStore consumers

- [ ] Run: `grep -r "messageStore\|useMessageStore\|useMessages\|useMessageActions\|useConversations\|useCurrentConversation" apps/web --include="*.ts" --include="*.tsx"`
- [ ] List all files that import from messageStore below

**Files importing messageStore:**
```
(fill in after grep)
```

### 2. Understand Dexie API

- [ ] Read `lib/db/dexieMessageStore.ts`
- [ ] Read `lib/db/useMessageDb.ts`
- [ ] Document equivalent functions:

| Old (messageStore) | New (Dexie) |
|-------------------|-------------|
| `useMessages()` | `useMessagesForTab(tabId)` |
| `addMessage()` | `addMessage(tabId, message)` |
| `setMessages()` | TBD |
| `initializeConversation()` | Create tab in tabStore |
| `switchConversation()` | Switch tab in tabStore |
| `deleteConversation()` | Delete tab in tabStore |
| `useConversations()` | Query tabs grouped by conversationId |

### 3. Migrate consumers one by one

For each file from step 1:

- [ ] File: `app/chat/page.tsx`
  - [ ] Remove messageStore imports
  - [ ] Replace with Dexie/tabStore equivalents
  - [ ] Verify compiles

- [ ] File: `app/chat/hooks/useChatMessaging.ts`
  - [ ] Remove messageStore imports
  - [ ] Replace with Dexie/tabStore equivalents
  - [ ] Verify compiles

- [ ] File: `app/chat/hooks/useTabIsolatedMessages.ts`
  - [ ] Remove messageStore imports
  - [ ] Replace with Dexie/tabStore equivalents
  - [ ] Verify compiles

- [ ] File: `features/chat/components/ConversationSidebar.tsx`
  - [ ] Remove messageStore imports
  - [ ] Replace with Dexie/tabStore equivalents
  - [ ] Verify compiles

- [ ] File: (add more as discovered)
  - [ ] Remove messageStore imports
  - [ ] Replace with Dexie/tabStore equivalents
  - [ ] Verify compiles

### 4. Delete messageStore

- [ ] Verify no remaining imports: `grep -r "messageStore" apps/web`
- [ ] Delete `lib/stores/messageStore.ts`
- [ ] Verify changes compile: `bun run type-check`

### 5. Clean up related files

- [ ] Check `lib/db/migrateLegacyStorage.ts` - may need updates or deletion
- [ ] Check hydration boundary for messageStore references
- [ ] Verify changes compile: `bun run type-check`

---

## Verification

- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] No remaining messageStore imports
- [ ] Chat still works (manual test)

---

## Notes

Write any issues, blockers, or decisions here during implementation:

```
(empty)
```

---

## Completion

- [ ] All checkboxes complete
- [ ] Update `0_overview.md`: Change PR 4 status to ✅ complete
