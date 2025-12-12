# Plan Part 1: Architecture & Design

Architecture and design decisions for message storage with Dexie.js + Supabase + direct broker streaming.

## Problem Statement

Current messageStore uses Zustand + localStorage:
- **Storage limit**: ~5MB total (localStorage limit)
- **Performance**: Entire state serialized/deserialized on every change
- **No server persistence**: Data lost if browser storage cleared
- **No sharing**: Can't share conversations with team members
- **No tabs**: Conversations don't support multiple tabs
- **Double-hop streaming**: Browser → Next.js → Claude → Next.js → Browser

## Solution Overview

- **Dexie.js (IndexedDB)**: Fast local cache for offline-first experience
- **Supabase**: Server-side persistence for completed messages
- **Direct Broker Streaming**: Browser streams directly to broker, not through Next.js
- **Private by default**: Only creator sees their conversations
- **Shareable**: Can share with organization members
- **Lazy loading**: Messages loaded per-tab, not all at once

## Core Architecture: Direct Streaming

### The Critical Change

**OLD (Double Hop):**
```
Browser → Next.js → Broker → Next.js → Browser
            ↑                    ↑
       holds stream         holds stream
```

**NEW (Direct Streaming):**
```
Browser ─────────────────────────────────────> Broker (direct SSE)
   │                                              │
   │ 1. POST /api/stream-token                    │ 3. Verify token, stream
   ↓                    2. {token, brokerUrl}     │
 Next.js ─────────────────────────────────────────┘
 (auth gatekeeper only)
```

### Why This Matters

| Aspect | Double Hop | Direct Streaming |
|--------|------------|------------------|
| Latency | 2x copying | Minimal |
| Failure modes | 2 servers can fail | 1 server |
| Scaling | Web tier pinned by streams | Independent scaling |
| Memory | Both servers buffer | Only broker buffers |

## Data Model

### Key Relationships

```
Organization (org)
  └── Workspace (domain)
        └── Conversation (private or shared)
              └── Tab (each tab is a separate chat thread)
                    └── Messages[]

Stream (broker-managed)
  └── requestId (idempotency key)
  └── Messages[] (with seq ordering)
```

### Conversation Ownership

- **Conversation belongs to**: workspace (domain)
- **Conversation created by**: user (creatorId)
- **Conversation visibility**: private (only creator) or shared (all org members)
- **Tabs belong to**: conversation
- **Messages belong to**: tab (NOT directly to conversation)
- **Messages have**: stream_id + seq for ordering within a stream

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

## Architecture Diagram

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
│  │ • isStreaming     │    │ • messages (final only)          │  │
│  │ • streamText      │    │ • tabs                           │  │
│  │ • currentStreamId │    │                                  │  │
│  └──────────────────┘    └──────────────────────────────────┘  │
│           │                            │                        │
│           │                            │                        │
│           ▼                            ▼                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Stream Client                            │   │
│  │  • Get token from Next.js                               │   │
│  │  • Stream directly to Broker                            │   │
│  │  • Handle reconnection with replay                      │   │
│  │  • Write final messages to Dexie                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────┐    ┌─────────────────────────────────┐
│       Next.js           │    │           Broker                 │
│  (Auth Gatekeeper)      │    │   (Streaming Authority)          │
├─────────────────────────┤    ├─────────────────────────────────┤
│                         │    │                                 │
│  POST /api/stream-token │    │  POST /v1/streams               │
│  → Verify session       │    │  → Verify token                 │
│  → Mint signed token    │    │  → Start stream                 │
│  → Return broker URL    │    │  → Manage worker pool           │
│                         │    │                                 │
│  (Fallback proxy mode   │    │  GET /v1/streams/:id/events     │
│   for restricted envs)  │    │  → SSE event stream             │
│                         │    │                                 │
│                         │    │  GET /v1/streams/:id/replay     │
│                         │    │  → Missed events for reconnect  │
│                         │    │                                 │
│                         │    │  POST /v1/streams/:id/cancel    │
│                         │    │  → Idempotent cancellation      │
└─────────────────────────┘    └─────────────────────────────────┘
                                           │
                                           ▼
                               ┌─────────────────────────────────┐
                               │          Supabase               │
                               ├─────────────────────────────────┤
                               │  app.conversations              │
                               │  app.conversation_tabs          │
                               │  app.messages (final only)      │
                               │  app.streams (tracking)         │
                               │                                 │
                               │  RLS Policies:                  │
                               │  • Private: creator only        │
                               │  • Shared: org members read     │
                               └─────────────────────────────────┘
