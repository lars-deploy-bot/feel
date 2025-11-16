# Users & Workspaces Database Migration Plan

**Status:** Planning Phase
**Created:** 2025-11-14
**Complexity:** High (Architecture-level change)

---

## Executive Summary

Migrate from **workspace-first JSON storage** to **user-first relational database** with proper Users, Workspaces, and UserWorkspace junction tables.

**Current:** Workspaces own passwords → Users accumulate workspace access in JWT
**Target:** Users own accounts → Users are granted access to Workspaces

---

## Current Architecture Analysis

### 1. Data Storage

**File:** `/var/lib/claude-bridge/domain-passwords.json`

**Structure:**
```json
{
  "demo.goalive.nl": {
    "tenantId": "f22288ad-636c-4fe9-b41c-acd0cb8fd25c",
    "port": 3333,
    "passwordHash": "$2b$12$...",
    "createdAt": "2025-11-06T20:46:37.000Z",
    "credits": 200,
    "email": "user@example.com"  // Optional
  }
}
```

**Key Properties:**
- Workspace (domain) is the primary key
- Each workspace has its own password
- `tenantId` already exists (can be repurposed)
- Email is optional and inconsistent

### 2. Authentication Flow

**Login:**
1. User provides `workspace` + `passcode`
2. System validates against `domain-passwords.json[workspace].passwordHash`
3. Create/update JWT: `{ workspaces: ["demo.goalive.nl", ...] }`
4. Cookie stored with JWT

**Authorization:**
```typescript
const payload = verifySessionToken(jwt)
if (payload.workspaces.includes(requestedWorkspace)) {
  // Authorized
}
```

### 3. Session System

**Key Format:** `${userId}::${workspace}::${conversationId}`
**userId:** JWT token value or `anon-{random}` (not a real user ID)

### 4. Files Involved

**Core:**
- `apps/web/types/guards/api.ts` - Password validation
- `apps/web/features/auth/lib/jwt.ts` - Token management
- `apps/web/features/auth/lib/auth.ts` - Auth helpers
- `apps/web/app/api/login/route.ts` - Login endpoint

**Types:**
- `apps/web/types/domain.ts` - `DomainConfig`, `DomainPasswords`

**Usage:**
- All API routes that call `isWorkspaceAuthenticated()`
- Manager dashboard (`/app/manager`)
- Claude stream API (`/app/api/claude/stream`)

---

## Target Architecture

### 1. Database Schema

#### Table: `users`
```typescript
interface User {
  id: string              // UUID (primary key)
  email: string           // Unique, required
  passwordHash: string    // bcrypt hash
  name: string | null     // Display name
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}
```

#### Table: `workspaces`
```typescript
interface Workspace {
  id: string              // UUID (primary key) - reuse existing tenantId
  domain: string          // Unique (e.g., "demo.goalive.nl")
  port: number            // Service port (3333, 3334, etc.)
  credits: number         // Default 200
  createdAt: Date
  updatedAt: Date

  // Future: workspace-level settings
  maxConcurrentConversations?: number
  allowedModels?: string[]
}
```

#### Table: `user_workspaces` (Junction)
```typescript
interface UserWorkspace {
  id: string              // UUID (primary key)
  userId: string          // Foreign key -> users.id
  workspaceId: string     // Foreign key -> workspaces.id
  role: 'owner' | 'member' | 'viewer'  // Access level
  createdAt: Date

  // Unique constraint: (userId, workspaceId)
}
```

#### Table: `sessions` (Optional - for better tracking)
```typescript
interface Session {
  id: string              // UUID (session ID)
  userId: string          // Foreign key -> users.id
  workspaceId: string     // Foreign key -> workspaces.id
  conversationId: string  // UUID (from frontend)
  sdkSessionId: string    // Anthropic SDK session ID
  lastActivity: Date
  expiresAt: Date

  // Unique constraint: (userId, workspaceId, conversationId)
}
```

### 2. New JWT Structure

**Option A: User ID Only (Recommended)**
```typescript
interface SessionPayload {
  userId: string          // User UUID
  iat?: number
  exp?: number
}
```

