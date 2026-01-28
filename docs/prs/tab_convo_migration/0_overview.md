# Tab → Conversation Migration Overview

## Status Tracker

| PR | File | Status | Notes |
|----|------|--------|-------|
| 1 | Backend Session Keys | [x] Complete | |
| 2 | Stream Buffer | [x] Complete | |
| 3 | Streaming Store | [x] Complete | 60+ changes |
| 4 | Delete Message Store | [x] Complete | messageStore.ts deleted, all consumers migrated to Dexie |
| 5 | Tab Store Refactor | [~] In Progress | Introduce tabGroupId; tab = session; sidebar = tabgroup |
| 6 | Hooks & Components | [~] In Progress | Wire tabgroup selection + Dexie tabgroup/tab sync |
| 7 | Supabase Migration | [x] Complete | Code ready; SQL migration pending production deployment |
| 8 | Tests & Cleanup | [ ] Pending | Update E2E + UI copy for tabgroups |

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

- **Tabgroup** = Left panel entity (what users think of as a "conversation")
- **Tab** = A workspace tab within a tabgroup
- **conversationId** = Per‑tab session key for Claude SDK `resume` parameter
- **tabGroupId** = Grouping ID for the left panel (Dexie conversation id)

## Current Implementation Notes (2026-01-28)

- `conversationId` is the per‑tab session key (used as Claude SDK `resume`).
- `tabGroupId` is the grouping id for the left panel and maps to Dexie conversations.
- `tabStore.id` remains a UI-only identifier.
- Dexie state should track both `currentConversationId` (tabgroup) and `currentTabId` (tab session).
