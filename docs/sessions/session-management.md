# Session Management - Current State

This document describes how sessions are currently managed in the Claude Bridge application. There are **three distinct session systems** that serve different purposes.

---

## 1. Authentication Sessions (JWT Cookies)

**Purpose**: User authentication and workspace access control

**Files**:
- `features/auth/lib/jwt.ts` - JWT token creation/verification
- `features/auth/lib/auth.ts` - Authentication helpers
- `app/api/login/route.ts` - Login endpoint

**Storage**: httpOnly cookie named `"session"`

**Token Format**:
```typescript
interface SessionPayload {
  workspaces: string[]  // List of workspaces user is authenticated for
  iat?: number          // Issued at timestamp (JWT standard)
  exp?: number          // Expiration timestamp (JWT standard)
}
```

**Token Lifetime**: 30 days

**JWT Secret**:
- Development: `"INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"`
- Production: Must be set via `JWT_SECRET` environment variable or server fails to start

**How It Works**:

1. User submits workspace domain + passcode to `/api/login`
2. Server validates passcode against `domain-passwords.json`
3. If valid, creates JWT with `workspaces: [domain]`
4. JWT stored in httpOnly cookie
5. Future logins to other workspaces add to the `workspaces` array
6. Protected routes check cookie presence and decode JWT to verify workspace access

**Cookie Verification Pattern** (used in all protected routes):
```typescript
const jar = await cookies()
if (!hasSessionCookie(jar.get("session"))) {
  return NextResponse.json({ error: "NO_SESSION" }, { status: 401 })
}
```

**Workspace Authorization**:
```typescript
const isAuth = await isWorkspaceAuthenticated(workspace)
// Returns true if JWT contains workspace in workspaces array
```

---

## 2. Backend Conversation Persistence (SDK Sessions)

**Purpose**: Resume Claude SDK conversations without re-executing tools

**Files**:
- `features/auth/lib/sessionStore.ts` - Store interface and implementation
- `app/api/claude/stream/route.ts` - Usage (lines 280-283)

**Storage**: In-memory `Map<string, string>`

**Key Format**:
```typescript
const sessionKey = `${userId}::${workspace}::${conversationId}`
// Example: "anon-abc123::example.com::550e8400-e29b-41d4-a716-446655440000"
```

**Value**: SDK session ID (opaque string from `@anthropic-ai/claude-agent-sdk`)

**Interface**:
```typescript
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, val: string): Promise<void>
  delete(key: string): Promise<void>
}
```

**Current Implementation**: `SessionStoreMemory` - simple in-memory Map
- All sessions lost on server restart
- No TTL or expiration
- No persistence

**How It Works**:

1. Client sends `conversationId` (UUID) with each request
2. Backend constructs key: `${userId}::${workspace}::${conversationId}`
3. Lookup existing SDK session: `const sessionId = await SessionStoreMemory.get(key)`
4. If found, pass to SDK: `query({ resume: sessionId, ... })`
5. SDK restores conversation context, skips re-executing previous tools
6. After query completes, save new session ID: `await SessionStoreMemory.set(key, newSessionId)`

**Benefits**: User can refresh page, continue conversation without tools re-running

**Limitations**: Sessions lost on server restart (in-memory only)

---

## 3. Frontend Session Tracking (Client State)

**Purpose**: Track which conversationId belongs to each workspace, persist across page reloads

**File**: `lib/stores/sessionStore.ts` (Zustand store)

**Storage**: Browser localStorage (key: `"claude-session-storage"`)

**State Shape**:
```typescript
interface SessionState {
  currentConversationId: string | null
  currentWorkspace: string | null
  sessions: ConversationSession[]
}

interface ConversationSession {
  conversationId: string    // UUID
  workspace: string          // Domain (e.g., "example.com")
  lastActivity: number       // Timestamp
}
```

**Max Sessions**: 10 (oldest conversations pruned when limit exceeded)

**Actions**:
- `initConversation(workspace)` - Get or create conversationId for workspace
- `newConversation(workspace)` - Force new conversationId
- `updateActivity()` - Update timestamp for current conversation
- `clearWorkspaceConversation(workspace)` - Delete specific workspace session
- `clearAll()` - Delete all sessions

**How It Works**:

1. User loads chat page for workspace (e.g., `example.com/chat`)
2. Component calls `initConversation("example.com")`
3. Store checks if session exists for this workspace
4. If yes, returns existing `conversationId`
5. If no, generates new UUID via `crypto.randomUUID()`, saves to localStorage
6. ConversationId sent to backend in all requests
7. When user closes browser and returns, conversationId restored from localStorage
8. Backend uses this conversationId to resume SDK session (see section 2)

**Persistence**: Survives page refresh, browser restart, but NOT browser data clear

---

## 4. Conversation Locking (Concurrency Control)

**Purpose**: Prevent multiple simultaneous requests to the same conversation

