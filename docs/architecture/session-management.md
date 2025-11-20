# Session Management

Session persistence, conversation locking, and context resumption patterns.

## Overview

Sessions enable:
- **Persistence** - Resume conversations after browser close
- **Context preservation** - Maintain conversation history
- **Tool skip** - Avoid re-executing tools on resume
- **Concurrency safety** - Prevent race conditions

## Session Store Interface

```typescript
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
```

**Session Key Format:** `${userId}::${workspace}::${conversationId}`

## Current Implementation

**Location:** `features/auth/lib/sessionStore.ts`

```typescript
class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.sessions.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.sessions.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.sessions.delete(key)
  }
}

export const sessionStore = new InMemorySessionStore()
```

**⚠️ Limitation:** In-memory storage loses sessions on server restart.

**Production TODO:** Replace with Redis or database for persistence.

## Session Lifecycle

### 1. New Conversation

```typescript
// No session exists yet
const sessionKey = `${userId}::${workspace}::${conversationId}`
const sessionId = await sessionStore.get(sessionKey)  // null

// Run SDK query without sessionId
const response = await sdk.query(prompt, {
  // no sessionId parameter
  ...options
})

// Store session ID from response
await sessionStore.set(sessionKey, response.sessionId)
```

### 2. Resume Conversation

```typescript
// Session exists from previous message
const sessionKey = `${userId}::${workspace}::${conversationId}`
const sessionId = await sessionStore.get(sessionKey)  // "session_abc123"

// Resume with existing session
const response = await sdk.query(prompt, {
  sessionId,  // SDK restores context, skips tool re-execution
  ...options
})

// Update with new session ID (if changed)
await sessionStore.set(sessionKey, response.sessionId)
```

### 3. Session Cleanup

```typescript
// Delete session when conversation reset
await sessionStore.delete(sessionKey)
```

## SDK Session Behavior

**With sessionId:**
- ✅ Restores conversation context
- ✅ Skips tool re-execution (results cached)
- ✅ Maintains message history
- ⚡ Faster response (no redundant work)

**Without sessionId:**
- Starts fresh conversation
- Executes all tools
- No previous context

## Conversation Locking

### Problem

Concurrent requests to same conversation cause:
- Message order corruption
- Session ID conflicts
- Duplicate tool executions
- Race conditions in sessionStore

### Solution

```typescript
const activeConversations = new Set<string>()

export async function POST(req: Request) {
  const { userId, workspace, conversationId } = await parseRequest(req)
  const conversationKey = `${userId}::${workspace}::${conversationId}`

  // 1. Check if conversation in progress
  if (activeConversations.has(conversationKey)) {
    return Response.json(
      { error: 'Conversation in progress' },
      { status: 409 }
    )
  }

  // 2. Lock conversation
  activeConversations.add(conversationKey)

  try {
    // 3. Resume session
    const sessionId = await sessionStore.get(conversationKey)

    // 4. Run SDK query
    const response = await sdk.query(prompt, { sessionId, ...options })

    // 5. Update session
    await sessionStore.set(conversationKey, response.sessionId)

    return Response.json({ ok: true, result: response })

  } finally {
    // 6. Always unlock, even on error
    activeConversations.delete(conversationKey)
  }
}
```

**Guarantees:**
- ✅ Only one request per conversation at a time
- ✅ Lock released even if error occurs
- ✅ 409 Conflict returned to concurrent requests

## Client-Side Handling

### Disable Send Button

```typescript
const [isStreaming, setIsStreaming] = useState(false)

function handleSend() {
  setIsStreaming(true)
  // ... send request
}

// In JSX
<Button disabled={isStreaming}>
  Send
</Button>
```

### Handle 409 Conflict

```typescript
const response = await fetch('/api/claude/stream', {
  method: 'POST',
  body: JSON.stringify({ message, conversationId })
})

if (response.status === 409) {
  // Show message: "Please wait for current message to complete"
  return
}
```

## Session Key Patterns

### Per-Workspace Sessions

```typescript
// Different workspaces = different sessions
const key1 = `user123::example.com::conv1`
const key2 = `user123::demo.com::conv1`  // Different workspace
// key1 !== key2
```

### Per-Conversation Sessions

```typescript
// Same workspace, different conversation = different sessions
const key1 = `user123::example.com::conv1`
const key2 = `user123::example.com::conv2`  // Different conversation
// key1 !== key2
```

### Shared Conversations

```typescript
// Same user, workspace, conversation = shared session
const key1 = `user123::example.com::conv1`
const key2 = `user123::example.com::conv1`  // Same everything
// key1 === key2 (shares session)
```

## Production Session Store

### Redis Implementation (Recommended)

```typescript
import { Redis } from '@upstash/redis'

class RedisSessionStore implements SessionStore {
  private redis = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN
  })

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value, {
      ex: 60 * 60 * 24 * 30  // 30 day expiry
    })
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key)
  }
}
```

### Database Implementation

```typescript
class DatabaseSessionStore implements SessionStore {
  async get(key: string): Promise<string | null> {
    const session = await db.session.findUnique({ where: { key } })
    return session?.sessionId ?? null
  }

  async set(key: string, value: string): Promise<void> {
    await db.session.upsert({
      where: { key },
      create: { key, sessionId: value },
      update: { sessionId: value }
    })
  }

  async delete(key: string): Promise<void> {
    await db.session.delete({ where: { key } })
  }
}
```

## Session Debugging

### Logging

```typescript
console.log('[Session] Lookup:', {
  key: sessionKey,
  found: !!sessionId,
  sessionId: sessionId?.slice(0, 8)
})

console.log('[Session] Stored:', {
  key: sessionKey,
  sessionId: response.sessionId.slice(0, 8)
})
```

### Inspect Session Store

```typescript
// In dev tools console
fetch('/api/debug/sessions')
  .then(r => r.json())
  .then(console.log)
```

## Common Issues

**Sessions not persisting across restarts:**
- Using InMemorySessionStore (expected behavior)
- Solution: Implement Redis or database store

**Conversation locked indefinitely:**
- Server crashed without releasing lock
- Solution: Add lock timeout or use Redis locks with TTL

**Session ID not updating:**
- Check `sessionStore.set()` called after SDK response
- Verify session key format matches

**Multiple users sharing session:**
- Missing userId in session key
- Solution: Ensure key includes `${userId}::`

## Testing Sessions

### Unit Tests

```typescript
describe('SessionStore', () => {
  it('stores and retrieves sessions', async () => {
    const store = new InMemorySessionStore()
    await store.set('test-key', 'session-123')
    const result = await store.get('test-key')
    expect(result).toBe('session-123')
  })

  it('returns null for missing sessions', async () => {
    const store = new InMemorySessionStore()
    const result = await store.get('nonexistent')
    expect(result).toBeNull()
  })
})
```

### Integration Tests

```typescript
describe('Session Resumption', () => {
  it('resumes conversation with sessionId', async () => {
    // First request
    const res1 = await fetch('/api/claude/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', conversationId: 'test' })
    })
    const sessionId1 = await extractSessionId(res1)

    // Second request (should resume)
    const res2 = await fetch('/api/claude/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Continue', conversationId: 'test' })
    })

    // Verify session resumed (check logs or response)
  })
})
```

## See Also

- [Architecture: Message Handling](./message-handling.md) - SSE streaming patterns
- [Security: Authentication](../security/authentication.md) - JWT sessions
- [Testing: Integration Tests](../testing/integration-testing.md) - Test session flows
