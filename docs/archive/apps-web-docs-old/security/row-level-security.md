# Row Level Security (RLS) Implementation

**Created:** 2025-11-17
**Status:** ✅ Implemented
**Applies to:** IAM schema (`iam.*`) and App schema (`app.*`)

## Overview

Row Level Security (RLS) is now enabled on all tables in the `iam` and `app` schemas to enforce multi-tenancy boundaries and prevent unauthorized data access.

### Security Model

```
Users → Organizations → Domains
  ↓         ↓              ↓
Sessions  Memberships   Errors
                       Feedback
                       Gateway Settings
```

**Key Principles:**
1. **User Isolation**: Users can only access their own user data and sessions
2. **Org-Based Access**: Users access domains, errors, and settings through org memberships
3. **Role-Based Permissions**: Admins/owners have additional privileges (manage members, invites)
4. **Service Role Bypass**: Backend operations use service role which bypasses RLS

## Architecture

### Current Authentication Flow

```
Client Request
    ↓
JWT Cookie (session)
    ↓
Backend API (Next.js Route)
    ↓
Service Role Client (bypasses RLS)
    ↓
Supabase Database
```

**IMPORTANT:** Currently, all database access happens server-side using the **service role**, which bypasses RLS entirely. RLS policies are defensive - they protect against future client-side database access or accidental anon key exposure.

### Helper Functions

Three helper functions power the RLS policies:

| Function | Purpose | Example |
|----------|---------|---------|
| `iam.current_user_id()` | Get authenticated user ID | `WHERE user_id = iam.current_user_id()` |
| `iam.is_org_member(org_id)` | Check if user is org member | `WHERE iam.is_org_member(org_id)` |
| `iam.is_org_admin(org_id)` | Check if user is admin/owner | `WHERE iam.is_org_admin(org_id)` |

## Policy Reference

### iam.users

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View own profile | `user_id = current_user_id()` |
| SELECT | View org members | Share at least one org |
| UPDATE | Update own profile | `user_id = current_user_id()` + prevent password changes |

**Password Protection:** Users cannot directly modify `password_hash` via UPDATE. Password changes must go through a dedicated authentication flow.

### iam.sessions

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View own sessions | `user_id = current_user_id()` |
| INSERT | Create own sessions | `user_id = current_user_id()` |
| UPDATE | Update own sessions | `user_id = current_user_id()` |
| DELETE | Delete own sessions | `user_id = current_user_id()` |

**Full isolation:** Users can ONLY access their own conversation sessions.

### iam.orgs

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View member orgs | `is_org_member(org_id)` |
| UPDATE | Update org details | `is_org_admin(org_id)` |

**No user creation:** Regular users cannot create orgs. Org creation is handled by backend (service role) during user registration/deployment.

### iam.org_memberships

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View org memberships | Own membership OR member of same org |
| INSERT | Add members (admin) | `is_org_admin(org_id)` |
| UPDATE | Modify members (admin) | `is_org_admin(org_id)` |
| DELETE | Remove members (admin) | `is_org_admin(org_id)` |

**Role hierarchy:**
- **Owner**: Can manage all aspects of org
- **Admin**: Can manage members and settings
- **Member**: Can view and use org resources
- **Viewer**: Read-only access (if implemented)

### iam.org_invites

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View invites | Own email OR admin of org |
| INSERT | Create invites (admin) | `is_org_admin(org_id)` |
| UPDATE | Accept/decline invite | Own email OR admin of org |
| DELETE | Cancel invites (admin) | `is_org_admin(org_id)` |

**Invite flow:**
1. Admin creates invite with recipient email
2. Recipient sees invite when querying by their email
3. Recipient accepts → membership created
4. Admin can cancel pending invites

### app.domains

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View org domains | `is_org_member(org_id)` |
| INSERT | Create domains (admin) | `is_org_admin(org_id)` |
| UPDATE | Update domains (admin) | `is_org_admin(org_id)` |
| DELETE | Delete domains (admin) | `is_org_admin(org_id)` |

**Access pattern:** Users access domains through their org memberships. All members can view; only admins can modify.

### app.errors

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View org errors | Domain's org membership |
| INSERT | Create errors | Domain's org membership |

**Error logging:** Any org member can log errors for domains in their org. Useful for debugging and monitoring.

### app.feedback

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View own feedback | `user_id = current_user_id()` |
| INSERT | Create feedback | `user_id = current_user_id()` |