```

## Critical Design Decisions

### 1. User-Scoped Database Names (SECURITY CRITICAL)

Prevent different users from sharing the same IndexedDB:

```typescript
const ENV = process.env.NEXT_PUBLIC_ENV ?? "local"

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

### 2. Broker as Single Source of Truth for Streaming

```typescript
// Client state is DERIVED from broker events
// Client NEVER invents final status

// WRONG:
if (connectionLost) {
  setStatus("interrupted")  // Client deciding status
}

// RIGHT:
if (connectionLost) {
  const replay = await broker.replay(streamId, lastSeq)
  if (replay.ended) {
    setStatus(replay.finalState)  // Broker decided status
  }
}
```

### 3. Idempotency via requestId

Every stream request requires a client-generated UUID:

```typescript
interface StreamRequest {
  requestId: string  // Client-generated, stored locally
  messages: Message[]
}

// Broker maintains requestId → streamId mapping
// Duplicate requests return existing stream, not new one
```

### 4. Stream Events with Sequence Numbers

```typescript
interface StreamEvent {
  seq: number      // Monotonically increasing
  type: string
  // ... event-specific fields
}

// Enables:
// - Replay after disconnect: GET /replay?after=seq
// - Ordering guarantee for persistence
// - Duplicate detection
```

### 5. No Dexie Writes During Streaming

**OLD (problematic):**
```typescript
// Debounced Dexie snapshots during streaming
scheduleFlushStreamingSnapshot(messageId, userId)  // Every 300ms
```

**NEW (simplified):**
```typescript
// Zustand holds live text during streaming
// Dexie write happens ONCE on stream end
// If disconnect, replay from broker to get final state
```

### 6. Lazy Loading (CRITICAL for 200+ editors)

**NEVER load all messages on workspace load.**

```typescript
// Initial fetch: metadata only
.select("id, workspace, title, visibility, created_at, updated_at, conversation_tabs(id, name, position)")

// On tab open: fetch messages for that tab
.from("messages").select("*").eq("tab_id", tabId).order("created_at")

// Pagination for very long conversations
.lte("created_at", cursor).limit(PAGE_SIZE)
```

### 7. Soft Deletes for Multi-Device Safety

Never hard-delete. If one device deletes while another is offline, hard deletes cause permanent desync.

```typescript
await db.conversations.update(id, {
  deletedAt: Date.now(),
  pendingSync: true,
})
```

### 8. Per-Org Quotas at Broker Level

```typescript
// Enforced BEFORE stream starts
interface OrgQuotas {
  maxConcurrentStreams: number  // e.g., 5
  maxQueuedRequests: number     // e.g., 10
}

// Prevents noisy neighbor - one org can't starve others
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

### Stream Token Security

```typescript
interface StreamToken {
  sub: string   // userId
  org: string   // orgId
  ws: string    // workspace
  tab: string   // tabId
  rid: string   // requestId
  exp: number   // 60 second TTL
  sig: string   // HMAC-SHA256 signature
}

// Next.js mints tokens, Broker verifies
// No shared secrets in client
// Token expires quickly, minimizing exposure
```

## Sync Behavior

1. **On app load**: Fetch conversation + tab metadata only (NOT messages)
2. **On conversation open**: Fetch messages for active tab (lazy loading)
3. **On stream complete**: Write final messages to Dexie + queue Supabase sync
4. **On tab change**: Queue sync (debounced 2s)
5. **On share/unshare**: Immediate sync
6. **Offline**: Local changes queued, synced when online with exponential backoff
7. **Shared conversations**: Subscribe to Supabase Realtime for live updates

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first for context (this doc)
2. **[Part 2: Schema](./two-dexie-schema.md)** - Implement Supabase + Dexie schema
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, hooks, store
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - Direct broker streaming

## Related Documents

- **[ARCHITECTURE_REVISION.md](./ARCHITECTURE_REVISION.md)** - Why we made these changes
- **[DIRECT_STREAMING_CONTRACT.md](./DIRECT_STREAMING_CONTRACT.md)** - Hard specs for streaming