**Authorization Flow:**
1. Decode JWT → get `userId`
2. Query DB: `SELECT workspaces.* FROM user_workspaces WHERE userId = ?`
3. Check if requested workspace is in result set

**Option B: Cached Workspace List (Performance)**
```typescript
interface SessionPayload {
  userId: string
  workspaces: string[]    // Cached for performance
  iat?: number
  exp?: number
}
```

**Tradeoff:** Requires JWT regeneration when workspace access changes, but faster authorization.

### 3. New Authentication Flow

**Registration (New):**
```
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "...",
  "name": "John Doe"
}
→ Create user record
→ Create JWT with userId
→ Set session cookie
```

**Login:**
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "..."
}
→ Verify credentials against users table
→ Create JWT with userId
→ Set session cookie
```

**Workspace Selection (Modified):**
```
POST /api/auth/select-workspace
{
  "workspaceId": "f22288ad-..."
}
→ Verify user has access via user_workspaces
→ Update session context (cookie/localStorage)
→ Redirect to /chat?workspace=demo.goalive.nl
```

**Authorization:**
```typescript
async function isWorkspaceAuthorized(workspaceId: string): Promise<boolean> {
  const user = await getSessionUser()  // From JWT
  if (!user) return false

  const access = await db.query(
    'SELECT 1 FROM user_workspaces WHERE userId = ? AND workspaceId = ?',
    [user.id, workspaceId]
  )
  return access.length > 0
}
```

---

## Migration Strategy

### Phase 1: Database Setup

**1.1 Choose ORM**

**Recommendation: Drizzle ORM**
- Zero runtime overhead (just SQL builder)
- TypeScript-first
- Works with Bun out of the box
- Better performance than Prisma for Next.js
- Easy migration from JSON

**Alternative: Prisma**
- More mature ecosystem
- Better tooling (Prisma Studio)
- Heavier runtime

**Decision Point:** Recommend Drizzle for this use case (performance + simplicity).

**1.2 Choose Database**

**Development:**
- SQLite (file-based, zero config)
- Path: `/var/lib/claude-bridge/database.sqlite`

**Production (Future):**
- PostgreSQL (when scaling beyond single server)
- Connection pooling with PgBouncer

**Start with SQLite, design schema to be PostgreSQL-compatible.**

**1.3 Install Dependencies**

```bash
cd apps/web
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3
```

**1.4 Define Schema**

**File:** `apps/web/lib/db/schema.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
})

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  domain: text('domain').unique().notNull(),
  port: integer('port').notNull(),
  credits: integer('credits').notNull().default(200),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const userWorkspaces = sqliteTable('user_workspaces', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'member', 'viewer'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').notNull(),
  sdkSessionId: text('sdk_session_id').notNull(),
  lastActivity: integer('last_activity', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})
```

**1.5 Create Database Client**

**File:** `apps/web/lib/db/client.ts`

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DB_PATH = process.env.DATABASE_PATH || '/var/lib/claude-bridge/database.sqlite'

const sqlite = new Database(DB_PATH)
export const db = drizzle(sqlite, { schema })
```

**1.6 Run Initial Migration**

```bash
# Generate migration
bunx drizzle-kit generate:sqlite

# Apply migration
bunx drizzle-kit push:sqlite
```

### Phase 2: Data Migration Script

**Goal:** Convert existing `domain-passwords.json` to database records.

**File:** `scripts/migrate-json-to-db.ts`

