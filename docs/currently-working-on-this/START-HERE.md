# Database Migration - START HERE

**Migration Type:** Workspace-first JSON → User-first Database
**Approach:** Hard cutover (no backward compatibility)
**Status:** Infrastructure ready, migration scripts ready, code updates pending

---

## Quick Summary

You currently have:
- ✅ Database schema defined (users, workspaces, user_workspaces, sessions)
- ✅ Database client with WAL mode
- ✅ Migration scripts with dry-run, validation, transactions
- ✅ Verification and testing scripts
- ✅ Database repositories (clean abstraction layer)
- ✅ Backup scripts

You need to:
- ⏳ Run the migration scripts
- ⏳ Update 8 authentication-related files
- ⏳ Deploy and test

---

## Step-by-Step Execution

### Step 1: Install Dependencies (5 minutes)

```bash
cd /root/webalive/claude-bridge/apps/web
bun add drizzle-orm better-sqlite3
bun add -d drizzle-kit @types/better-sqlite3
```

### Step 2: Backup Current State (1 minute)

```bash
cd /root/webalive/claude-bridge
./scripts/backup-current-state.sh
```

Verify backup created:
```bash
ls -la /var/lib/claude-bridge/backups/
```

### Step 3: Initialize Database (1 minute)

```bash
bun scripts/init-database.ts
```

Expected output:
```
✓ Created table: users
✓ Created table: workspaces
✓ Created table: user_workspaces
✓ Created table: sessions
✅ Database initialized successfully!
```

### Step 4: Test Migration (Dry Run) (2 minutes)

```bash
bun scripts/migrate-to-database.ts --dry-run
```

Review the output carefully:
- Check user email addresses (are they correct?)
- Check workspace counts (matches your JSON file?)
- Check for any validation errors

### Step 5: Run Migration (5 minutes)

```bash
bun scripts/migrate-to-database.ts
```

Watch the output - it should show each user and workspace being created.

### Step 6: Verify Migration (1 minute)

```bash
bun scripts/verify-migration.ts
```

All checks should pass (✓).

### Step 7: Test Login (1 minute)

Find a user email from the migration output, then:

```bash
bun scripts/test-login.ts demo-goalive-nl@bridge.local supersecret
```

Expected: "✅ Login test PASSED"

---

## Step 8: Update Code (2-4 hours)

You need to update 8 files. Here's the order:

### 1. Update JWT Structure
**File:** `apps/web/features/auth/lib/jwt.ts`

**Change payload:**
```typescript
// OLD
export interface SessionPayload {
  workspaces: string[]
  iat?: number
  exp?: number
}

// NEW
export interface SessionPayload {
  userId: string
  iat?: number
  exp?: number
}
```

**Update createSessionToken:**
```typescript
// OLD
export function createSessionToken(workspaces: string[]): string {
  const payload: SessionPayload = { workspaces }
  return sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

// NEW
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = { userId }
  return sign(payload, JWT_SECRET, { expiresIn: '30d' })
}
```

**Remove this function entirely:**
```typescript
export function addWorkspaceToToken(...) { ... }  // DELETE THIS
```

### 2. Update Auth Helpers
**File:** `apps/web/features/auth/lib/auth.ts`

Add imports at top:
```typescript
import { userRepository, userWorkspaceRepository } from '@/lib/db/repositories'
```

Replace `getSessionUser()` function:
```typescript
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
  if (!payload || !payload.userId) {
    return null
  }

  // Fetch user from database
  const user = await userRepository.findById(payload.userId)
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}
```

Replace `isWorkspaceAuthenticated()`:
```typescript
export async function isWorkspaceAuthenticated(workspaceDomain: string): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false

  // Test mode allows all workspaces
  if (process.env.BRIDGE_ENV === 'local' && user.id === 'test-user') {
    return true
  }

  return userWorkspaceRepository.hasAccessByDomain(user.id, workspaceDomain)
}
```

Replace `getAuthenticatedWorkspaces()`:
```typescript
export async function getAuthenticatedWorkspaces(): Promise<string[]> {
  const user = await getSessionUser()
  if (!user) return []

  const workspaces = await userWorkspaceRepository.getWorkspacesForUser(user.id)
  return workspaces.map(w => w.workspace.domain)
}
```

Update `SessionUser` interface:
```typescript
export interface SessionUser {
  id: string
  email: string
  name: string | null
}
```

### 3. Update Login Endpoint
**File:** `apps/web/app/api/login/route.ts`

Replace the entire file with email/password login:

```typescript
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { createSessionToken } from '@/features/auth/lib/jwt'
import { addCorsHeaders } from '@/lib/cors-utils'
import { userRepository } from '@/lib/db/repositories'
import { ErrorCodes, getErrorMessage } from '@/lib/error-codes'
import { generateRequestId } from '@/lib/utils'
import { verifyPassword } from '@/types/guards/api'
import { z } from 'zod'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get('origin')
  const body = await req.json().catch(() => ({}))
  const result = LoginSchema.safeParse(body)

  if (!result.success) {
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_REQUEST,
        message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
        details: { issues: result.error.issues },
        requestId,
      },
      { status: 400 }
    )
    addCorsHeaders(res, origin)
    return res
  }

  const { email, password } = result.data

  // Test mode
  if (process.env.BRIDGE_ENV === 'local' && email === 'test@bridge.local' && password === 'test') {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('session', 'test-user', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })
    addCorsHeaders(res, origin)
    return res
  }

  // Find user
  const user = await userRepository.findByEmail(email)
  if (!user) {
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
        requestId,
      },
      { status: 401 }
    )
    addCorsHeaders(res, origin)
    return res
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
        requestId,
      },
      { status: 401 }
    )
    addCorsHeaders(res, origin)
    return res
  }

  // Create JWT
  const sessionToken = createSessionToken(user.id)

  // Update last login
  await userRepository.updateLastLogin(user.id)

  const res = NextResponse.json({ ok: true, userId: user.id })
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    domain: '.terminal.goalive.nl',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  addCorsHeaders(res, origin)
  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
```

