# Session Management

## Files

- `features/auth/lib/sessionStore.ts`
- `features/auth/types/session.ts` (conversation locking)
- `app/api/claude/stream/route.ts` (integration)

## SessionStore Interface

```typescript
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
```

## Default Implementation

In-memory `Map<string, string>`:

```typescript
const memory = new Map<string, string>()

export const SessionStoreMemory: SessionStore = {
  async get(key: string) {
    return memory.get(key) ?? null
  },
  async set(key: string, value: string) {
    memory.set(key, value)
  },
  async delete(key: string) {
    memory.delete(key)
  },
}
```

**⚠️ Warning:** Loses all sessions on server restart. Use Redis or database in production.

## Session Key

```typescript
const sessionKey = `${userId}::${workspace}::${conversationId}`
// Example: "user-123::example-com::conv-456"
```

## Conversation Locking

Prevent concurrent requests to same conversation:

```typescript
const activeConversations = new Set<string>()

const conversationKey = `${userId}::${workspace}::${conversationId}`

if (activeConversations.has(conversationKey)) {
  return res.status(409).json({
    error: 'CONVERSATION_IN_PROGRESS',
    message: 'A query is already in progress for this conversation',
  })
}

activeConversations.add(conversationKey)

try {
  const q = query({ prompt: message, options: claudeOptions })
  for await (const m of q) {
    // ... send events
  }
} finally {
  activeConversations.delete(conversationKey)
}
```

## Session Resumption

1. Client sends `conversationId`
2. Lookup: `const sessionId = await sessionStore.get(conversationKey)`
3. Pass to SDK: `{ resume: sessionId, ... }`
4. SDK restores context, skips re-executing prior tools
5. Save updated session: `await sessionStore.set(conversationKey, updatedSessionId)`

**Result:** No context loss on refresh, no tool re-execution.

## Redis Migration

Replace in-memory store:

```typescript
import redis from 'redis'

const client = redis.createClient()

export const sessionStoreRedis: SessionStore = {
  async get(key: string) {
    return await client.get(key)
  },
  async set(key: string, value: string) {
    await client.set(key, value, { EX: 86400 })  // 24h TTL
  },
  async delete(key: string) {
    await client.del(key)
  },
}
```

Update route to use `sessionStoreRedis` instead of `SessionStoreMemory`. No other changes needed.

## Verification Checklist

**In-memory store:**
- [ ] Conversation lock fires on concurrent requests (409 response)
- [ ] Session ID saved after first query
- [ ] Second query with same conversationId resumes (resume: sessionId passed)
- [ ] Tools not re-executed on resume
- [ ] Session lost on server restart (expected)

**Redis store:**
- [ ] Redis server running: `redis-cli ping` returns PONG
- [ ] Session persists across server restarts
- [ ] TTL respected (24h default)
- [ ] Old sessions auto-deleted
- [ ] Concurrent requests still locked (same Set behavior)

## Quick Debugging

**Check active conversations:**
```typescript
// In route handler
console.log('Active conversations:', Array.from(activeConversations))
```

**Inspect session:**
```bash
# For in-memory (if exposed):
curl -X POST http://localhost:8999/api/debug/sessions

# For Redis:
redis-cli GET "user-123::example-com::conv-456"
```

**Test resumption:**
```bash
# First request
curl -X POST /api/claude/stream \
  -d '{"message":"hello","conversationId":"test-1",...}'

# Extract sessionId from response
# Second request with same conversationId
curl -X POST /api/claude/stream \
  -d '{"message":"continue","conversationId":"test-1",...}'

# Should have resume: sessionId in second query
```