```typescript
#!/usr/bin/env bun
import { randomUUID } from 'crypto'
import { db } from '../apps/web/lib/db/client'
import { users, workspaces, userWorkspaces } from '../apps/web/lib/db/schema'
import { loadDomainPasswords } from '../apps/web/types/guards/api'
import { hashPassword } from '../apps/web/types/guards/api'

async function migrate() {
  const domainPasswords = loadDomainPasswords()

  console.log(`Migrating ${Object.keys(domainPasswords).length} workspaces...`)

  for (const [domain, config] of Object.entries(domainPasswords)) {
    console.log(`\nProcessing: ${domain}`)

    // 1. Create workspace
    const workspaceId = config.tenantId || randomUUID()
    await db.insert(workspaces).values({
      id: workspaceId,
      domain,
      port: config.port,
      credits: config.credits || 200,
      createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
      updatedAt: new Date(),
    })
    console.log(`  ✓ Workspace created: ${workspaceId}`)

    // 2. Create default user for this workspace
    const userId = randomUUID()
    const email = config.email || `${domain.replace(/\./g, '-')}@bridge.local`

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash: config.passwordHash,  // Reuse existing bcrypt hash
      name: domain,  // Use domain as display name initially
      createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    })
    console.log(`  ✓ User created: ${email}`)

    // 3. Link user to workspace as owner
    await db.insert(userWorkspaces).values({
      id: randomUUID(),
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
    })
    console.log(`  ✓ User linked to workspace as owner`)
  }

  console.log('\n✅ Migration complete!')
  console.log('\nNext steps:')
  console.log('1. Backup domain-passwords.json: mv /var/lib/claude-bridge/domain-passwords.json /var/lib/claude-bridge/domain-passwords.json.backup')
  console.log('2. Update environment: Add DATABASE_PATH=/var/lib/claude-bridge/database.sqlite')
  console.log('3. Deploy new authentication code')
}

migrate().catch(console.error)
```

**Migration Strategy Options:**

**Option A: One User Per Workspace (Recommended for MVP)**
- Each existing workspace gets its own user account
- Email: Use `config.email` if present, else `{domain}@bridge.local`
- Password: Reuse existing `passwordHash` (already bcrypt)
- User name: Domain name initially
- Role: 'owner'

**Pros:**
- Backward compatible (same password per workspace)
- Easy rollback
- Users can update email/password later

**Cons:**
- Users who know multiple workspace passwords must remember multiple accounts

**Option B: Single Admin User For All Workspaces**
- Create one "bridge-admin" user
- Link all workspaces to this user
- Generate random password, share with admin

**Pros:**
- Single sign-on for admin

**Cons:**
- Loses per-workspace isolation
- Not suitable if workspaces have different owners

**Recommendation: Option A** - Maintains workspace isolation, can consolidate later via UI.

### Phase 3: Update Authentication Code

**3.1 Update JWT Payload**

**File:** `apps/web/features/auth/lib/jwt.ts`

```typescript
export interface SessionPayload {
  userId: string          // NEW: User UUID instead of workspace list
  iat?: number
  exp?: number
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId }
  return sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as SessionPayload

    if (!decoded.userId || typeof decoded.userId !== 'string') {
      console.error('[JWT] Invalid token payload: userId missing or invalid')
      return null
    }

    return decoded
  } catch (error) {
    // ... existing error handling
  }
}
```

**3.2 Update Auth Helpers**

**File:** `apps/web/features/auth/lib/auth.ts`

```typescript
import { db } from '@/lib/db/client'
import { users, workspaces, userWorkspaces } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export interface SessionUser {
  id: string
  email: string
  name: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const sessionCookie = jar.get('session')

  if (!sessionCookie || !hasSessionCookie(sessionCookie)) {
    return null
  }

  const sessionValue = sessionCookie.value

  // Test mode
  if (process.env.BRIDGE_ENV === 'local' && sessionValue === 'test-user') {
    return {
      id: 'test-user',
      email: 'test@bridge.local',
      name: 'Test User',
    }
  }

  // Verify JWT
  const payload = verifySessionToken(sessionValue)
  if (!payload) return null

  // Fetch user from database
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, payload.userId)
  })

  if (!userRecord) return null

  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
  }
}

export async function isWorkspaceAuthenticated(workspaceDomain: string): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false

  // Lookup workspace by domain
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.domain, workspaceDomain)
  })

  if (!workspace) return false

  // Check user has access
  const access = await db.query.userWorkspaces.findFirst({
    where: and(
      eq(userWorkspaces.userId, user.id),
      eq(userWorkspaces.workspaceId, workspace.id)
    )
  })

  return !!access
}

export async function getAuthenticatedWorkspaces(): Promise<string[]> {
  const user = await getSessionUser()
  if (!user) return []

  const userWorkspaceRecords = await db.query.userWorkspaces.findMany({
    where: eq(userWorkspaces.userId, user.id),
    with: {
      workspace: true
    }
  })

  return userWorkspaceRecords.map(uw => uw.workspace.domain)
}
```

