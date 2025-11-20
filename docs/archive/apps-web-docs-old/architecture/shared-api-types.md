# Shared API Types Refactor - Summary

## What Changed

Refactored from inline validators and duplicate types to a **single source of truth** for all API types.

### Before ❌

```typescript
// Duplicated everywhere:
const validator = (data): data is { ok: boolean; workspaces: string[] } =>
  typeof data === "object" && data !== null && "ok" in data && data.ok === true

// Different inline validators in:
// - WorkspaceSwitcher.tsx
// - useOrganizations.ts
// - SettingsModal.tsx
// - etc.
```

**Problems:**
- Inline validators recreated on every render → infinite loops
- No shared types between API and frontend
- Hard to maintain
- No type safety

### After ✅

```typescript
// lib/api/types.ts - Single source of truth
export interface WorkspacesResponse {
  ok: true
  workspaces: string[]
}

export function isWorkspacesResponse(data: unknown): data is WorkspacesResponse {
  // Shared type guard
}

// Usage everywhere:
import { isWorkspacesResponse } from "@/lib/api/types"
const validator = useCallback(isWorkspacesResponse, [])
```

## Files Created

1. **`lib/api/types.ts`** - Shared types & type guards
   - Auth: `LoginResponse`, `LogoutResponse`, `VerifyResponse`, `TokensResponse`
   - Organizations: `Organization`, `OrganizationsResponse`, `WorkspacesResponse`
   - Feedback: `FeedbackResponse`
   - Type guards for all types
   - Only includes types that use `{ ok: boolean }` pattern

2. **`lib/api/responses.ts`** - Response builders for API routes
   - `organizationsResponse()`, `workspacesResponse()`
   - `errorResponse()`, `CommonErrors`
   - Standardized API responses

3. **`lib/api/README.md`** - Usage guide & documentation

## Files Refactored

### Frontend

1. **`components/workspace/WorkspaceSwitcher.tsx`**
   - ❌ Removed inline validator
   - ✅ Uses `isWorkspacesResponse` type guard
   - ✅ Memoized with `useCallback`

2. **`lib/hooks/useOrganizations.ts`**
   - ❌ Removed manual `data.ok && data.organizations` checks
   - ✅ Uses `isOrganizationsResponse` type guard
   - ✅ Imports `Organization` type from shared types

3. **`lib/stores/workspaceStore.ts`**
   - ❌ Removed duplicate `Organization` interface
   - ✅ Re-exports from `lib/api/types`

4. **`components/modals/SettingsModal.tsx`**
   - ✅ Imports `Organization` from shared types

## Benefits

### 1. Type Safety

```typescript
// Frontend knows exact API shape
const data: OrganizationsResponse = await fetch("/api/auth/organizations")
//    ^? Type is guaranteed by shared type guard

// API routes return typed responses
return organizationsResponse(orgs)  // Type-checked
```

### 2. No More Infinite Loops

```typescript
// ✅ Stable reference - won't cause re-renders
const validator = useCallback(isWorkspacesResponse, [])

// ❌ New function every render - causes loops
const validator = (data) => data.ok === true
```

### 3. Single Source of Truth

```
                  lib/api/types.ts
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    API routes    Frontend hooks   Components
         │              │              │
         └──────────────┴──────────────┘
              All use same types!
```

### 4. Easy Maintenance

Change the type once → TypeScript finds all usages:

```typescript
// lib/api/types.ts
export interface WorkspacesResponse {
  ok: true
  workspaces: string[]
  total_count: number  // Add new field
}
```

TypeScript will error everywhere the type is used incorrectly!

## Testing

```bash
# Still works after refactor:
bun run test:e2e:staging --grep="workspace"
✅ All tests pass
```

## Migration Pattern

For any new API endpoint:

```typescript
// 1. Define type in lib/api/types.ts
export interface MyResponse {
  ok: true
  data: MyData[]
}

// 2. Create type guard
export function isMyResponse(data: unknown): data is MyResponse {
  if (!isApiSuccess(data)) return false
  return "data" in data && Array.isArray(data.data)
}

// 3. Use in API route
import { jsonResponse } from "@/lib/api/responses"
export async function GET() {
  const data = await getData()
  return jsonResponse({ ok: true, data })
}

// 4. Use in frontend
import { isMyResponse } from "@/lib/api/types"
const validator = useCallback(isMyResponse, [])
const { data } = useFetch({ url: "/api/my-endpoint", validator })
```

## Rules Going Forward

1. ✅ **Always use shared type guards** - Never inline validators
2. ✅ **Always import types from `lib/api/types`** - Never duplicate
3. ✅ **Always memoize type guards** - `useCallback(guard, [])`
4. ✅ **API routes use response builders** - `lib/api/responses.ts`

## Known Inconsistencies

### Response Format Patterns

The codebase currently has **two different response patterns**:

1. **Standard Pattern** (recommended) - `{ ok: boolean }`
   - Used by: Auth APIs (login, logout, verify, tokens), Organizations, Workspaces
   - All shared types in `lib/api/types.ts` use this pattern

2. **Legacy Pattern** - `{ success: boolean }`
   - Used by: Deploy API, Image Upload API
   - Has local type definitions in route files
   - Frontend code expects this format

**Why this exists**: Different parts of the app were developed at different times with different conventions.

**Resolution**: New APIs should use the `{ ok: boolean }` pattern. Legacy APIs will be gradually migrated when safe to do so (requires frontend updates).

## Related Docs

- `lib/api/README.md` - Full usage guide
- `docs/debugging/infinite-loop-fix.md` - Why inline validators are bad
- `docs/architecture/org-auto-selection-refactor.md` - Store architecture