**Feedback isolation:** Users can only see feedback they've submitted.

### app.user_profile

| Operation | Policy | Rule |
|-----------|--------|------|
| ALL | Manage own profile | `user_id = current_user_id()` |

**Full control:** Users have complete control over their own profile (separate from `iam.users`).

### app.user_onboarding

| Operation | Policy | Rule |
|-----------|--------|------|
| ALL | Manage own onboarding | `user_id = current_user_id()` |

**Onboarding state:** Users control their own onboarding progress and preferences.

### app.gateway_settings

| Operation | Policy | Rule |
|-----------|--------|------|
| SELECT | View settings | Domain's org membership |
| INSERT/UPDATE/DELETE | Manage settings (admin) | Domain's org + admin role |

**Configuration access:** All members can view gateway settings; only admins can modify.

## Deployment Guide

### Step 1: Backup

```bash
# Export current database schema and data
pg_dump -h <host> -U postgres -d postgres \
  --schema=iam --schema=app \
  --file=backup_before_rls_$(date +%Y%m%d).sql
```

### Step 2: Apply RLS Migration

1. Open Supabase SQL Editor
2. Copy contents of `apps/web/docs/database/enable-rls.sql`
3. Run the migration
4. Verify success messages

### Step 3: Verify RLS Enabled

```sql
-- Should show rowsecurity = true for all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('iam', 'app')
ORDER BY schemaname, tablename;
```

### Step 4: Test Policies

1. Open Supabase SQL Editor
2. Copy contents of `apps/web/docs/database/test-rls.sql`
3. Run the test script
4. Verify all tests show `✓ PASS`

### Step 5: Monitor Application

```bash
# Check application logs for RLS errors
bun run see

# Look for errors like:
# - "permission denied for table"
# - "new row violates row-level security policy"
```

**Expected:** No errors should occur because service role bypasses RLS.

## Testing

### Automated Tests

Run the test suite:

```bash
cd apps/web/docs/database
# In Supabase SQL Editor:
# Copy and paste test-rls.sql
```

Tests verify:
- ✅ RLS is enabled on all tables
- ✅ Service role can access all data
- ✅ Policies exist for each table
- ✅ Helper functions are created
- ✅ Users can only see their own orgs
- ✅ Cross-org access is prevented

### Manual Testing (with Anon Key)

To test RLS enforcement with an authenticated user:

```typescript
import { createClient } from '@supabase/supabase-js'

// Use ANON key (not service role)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

// Sign in as test user
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'test-password'
})

// Test 1: Can see own user
const { data: ownUser } = await supabase
  .schema('iam')
  .from('users')
  .select('*')
  .single()
console.log('✓ Own user:', ownUser)

// Test 2: Cannot see other users (should be empty)
const { data: allUsers } = await supabase
  .schema('iam')
  .from('users')
  .select('*')
console.log('✓ All users (should filter):', allUsers)

// Test 3: Can see own orgs
const { data: myOrgs } = await supabase
  .schema('iam')
  .from('orgs')
  .select('*')
console.log('✓ My orgs:', myOrgs)

// Test 4: Can see domains from my orgs
const { data: myDomains } = await supabase
  .schema('app')
  .from('domains')
  .select('*')
console.log('✓ My domains:', myDomains)

// Test 5: Cannot access other org's domain (should fail)
const { data: otherDomain, error } = await supabase
  .schema('app')
  .from('domains')
  .select('*')
  .eq('org_id', 'other-org-id-here')
console.log('✓ Other org domain (should fail):', error)
```

### Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| User A views User B's profile | ❌ Denied (unless they share an org) |
| User A views their own profile | ✅ Allowed |
| User A views domains in their org | ✅ Allowed |
| User A views domains in other org | ❌ Denied (empty result) |
| Member tries to add new member | ❌ Denied (admin-only) |
| Admin adds new member | ✅ Allowed |
| User creates session for another user | ❌ Denied |
| Service role accesses any data | ✅ Allowed (bypasses RLS) |

## Performance Considerations

### Indexes

Ensure indexes exist on frequently filtered columns:

```sql
-- User lookups
CREATE INDEX IF NOT EXISTS idx_users_user_id ON iam.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON iam.users(email);

-- Session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON iam.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_domain_id ON iam.sessions(domain_id);

-- Membership lookups (critical for RLS)
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON iam.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON iam.org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_composite ON iam.org_memberships(user_id, org_id);

-- Domain lookups
CREATE INDEX IF NOT EXISTS idx_domains_org_id ON app.domains(org_id);
CREATE INDEX IF NOT EXISTS idx_domains_hostname ON app.domains(hostname);
```