**3.3 Update Login Endpoint**

**File:** `apps/web/app/api/login/route.ts`

**NEW APPROACH: Email/Password Login**

```typescript
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '@/types/guards/api'
import { createSessionToken } from '@/features/auth/lib/jwt'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get('origin')
  const body = await req.json().catch(() => ({}))
  const result = LoginSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_REQUEST,
        message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
        requestId,
      },
      { status: 400 }
    )
  }

  const { email, password } = result.data

  // Test mode
  if (process.env.BRIDGE_ENV === 'local' && email === 'test@bridge.local' && password === 'test') {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('session', 'test-user', { /* ... */ })
    return res
  }

  // Lookup user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  })

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
        requestId,
      },
      { status: 401 }
    )
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
        requestId,
      },
      { status: 401 }
    )
  }

  // Create JWT with userId
  const sessionToken = createSessionToken(user.id)

  const res = NextResponse.json({ ok: true, userId: user.id })
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.terminal.goalive.nl',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  // Update last login
  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id))

  return res
}
```

**3.4 Add Registration Endpoint**

**File:** `apps/web/app/api/auth/register/route.ts`

```typescript
import { randomUUID } from 'crypto'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { hashPassword } from '@/types/guards/api'
import { createSessionToken } from '@/features/auth/lib/jwt'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = RegisterSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }

  const { email, password, name } = result.data

  // Check if email already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email)
  })

  if (existing) {
    return NextResponse.json(
      { ok: false, error: 'EMAIL_ALREADY_EXISTS' },
      { status: 409 }
    )
  }

  // Create user
  const userId = randomUUID()
  const passwordHash = await hashPassword(password)

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name: name || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  })

  // Create session
  const sessionToken = createSessionToken(userId)

  const res = NextResponse.json({ ok: true, userId })
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.terminal.goalive.nl',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  return res
}
```

### Phase 4: Update Session Store

**Current:** Session keys use `${userId}::${workspace}::${conversationId}`
**Problem:** `userId` is currently JWT token value, which is unstable

**File:** `apps/web/features/auth/lib/sessionStore.ts`

**Replace In-Memory with Database-Backed:**

```typescript
import { db } from '@/lib/db/client'
import { sessions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export interface SessionStore {
  get(userId: string, workspaceId: string, conversationId: string): Promise<string | null>
  set(userId: string, workspaceId: string, conversationId: string, sdkSessionId: string): Promise<void>
  delete(userId: string, workspaceId: string, conversationId: string): Promise<void>
}

export const sessionStore: SessionStore = {
  async get(userId, workspaceId, conversationId) {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.workspaceId, workspaceId),
        eq(sessions.conversationId, conversationId)
      )
    })

    if (!session) return null

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.delete(userId, workspaceId, conversationId)
      return null
    }

    // Update last activity
    await db.update(sessions)
      .set({ lastActivity: new Date() })
      .where(eq(sessions.id, session.id))

    return session.sdkSessionId
  },

  async set(userId, workspaceId, conversationId, sdkSessionId) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Upsert
    const existing = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.workspaceId, workspaceId),
        eq(sessions.conversationId, conversationId)
      )
    })

    if (existing) {
      await db.update(sessions)
        .set({
          sdkSessionId,
          lastActivity: new Date(),
          expiresAt,
        })
        .where(eq(sessions.id, existing.id))
    } else {
      await db.insert(sessions).values({
        id: randomUUID(),
        userId,
        workspaceId,
        conversationId,
        sdkSessionId,
        lastActivity: new Date(),
        expiresAt,
      })
    }
  },

  async delete(userId, workspaceId, conversationId) {
    await db.delete(sessions)
      .where(and(
        eq(sessions.userId, userId),
        eq(sessions.workspaceId, workspaceId),
        eq(sessions.conversationId, conversationId)
      ))
  },
}
```

