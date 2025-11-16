# API Types & Type Guards

**Single source of truth for API request/response types.**

## Why?

Previously, we had inline validators and duplicate type definitions scattered across the codebase:

```typescript
// ❌ BAD - Inline validators (before)
const validator = (data): data is { ok: boolean; workspaces: string[] } =>
  typeof data === "object" && data !== null && "ok" in data && data.ok === true
```

**Problems:**
- Type definitions duplicated between API routes and frontend
- No type safety between client and server
- Inline validators cause re-renders (new function reference every render)
- Hard to maintain - changes need to be made in multiple places

## Architecture

```
lib/api/
├── types.ts       # Shared types & type guards
├── responses.ts   # Response builders for API routes
└── README.md      # This file
```

### Single Source of Truth

```typescript
// lib/api/types.ts
export interface WorkspacesResponse {
  ok: true
  workspaces: string[]
}

export function isWorkspacesResponse(data: unknown): data is WorkspacesResponse {
  // Type guard implementation
}
```

Both API routes and frontend use the **same** types and guards.

## Usage

### Frontend (Components/Hooks)

```typescript
import { isWorkspacesResponse } from "@/lib/api/types"

// ✅ GOOD - Use shared type guard
const validator = useCallback(isWorkspacesResponse, [])

const { data } = useFetch({
  url: `/api/auth/workspaces?org_id=${orgId}`,
  validator,  // Stable reference, won't cause re-renders
})
```

### API Routes

```typescript
import type { WorkspacesResponse } from "@/lib/api/types"
import { workspacesResponse } from "@/lib/api/responses"

export async function GET(req: NextRequest) {
  const workspaces = ["site1.com", "site2.com"]

  // ✅ Type-safe response
  return workspacesResponse(workspaces, { origin })
}
```

## Available Types

### Response Types

- `OrganizationsResponse` - List of organizations
- `WorkspacesResponse` - List of workspace domains
- `LoginResponse` - Login success
- `ApiError` - Error response
- `ApiResponse<T>` - Generic response wrapper

### Type Guards

- `isOrganizationsResponse(data)` - Validates organizations response
- `isWorkspacesResponse(data)` - Validates workspaces response
- `isApiError(data)` - Check if response is an error
- `isApiSuccess(data)` - Check if response is successful

### Response Builders

- `workspacesResponse(workspaces, options)` - Create workspaces response
- `organizationsResponse(orgs, options)` - Create organizations response
- `errorResponse(error, options)` - Create error response
- `CommonErrors.unauthorized()` - Common 401 response
- `CommonErrors.forbidden(msg)` - Common 403 response
- `CommonErrors.internal()` - Common 500 response

## Adding New Types

### 1. Define the type in `types.ts`

```typescript
export interface UsersResponse {
  ok: true
  users: User[]
}
```

### 2. Create type guard

```typescript
export function isUsersResponse(data: unknown): data is UsersResponse {
  if (!isApiSuccess(data)) return false
  return "users" in data && Array.isArray(data.users)
}
```

### 3. (Optional) Add response builder in `responses.ts`

```typescript
export function usersResponse(users: User[], options: ResponseOptions = {}): NextResponse {
  const data: UsersResponse = { ok: true, users }
  return jsonResponse(data, options)
}
```

### 4. Use in API route

```typescript
import type { UsersResponse } from "@/lib/api/types"
import { usersResponse } from "@/lib/api/responses"

export async function GET() {
  const users = await getUsers()
  return usersResponse(users)
}
```

### 5. Use in frontend

```typescript
import { isUsersResponse } from "@/lib/api/types"

const validator = useCallback(isUsersResponse, [])
const { data } = useFetch({ url: "/api/users", validator })
```

## Benefits

### Type Safety ✅
- **Frontend knows exact API shape** - TypeScript catches mismatches
- **API routes return typed responses** - Can't accidentally send wrong shape
- **Refactoring is safe** - Change type once, TypeScript finds all usages

### Performance ✅
- **No re-renders from inline validators** - Type guard reference is stable
- **Memoized with useCallback** - Same function reference every render

### Maintainability ✅
- **Single source of truth** - Change once, updates everywhere
- **Easy to find** - All types in one place
- **Self-documenting** - Types serve as API documentation

## Migration Guide

### Before (❌ Inline validator)

```typescript
const { data } = useFetch({
  url: "/api/workspaces",
  validator: (data): data is { ok: boolean; workspaces: string[] } =>
    typeof data === "object" && data !== null && "ok" in data && data.ok === true,
})
```

### After (✅ Shared type guard)

```typescript
import { isWorkspacesResponse } from "@/lib/api/types"

const validator = useCallback(isWorkspacesResponse, [])
const { data } = useFetch({
  url: "/api/workspaces",
  validator,
})
```

## Rules

1. **Never create inline validators** - Always use shared type guards
2. **Never duplicate types** - Import from `lib/api/types.ts`
3. **Always memoize validators** - Use `useCallback(typeGuard, [])`
4. **API routes use response builders** - Use helpers from `lib/api/responses.ts`

## Related Docs

- `docs/debugging/infinite-loop-fix.md` - Why inline validators cause loops
- `docs/architecture/org-auto-selection-refactor.md` - Zustand store architecture