**File**: `features/auth/types/session.ts`

**Storage**: In-memory `Set<string>` (not persisted anywhere)

**Key Format**: Same as backend session key: `${userId}::${workspace}::${conversationId}`

**State**:
```typescript
const activeConversations = new Set<string>()           // Currently locked conversations
const conversationLockTimestamps = new Map<string, number>()  // Lock acquisition time
```

**Lock Timeout**: 5 minutes (300,000 ms)

**How It Works**:

1. Request arrives at `/api/claude/stream`
2. Construct lock key: `${userId}::${workspace}::${conversationId}`
3. Call `tryLockConversation(key)`
4. If lock exists and is < 5 minutes old, return `409 Conflict`
5. If lock exists and is > 5 minutes old, force unlock and acquire
6. If no lock, acquire lock (add to Set, record timestamp)
7. Process request
8. Finally block: `unlockConversation(key)` - remove from Set and timestamp Map

**Stale Lock Cleanup**:
- Automatic cleanup runs every 60 seconds
- Removes locks older than 5 minutes
- Prevents memory leaks from abandoned requests

**Purpose of Timeout**: If client disconnects mid-request, lock auto-releases after 5 minutes

---

## Interaction Between Systems

**Login Flow**:
1. User enters domain + passcode → `/api/login`
2. JWT created with workspace → **System 1** (Auth)
3. Cookie sent to browser
4. User redirects to `/chat`
5. Frontend calls `initConversation(workspace)` → **System 3** (Frontend)
6. ConversationId generated, saved to localStorage

**First Message Flow**:
1. User types message, clicks send
2. Frontend reads conversationId from Zustand store → **System 3**
3. POST to `/api/claude/stream` with conversationId
4. Backend checks JWT cookie → **System 1** (Auth)
5. Backend tries to lock conversation → **System 4** (Locking)
6. Backend looks up SDK session → **System 2** (Backend) - none found
7. SDK query runs without resume
8. SDK returns new sessionId
9. Backend saves sessionId to SessionStoreMemory → **System 2**
10. Response streamed to client

**Subsequent Message Flow**:
1. User types another message
2. Frontend reads **same** conversationId from Zustand → **System 3**
3. POST to `/api/claude/stream` with conversationId
4. Backend checks JWT cookie → **System 1** (Auth)
5. Backend tries to lock conversation → **System 4** (Locking)
6. Backend looks up SDK session → **System 2** (Backend) - **found!**
7. SDK query runs WITH resume (context restored, tools not re-executed)
8. SDK returns updated sessionId
9. Backend updates sessionId in SessionStoreMemory → **System 2**
10. Response streamed to client

**Page Refresh Flow**:
1. User refreshes browser
2. JWT cookie persists (httpOnly) → **System 1**
3. Zustand store restores from localStorage → **System 3**
4. ConversationId retrieved for workspace
5. Next message uses existing conversationId
6. Backend resumes SDK session → **System 2**
7. Conversation continues where user left off

**Server Restart Flow**:
1. Server restarts
2. JWT cookies still valid (stored in browser) → **System 1** ✓
3. Frontend Zustand still has conversationId (localStorage) → **System 3** ✓
4. Backend SessionStoreMemory cleared (in-memory) → **System 2** ✗
5. Conversation locks cleared (in-memory) → **System 4** ✗
6. Next message: Backend cannot resume SDK session (no sessionId found)
7. SDK starts new conversation (context lost)
8. User sees response but prior context forgotten

---

## Files Reference

**Authentication (System 1)**:
- `features/auth/lib/jwt.ts` - Token operations
- `features/auth/lib/auth.ts` - Verification helpers
- `features/auth/types/guards.ts` - Type guards for cookies
- `app/api/login/route.ts` - Login endpoint

**Backend Persistence (System 2)**:
- `features/auth/lib/sessionStore.ts` - Store interface + in-memory impl
- `app/api/claude/stream/route.ts` - Usage (get/set session)

**Frontend Tracking (System 3)**:
- `lib/stores/sessionStore.ts` - Zustand store
- `features/chat/hooks/useConversationSession.ts` - React hook wrapper

**Conversation Locking (System 4)**:
- `features/auth/types/session.ts` - Lock implementation
- `app/api/claude/stream/route.ts` - Lock usage (try/unlock)

---

## Current Limitations

**System 2 (Backend Persistence)**:
- In-memory only, lost on restart
- No expiration/TTL
- No cleanup of old sessions
- Memory grows unbounded

**System 4 (Conversation Locking)**:
- In-memory only, not shared across server instances
- If multiple backend servers, locks not coordinated
- 5-minute timeout is arbitrary (no user configuration)

---

## Environment Variables

**JWT_SECRET**: Secret key for signing authentication tokens
- Development: Uses default (server logs warning)
- Production: Must be set or server refuses to start

**No other session-related environment variables currently used.**