**Update Claude Stream Route:**

**File:** `apps/web/app/api/claude/stream/route.ts`

```typescript
// OLD:
const sessionKey = `${userId}::${workspace}::${conversationId}`
const sdkSessionId = await SessionStoreMemory.get(sessionKey)

// NEW:
const user = await requireSessionUser()
const workspaceRecord = await db.query.workspaces.findFirst({
  where: eq(workspaces.domain, workspace)
})
if (!workspaceRecord) {
  return new Response('Workspace not found', { status: 404 })
}

const sdkSessionId = await sessionStore.get(
  user.id,
  workspaceRecord.id,
  conversationId
)

// ... after SDK query completes ...

await sessionStore.set(
  user.id,
  workspaceRecord.id,
  conversationId,
  result.sessionId
)
```

### Phase 5: Update Frontend

**5.1 Update Login UI**

**File:** `apps/web/features/auth/components/LoginForm.tsx`

```tsx
// Change from workspace + passcode to email + password
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      // Redirect to workspace selection
      window.location.href = '/workspaces'
    } else {
      // Show error
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Log In</button>
    </form>
  )
}
```

**5.2 Add Workspace Selection Page**

**File:** `apps/web/app/workspaces/page.tsx`

```tsx
export default async function WorkspacesPage() {
  const user = await requireSessionUser()
  const workspaceList = await getAuthenticatedWorkspaces()

  return (
    <div>
      <h1>Select Workspace</h1>
      <ul>
        {workspaceList.map(domain => (
          <li key={domain}>
            <a href={`/chat?workspace=${domain}`}>{domain}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Phase 6: Backward Compatibility

**Problem:** Existing JWTs have `{ workspaces: string[] }`, new JWTs have `{ userId: string }`

**Solution: Grace Period with Dual Support**

**File:** `apps/web/features/auth/lib/jwt.ts`

```typescript
export interface LegacySessionPayload {
  workspaces: string[]
  iat?: number
  exp?: number
}

export interface SessionPayload {
  userId: string
  iat?: number
  exp?: number
}

export function verifySessionToken(token: string): SessionPayload | LegacySessionPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as any

    // New format: { userId: string }
    if (decoded.userId) {
      return { userId: decoded.userId, iat: decoded.iat, exp: decoded.exp }
    }

    // Legacy format: { workspaces: string[] }
    if (decoded.workspaces && Array.isArray(decoded.workspaces)) {
      return { workspaces: decoded.workspaces, iat: decoded.iat, exp: decoded.exp }
    }

    console.error('[JWT] Invalid token payload: neither userId nor workspaces found')
    return null
  } catch (error) {
    // ... error handling
  }
}
```

**File:** `apps/web/features/auth/lib/auth.ts`

```typescript
export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = verifySessionToken(sessionValue)
  if (!payload) return null

  // Legacy token format - return null to force re-login
  if ('workspaces' in payload) {
    console.warn('[Auth] Legacy JWT detected, user must re-login')
    return null
  }

  // New format
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, payload.userId)
  })

  return userRecord ? {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
  } : null
}
```

**Result:** Users with old JWTs will be logged out and must re-login with email/password.

### Phase 7: Deployment Plan

**7.1 Pre-Deployment**

1. **Backup current data:**
   ```bash
   cp /var/lib/claude-bridge/domain-passwords.json \
      /var/lib/claude-bridge/domain-passwords.json.$(date +%Y%m%d-%H%M%S).backup
   ```

2. **Test migration script locally:**
   ```bash
   DATABASE_PATH=./test.sqlite bun scripts/migrate-json-to-db.ts
   sqlite3 test.sqlite "SELECT * FROM users; SELECT * FROM workspaces;"
   ```

3. **Create rollback script:**
   ```bash
   # Export database back to JSON
   bun scripts/export-db-to-json.ts > domain-passwords.json
   ```

**7.2 Deployment Steps**

1. **Install dependencies:**
   ```bash
   cd /root/webalive/claude-bridge/apps/web
   bun add drizzle-orm better-sqlite3
   bun add -d drizzle-kit @types/better-sqlite3
   ```

2. **Run database migration:**
   ```bash
   cd /root/webalive/claude-bridge
   bunx drizzle-kit push:sqlite --config=drizzle.config.ts
   ```

3. **Run data migration:**
   ```bash
   bun scripts/migrate-json-to-db.ts
   ```

4. **Deploy new code:**
   ```bash
   bun run deploy
   ```

5. **Verify deployment:**
   ```bash
   # Check database
   sqlite3 /var/lib/claude-bridge/database.sqlite "SELECT COUNT(*) FROM users;"

   # Test login
   curl -X POST https://terminal.goalive.nl/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo-goalive-nl@bridge.local","password":"supersecret"}'
   ```

**7.3 Rollback Plan**

If migration fails:

1. **Restore JSON file:**
   ```bash
   cp /var/lib/claude-bridge/domain-passwords.json.backup \
      /var/lib/claude-bridge/domain-passwords.json
   ```

2. **Revert code deployment:**
   ```bash
   cd /root/webalive/claude-bridge
   git checkout HEAD~1
   bun run deploy
   ```

3. **Delete database:**
   ```bash
   rm /var/lib/claude-bridge/database.sqlite
   ```

---

## Testing Strategy

### Unit Tests

**File:** `apps/web/features/auth/__tests__/db-auth.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { db } from '@/lib/db/client'
import { users, workspaces, userWorkspaces } from '@/lib/db/schema'
import { hashPassword } from '@/types/guards/api'
import { randomUUID } from 'crypto'

