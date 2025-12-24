# Session & Authentication Duplicate Code Analysis

## Executive Summary

**Total Estimated Duplicate Lines:** ~900+ lines
**Files Affected:** 40+ API routes
**Priority Level:** CRITICAL - Security consistency and maintainability

---

## Critical Duplications

### 1. Manager Authentication Check
**Impact:** 12+ files, ~120 lines
**Priority:** CRITICAL - Inconsistent security patterns

**Files Affected:**
- `apps/web/app/api/manager/route.ts` (3 times in same file!)
- `apps/web/app/api/manager/backup/route.ts`
- `apps/web/app/api/manager/caddy/reload/route.ts`
- `apps/web/app/api/manager/orgs/route.ts`
- `apps/web/app/api/manager/orgs/members/route.ts`
- `apps/web/app/api/manager/status/route.ts`
- `apps/web/app/api/manager/permissions/route.ts`
- `apps/web/app/api/manager/users/route.ts`
- `apps/web/app/api/manager/users/create/route.ts`
- `apps/web/app/api/manager/feedback/route.ts`
- `apps/web/app/api/manager/actions/cleanup-test-data/route.ts`
- And potentially more

**Current Pattern:**
```typescript
const jar = await cookies()
if (!jar.get("manager_session")) {
  return NextResponse.json(
    {
      ok: false,
      error: ErrorCodes.UNAUTHORIZED,
      message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
      requestId
    },
    { status: 401 }
  )
}
```

**ISSUE:** Helper already exists at `features/manager/lib/api-helpers.ts` but is NOT USED!

**Solution:**
```typescript
// features/manager/lib/api-helpers.ts (ALREADY EXISTS!)
export async function requireManagerAuth(): Promise<
  { authorized: true } | { authorized: false; error: NextResponse }
>

// Usage in routes:
const auth = await requireManagerAuth()
if (!auth.authorized) {
  return auth.error
}
```

**Action Required:**
1. Update all 12+ manager routes to use existing `requireManagerAuth()`
2. Remove duplicate authentication checks
3. Add test to ensure all manager routes use helper

---

### 2. CORS Response Creation
**Impact:** 25+ files, ~300 lines
**Priority:** CRITICAL

**Files with heavy usage:**
- `/api/manager/route.ts` (7 instances)
- `/api/manager/orgs/route.ts` (9 instances)
- `/api/manager/users/create/route.ts` (6 instances)
- `/api/auth/organizations/route.ts` (8 instances)
- `/api/login/route.ts` (5 instances)
- Plus 20+ more files

**Current Pattern:**
```typescript
const origin = req.headers.get("origin")
// ... create response ...
const res = NextResponse.json(data, { status })
addCorsHeaders(res, origin)
return res
```

**NOTE:** `corsResponse()` exists in `api/manager/route.ts` but is local to that file!

**Solution:**
Create shared CORS response helpers:
```typescript
// lib/api/responses.ts
export function createCorsResponse(
  origin: string | null,
  data: unknown,
  status?: number
): NextResponse {
  const res = NextResponse.json(data, { status })
  addCorsHeaders(res, origin)
  return res
}

export function createCorsErrorResponse(
  origin: string | null,
  error: ErrorCode,
  status: number,
  fields?: { requestId?: string; details?: any }
): NextResponse {
  const res = NextResponse.json(
    {
      ok: false,
      error,
      message: getErrorMessage(error),
      ...fields
    },
    { status }
  )
  addCorsHeaders(res, origin)
  return res
}
```

**Migration:**
```typescript
// Before:
const res = NextResponse.json({ ok: true, data }, { status: 200 })
addCorsHeaders(res, origin)
return res

// After:
return createCorsResponse(origin, { ok: true, data }, 200)
```

---

### 3. Session Cookie Validation
**Impact:** 8+ files, ~80-96 lines
**Priority:** HIGH

**Files:**
- `apps/web/app/api/files/route.ts`
- `apps/web/app/api/images/list/route.ts`
- `apps/web/app/api/images/upload/route.ts`
- `apps/web/app/api/claude/stream/route.ts`
- Several others

