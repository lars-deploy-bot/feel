# Organization Auto-Selection Architecture

## Overview

Organization auto-selection is now centralized in Zustand store with a single custom hook for consistency and maintainability.

## Architecture Principles

**Single Source of Truth** ✅
- **Zustand Store** (`workspaceStore.ts`) contains the auto-selection logic
- **Custom Hook** (`useOrganizations.ts`) handles fetching + triggering auto-select
- **Components** just consume the hook - no logic duplication

## File Structure

```
lib/
├── stores/
│   └── workspaceStore.ts          # Auto-selection logic in store
├── hooks/
│   └── useOrganizations.ts        # Fetching hook that calls store
```

## Components

### 1. Zustand Store Action (`workspaceStore.ts`)

```typescript
/**
 * Auto-select first organization if none selected
 * This is the single source of truth for org auto-selection logic
 */
autoSelectOrg: (organizations: Organization[]) => {
  set(state => {
    // Only auto-select if no org currently selected and we have orgs
    if (!state.selectedOrgId && organizations.length > 0) {
      console.log("[WorkspaceStore] Auto-selecting first organization:", organizations[0].name)
      return { selectedOrgId: organizations[0].org_id }
    }
    return state
  })
}
```

**Key Features:**
- Checks if org already selected (idempotent)
- Only selects if organizations array is not empty
- Logs selection for debugging
- Returns unchanged state if no action needed

### 2. Custom Hook (`useOrganizations.ts`)

```typescript
export function useOrganizations(options?: { immediate?: boolean }) {
  const { autoSelectOrg } = useWorkspaceActions()

  const fetchOrganizations = async () => {
    // ... fetch logic ...

    if (data.ok && data.organizations) {
      setOrganizations(data.organizations)

      // Auto-select via store (single source of truth)
      autoSelectOrg(data.organizations)
    }
  }

  return { organizations, loading, error, refetch }
}
```

**Key Features:**
- ALWAYS calls `autoSelectOrg` after successful fetch
- Store decides whether to actually select (based on existing state)
- Returns organizations array, loading state, error, and refetch function
- Can be used anywhere that needs organizations

### 3. Component Usage

#### Chat Page (`app/chat/page.tsx`)

```typescript
const {
  organizations,
  loading: orgsLoading,
  error: orgsError,
  refetch: refetchOrgs,
} = useOrganizations()

// Calculate domain count
const totalDomainCount = organizations.reduce(
  (sum, org) => sum + (org.workspace_count || 0),
  0
)
```

#### Settings Modal (`components/modals/SettingsModal.tsx`)

```typescript
function OrganizationSettings() {
  const { organizations, loading, error, refetch } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()

  // ... render organizations list ...
}
```

## Benefits

### Before (❌ Problem)

**Multiple auto-selection locations:**
1. Chat page: `fetchDomainCount()` had inline auto-select logic
2. Settings modal: `OrganizationSettings` had duplicate auto-select logic

**Issues:**
- Logic duplication
- Hard to maintain
- Inconsistent behavior
- Auto-select only ran when Settings opened (in original code)

### After (✅ Solution)

**Single source of truth:**
1. Store has the selection logic
2. Hook handles fetching
3. Components just use the hook

**Benefits:**
- No duplication - DRY principle
- Consistent behavior everywhere
- Easy to test
- Easy to maintain
- Auto-selects immediately on page load

## Testing

E2E test confirms auto-selection works:

```bash
cd apps/web
bun run test:e2e:staging --grep="auto-selects first organization"

# Result: ✅ 1 passed (4.9s)
```

## Migration Notes

### If you need to add org fetching to a new component:

```typescript
import { useOrganizations } from "@/lib/hooks/useOrganizations"

function MyComponent() {
  const { organizations, loading, error, refetch } = useOrganizations()

  if (loading) return <Spinner />
  if (error) return <Error message={error} onRetry={refetch} />

  return <OrgList organizations={organizations} />
}
```

### If you need to manually select an org:

```typescript
import { useWorkspaceActions } from "@/lib/stores/workspaceStore"

function MyComponent() {
  const { setSelectedOrg } = useWorkspaceActions()

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrg(orgId) // Manual selection
  }
}
```

## Flow Diagram

```
User loads chat page
        ↓
useOrganizations hook runs
        ↓
Fetches /api/auth/organizations
        ↓
Calls autoSelectOrg(organizations)
        ↓
Store checks: !selectedOrgId && orgs.length > 0
        ↓
    [YES] → Sets selectedOrgId
    [NO]  → Returns unchanged
        ↓
WorkspaceSwitcher sees selectedOrgId
        ↓
Fetches /api/auth/workspaces?org_id={selectedOrgId}
        ↓
Auto-selects first workspace
        ↓
User can start chatting ✅
```

## Debugging

### Check if org was auto-selected:

```javascript
// Browser console
localStorage.getItem('workspace-storage')
// Should show: { "state": { "selectedOrgId": "org-xyz", ... } }
```

### Check console logs:

```javascript
// Should see in console:
[WorkspaceStore] Auto-selecting first organization: <org-name>
```

### Force re-fetch organizations:

```typescript
const { refetch } = useOrganizations()

// Later...
await refetch() // Will trigger auto-select again if no org selected
```

## Related Files

- `lib/stores/workspaceStore.ts` - Zustand store with auto-select action
- `lib/hooks/useOrganizations.ts` - Custom hook for fetching
- `app/chat/page.tsx` - Chat page using the hook
- `components/modals/SettingsModal.tsx` - Settings using the hook
- `components/workspace/WorkspaceSwitcher.tsx` - Depends on selectedOrgId
- `e2e-tests/org-workspace-selection.spec.ts` - E2E tests

## Future Improvements

- [ ] Add telemetry to track auto-selection success rate
- [ ] Add toast notification when org is auto-selected
- [ ] Consider caching organizations in Zustand store too
- [ ] Add optimistic updates when changing org name
