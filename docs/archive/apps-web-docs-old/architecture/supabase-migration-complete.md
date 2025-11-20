# Supabase Migration (2025-11-16)

**Status**: ✅ Complete
**Objective**: Eliminate JSON file and SQLite dependencies

## What Changed

All data storage migrated from JSON files and SQLite to Supabase PostgreSQL:

- **Passwords**: `domain-passwords.json` → `iam.users.password_hash`
- **Feedback**: `feedback.json` → `app.feedback`
- **Ports**: `domain-passwords.json` → `app.domains.port`
- **Credits**: Already using `iam.orgs.credits` (migrated 2025-11-14)
- **Sessions**: Already using `iam.sessions`
- **SQLite**: Removed (unused)

## New Files

| File | Purpose |
|------|---------|
| `lib/domains.ts` | Domain/port lookups from Supabase |
| `lib/auth/supabase-passwords.ts` | Password updates via Supabase |
| `lib/feedback.ts` | Feedback storage (replaced JSON version) |

## Updated Routes

| Route | Change |
|-------|--------|
| `/api/claude/stream` | Uses `getWorkspaceCredits()` (Supabase) |
| `/api/manager/vite-config` | Uses `getDomain()` for ports |
| `/api/manager/status` | Uses `getAllDomains()` |
| `/api/feedback` | Uses `addFeedbackEntry()` (Supabase) |
| `/api/manager/feedback/*` | All use Supabase functions |

## Deprecated Code

**Marked `@deprecated` in `types/guards/api.ts`:**
- `loadDomainPasswords()`
- `saveDomainPasswords()`
- `isDomainPasswordValid()`
- `updateDomainConfig()`

**Marked `@deprecated`:**
- `lib/db/` - Entire SQLite infrastructure (unused)

## Data Flow

### Credits
```
domain → getWorkspaceCredits() → app.domains.org_id → iam.orgs.credits
```

### Password Updates
```
domain → updateDomainOwnerPassword()
  → app.domains.org_id
  → iam.org_memberships (role='owner')
  → iam.users.password_hash
```

### Feedback
```
addFeedbackEntry() → app.feedback (context as JSON)
```

## Verification

```bash
# No JSON file usage
grep -r "loadDomainPasswords" app/api
# Result: No matches (only deprecated functions remain)

# Build passes
bun run build
# ✅ Compiled successfully
```

## Edge Cases Handled

- Null `org_id` check in password updates
- Missing domain returns null (not error)
- Empty feedback context defaults to `{}`
- Async operations properly awaited

## Next Steps

After 1 week of stable operation (2025-11-23):
- Remove deprecated functions from `types/guards/api.ts`
- Delete `lib/db/` directory
- Clean up `/var/lib/claude-bridge/*.json` files from server
