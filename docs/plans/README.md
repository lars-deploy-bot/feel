# Plans Index

Implementation plans for message storage with Dexie.js, Supabase, and direct broker streaming.

## Reading Order

| # | Document | Description | Est. Time |
|---|----------|-------------|-----------|
| 1 | [one-dexie-architecture.md](./one-dexie-architecture.md) | Architecture decisions, data model, security | 15 min read |
| 2 | [two-dexie-schema.md](./two-dexie-schema.md) | Supabase tables, Dexie schema, RLS policies | 20 min read |
| 3 | [three-dexie-implementation.md](./three-dexie-implementation.md) | Sync service, React hooks, Zustand store | 30 min read |
| 4 | [four-dexie-streaming-integration.md](./four-dexie-streaming-integration.md) | Direct broker streaming, client hooks | 25 min read |

## Key Architecture Decisions

### Direct Browser-to-Broker Streaming

```
Browser ──────────────────────────> Broker (direct SSE)
   │                                   │
   │ 1. POST /api/stream-token         │ 3. Verify, stream
   ↓                                   │
 Next.js ──────────────────────────────┘
 (auth only)
```

**Why?**
- Single hop instead of double (Browser → Next → Broker → Next → Browser)
- Half the latency, half the failure modes
- Next.js web tier can scale independently from streaming

### Broker as Single Source of Truth

- Broker owns stream state machine (running/complete/interrupted/error)
- Client displays what broker emits, never invents final status
- On disconnect, client fetches authoritative state via replay endpoint

### No Dexie Writes During Streaming

- Streaming text lives in Zustand (in-memory)
- Final message written to Dexie ONCE on stream end
- Simplifies state, eliminates race conditions

### Idempotency via requestId

- Every stream request has client-generated UUID
- Broker tracks requestId → streamId mapping
- Duplicate requests return existing stream

## Implementation Phases

### Phase 1: Foundation (~4 hours)
- [ ] Create `packages/bridge-types` with shared event types
- [ ] Add stream_id, seq fields to Dexie/Supabase schemas

### Phase 2: Storage Layer (~10 hours)
- [ ] Implement Dexie schema (messageDb.ts)
- [ ] Implement sync service (conversationSync.ts)
- [ ] Implement React hooks (useMessageDb.ts)
- [ ] Implement message store (messageStore.ts)
- [ ] Migration from localStorage

### Phase 3: Streaming (~10 hours)
- [ ] Create /api/stream-token endpoint
- [ ] Implement useStreamClient hook
- [ ] Implement useChat hook
- [ ] UI integration (MessageList)

### Phase 4: Broker (separate project)
- [ ] Token verification
- [ ] Stream state machine
- [ ] Event replay buffer
- [ ] Worker pool
- [ ] Quotas

**Total estimate: ~24 hours** (excluding broker)

## File Structure

```
packages/
└── bridge-types/                 # Shared event types
    └── src/
        ├── events.ts             # StreamEvent types
        ├── tokens.ts             # Token types
        └── index.ts

apps/web/
├── app/api/
│   └── stream-token/route.ts     # Token minting
├── lib/
│   ├── db/
│   │   ├── messageDb.ts          # Dexie schema
│   │   ├── safeDb.ts             # Error handling
│   │   ├── messageAdapters.ts    # Type adapters
│   │   ├── useMessageDb.ts       # React hooks
│   │   ├── conversationSync.ts   # Supabase sync
│   │   └── migrateLegacyStorage.ts
│   └── stores/
│       └── messageStore.ts       # Zustand store
└── features/chat/
    └── hooks/
        ├── useStreamClient.ts    # Stream client
        └── useChat.ts            # Chat hook
```

## Testing Strategy

### Unit Tests
- Token signing/verification
- Event type guards
- Message adapters

### Integration Tests
- Dexie CRUD operations
- Sync to Supabase
- Stream lifecycle

### E2E Tests
- Full stream flow (user sends → stream → complete)
- Reconnection after disconnect
- Multi-tab behavior

## Other Plans (Unrelated)

| Document | Description |
|----------|-------------|
| [shared-assets-tool.md](./shared-assets-tool.md) | Copying fonts/icons to workspaces |
| [file-upload-sdk-reading-plan.md](./file-upload-sdk-reading-plan.md) | File upload support |
| [superadmin-bridge-editing.md](./superadmin-bridge-editing.md) | Superadmin workspace access |
