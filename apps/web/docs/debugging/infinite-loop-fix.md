# Infinite Loop Fix - Workspace Loading

## Issue

After refactoring org auto-selection, the workspace switcher was stuck on "Loading workspace..." infinitely, with repeated API calls to `/api/auth/workspaces?org_id=...` happening in a loop.

## Root Cause

The `WorkspaceSwitcher` component was creating a new `validator` function on every render:

```typescript
// ❌ BEFORE - Recreated on every render
const { data, loading, error } = useFetch({
  url: selectedOrgId ? `/api/auth/workspaces?org_id=${selectedOrgId}` : null,
  validator: (data): data is { ok: boolean; workspaces: string[] } =>
    typeof data === "object" && data !== null && "ok" in data && data.ok === true,
  dependencies: [selectedOrgId],
})
```

### The Loop

1. `WorkspaceSwitcher` renders
2. Creates **new** `validator` function (new reference)
3. Passes to `useFetch`
4. `useFetch` sees new `validator`, recreates `fetchData` callback (line 87 of `useFetch.ts`)
5. `useEffect` sees new `fetchData`, re-runs fetch (line 98)
6. Fetches workspaces → success
7. Auto-select effect runs, calls `onWorkspaceChange(firstWorkspace)`
8. Parent component re-renders (workspace changed)
9. `WorkspaceSwitcher` re-renders
10. **Go to step 2** → Infinite loop ♾️

### Why This Happened

The `useFetch` hook has `validator` as a dependency of `fetchData`:

```typescript
// useFetch.ts line 87
const fetchData = useCallback(async () => {
  // ... fetch logic
}, [url, validator, onSuccess])  // ← validator in deps
```

And the `useEffect` depends on `fetchData`:

```typescript
// useFetch.ts line 90
useEffect(() => {
  fetchData()
}, [fetchData, retryCount, ...dependencies])  // ← fetchData in deps
```

So if `validator` changes → `fetchData` changes → effect re-runs → fetch happens again.

## Solution

Memoize the `validator` function with `useCallback` so it has a stable reference:

```typescript
// ✅ AFTER - Stable reference
const validator = useCallback(
  (data: unknown): data is { ok: boolean; workspaces: string[] } =>
    typeof data === "object" && data !== null && "ok" in data && (data as { ok: boolean }).ok === true,
  [],  // ← Empty deps = created once
)

const { data, loading, error } = useFetch({
  url: selectedOrgId ? `/api/auth/workspaces?org_id=${selectedOrgId}` : null,
  validator,  // ← Stable reference
  dependencies: [selectedOrgId],
})
```

## Files Changed

**`components/workspace/WorkspaceSwitcher.tsx`**
- Added `useCallback` import
- Memoized `validator` function
- Prevented infinite re-renders

## Testing

```bash
cd apps/web
bun run test:e2e:staging --grep="auto-selects first workspace"

# Result: ✅ 1 passed (12.7s)
```

## Logs Before Fix

```bash
# Repeated calls in PM2 logs:
GET /api/auth/workspaces?org_id=org_7e5f34d935432e19 200 in 3ms
GET /api/auth/workspaces?org_id=org_7e5f34d935432e19 200 in 5ms
GET /api/auth/workspaces?org_id=org_7e5f34d935432e19 200 in 9ms
GET /api/auth/workspaces?org_id=org_7e5f34d935432e19 200 in 7ms
# ... repeating infinitely
```

## Logs After Fix

```bash
# Single call on mount:
GET /api/auth/workspaces?org_id=org_7e5f34d935432e19 200 in 4ms
# No more repeated calls ✅
```

## Lesson Learned

### Rule: Never create inline functions for hook dependencies

**❌ Bad:**
```typescript
useSomeHook({
  callback: () => { /* ... */ },  // New function every render
  validator: (x) => x.ok,          // New function every render
})
```

**✅ Good:**
```typescript
const callback = useCallback(() => { /* ... */ }, [deps])
const validator = useCallback((x) => x.ok, [])

useSomeHook({
  callback,   // Stable reference
  validator,  // Stable reference
})
```

### When to use `useCallback`

Use `useCallback` when:
1. Passing functions to custom hooks that use them as dependencies
2. Passing functions to child components that are memoized with `React.memo`
3. Functions are dependencies of `useEffect` or other hooks
4. Functions are used in dependency arrays

### Alternative Solutions

1. **Move validator outside component** (for truly static validators):
   ```typescript
   const workspaceValidator = (data: unknown): data is WorkspaceResponse =>
     typeof data === "object" && data !== null && "ok" in data && (data as any).ok === true

   function WorkspaceSwitcher() {
     const { data } = useFetch({ validator: workspaceValidator })
   }
   ```

2. **Use a ref** (if validator needs to access props/state):
   ```typescript
   const validatorRef = useRef((data: unknown) => /* ... */)
   const { data } = useFetch({ validator: validatorRef.current })
   ```

## Related Issues

This pattern applies to **any** hook that uses callbacks/validators as dependencies:
- `useFetch` - validators, onSuccess callbacks
- `useEffect` - callback functions
- `useMemo` - compute functions (less critical)
- Custom hooks - any function props

## Prevention

To prevent this in the future:

1. **ESLint rule**: Enable `react-hooks/exhaustive-deps` (already enabled)
2. **Code review**: Check for inline functions passed to hooks
3. **Testing**: E2E tests caught this issue immediately
4. **Monitoring**: Watch for repeated API calls in logs

## Quick Check

If you see repeated API calls in logs:
1. Check for inline functions in hook calls
2. Add `useCallback` to stabilize references
3. Test again

## Related Documentation

- `docs/architecture/org-auto-selection-refactor.md` - Architecture overview
- `docs/debugging/org-workspace-loading.md` - General debugging guide
