# Plan Part 1: Dexie Architecture & Design

Architecture and design decisions for migrating message storage to Dexie.js + Supabase.

## Problem Statement

Current messageStore uses Zustand + localStorage:
- **Storage limit**: ~5MB total (localStorage limit)
- **Performance**: Entire state serialized/deserialized on every change
- **No server persistence**: Data lost if browser storage cleared
- **No sharing**: Can't share conversations with team members
- **No tabs**: Conversations don't support multiple tabs

## Proposed Solution

- **Dexie.js (IndexedDB)**: Fast local cache for offline-first experience
- **Supabase**: Server-side persistence for all conversations
- **Private by default**: Only creator sees their conversations
- **Shareable**: Can share with organization members
- **Lazy loading**: Messages loaded per-tab, not all at once

## Data Model

### Key Relationships

```
Organization (org)
  └── Workspace (domain)
        └── Conversation (private or shared)
              └── Tab (each tab is a separate chat thread)
                    └── Messages[]

User
  └── owns Conversations (creatorId)
  └── can view shared Conversations (via org membership)
```

### Conversation Ownership

- **Conversation belongs to**: workspace (domain)
- **Conversation created by**: user (creatorId)
- **Conversation visibility**: private (only creator) or shared (all org members)
- **Tabs belong to**: conversation
- **Messages belong to**: tab (NOT directly to conversation)

### Session Context (CRITICAL)

Every operation that touches conversations MUST have a valid session context:

```typescript
// REQUIRED for all conversation operations
export interface SessionContext {
  userId: string
  orgId: string
  workspace: string
}

// Never allow null orgId when showing shared conversations
// Never allow operations without userId
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │   Zustand Store   │    │    Dexie (IndexedDB, per-user)   │  │
│  │   (UI State)      │    │    DB: claude-messages-{env}-{userId}│
│  │                   │    │                                  │  │
│  │ • currentConvoId  │◄───│ • conversations                  │  │
│  │ • isLoading       │    │ • messages                       │  │
│  │ • isSyncing       │    │ • tabs                           │  │
│  │ • streamingBuffers│    │                                  │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
│           │                            │                        │
│           │                            │                        │
│           ▼                            ▼                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Conversation Service                     │   │
│  │  (Single layer for all conversation operations)          │   │
│  │  • Push local changes to server                          │   │
│  │  • Pull server changes to local (lazy, per-tab)          │   │
│  │  • Conflict resolution (last-write-wins with timestamps) │   │
│  │  • Offline retry with exponential backoff                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
├─────────────────────────────────────────────────────────────────┤
│  app.conversations     (all conversations - private & shared)   │
│  app.messages          (all messages with status tracking)      │
│  app.conversation_tabs (tabs per conversation)                  │
│                                                                 │
│  RLS Policies:                                                  │
│  • Private: only creator can read/write                         │
│  • Shared: org members can read, creator can write              │
│                                                                 │
│  Realtime Subscriptions:                                        │
│  • Shared conversations get live updates via postgres_changes   │
└─────────────────────────────────────────────────────────────────┘
```

## Critical Design Decisions

### 1. User-Scoped Database Names (SECURITY CRITICAL)

Prevent different users from sharing the same IndexedDB. Without this, if user A logs out and user B logs in on the same browser, user B could see user A's cached conversations.

```typescript
const ENV = process.env.NEXT_PUBLIC_ENV ?? "local"

// DB is instantiated lazily AFTER user is known
export function getMessageDbName(userId: string) {
  return `claude-messages-${ENV}-${userId}`
}

// WRONG: Don't instantiate at module level
// const db = new MessageDatabase()

// RIGHT: Instantiate after authentication
let _db: MessageDatabase | null = null
export function getMessageDb(userId: string): MessageDatabase {
  if (!_db || _db.name !== getMessageDbName(userId)) {
    _db = new MessageDatabase(userId)
  }
  return _db
}
```

