# Tab-Conversation Migration Overview

## Status Tracker

| PR | Status | Description |
|----|--------|-------------|
| 1_backend_session_keys.md | ⏳ pending | Backend: tabId becomes session key |
| 2_stream_buffer.md | ⏳ pending | Stream buffer uses tabKey |
| 3_streaming_store.md | ⏳ pending | Frontend streamingStore refactor |
| 4_delete_message_store.md | ⏳ pending | Delete localStorage messageStore, use Dexie only |
| 5_tab_store_refactor.md | ⏳ pending | Tab becomes primary, conversationId required |
| 6_hooks_components.md | ⏳ pending | Update all hooks and components |
| 7_supabase_migration.md | ⏳ pending | Database column rename |
| 8_tests_cleanup.md | ⏳ pending | Update tests, delete old code |

**Legend**: ⏳ pending | 🔄 in progress | ✅ complete | ❌ blocked

## Quick Reference

- **Main plan**: `../tab_becomes_conversation.md`
- **Session key change**: `userId::workspace::conversationId` → `userId::workspace::tabId`
- **Message storage**: Dexie only (delete localStorage messageStore)
- **Conversation**: Grouping layer (always present, future: git branches)
- **Tab**: Chat thread (has messages, maps to Claude SDK session)

## How to Use

1. Start with PR 1 (backend session keys)
2. Each PR file has a checklist - work through it
3. After completing each file change, update the checklist
4. Update this overview when PR is complete
5. PRs can be done in order (dependencies noted in each)

## Crash Recovery

Each PR file tracks its own progress. If you crash mid-PR:
1. Read the PR file to see what's checked off
2. Continue from where you left off
3. The checklist IS the source of truth