### 4. Replace Session Store
**File:** `apps/web/features/auth/lib/sessionStore.ts`

Replace entire file:

```typescript
/**
 * Session store - now database-backed via sessionRepository
 */

import { sessionRepository } from '@/lib/db/repositories'

export interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

// Parse composite key: userId::workspaceId::conversationId
function parseKey(key: string): { userId: string; workspaceId: string; conversationId: string } {
  const [userId, workspaceId, conversationId] = key.split('::')
  return { userId, workspaceId, conversationId }
}

export const SessionStoreMemory: SessionStore = {
  async get(key: string): Promise<string | null> {
    const { userId, workspaceId, conversationId } = parseKey(key)
    return sessionRepository.get(userId, workspaceId, conversationId)
  },

  async set(key: string, value: string): Promise<void> {
    const { userId, workspaceId, conversationId } = parseKey(key)
    await sessionRepository.set(userId, workspaceId, conversationId, value)
  },

  async delete(key: string): Promise<void> {
    const { userId, workspaceId, conversationId } = parseKey(key)
    await sessionRepository.delete(userId, workspaceId, conversationId)
  },
}
```

### 5. Update Claude Stream Route
**File:** `apps/web/app/api/claude/stream/route.ts`

Find the session key creation (around line 280):
```typescript
// OLD
const sessionKey = `${userId}::${workspace}::${conversationId}`
const sessionId = await SessionStoreMemory.get(sessionKey)
```

Replace with:
```typescript
// NEW
const user = await requireSessionUser()
const workspaceRecord = await workspaceRepository.findByDomain(workspace)

if (!workspaceRecord) {
  return new Response(JSON.stringify({ error: 'Workspace not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })
}

const sessionKey = `${user.id}::${workspaceRecord.id}::${conversationId}`
const sessionId = await SessionStoreMemory.get(sessionKey)
```

Add import at top:
```typescript
import { requireSessionUser } from '@/features/auth/lib/auth'
import { workspaceRepository } from '@/lib/db/repositories'
```

### 6. Update Login Form UI
**File:** `apps/web/features/auth/components/LoginForm.tsx`

Change the form fields from workspace+passcode to email+password.

### 7. Create Registration Endpoint (NEW)
**File:** `apps/web/app/api/auth/register/route.ts`

Create new file (see detailed implementation in MIGRATION-EXECUTION-PLAN.md section 3.4).

### 8. Create Workspace Selection Page (NEW)
**File:** `apps/web/app/workspaces/page.tsx`

Create new file (see detailed implementation in MIGRATION-EXECUTION-PLAN.md section 5.2).

---

## Step 9: Test & Deploy (30 minutes)

```bash
# Build
cd /root/webalive/claude-bridge/apps/web
bun run build

# Restart
pm2 restart claude-bridge

# Watch logs
pm2 logs claude-bridge

# Test login
curl -X POST http://localhost:8999/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo-goalive-nl@bridge.local","password":"supersecret"}'
```

---

## Rollback (If Needed)

```bash
# Find latest backup
BACKUP=$(ls -td /var/lib/claude-bridge/backups/* | head -1)

# Stop service
pm2 stop claude-bridge

# Restore JSON
cp "$BACKUP/domain-passwords.json" /var/lib/claude-bridge/domain-passwords.json

# Delete database
rm -f /var/lib/claude-bridge/database.sqlite*

# Revert code
cd /root/webalive/claude-bridge
git checkout apps/web/

# Rebuild & restart
cd apps/web && bun run build
pm2 restart claude-bridge
```

---

## Key Files Reference

**Migration Scripts:**
- `scripts/init-database.ts` - Create tables
- `scripts/migrate-to-database.ts` - Migrate data
- `scripts/verify-migration.ts` - Verify integrity
- `scripts/test-login.ts` - Test user login

**Database:**
- `apps/web/lib/db/schema.ts` - Table definitions
- `apps/web/lib/db/client.ts` - Database connection
- `apps/web/lib/db/repositories/` - Database operations

**Auth Code to Update:**
- `apps/web/features/auth/lib/jwt.ts` - JWT structure
- `apps/web/features/auth/lib/auth.ts` - Auth helpers
- `apps/web/features/auth/lib/sessionStore.ts` - Session storage
- `apps/web/app/api/login/route.ts` - Login endpoint
- `apps/web/app/api/claude/stream/route.ts` - Claude API

**Documentation:**
- `docs/currently-working-on-this/MIGRATION-EXECUTION-PLAN.md` - Detailed plan
- `docs/currently-working-on-this/MIGRATION-FILES-CREATED.md` - File inventory
- `docs/currently-working-on-this/START-HERE.md` - This file

---

## Questions?

Check the detailed docs:
- Execution plan: `docs/currently-working-on-this/MIGRATION-EXECUTION-PLAN.md`
- Files created: `docs/currently-working-on-this/MIGRATION-FILES-CREATED.md`
- Original plan: `docs/currently-working-on-this/users-workspaces-migration-plan.md`
