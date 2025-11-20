# Debugging Organization and Workspace Loading Issues

This guide helps diagnose issues when organizations or workspaces fail to load after login.

## Quick Diagnosis

### Symptom: "Org selected but not loading workspaces"

**Flow to check:**

1. **Login Success** → User redirects to `/chat` ✅
2. **Organizations API Call** → `/api/auth/organizations` ✅
3. **Auto-select First Org** → Zustand store updates ⚠️
4. **Workspaces API Call** → `/api/auth/workspaces?org_id={orgId}` ❌
5. **Auto-select First Workspace** → UI updates ❌

### Common Failure Points

| Issue | Symptom | Fix |
|-------|---------|-----|
| Org API fails | "Failed to load organizations" banner | Check Supabase IAM connection |
| Org auto-select fails | No org selected, "no org selected" in UI | Check `OrganizationSelector` useEffect |
| Workspace API fails | "error loading sites" in switcher | Check org_id parameter, verify domains table |
| Workspace auto-select fails | Shows "loading..." forever | Check `WorkspaceSwitcher` useEffect |

## Step-by-Step Debug

### 1. Check Browser Console

Open DevTools Console and look for:

```javascript
// Expected logs
[Chat] Fetching organizations...
[Chat] Organizations loaded: [...]
[WorkspaceSwitcher] Fetching workspaces for org: org-xyz
[WorkspaceSwitcher] Workspaces loaded: [...]

// Error logs
[Chat] Failed to fetch organizations: <error>
[WorkspaceSwitcher] Failed to fetch workspaces: <error>
```

### 2. Check Network Tab

Filter for: `/api/auth/`

**Expected sequence:**
1. `POST /api/login` → 200 OK (sets JWT cookie)
2. `GET /api/auth/organizations` → 200 OK with JSON
3. `GET /api/auth/workspaces?org_id=<org-id>` → 200 OK with JSON

**Check responses:**

```json
// /api/auth/organizations
{
  "ok": true,
  "organizations": [
    {
      "org_id": "...",
      "name": "...",
      "credits": 1000,
      "workspace_count": 5
    }
  ]
}

// /api/auth/workspaces?org_id=xxx
{
  "ok": true,
  "workspaces": ["example.com", "another.com"]
}
```

### 3. Check Zustand Store State

In console:

```javascript
// Check org selection
window.__ZUSTAND_STORES__ // (if dev tools installed)

// Or inspect localStorage
JSON.parse(localStorage.getItem('workspace-storage'))
// Should show: { state: { selectedOrgId: "org-xyz", ... }, version: 2 }
```

### 4. Check Component Re-renders

Add this to `WorkspaceSwitcher.tsx` temporarily:

```typescript
useEffect(() => {
  console.log('[WorkspaceSwitcher] State:', {
    selectedOrgId,
    loading,
    workspaces,
    currentWorkspace,
  })
}, [selectedOrgId, loading, workspaces, currentWorkspace])
```

Expected logs:
```
[WorkspaceSwitcher] State: { selectedOrgId: null, loading: true, workspaces: [], currentWorkspace: null }
[WorkspaceSwitcher] State: { selectedOrgId: 'org-xyz', loading: true, workspaces: [], currentWorkspace: null }
[WorkspaceSwitcher] State: { selectedOrgId: 'org-xyz', loading: false, workspaces: ['site.com'], currentWorkspace: 'site.com' }
```

### 5. Verify Database State

Check Supabase tables:

```sql
-- Check user's org memberships
SELECT om.*, o.name
FROM org_memberships om
JOIN orgs o ON om.org_id = o.org_id
WHERE om.user_id = '<user-id>';

-- Check org's domains
SELECT d.*
FROM domains d
WHERE d.org_id = '<org-id>';
```

## E2E Test Reproduction

Run the comprehensive E2E tests:

```bash
# Against staging (reproduces user's environment)
cd apps/web
bun run test:e2e:staging

# With browser visible
TEST_ENV=staging bun run test:e2e:headed org-workspace-selection.spec.ts

# Debug mode (step through)
TEST_ENV=staging bun run test:e2e:debug org-workspace-selection.spec.ts
```

## Common Fixes

### Fix 1: Org Not Auto-Selecting

**File**: `components/workspace/OrganizationSelector.tsx`

**Check**: Lines 23-30 - auto-select effect

```typescript
useEffect(() => {
  if (!loading && organizations.length > 0 && !selectedOrgId) {
    const firstOrg = organizations[0]
    setSelectedOrg(firstOrg.org_id) // ← Is this running?
    onOrgChange?.(firstOrg.org_id)
  }
}, [loading, organizations, selectedOrgId, setSelectedOrg, onOrgChange])
```

**Common issue**: `onOrgChange` dependency causes infinite loop

### Fix 2: Workspaces Not Loading

**File**: `components/workspace/WorkspaceSwitcher.tsx`

**Check**: Lines 19-24 - useFetch hook

```typescript
const { data, loading, error } = useFetch<{ ok: boolean; workspaces: string[] }>({
  url: selectedOrgId ? `/api/auth/workspaces?org_id=${selectedOrgId}` : null,
  // ↑ If selectedOrgId is null/undefined, API won't be called
  dependencies: [selectedOrgId],
})
```

**Common issue**: `selectedOrgId` is null because org auto-select didn't run

### Fix 3: Workspace Not Auto-Selecting

**File**: `components/workspace/WorkspaceSwitcher.tsx`

**Check**: Lines 30-43 - auto-select effect

```typescript
useEffect(() => {
  if (!loading && workspaces.length > 0 && selectedOrgId) {
    const currentWorkspaceInList = workspaces.includes(currentWorkspace || "")

    if (!currentWorkspace || !currentWorkspaceInList) {
      const firstWorkspace = recentWorkspaces.length > 0
        ? recentWorkspaces[0].domain
        : workspaces[0]

      setSelectedWorkspace(firstWorkspace, selectedOrgId)
      onWorkspaceChange(firstWorkspace) // ← Is this running?
    }
  }
}, [loading, workspaces, currentWorkspace, recentWorkspaces, selectedOrgId])
```

**Common issue**: Effect dependencies cause re-run loops or prevent execution

## Staging-Specific Issues

### Issue: CORS Errors

If you see CORS errors in staging:

1. Check `lib/cors-utils.ts` - ensures proper CORS headers
2. Verify Supabase project allows staging domain
3. Check Caddy reverse proxy config

### Issue: Session Cookie Not Set

Symptoms:
- Login redirects to `/chat` but immediately redirects back to `/`
- Or: 401 errors on `/api/auth/organizations`

Check:
1. Cookie `httpOnly` and `secure` flags in production
2. Domain attribute on cookie (must match staging domain)
3. SameSite attribute

### Issue: Database Connection

If Supabase queries fail:

1. Check environment variables in PM2:
   ```bash
   pm2 env claude-bridge-staging
   ```

2. Verify Supabase keys are correct:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Related Files

- `apps/web/app/chat/page.tsx` - Main chat page with org fetch
- `apps/web/components/workspace/OrganizationSelector.tsx` - Org selector component
- `apps/web/components/workspace/WorkspaceSwitcher.tsx` - Workspace switcher component
- `apps/web/lib/stores/workspaceStore.ts` - Zustand store for org/workspace state
- `apps/web/app/api/auth/organizations/route.ts` - Organizations API
- `apps/web/app/api/auth/workspaces/route.ts` - Workspaces API

## Further Help

If issue persists after checking above:

1. Enable debug logging in components (add console.logs)
2. Run E2E tests to capture exact failure point
3. Check PM2 logs: `pm2 logs claude-bridge-staging`
4. Check Supabase logs in dashboard
5. Use Playwright trace viewer: `bunx playwright show-trace test-results/.../trace.zip`
