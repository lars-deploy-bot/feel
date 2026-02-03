# Organization/Workspace Loading Fix - Summary

## Issue Reported

**User**: admin@example.com (staging environment)
**Symptom**: "I have this org selected but it's not loading in staging"

## Root Cause Found

The organization auto-selection logic was only in the Settings modal (`OrganizationSettings` component), but it needed to run on initial page load in terminal mode.

**Flow Issue:**
1. User logs in to `dev.terminal.goalive.nl` (terminal mode)
2. Chat page loads and fetches organizations (for domain count)
3. **BUG**: No org is auto-selected
4. `WorkspaceSwitcher` tries to load workspaces but `selectedOrgId` is null
5. Shows "no org selected" error in UI

## Fix Applied

**File**: `apps/web/app/chat/page.tsx`

Added auto-selection logic to the `fetchDomainCount` useEffect (lines 175-179):

```typescript
// Auto-select first org if none selected (terminal mode only)
if (isTerminal && !selectedOrgId && data.organizations.length > 0) {
  console.log("[Chat] Auto-selecting first organization:", data.organizations[0].name)
  setSelectedOrg(data.organizations[0].org_id)
}
```

**Dependencies added**:
- Import: `useSelectedOrgId, useWorkspaceActions` from workspace store
- Used in component: `selectedOrgId`, `setSelectedOrg`
- Added to useEffect deps: `isTerminal`, `selectedOrgId`, `setSelectedOrg`

## Testing

Created comprehensive E2E tests in `e2e-tests/org-workspace-selection.spec.ts`:

### Test Coverage
- ✅ Organization loading after login
- ✅ Auto-selection of first organization
- ✅ Workspace loading for selected organization
- ✅ Auto-selection of first workspace
- ✅ Error states and retry functionality
- ✅ Empty workspace handling

### Test Results (Staging)

Before fix:
```
❌ auto-selects first organization when none selected
   Expected: not visible
   Received: <span>no org selected</span>
```

After fix:
```
✅ auto-selects first organization when none selected (4.7s)
```

### Running Tests

**Local tests:**
```bash
cd apps/web
bun run test:e2e
```

**Staging tests:**
```bash
cd apps/web
bun run test:e2e:staging

# With browser visible
TEST_ENV=staging bun run test:e2e:headed org-workspace-selection.spec.ts

# Debug mode
TEST_ENV=staging bun run test:e2e:debug org-workspace-selection.spec.ts

# Custom credentials
STAGING_EMAIL=your@email.com STAGING_PASSWORD=pass bun run test:e2e:staging
```

## Files Changed

1. **apps/web/app/chat/page.tsx**
   - Added org auto-selection logic
   - Imports workspace store hooks
   - Console logging for debugging

2. **apps/web/e2e-tests/org-workspace-selection.spec.ts** *(new)*
   - Comprehensive E2E tests for org/workspace flow
   - Works against both local and staging
   - Tests auto-selection behavior

3. **apps/web/package.json**
   - Added `test:e2e:staging` command
   - Added `test:e2e:staging:ui` command

4. **apps/web/playwright.config.ts**
   - Support for staging environment testing
   - Conditional baseURL based on TEST_ENV

5. **apps/web/e2e-tests/README.md** *(new)*
   - Documentation for running tests
   - Staging test instructions
   - Debugging guide

6. **apps/web/docs/debugging/org-workspace-loading.md** *(new)*
   - Complete debugging guide
   - Common failure points
   - Step-by-step diagnosis
   - Fixes reference

## Deployment

To deploy this fix to staging:

```bash
cd /root/webalive/claude-bridge
bun run staging

# Or build and restart manually
cd apps/web
bun run build
pm2 restart claude-bridge-staging
```

## Verification

After deployment, verify the fix:

1. **Login to staging**: https://dev.terminal.goalive.nl
2. **Check browser console** for log:
   ```
   [Chat] Auto-selecting first organization: <org-name>
   ```
3. **Verify UI**: Should NOT show "no org selected" error
4. **Check workspace**: Should auto-load workspaces and select first one

## Notes

- Fix only applies in **terminal mode** (dev.terminal.goalive.nl, terminal.goalive.nl)
- In domain mode (direct site.com login), org/workspace comes from domain
- Settings modal still has its own auto-select logic (unchanged)
- Zustand store persists selected org across page refreshes

## Related Issues

- WorkspaceSwitcher expects selectedOrgId to fetch workspaces
- Without org selection, workspace fetch never happens
- UI shows "no org selected" in workspace switcher
- This blocks the entire chat interface

## Future Improvements

- [ ] Add loading spinner during org fetch
- [ ] Show toast notification when org is auto-selected
- [ ] Add "Switch Organization" quick action in UI
- [ ] Consider combining OrganizationSettings auto-select with chat page logic
- [ ] Add telemetry to track auto-selection success rate