**Why user-scoped, not just env-scoped?**
- Browser localStorage/IndexedDB is shared per origin
- If someone logs out and another person logs in, they'd share the same cache
- Even with query filters, the data would still exist locally

### 2. Schema Versioning for Messages

Store a version field to handle future format changes:

```typescript
export type DbMessageStatus = "streaming" | "complete" | "interrupted" | "error"
export type DbMessageOrigin = "local" | "remote" | "migration"

export interface DbMessage {
  id: string
  tabId: string
  type: DbMessageType
  content: DbMessageContent  // Structured, not unknown
  createdAt: number
  updatedAt: number          // Track last update for stale detection
  version: number            // For schema evolution (current: 1)
  status: DbMessageStatus    // Message lifecycle status
  origin: DbMessageOrigin    // Where message came from (debugging/migrations)
  // Optional metadata
  abortedAt?: number         // Timestamp when user stopped the stream
  errorCode?: string         // Error code if status === "error"
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean      // IMPORTANT: false during streaming, true only when finalized
}

// Discriminated union for content - easier to evolve
// Include future types now to prevent breaking migrations later
type DbMessageContent =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; toolName: string; toolUseId: string; args: unknown }
  | { kind: "tool_result"; toolName: string; toolUseId: string; result: unknown }
  | { kind: "thinking"; text: string }
  | { kind: "system"; text: string; code?: string }           // Future: system notices
  | { kind: "file"; fileId: string; fileName: string; size: number; mimeType: string }  // Future: file uploads
  | { kind: "diff"; language: string; diff: string }          // Future: code diffs
```

### 3. Composite Indexes for Performance

Use composite indexes instead of `sortBy()` which loads all data into memory:

```typescript
// Instead of:
db.conversations.where("workspace").equals(workspace).sortBy("updatedAt")

// Use:
db.conversations
  .where("[workspace+updatedAt]")
  .between([workspace, Dexie.minKey], [workspace, Dexie.maxKey])
  .reverse()
  .toArray()
```

### 4. Multi-Tab Safety

When a conversation is deleted in another tab, handle gracefully. Use a reusable hook:

```typescript
// lib/db/useCurrentConversationSafe.ts
// Use this everywhere instead of raw useConversation + useCurrentConversationId

export function useCurrentConversationSafe() {
  const currentConversationId = useCurrentConversationId()
  const conversation = useConversation(currentConversationId)
  const { clearCurrentConversation } = useMessageActions()

  useEffect(() => {
    if (currentConversationId && conversation === null) {
      // Conversation was deleted in another tab
      clearCurrentConversation()
    }
  }, [conversation, currentConversationId, clearCurrentConversation])

  return conversation
}
```

Also handle Dexie blocked events during schema upgrades:

```typescript
// In MessageDatabase constructor
this.on("blocked", () => {
  console.warn("[dexie] Upgrade blocked by another tab")
  // Show UI hint: "Please close other Claude Bridge tabs to complete an upgrade"
})
```

### 5. Migration Idempotency

Migration must be safe to re-run:

```typescript
// Use transaction + only set flag on success
await db.transaction("rw", [db.conversations, db.messages, db.tabs], async () => {
  // All migration logic here
})
// Only after transaction succeeds:
localStorage.setItem(migrationKey, "true")
```

### 6. Separate Persistence Types from UI Types

Keep `DbMessage` (on-disk) separate from `UIMessage` (in-memory):

```typescript
// Domain layer - pure types
// lib/domain/messageTypes.ts
export interface Message { /* persistence shape */ }

// UI layer - display shape
// features/chat/lib/message-parser.ts
export interface UIMessage { /* UI shape */ }

// Adapter function
export function toUIMessage(dbMessage: DbMessage): UIMessage { ... }
export function toDbMessage(uiMessage: UIMessage, tabId: string): DbMessage { ... }
```

**CRITICAL**: Create a central types index with clear comments:

