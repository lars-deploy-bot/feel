# Authentication

> ⚠️ **DEPRECATED DOCUMENTATION (2025-11-16)**
> This document describes the OLD authentication system (workspace + passcode).
> The NEW system uses email + password with Supabase. See below for migration notes.
>
> **Current System**: Users authenticate with email + password → JWT with userId → workspace access via org memberships
> **This Doc Describes**: Old workspace + passcode → JWT with workspaces array (NO LONGER USED)

## Files

- `features/auth/lib/jwt.ts` – JWT creation/verification
- `features/auth/lib/auth.ts` – Workspace authentication
- `app/api/login/route.ts` – Login endpoint

## Login Flow

**POST `/api/login`**

```typescript
const { workspace, passcode } = await req.json()

// Validate passcode
const correctPasscode = DOMAIN_PASSWORDS[workspace]
if (passcode !== correctPasscode) {
  return 401 INVALID_PASSCODE
}

// Create JWT with workspace
const token = createSessionToken([workspace])

// Set httpOnly cookie
res.cookies.set('session', token, {
  httpOnly: true,        // JS cannot access
  secure: true,          // HTTPS only
  sameSite: 'strict',    // CSRF protection
  maxAge: 30 * 86400,    // 30 days
})

return 200 { success: true, workspace }
```

## JWT Token

Standard JWT with HS256:

```typescript
function createSessionToken(workspaces: string[]): string {
  const payload = {
    workspaces,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 86400,  // 30 days
  }
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' })
}

function verifySessionToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
  } catch (error) {
    return null  // Invalid or expired
  }
}
```

**Environment variable:**
```bash
JWT_SECRET=your-very-long-random-key-min-32-chars
# Generate: openssl rand -base64 32
```

## Multi-Workspace Sessions

Single JWT tracks multiple workspaces:

```typescript
// User authenticates to example.com
const token1 = createSessionToken(['example.com'])

// Later, authenticates to demo.goalive.nl
function addWorkspaceToToken(token: string, workspace: string): string | null {
  const payload = verifySessionToken(token)
  if (!payload) return null

  const updated = {
    ...payload,
    workspaces: Array.from(new Set([...payload.workspaces, workspace])),
  }
  return jwt.sign(updated, JWT_SECRET, { algorithm: 'HS256' })
}

// Token now has ["example.com", "demo.goalive.nl"]
```

## Per-Request Validation

Every route validates workspace membership:

```typescript
function isWorkspaceAuthenticated(token: string, workspace: string): boolean {
  const payload = verifySessionToken(token)
  if (!payload) return false
  return payload.workspaces.includes(workspace)
}

// In route handler
const sessionToken = getCookie('session')
const isAuthenticated = await isWorkspaceAuthenticated(sessionToken, workspace)
if (!isAuthenticated) return 401 WORKSPACE_NOT_AUTHENTICATED
```

Applied in `/api/claude`, `/api/claude/stream`, `/api/verify`, `/api/files`.

## Passcode Storage

**File:** `domain-passwords.json`

```json
{
  "example.com": "supersecret",
  "demo.goalive.nl": "anothersecret",
  "test": "test"
}
```

**Permissions:**
```bash
chmod 600 domain-passwords.json  # Only root can read
```

## Cookie Security

```typescript
res.cookies.set('session', token, {
  httpOnly: true,         // Prevents XSS theft
  secure: true,           // HTTPS only (prevents MITM)
  sameSite: 'strict',     // Prevents CSRF
  path: '/',
  maxAge: 30 * 86400,     // Auto-expire
})
```

## Local Development

When `BRIDGE_ENV=local`, accept any passcode:

```typescript
if (process.env.BRIDGE_ENV === 'local') {
  const token = createSessionToken([req.body.workspace])
  // Set cookie and return success
}
```

**Test credentials:**
```
workspace: test
passcode: test
```

## API Endpoints

**POST `/api/login`**
- Request: `{ "workspace": "example.com", "passcode": "supersecret" }`
- Response (success): `{ "success": true, "workspace": "example.com" }`
- Sets `session` cookie (30-day expiration)

**POST `/api/logout`** (optional)
```typescript
res.cookies.delete('session')
return 200 { success: true }
```

## Token Expiration

30-day lifespan. Users must re-authenticate after expiration. Extend with:

```typescript
if (payload && isNearExpiry(payload.exp)) {
  const newToken = createSessionToken(payload.workspaces)
  res.cookies.set('session', newToken, { ... })
}
```

## Troubleshooting

**"Invalid session" on every request**
- Cause: `JWT_SECRET` changed
- Fix: Ensure `JWT_SECRET` is consistent across restarts

**"Workspace not authenticated" despite login**
- Cause: Token doesn't include workspace
- Fix: User must authenticate to that workspace first

**Cookies not being set**
- Cause: Using `secure: true` without HTTPS in dev
- Fix: Disable secure flag in dev:

```typescript
const isProduction = process.env.NODE_ENV === 'production'
res.cookies.set('session', token, {
  secure: isProduction,
  // ... other options
})
```

## Implementation Checklist

**Setup:**
- [ ] `JWT_SECRET` env var set (strong, 32+ chars)
- [ ] `domain-passwords.json` created with 600 permissions
- [ ] `/api/login` endpoint created
- [ ] Session cookie options set (httpOnly, secure, sameSite, maxAge)

**Testing:**
- [ ] Login with valid passcode: 200 with token
- [ ] Login with invalid passcode: 401 error
- [ ] Session cookie set: check browser DevTools
- [ ] Token expires: test after 30 days
- [ ] Multi-workspace: login to second workspace, token includes both

**Routes protected:**
- [ ] `/api/claude` validates token
- [ ] `/api/claude/stream` validates token
- [ ] `/api/verify` validates token
- [ ] Unprotected routes: `/api/login`, `/` (UI)

**Security:**
- [ ] Passcodes not logged (grep codebase for passcode logs)
- [ ] JWT secret not in git history
- [ ] domain-passwords.json not in git
- [ ] Cookies never exposed in logs/responses
- [ ] Token expiration enforced (30 days max)

## Workspace Authorization in API Routes (November 2025 Update)

**File**: `apps/web/lib/workspace-api-handler.ts`

API routes that accept `workspaceRoot` parameter now validate user has access to that specific workspace:

```typescript
export async function handleWorkspaceApi(req: Request, config): Promise<NextResponse> {
  // 1. Always require authentication (no localhost bypass)
  const user = await requireSessionUser() // Get JWT with workspaces array

  // 2. Parse request body
  const { workspaceRoot } = parseResult.data

  // 3. Extract workspace name from path
  const pathParts = workspaceRoot.split("/")
  const sitesIndex = pathParts.indexOf("sites")
  const workspaceName = pathParts[sitesIndex + 1] // e.g., "example.com"

  // 4. Validate user has access to this workspace
  if (!user.workspaces.includes(workspaceName)) {
    return 403 Forbidden // User authenticated, but not for THIS workspace
  }

  // 5. Proceed with operation
}
```

**What This Prevents**:
- User authenticated for `example.com` cannot call `/api/install-package` with `workspaceRoot: "/srv/webalive/sites/victim.com"`
- Blocks workspace bypass attacks even with valid session cookie

**See Also**: `docs/security/workspace-security-current-state.md` for complete security implementation

## Quick Testing

```bash
# Generate test token
JWT_SECRET="test-secret" node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ workspaces: ['test'] }, 'test-secret', { algorithm: 'HS256' });
console.log(token);
"

# Use in request
curl -H "Cookie: session=TOKEN_HERE" \
  http://localhost:8999/api/verify \
  -d '{"workspace":"test"}'

# Should return 200
```

---

## NEW AUTHENTICATION SYSTEM (Current as of 2025-11-16)

### Overview
Users authenticate with **email + password** instead of workspace + passcode. One account gives access to all their workspaces.

### Key Files
- `apps/web/app/api/login/route.ts` - Email + password login
- `apps/web/features/auth/lib/auth.ts` - Session management and workspace validation
- `apps/web/lib/deployment/domain-registry.ts` - Domain registration and user linking

### Flow

**1. Login (POST /api/login)**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**2. Backend Process**
- Query `iam.users` for user by email
- Verify password with bcrypt (`verifyPassword()`)
- Create JWT with `userId` (NOT workspaces array)
- Set httpOnly session cookie

**3. Workspace Access Check**
```typescript
// Get user from JWT
const user = await getSessionUser() // Returns { id, email, name }

// Check if user has access to workspace
const isAuth = await isWorkspaceAuthenticated(workspace)
// → Queries user's org memberships
// → Checks if any org owns the domain
```

### Database Schema

**iam.users** - User accounts
```sql
- user_id (UUID)
- email (unique)
- password_hash (bcrypt)
- display_name
```

**iam.orgs** - Organizations
```sql
- org_id (UUID)
- name
- credits
```

**iam.org_memberships** - User ↔ Org relationships
```sql
- user_id → users.user_id
- org_id → orgs.org_id
- role (owner, member, viewer)
```

**app.domains** - Workspaces/Sites
```sql
- hostname (e.g., "example.com")
- org_id → orgs.org_id
- port
```

### Migration Notes

**Deployment Changes:**
- Old: Each domain had its own password in `domain-passwords.json`
- New: Domain is linked to a user account via org membership
- During deployment, if email already exists → use that user, else create new user

**User Experience:**
- Old: "Enter site password" (different for each site)
- New: "Enter account password" (same across all sites)
- If user already has account, deployment uses their existing password

### Environment Variables
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret-min-32-chars  # For session tokens
```

### Testing (Local Dev)
```bash
# .env.local
BRIDGE_ENV=local

# Test credentials
Email: test@bridge.local
Password: test
```