**Current Pattern:**
```typescript
const jar = await cookies()
if (!hasSessionCookie(jar.get(COOKIE_NAMES.SESSION))) {
  return NextResponse.json(
    {
      ok: false,
      error: ErrorCodes.NO_SESSION,
      message: getErrorMessage(ErrorCodes.NO_SESSION),
      requestId,
    },
    { status: 401 }
  )
}
```

**ISSUE:** `validateRequest()` exists in `features/auth/lib/auth.ts` but is under-utilized!

**Solution:**
Use existing helper or create simpler wrapper:
```typescript
// lib/auth/middleware.ts
export async function requireSessionCookie(): Promise<
  { success: true; cookie: string } | { success: false; error: NextResponse }
> {
  const jar = await cookies()
  const sessionCookie = jar.get(COOKIE_NAMES.SESSION)

  if (!hasSessionCookie(sessionCookie)) {
    return {
      success: false,
      error: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: getErrorMessage(ErrorCodes.NO_SESSION),
        },
        { status: 401 }
      )
    }
  }

  return { success: true, cookie: sessionCookie.value }
}
```

---

### 4. User + Workspace Authorization
**Impact:** 4+ files, ~60 lines
**Priority:** HIGH

**Files:**
- `apps/web/app/api/claude/stream/route.ts`
- `apps/web/app/api/images/upload/route.ts`
- `apps/web/app/api/images/delete/route.ts`
- `apps/web/app/api/claude/stream/cancel/route.ts`

**Current Pattern (3-step process):**
```typescript
// Step 1: Authenticate user
const user = await requireSessionUser()

// Step 2: Verify workspace access
const workspace = await verifyWorkspaceAccess(user, body, "[Route]")
if (!workspace) {
  return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401, { requestId })
}

// Step 3: Resolve workspace path
const workspaceResult = resolveWorkspace(host, body, requestId)
if (!workspaceResult.success) {
  return workspaceResult.response
}
```

**ISSUE:** `validateRequest()` exists but doesn't include path resolution!

**Solution:**
Create comprehensive workspace auth helper:
```typescript
// features/auth/lib/auth.ts (enhance existing)
export async function requireWorkspaceAuth(
  req: NextRequest,
  body: { workspace?: string },
  requestId?: string
): Promise<
  | {
      success: true
      user: SessionUser
      workspace: string
      workspacePath: string
    }
  | {
      success: false
      error: NextResponse
    }
> {
  // Step 1: Authenticate user
  const user = await requireSessionUser()

  // Step 2: Verify workspace access
  const workspace = await verifyWorkspaceAccess(user, body, "[context]")
  if (!workspace) {
    return {
      success: false,
      error: createErrorResponse(
        ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
        401,
        { requestId }
      )
    }
  }

  // Step 3: Resolve workspace path
  const host = req.headers.get("host")
  const workspaceResult = resolveWorkspace(host, body, requestId)
  if (!workspaceResult.success) {
    return { success: false, error: workspaceResult.response }
  }

  return {
    success: true,
    user,
    workspace,
    workspacePath: workspaceResult.data.workspacePath
  }
}
```

---

## High Priority Duplications

### 5. Error Response Creation
**Impact:** 30+ files, ~200 lines
**Priority:** HIGH

**Current Pattern:**
```typescript
return NextResponse.json(
  {
    ok: false,
    error: ErrorCodes.SOME_ERROR,
    message: getErrorMessage(ErrorCodes.SOME_ERROR),
    requestId,
  },
  { status: 4xx }
)
```

**ISSUE:** `createErrorResponse()` exists in `features/auth/lib/auth.ts` but many routes don't use it!

**Solution:**
Mandate usage of existing `createErrorResponse()`:
```typescript
// features/auth/lib/auth.ts (ALREADY EXISTS!)
export function createErrorResponse(
  error: ErrorCode,
  status: number,
  fields?: { requestId?: string; details?: any }
): NextResponse
```

**Action:** Migrate all routes to use this helper.

---

### 6. JWT Token Retrieval Pattern
**Impact:** 4 locations in auth.ts, ~40 lines
**Priority:** MEDIUM

