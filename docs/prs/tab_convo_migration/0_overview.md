# Tab → Conversation Migration Overview

## Status Tracker

| PR | File | Status | Notes |
|----|------|--------|-------|
| 1 | Backend Session Keys | [x] Complete | |
| 2 | Stream Buffer | [x] Complete | |
| 3 | Streaming Store | [x] Complete | 60+ changes |
| 4 | Delete Message Store | [x] Complete | messageStore.ts deleted, all consumers migrated to Dexie |
| 5 | Tab Store Refactor | [x] Complete | Added createConversationWithTab, useTabsForConversation; kept sessionStore |
| 6 | Hooks & Components | [x] Complete | useTabSession, tabId in all hooks/components |
| 7 | Supabase Migration | [x] Complete | Code ready; SQL migration pending production deployment |
| 8 | Tests & Cleanup | [ ] Not Started | |

## Quick Links

- [Main Plan](../tab_becomes_conversation.md)
- [PR 1: Backend Session Keys](./1_backend_session_keys.md)
- [PR 2: Stream Buffer](./2_stream_buffer.md)
- [PR 3: Streaming Store](./3_streaming_store.md)
- [PR 4: Delete Message Store](./4_delete_message_store.md)
- [PR 5: Tab Store Refactor](./5_tab_store_refactor.md)
- [PR 6: Hooks & Components](./6_hooks_components.md)
- [PR 7: Supabase Migration](./7_supabase_migration.md)
- [PR 8: Tests & Cleanup](./8_tests_cleanup.md)

## How to Use These Files

Each PR file contains:
1. **Checklist** - Tasks to complete
2. **Files to modify** - Exact files and what to change
3. **Code examples** - Before/after snippets
4. **Self-update instructions** - Mark tasks complete as you go

**On crash recovery**: Read this file first to see overall status, then continue from the first incomplete PR.

## Key Terminology Reminder

- **Tab** = Primary chat entity, owns messages, maps to Claude SDK session
- **Conversation** = Grouping layer, will link to git branches
- **tabId** = Session key for Claude SDK `resume` parameter
- **conversationId** = Grouping ID (required, every tab belongs to a conversation)
