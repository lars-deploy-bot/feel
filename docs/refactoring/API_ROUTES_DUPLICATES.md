# API Routes Duplicate Code Analysis

## Executive Summary

**Total Estimated Duplicate Lines:** 1,071 - 1,519 lines
**Files Analyzed:** 47 API route files in `apps/web/app/api/`
**Priority Level:** CRITICAL - High impact on security consistency and maintainability

---

## Critical Duplications

### 1. Manager Authentication Pattern
**Impact:** 11 files, ~88-110 lines
**Priority:** CRITICAL

**Current Pattern:**
```typescript
const jar = await cookies()
if (!jar.get("manager_session")) {
  return corsResponse(origin, {
    ok: false,
    error: ErrorCodes.UNAUTHORIZED,
    message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
    requestId,
  }, 401)
}
```

**Files Affected:**
- `/api/manager/route.ts` (3 times!)
- `/api/manager/users/route.ts`
- `/api/manager/users/create/route.ts`
- `/api/manager/orgs/route.ts`
- `/api/manager/orgs/members/route.ts`
- `/api/manager/status/route.ts`
- `/api/manager/permissions/route.ts`
- `/api/manager/backup/route.ts`
- `/api/manager/caddy/reload/route.ts`
- `/api/manager/feedback/route.ts`
- `/api/manager/actions/cleanup-test-data/route.ts`

**Solution:**
Use existing `requireManagerAuth()` from `features/manager/lib/api-helpers.ts`:
```typescript
const authResult = await requireManagerAuth()
if (!authResult.authorized) {
  return authResult.error
}
```

**Note:** Helper exists but is under-utilized!

---

### 2. OPTIONS Handler (CORS Preflight)
**Impact:** 18 files, ~72-108 lines
**Priority:** HIGH

**Current Pattern:**
```typescript
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
```

**Files Affected:**
- All manager routes (11 files)
- `/api/login/route.ts`
- `/api/logout/route.ts`
- `/api/login-manager/route.ts`
- `/api/feedback/route.ts`
- `/api/auth/organizations/route.ts`
- `/api/auth/workspaces/route.ts`
- `/api/auth/org-members/route.ts`
- `/api/claude/stream/route.ts`

**Solution:**
Create shared OPTIONS handler factory:
```typescript
// lib/api/cors.ts
export function createOptionsHandler() {
  return async (req: NextRequest) => {
    const origin = getOrigin(req)
    const res = new NextResponse(null, { status: 200 })
    addCorsHeaders(res, origin)
    return res
  }
}

// Usage in routes:
export const OPTIONS = createOptionsHandler()
```

---

### 3. CORS Response Wrapper
**Impact:** 25+ files, ~375-675 lines
**Priority:** HIGH

**Current Pattern:**
```typescript
const res = NextResponse.json(data, { status })
addCorsHeaders(res, origin)
return res
```

**Heavy Users:**
- `/api/manager/route.ts` (7 instances)
- `/api/manager/orgs/route.ts` (9 instances)
- `/api/manager/users/create/route.ts` (6 instances)
- `/api/auth/organizations/route.ts` (8 instances)
- `/api/login/route.ts` (5 instances)

**Solution:**
Extract to helper (note: `corsResponse()` exists in manager/route.ts but is local):
```typescript
// lib/api/responses.ts
export function corsJsonResponse(
  data: any,
  status: number,
  origin: string | null
): NextResponse {
  const res = NextResponse.json(data, { status })
  addCorsHeaders(res, origin)
  return res
}

export function corsErrorResponse(
  error: ErrorCode,
  status: number,
  origin: string | null,
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

---

### 4. Workspace Resolution Pattern
**Impact:** 10+ files, ~100-150 lines
**Priority:** HIGH

**Current Pattern:**
```typescript
const workspace = await verifyWorkspaceAccess(user, body, logPrefix)
if (!workspace) {
  return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401, { requestId })
}