**Current Pattern (repeated 4 times in same file):**
```typescript
const jar = await cookies()
const sessionCookie = jar.get(COOKIE_NAMES.SESSION)
if (!sessionCookie?.value) {
  return null/undefined
}
const payload = await verifySessionToken(sessionCookie.value)
```

**Locations in `features/auth/lib/auth.ts`:**
- Lines 16-21
- Lines 90-94
- Lines 150-152
- Lines 212-214

**Solution:**
Extract to helper within same file:
```typescript
// features/auth/lib/auth.ts (internal helper)
async function getSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const sessionCookie = jar.get(COOKIE_NAMES.SESSION)
  if (!sessionCookie?.value) return null
  return await verifySessionToken(sessionCookie.value)
}
```

---

### 7. Database Query for Workspaces
**Impact:** 3 files, ~45 lines
**Priority:** LOW (JWT should eliminate need)

**Files:**
- `apps/web/app/api/login/route.ts` (lines 105-118)
- `apps/web/app/api/auth/workspaces/route.ts` (lines 40-73)
- `apps/web/features/auth/lib/auth.ts` (lines 64-82)

**Current Pattern:**
```typescript
const iam = await createIamClient("service")
const { data: memberships } = await iam
  .from("org_memberships")
  .select("org_id")
  .eq("user_id", user.id)

if (!memberships || memberships.length === 0) {
  return []
}

const orgIds = memberships.map(m => m.org_id)
const app = await createAppClient("service")
const { data: domains } = await app
  .from("domains")
  .select("hostname")
  .in("org_id", orgIds)
```

**NOTE:** With JWT containing workspaces, this pattern should be deprecated.

**Action:**
1. Verify JWT approach is fully implemented
2. Remove database queries for workspace list
3. Use JWT claims instead

---

## Medium Priority

### 8. Request ID Generation
**Impact:** 40+ files, ~40 lines
**Priority:** MEDIUM

**Current Inconsistency:**
- Some use: `generateRequestId()`
- Others use: `crypto.randomUUID()`

**Solution:**
1. Standardize on `generateRequestId()` everywhere
2. Or create middleware that auto-adds request ID

**Middleware approach:**
```typescript
// lib/api/middleware.ts
export function withRequestId(
  handler: (req: NextRequest, requestId: string) => Promise<Response>
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    const requestId = generateRequestId()
    return handler(req, requestId)
  }
}

// Usage:
export const POST = withRequestId(async (req, requestId) => {
  // requestId available automatically
})
```

---

## Existing Helpers (Under-utilized)

### Tools Already Available But Not Used Consistently:

1. **`features/auth/lib/auth.ts`:**
   - ✅ `createErrorResponse()` - EXISTS but not used everywhere
   - ✅ `validateRequest()` - EXISTS but rarely used
   - ✅ `verifyWorkspaceAccess()` - Used in some routes
   - ✅ `requireSessionUser()` - Widely used (good!)

2. **`features/manager/lib/api-helpers.ts`:**
   - ✅ `requireManagerAuth()` - EXISTS but manager routes don't use it!
   - ✅ `createSuccessResponse()` - Only used in one route
   - ✅ `createBadRequestResponse()` - Only used in one route

3. **`lib/workspace-api-handler.ts`:**
   - ✅ `handleWorkspaceApi()` - Only used in restart-workspace route

**Problem:** Helpers exist but adoption is low. Need to mandate usage.

---

## Refactoring Action Plan

### Phase 1: Fix Manager Routes (Week 1)
**Priority:** CRITICAL
**Impact:** ~120 lines saved, consistent security

**Steps:**
1. Update all 12+ manager routes to use `requireManagerAuth()`
2. Remove inline authentication checks
3. Add test to verify all manager routes are protected
4. Document pattern in contributing guide

**Files to update:**
- `api/manager/*.ts` (11+ files)

---

### Phase 2: Standardize CORS (Week 1-2)
**Priority:** CRITICAL
**Impact:** ~300 lines saved

**Steps:**
1. Create `lib/api/responses.ts` with:
   - `createCorsResponse()`
   - `createCorsErrorResponse()`
2. Migrate all routes using inline CORS (25+ files)
3. Remove `corsResponse()` from `api/manager/route.ts`
4. Update documentation