describe('Database Authentication', () => {
  beforeEach(async () => {
    // Clear database
    await db.delete(userWorkspaces)
    await db.delete(users)
    await db.delete(workspaces)
  })

  test('should create user and workspace', async () => {
    const userId = randomUUID()
    const workspaceId = randomUUID()
    const passwordHash = await hashPassword('test123')

    await db.insert(users).values({
      id: userId,
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.insert(workspaces).values({
      id: workspaceId,
      domain: 'test.example.com',
      port: 3333,
      credits: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.insert(userWorkspaces).values({
      id: randomUUID(),
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
    })

    const user = await db.query.users.findFirst({
      where: eq(users.email, 'test@example.com')
    })

    expect(user).toBeDefined()
    expect(user?.email).toBe('test@example.com')
  })

  test('should verify user has workspace access', async () => {
    // ... test workspace authorization logic
  })
})
```

### Integration Tests

**File:** `apps/web/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('should register, login, and access workspace', async ({ page }) => {
  // 1. Register
  await page.goto('/register')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')

  // 2. Should redirect to workspaces page
  await expect(page).toHaveURL('/workspaces')

  // 3. Should show "No workspaces" message (new user)
  await expect(page.locator('text=No workspaces')).toBeVisible()

  // 4. Logout and login again
  await page.click('text=Logout')
  await page.goto('/login')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')

  // 5. Should redirect to workspaces again
  await expect(page).toHaveURL('/workspaces')
})
```

---

## Risk Assessment

### High Risk

1. **Session Invalidation:** All existing users logged out after deployment
   - **Mitigation:** Notify users in advance, display clear re-login message

2. **Data Loss:** Migration script fails, JSON file corrupted
   - **Mitigation:** Backup JSON file, test migration locally first, rollback plan

3. **Performance Degradation:** Database queries slower than JSON reads
   - **Mitigation:** Add indexes, benchmark before/after, use SQLite WAL mode

### Medium Risk

1. **Email Conflicts:** Multiple workspaces using same email
   - **Mitigation:** Migration script detects conflicts, creates unique emails with suffix

2. **Password Reset:** Users forget workspace password, no email system
   - **Mitigation:** Implement password reset endpoint before launch (Phase 8)

### Low Risk

1. **JWT Secret Rotation:** Existing JWTs invalidated if secret changes
   - **Mitigation:** Document secret management, add to deployment checklist

---

## Post-Migration Enhancements

### Phase 8: Password Reset

**File:** `apps/web/app/api/auth/reset-password/route.ts`

- Generate reset token
- Send email (requires email service)
- Validate token and update password

### Phase 9: Workspace Management UI

- Create new workspaces
- Invite users to existing workspaces
- Transfer ownership
- Remove user access

### Phase 10: Admin Dashboard

- View all users
- View all workspaces
- Audit logs (who accessed what, when)

### Phase 11: Role-Based Access Control

Implement granular permissions:
- `owner`: Full access, can manage users
- `member`: Can use workspace, create conversations
- `viewer`: Read-only access to conversations

---

## File Checklist

### New Files to Create

- [ ] `apps/web/lib/db/schema.ts` - Drizzle schema
- [ ] `apps/web/lib/db/client.ts` - Database client
- [ ] `apps/web/drizzle.config.ts` - Drizzle config
- [ ] `scripts/migrate-json-to-db.ts` - Migration script
- [ ] `scripts/export-db-to-json.ts` - Rollback script
- [ ] `apps/web/app/api/auth/register/route.ts` - Registration
- [ ] `apps/web/app/workspaces/page.tsx` - Workspace selection
- [ ] `apps/web/features/auth/__tests__/db-auth.test.ts` - Unit tests

### Files to Modify

- [ ] `apps/web/features/auth/lib/jwt.ts` - New payload structure
- [ ] `apps/web/features/auth/lib/auth.ts` - Database lookups
- [ ] `apps/web/features/auth/lib/sessionStore.ts` - Database-backed sessions
- [ ] `apps/web/app/api/login/route.ts` - Email/password login
- [ ] `apps/web/app/api/claude/stream/route.ts` - Updated session keys
- [ ] `apps/web/types/guards/api.ts` - Keep legacy functions for migration
- [ ] `apps/web/features/auth/components/LoginForm.tsx` - UI changes
- [ ] `package.json` - Add drizzle dependencies

### Files to Deprecate (But Keep for Rollback)

- [ ] `apps/web/types/guards/api.ts:loadDomainPasswords()` - After migration
- [ ] `apps/web/types/guards/api.ts:isDomainPasswordValid()` - After migration

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Database setup + schema | 2-3 hours |
| 2 | Data migration script | 2-3 hours |
| 3 | Update auth code | 4-6 hours |
| 4 | Update session store | 2-3 hours |
| 5 | Update frontend | 3-4 hours |
| 6 | Backward compatibility | 1-2 hours |
| 7 | Testing + deployment | 4-6 hours |
| **Total** | | **18-27 hours** |

**Buffer:** Add 50% for unexpected issues → **27-40 hours total**

---

## Success Criteria

- [ ] All existing workspaces migrated to database
- [ ] Users can log in with email/password
- [ ] Workspace authorization works correctly
- [ ] Sessions persist across restarts (database-backed)
- [ ] No data loss (compare workspace count before/after)
- [ ] Performance acceptable (< 100ms for auth checks)
- [ ] Rollback tested and documented
- [ ] All tests passing (unit + integration)

---

## Questions for Discussion

1. **Email Strategy:** Should we require real emails or allow placeholder emails initially?
2. **Migration Strategy:** One user per workspace, or consolidate to single admin?
3. **ORM Choice:** Drizzle (recommended) or Prisma?
4. **Database Choice:** SQLite (recommended for MVP) or PostgreSQL immediately?
5. **Backward Compatibility Duration:** How long to support legacy JWTs? (Recommend: 0 days, force re-login)
6. **Password Reset:** Required before launch or post-launch feature?
7. **Manager Access:** Should manager have a separate database user or special flag?

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Answer questions** in "Questions for Discussion" section
3. **Create POC:** Set up Drizzle + SQLite locally, test basic CRUD
4. **Build migration script:** Test with production data copy
5. **Implement Phase 1-3:** Database + core auth changes
6. **Test thoroughly:** Unit + integration tests
7. **Deploy to staging** (if available)
8. **Deploy to production:** Follow deployment plan