const workspaceResult = resolveWorkspace(host, body, requestId)
if (!workspaceResult.success) {
  return workspaceResult.response
}
```

**Files Affected:**
- `/api/verify/route.ts`
- `/api/files/route.ts`
- `/api/images/upload/route.ts`
- `/api/images/list/route.ts`
- `/api/images/delete/route.ts`
- `/api/claude/stream/route.ts`
- Others

**Solution:**
Enhance existing `validateRequest()` helper:
```typescript
// features/auth/lib/auth.ts
export async function validateWorkspaceRequest(
  req: NextRequest,
  body: { workspace?: string },
  requestId?: string
) {
  const user = await requireSessionUser()
  const workspace = await verifyWorkspaceAccess(user, body, "[context]")
  if (!workspace) {
    return { error: createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401, { requestId }) }
  }

  const host = req.headers.get("host")
  const workspaceResult = resolveWorkspace(host, body, requestId)
  if (!workspaceResult.success) {
    return { error: workspaceResult.response }
  }

  return {
    user,
    workspace,
    workspacePath: workspaceResult.data.workspacePath
  }
}
```

---

### 5. Request Body Parsing
**Impact:** 20+ files, ~100-160 lines
**Priority:** HIGH

**Current Pattern:**
```typescript
const body = await req.json().catch(() => ({}))
// Or
try {
  body = await req.json()
} catch (jsonError) {
  return createErrorResponse(ErrorCodes.INVALID_JSON, 400, { requestId })
}
```

**Files Affected:**
- `/api/login/route.ts`
- `/api/login-manager/route.ts`
- `/api/feedback/route.ts`
- `/api/deploy/route.ts`
- `/api/manager/route.ts` (3 methods)
- And many more

**Solution:**
```typescript
// lib/api/request.ts
export async function parseJsonBody<T = any>(
  req: NextRequest,
  requestId?: string
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const data = await req.json()
    return { success: true, data }
  } catch {
    return {
      success: false,
      error: createErrorResponse(ErrorCodes.INVALID_JSON, 400, { requestId })
    }
  }
}
```

---

## Moderate Priority Duplications

### 6. Session Cookie Validation
**Impact:** 8+ files, ~80-96 lines

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

**Solution:** Use existing `validateRequest()` consistently.

---

### 7. Zod Schema Validation
**Impact:** 8+ files, ~96-120 lines

```typescript
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
```

**Solution:**
```typescript
// lib/api/validation.ts
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  origin: string | null,
  requestId?: string
): { success: true; data: T } | { success: false; error: NextResponse } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      error: corsErrorResponse(
        ErrorCodes.INVALID_REQUEST,
        400,
        origin,
        { details: { issues: result.error.issues }, requestId }
      )
    }
  }
  return { success: true, data: result.data }
}
```

---

### 8. Origin Header Extraction
**Impact:** 25+ files, ~25-50 lines

**Current Variations:**
```typescript
const origin = req.headers.get("origin")
// vs
const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
```

**Solution:**
```typescript
// lib/api/request.ts
export function getOrigin(req: NextRequest): string | null {
  return (
    req.headers.get("origin") ||
    req.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
    null
  )
}
```

---

### 9. Request ID Generation
**Impact:** 35+ files, ~35+ lines

**Inconsistency:**
- Some use: `generateRequestId()`
- Others use: `crypto.randomUUID()`

**Solution:** Standardize on `generateRequestId()` everywhere.

---

## Recommended Action Plan

### Phase 1: Critical Security Patterns (Week 1)
1. **Standardize manager auth** - Update all 11 manager routes to use `requireManagerAuth()`
2. **Create CORS helpers** - Extract `corsJsonResponse()` and `corsErrorResponse()`
3. **Fix request ID generation** - Search/replace all `crypto.randomUUID()` with `generateRequestId()`

### Phase 2: Request/Response Patterns (Week 2)
4. **Create OPTIONS handler factory** - Replace 18 duplicate OPTIONS handlers
5. **Standardize body parsing** - Create `parseJsonBody()` helper
6. **Enhance workspace validation** - Create `validateWorkspaceRequest()`

### Phase 3: Validation & Cleanup (Week 3)
7. **Create Zod validation helper** - Extract schema validation pattern
8. **Standardize origin extraction** - Create `getOrigin()` helper
9. **Document and enforce patterns** - Update contributing guide

---

## Testing Strategy

**For each refactoring:**
1. Write test for new helper function
2. Test one route with new helper
3. Run E2E tests to ensure behavior unchanged
4. Roll out to remaining routes
5. Remove old duplicate code

---

## Under-utilized Existing Helpers

**Already exists but not consistently used:**
1. `createErrorResponse()` - features/auth/lib/auth.ts
2. `validateRequest()` - features/auth/lib/auth.ts
3. `requireManagerAuth()` - features/manager/lib/api-helpers.ts
4. `createSuccessResponse()`, `createBadRequestResponse()` - features/manager/lib/api-helpers.ts
5. `handleWorkspaceApi()` - lib/workspace-api-handler.ts

**Action:** Audit and mandate usage before creating new helpers.

---

## Files for New Helpers

```
lib/api/
├── cors.ts          # CORS utilities (OPTIONS, addHeaders)
├── responses.ts     # Response helpers (corsJsonResponse, corsErrorResponse)
├── request.ts       # Request utilities (getOrigin, parseJsonBody)
├── validation.ts    # Schema validation helpers
└── middleware.ts    # Route middleware (withAuth, withRequestId)
```
