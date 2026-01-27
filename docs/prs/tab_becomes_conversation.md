# Tab Becomes Primary Chat Entity

## Overview

Restructure the tab/conversation hierarchy so that **Tab becomes the primary chat entity** (maps to Claude SDK session), while **Conversation becomes a grouping layer** (will connect to git branches in future).

## Current vs New Architecture

### Current (BEFORE)
```
Workspace
  └── Conversation (has messages[], maps to Claude SDK session)
        └── Tab (UI state only, shares conversation's messages)
```

### New (AFTER)
```
Workspace
  └── Conversation (grouping only, will link to git branches)
        └── Tab (has messages, maps to Claude SDK session)
```

## Terminology (CRITICAL - Read This First)

| Term | Role | Maps to Claude SDK |
|------|------|-------------------|
| **Conversation** | Grouping layer. Groups related tabs. Future: links to git branches. | Nothing |
| **Tab** | Primary chat entity. Owns messages. Has its own Claude session. | `resume` parameter |
| **conversationId** | ID of the grouping (required - every tab belongs to a conversation) | Nothing |
| **tabId** | ID of the chat session. This is what we send to Claude SDK. | Session ID for `resume` |

## Key Changes

### 1. Session Key Format
```typescript
// BEFORE
sessionKey = `${userId}::${workspace}::${conversationId}`
lockKey = `${userId}::${workspace}::${conversationId}::${tabId}`

// AFTER
sessionKey = `${userId}::${workspace}::${tabId}`
lockKey = `${userId}::${workspace}::${tabId}`  // Same as sessionKey now!
```

### 2. API Request Body
```typescript
// BEFORE
{ conversationId: string, tabId?: string, message: string }

// AFTER
{ conversationId: string, tabId: string, message: string }
// conversationId is still sent for grouping, but tabId is the session key
```

### 3. Tab Interface
```typescript
// BEFORE
interface Tab {
  id: string
  name: string
  createdAt: number
  inputDraft?: string
  messages: Message[]  // Tab had its own messages
}

// AFTER
interface Tab {
  id: string                  // UUID, this is the tabId
  conversationId: string      // Required - every tab belongs to a conversation
  tabNumber: number           // Sequential: 1, 2, 3...
  name: string                // "Tab 1", "Tab 2", etc.
  createdAt: number
  inputDraft?: string
  // NO messages[] here - messages are in Dexie by tabId
}
```

### 4. Conversation Interface
```typescript
// BEFORE
interface Conversation {
  id: string
  messages: Message[]  // Conversation owned messages
}

// AFTER
interface Conversation {
  id: string
  // NO messages[] - tabs own messages
  branchName?: string  // Future: git branch link
}
```

### 5. Message Storage
- **Dexie (IndexedDB)** is the ONLY message store
- Messages keyed by `tabId` (not conversationId)
- DELETE the localStorage `messageStore.ts` entirely

### 6. New Chat Behavior
- Clicking "New Chat" creates a Conversation + Tab 1 automatically
- Every Tab must belong to a Conversation (conversationId is required)
- Tabs are named sequentially: Tab 1, Tab 2, Tab 3...

### 7. Sidebar Behavior
- Sidebar shows Conversations
- Click a Conversation to expand and see its Tabs
- Select a Tab to open that chat session

## Files to Modify

### Critical Path (Backend)
1. `types/guards/api.ts` - Update Zod schema to require `tabId`
2. `features/auth/lib/sessionStore.ts` - Change session key to use `tabId`
3. `app/api/claude/stream/route.ts` - Use `tabId` for session/lock
4. `lib/stream/stream-buffer.ts` - Key buffers by `tabId`
5. `app/api/claude/stream/reconnect/route.ts` - Update inline schema

### Critical Path (Frontend Stores)
6. `lib/stores/streamingStore.ts` - Change all `conversationId` refs to `tabId` (60+ occurrences)
7. `lib/stores/tabStore.ts` - Add `conversationId` to Tab interface, update creation logic

### Delete These Files
8. `lib/stores/messageStore.ts` - DELETE entirely (use Dexie only)
9. `lib/stores/sessionStore.ts` - DELETE if only used for old pattern

### Hooks & Components
10. `hooks/useConversationSession.ts` - Update to use `tabId`
11. `hooks/useStreamReconnect.ts` - Update to use `tabId`
12. `features/chat/hooks/useTabs.ts` - Update tab creation
13. `features/chat/components/ConversationSidebar.tsx` - Show Conversations → Tabs hierarchy
14. `components/chat/ChatInterface.tsx` - Use `tabId` for streaming

### Database
15. Supabase migration for `app.conversations` and `app.tabs` tables (if persisting server-side)

## Implementation Phases -- ALL COMPLETE

### Phase 1: Backend Session Keys ✅
- Updated session key format to use `tabId` via `tabKey()`
- Lock key = session key
- API validation schemas updated

### Phase 2: Stream Buffer ✅
- Buffers keyed by `tabId`

### Phase 3: Streaming Store ✅
- Replaced all `conversationId` with `tabId` (60+ occurrences)

### Phase 4: Delete Message Store ✅
- Removed `lib/stores/messageStore.ts`
- All code uses Dexie via `dexieMessageStore`

### Phase 5: Tab Store Refactor ✅
- Added `conversationId` and `tabNumber` to Tab interface
- Added `createConversationWithTab()` for "New Chat"

### Phase 6: Hooks & Components ✅
- All hooks use new tab-based pattern

### Phase 7: Supabase Migration ✅
- `iam.sessions` table with `(user_id, domain_id, tab_id)` composite key
- SessionStoreMemory backed by Supabase

### Phase 8: Tests & Cleanup ✅
- All tests pass, docs updated, old code removed

## Migration Notes

- This is a breaking change for existing sessions
- Existing conversations will need migration or will lose session continuity
- Consider adding a migration script or accepting that existing sessions restart fresh
