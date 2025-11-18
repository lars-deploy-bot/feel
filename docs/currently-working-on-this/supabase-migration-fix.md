# Supabase Migration Fix - Manager "Infrastructure exists but not in registry" Issue

**Date**: 2025-11-17
**Branch**: supabase-credit
**Status**: ✅ COMPLETE

## Problem

The manager dashboard was showing "Infrastructure exists but not in registry" error for domains. This happened because:

1. The manager API route (`apps/web/app/api/manager/route.ts`) was already migrated to use Supabase
2. But the deployment scripts (`scripts/deploy-site-systemd.sh`, `scripts/delete-site-systemd.sh`) were still only writing to JSON files (`/var/lib/claude-bridge/domain-passwords.json`)
3. Domains deployed after the initial Supabase migration (2025-11-14) were only in JSON, not in Supabase
4. The manager marked these as "orphaned" (infrastructure exists but not in database registry)

## Solution

### 1. Created Helper Scripts

**`apps/web/scripts/add-domain-to-supabase.ts`**
- Adds a domain to Supabase when deploying
- Creates/finds user, creates org, creates membership, creates domain entry
- Called by `deploy-site-systemd.sh`

**`apps/web/scripts/remove-domain-from-supabase.ts`**
- Removes a domain from Supabase when deleting
- Called by `delete-site-systemd.sh`

**`apps/web/scripts/sync-orphaned-domains.ts`**
- One-time migration to sync existing orphaned domains
- Finds domains in JSON but not in Supabase and migrates them
- Successfully migrated 7 orphaned domains

### 2. Updated Deployment Scripts

**`scripts/deploy-site-systemd.sh`** (lines 171-178)
- Now writes to BOTH domain-passwords.json (for backwards compatibility) AND Supabase
- Calls `bun scripts/add-domain-to-supabase.ts` after adding to JSON
- Fails gracefully if Supabase update fails (warns but continues)

**`scripts/delete-site-systemd.sh`** (lines 127-134)
- Now removes from BOTH domain-passwords.json AND Supabase
- Calls `bun scripts/remove-domain-from-supabase.ts` after removing from JSON

### 3. Migrated Orphaned Domains

Ran `bun scripts/sync-orphaned-domains.ts` to migrate 7 orphaned domains:
- arnotennis.alive.best
- blabla.alive.best
- awan.alive.best
- test-e2e.alive.best
- test-polling-check.alive.best
- test-poll.alive.best
- test-flow.alive.best

**Result**: All 62 domains from JSON are now in Supabase (63 total in Supabase)

## Verification

```bash
# Before fix
Found 56 domains in Supabase
Found 62 domains in JSON
Found 7 orphaned domains

# After fix
Found 63 domains in Supabase
Found 62 domains in JSON
Found 0 orphaned domains ✅
```

## Next Steps

### For Future Deployments

New domains deployed using `scripts/deploy-site-systemd.sh` will automatically be added to both JSON and Supabase.

### Migration Status

- ✅ Manager API already using Supabase
- ✅ Deployment scripts updated to write to Supabase
- ✅ Delete scripts updated to remove from Supabase
- ✅ All existing domains migrated
- ⚠️ JSON files still maintained for backwards compatibility
- 🔮 Future: Remove JSON dependency entirely (requires updating all code that reads from JSON)

## Technical Details

### Supabase Schema

**IAM Schema** (`iam`)
- `users` - User accounts with email and password_hash
- `orgs` - Organizations with credits
- `org_memberships` - Links users to orgs with roles (owner/member)

**App Schema** (`app`)
- `domains` - Domain entries with hostname, port, org_id

### Data Flow

**Domain → Credits**:
```
domain (hostname)
  → app.domains.org_id
  → iam.orgs.credits
```

**Domain → Owner**:
```
domain (hostname)
  → app.domains.org_id
  → iam.org_memberships (role='owner')
  → iam.users
```

## Files Changed

- ✅ `apps/web/scripts/add-domain-to-supabase.ts` (new)
- ✅ `apps/web/scripts/remove-domain-from-supabase.ts` (new)
- ✅ `apps/web/scripts/sync-orphaned-domains.ts` (new)
- ✅ `scripts/deploy-site-systemd.sh` (updated lines 171-178)
- ✅ `scripts/delete-site-systemd.sh` (updated lines 127-134)

## Testing

To test the fix:

1. **Deploy a new domain**:
   ```bash
   /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh newtest.alive.best
   ```
   - Should add to both JSON and Supabase

2. **Check manager dashboard**:
   - Visit `/manager` (requires manager_session cookie)
   - Domain should NOT show as orphaned
   - Should display correct port and credits

3. **Delete a domain**:
   ```bash
   /root/webalive/claude-bridge/scripts/delete-site-systemd.sh newtest.alive.best
   ```
   - Should remove from both JSON and Supabase

## Notes

- The manager API route was already using Supabase (via `getAllOrganizationCredits()`), so no changes needed there
- JSON files are still maintained for backwards compatibility and as a backup
- The sync script (`sync-orphaned-domains.ts`) can be run anytime to catch any future orphaned domains
- All new deployments now write to both storage systems for maximum compatibility