```typescript
// lib/conversations/types.ts
export * from "@/lib/db/messageDb"              // Db* types
export * from "@/features/chat/lib/message-parser" // UIMessage
export * from "@/lib/bridge/streamTypes"        // BridgeEvent

// RULES (for humans and agents):
// - Db* types must NOT be used in React components
// - UIMessage must NOT be persisted to Dexie directly
// - BridgeEvent must be the only valid shape for NDJSON events
```

### 7. Centralized Error Handling for Dexie

Wrap all Dexie operations to catch quota errors, blocked events, etc:

```typescript
// lib/db/safeDb.ts
export async function safeDb<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op()
  } catch (err) {
    console.error("[dexie] operation failed", err)
    // TODO: surface in a global toast store
    return null
  }
}

// Usage: await safeDb(() => db.messages.add(dbMessage))
// Never call db.messages.add/put/delete directly in UI or store code.
```

### 8. Conversation Metadata for Scalability

Track metadata to avoid scanning all messages for common operations:

```typescript
export interface DbConversation {
  // ... existing fields
  messageCount?: number          // Total messages across all tabs
  lastMessageAt?: number         // Timestamp of most recent message
  firstUserMessageId?: string    // For title generation (avoid scanning)
  autoTitleSet?: boolean         // Has title been auto-generated?
  archivedAt?: number            // Soft archive for cleanup
  deletedAt?: number             // Soft delete (never hard delete)
}

export interface DbTab {
  // ... existing fields
  messageCount?: number          // Messages in this tab
  lastMessageAt?: number         // For "active" tab indicator
}
```

### 9. Soft Deletes for Multi-Device Safety

Never hard-delete conversations. If one device deletes while another is offline, hard deletes cause permanent desync.

```typescript
// Instead of DELETE, set deletedAt
await db.conversations.update(id, {
  deletedAt: Date.now(),
  pendingSync: true,
})

// UI hides conversations where deletedAt is set
// fetchConversations syncs deletedAt from server
// Can implement "Trash" view later if needed
```

## Security Model

| Action | Private | Shared |
|--------|---------|--------|
| View conversation | Creator only | All org members |
| Add messages | Creator only | Creator only |
| Edit title | Creator only | Creator only |
| Delete | Creator only | Creator only |
| Share/Unshare | Creator only | Creator only |
| Manage tabs | Creator only | Creator only |

## Sync Behavior

1. **On app load**: Fetch conversation + tab metadata only (NOT messages)
2. **On conversation open**: Fetch messages for active tab (lazy loading)
3. **On message add**: Queue sync (debounced 2s)
4. **On tab change**: Queue sync (debounced 2s)
5. **On share/unshare**: Immediate sync
6. **Offline**: Local changes queued, synced when online with exponential backoff
7. **Shared conversations**: Subscribe to Supabase Realtime for live updates

### Lazy Loading (CRITICAL for 200+ editors)

**NEVER load all messages on workspace load.** With many users and large histories, this would be catastrophic.

```typescript
// Initial fetch: metadata only
.select("id, workspace, org_id, creator_id, title, visibility, created_at, updated_at, conversation_tabs(id, name, position)")

// On tab open: fetch messages for that tab
.from("messages").select("*").eq("tab_id", tabId).order("created_at")

// Pagination for very long conversations
.lte("created_at", cursor).limit(PAGE_SIZE)
```

### Offline Retry Strategy

```typescript
export interface DbConversation {
  // ... existing fields
  lastSyncError?: string
  lastSyncAttemptAt?: number
  nextRetryAt?: number  // Exponential backoff
}
```

On error, set `nextRetryAt = now + backoff`. Use `window.addEventListener("online")` to trigger retry.

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first for context (this doc)
2. **[Part 2: Schema](./two-dexie-schema.md)** - Implement Supabase + Dexie schema
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, hooks, store
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - Streaming message lifecycle