---

### Phase 3: Enhance Auth Helpers (Week 2)
**Priority:** HIGH
**Impact:** ~140 lines saved

**Steps:**
1. Create `requireWorkspaceAuth()` combining user + workspace + path resolution
2. Extract `getSessionPayload()` in auth.ts
3. Migrate 4+ workspace routes to use new helper
4. Deprecate separate workspace resolution steps

---

### Phase 4: Standardize Error Handling (Week 3)
**Priority:** HIGH
**Impact:** ~200 lines saved

**Steps:**
1. Audit all routes not using `createErrorResponse()`
2. Migrate to standard error helper (30+ files)
3. Ensure consistent error format
4. Update tests

---

### Phase 5: Cleanup & Consistency (Week 3-4)
**Priority:** MEDIUM
**Impact:** Improved consistency

**Steps:**
1. Standardize request ID generation
2. Create session cookie helper
3. Remove deprecated workspace query pattern
4. Document all auth patterns

---

## New Auth Utilities Structure

```typescript
// lib/auth/middleware.ts (NEW)
export async function requireSessionCookie()
export async function requireManagerAuth()
export async function requireWorkspaceAuth(req, body, requestId)
export function withRequestId(handler)

// lib/api/responses.ts (NEW)
export function createCorsResponse(origin, data, status)
export function createCorsErrorResponse(origin, error, status, fields)

// features/auth/lib/auth.ts (ENHANCE EXISTING)
export async function requireWorkspaceAuth(req, body, requestId) // NEW
async function getSessionPayload() // NEW internal helper

// Keep existing:
export function createErrorResponse(...)
export async function validateRequest(...)
export async function verifyWorkspaceAccess(...)
export async function requireSessionUser(...)
```

---

## Testing Strategy

### For each refactored pattern:
1. Write unit tests for new helpers
2. Test authentication failure scenarios
3. Test CORS behavior
4. Run E2E tests for critical flows
5. Security audit for auth patterns

### Specific test cases:
```typescript
describe('requireManagerAuth', () => {
  it('allows access with valid manager session')
  it('blocks access without manager session')
  it('blocks access with expired session')
  it('returns proper CORS headers in error')
})

describe('requireWorkspaceAuth', () => {
  it('validates user + workspace + path in one call')
  it('blocks unauthorized workspace access')
  it('blocks path traversal attempts')
  it('resolves workspace path correctly')
})

describe('createCorsResponse', () => {
  it('adds CORS headers to response')
  it('handles null origin')
  it('returns correct status code')
})
```

---

## Migration Checklist

- [ ] Phase 1: Manager routes (Week 1)
  - [ ] Update all manager routes to use `requireManagerAuth()`
  - [ ] Remove inline auth checks
  - [ ] Add protection test
  - [ ] Document pattern

- [ ] Phase 2: CORS standardization (Week 1-2)
  - [ ] Create `lib/api/responses.ts`
  - [ ] Implement CORS helpers
  - [ ] Migrate 25+ routes
  - [ ] Test CORS behavior

- [ ] Phase 3: Auth helpers (Week 2)
  - [ ] Create `requireWorkspaceAuth()`
  - [ ] Extract `getSessionPayload()`
  - [ ] Migrate workspace routes
  - [ ] Update documentation

- [ ] Phase 4: Error handling (Week 3)
  - [ ] Audit error response usage
  - [ ] Migrate 30+ routes
  - [ ] Ensure consistent format
  - [ ] Update tests

- [ ] Phase 5: Cleanup (Week 3-4)
  - [ ] Standardize request ID
  - [ ] Create session helpers
  - [ ] Remove deprecated patterns
  - [ ] Final documentation update

---

## Success Metrics

**Code Reduction:**
- ~900 lines of duplicate code eliminated
- ~40 files simplified

**Security:**
- 100% of manager routes use standard auth check
- 100% of workspace routes use consistent validation
- All auth patterns tested and documented

**Maintainability:**
- Single source of truth for auth patterns
- Consistent error handling across all routes
- Easier onboarding for new developers

**Performance:**
- No performance impact (same logic, better organization)
- Easier to optimize centralized helpers later