### Query Performance

RLS policies add `WHERE` clauses to every query:

```sql
-- User query:
SELECT * FROM iam.orgs WHERE org_id = 'abc123';

-- Actual query (with RLS):
SELECT * FROM iam.orgs
WHERE org_id = 'abc123'
  AND iam.is_org_member(org_id);  -- Added by RLS policy
```

**Optimization tips:**
- Keep `is_org_member()` and `is_org_admin()` functions simple
- Use `SECURITY DEFINER` on helper functions (already done)
- Mark helper functions as `STABLE` (already done)
- Monitor slow query log for RLS-related performance issues

## Migration from Legacy System

If migrating from a system without RLS:

1. **Enable RLS first, test extensively**
2. **Verify service role still works** (should bypass RLS)
3. **Add policies table by table** (start with read-only)
4. **Test with anon key** before client-side exposure
5. **Monitor for policy violations** in logs

## Troubleshooting

### Issue: "permission denied for table X"

**Cause:** Trying to access table with anon key, RLS is blocking access

**Fix:**
1. Verify user is authenticated: `SELECT auth.uid()`
2. Check if policy exists: `SELECT * FROM pg_policies WHERE tablename = 'X'`
3. Verify user meets policy conditions (e.g., is org member)

### Issue: "new row violates row-level security policy"

**Cause:** INSERT/UPDATE fails policy check

**Fix:**
1. Check `WITH CHECK` clause in policy
2. Verify inserted data matches policy (e.g., `user_id = current_user_id()`)
3. Ensure user has required role (admin/owner)

### Issue: Service role queries fail

**Cause:** RLS should NOT affect service role

**Fix:**
1. Verify using `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`
2. Check Supabase client initialization
3. Service role bypasses RLS by default - this should never happen

### Issue: Slow queries after enabling RLS

**Cause:** Missing indexes on filtered columns

**Fix:**
1. Run `EXPLAIN ANALYZE` on slow query
2. Add indexes on `user_id`, `org_id` columns
3. Consider materialized views for complex joins

## Security Best Practices

### ✅ DO

- Always use service role for server-side operations (current setup)
- Test RLS policies before exposing anon key client-side
- Keep helper functions simple and efficient
- Monitor policy violations in logs
- Use role hierarchy (owner > admin > member)
- Validate org access in API routes (belt-and-suspenders)

### ❌ DON'T

- Don't expose service role key client-side (never!)
- Don't rely solely on RLS for critical security (use API validation too)
- Don't create overly complex policies (performance impact)
- Don't bypass RLS with `security_invoker = false`
- Don't remove RLS from tables (defense in depth)

## Future Enhancements

### Potential Improvements

1. **Audit Logging**: Add `UPDATE` triggers to log policy violations
2. **Rate Limiting**: Implement per-user query limits
3. **Field-Level Security**: Hide sensitive fields (e.g., `password_hash`) even from SELECT
4. **Temporal Policies**: Time-based access (e.g., expired sessions)
5. **IP-Based Policies**: Restrict access by IP range

### Client-Side Database Access (if needed)

If you ever need to expose the anon key client-side:

```typescript
// apps/web/lib/supabase/client-authenticated.ts
import { createBrowserClient } from '@supabase/ssr'

export function createAuthenticatedClient() {
  // Get user session from cookie
  const session = getSessionFromCookie()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // Safe because RLS is enabled
  )

  // Set session
  if (session) {
    supabase.auth.setSession(session)
  }

  return supabase
}
```

**Requirements:**
1. RLS must be enabled (✅ done)
2. All policies must be tested (✅ test-rls.sql)
3. User must authenticate via Supabase Auth (⚠️ currently using JWT)
4. Session must be passed to client safely

## Related Documentation

- **Database Schema**: `apps/web/lib/supabase/iam.types.ts`, `app.types.ts`
- **Authentication**: `apps/web/docs/security/authentication.md`
- **Org Management**: `apps/web/lib/deployment/org-resolver.ts`
- **Session Management**: `apps/web/docs/sessions/session-management.md`

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)

---

**Questions?** See the inline comments in `enable-rls.sql` or run `test-rls.sql` for verification.
