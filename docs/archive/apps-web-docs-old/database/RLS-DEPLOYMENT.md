# Row Level Security (RLS) Deployment Guide

**Date:** 2025-11-17
**Status:** Ready for deployment
**Impact:** Low (service role bypasses RLS, no code changes required)

## Quick Start

### 1. Review Files

- ✅ **Migration**: `enable-rls.sql` - Enables RLS and creates policies
- ✅ **Tests**: `test-rls.sql` - Verifies RLS works correctly
- ✅ **Documentation**: `../security/row-level-security.md` - Complete reference

### 2. Pre-Deployment Checklist

- [ ] Backup database (see command below)
- [ ] Review `enable-rls.sql` to understand changes
- [ ] Confirm service role key is used in `SUPABASE_SERVICE_ROLE_KEY` env var
- [ ] Verify no client-side database access (currently all server-side)

### 3. Deploy

```bash
# 1. Backup database
pg_dump -h <host> -U postgres -d postgres \
  --schema=iam --schema=app \
  --file=backup_before_rls_$(date +%Y%m%d).sql

# 2. Open Supabase SQL Editor
# Go to: https://supabase.com/dashboard/project/<your-project>/sql

# 3. Copy and paste enable-rls.sql
# 4. Click "Run"
# 5. Verify "Query Success" message
```

### 4. Verify Deployment

```sql
-- Run in SQL Editor - should show all tables with rowsecurity=true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('iam', 'app')
ORDER BY schemaname, tablename;
```

### 5. Run Tests

```bash
# In Supabase SQL Editor:
# Copy and paste test-rls.sql
# Run and verify all tests show ✓ PASS
```

### 6. Monitor Application

```bash
# Check application logs
bun run see

# No errors expected (service role bypasses RLS)
```

## What Changes?

### Database Changes

✅ **RLS Enabled** on all tables in `iam` and `app` schemas:
- `iam.users`, `iam.sessions`, `iam.orgs`, `iam.org_memberships`, `iam.org_invites`
- `app.domains`, `app.errors`, `app.feedback`, `app.user_profile`, `app.user_onboarding`, `app.gateway_settings`

✅ **Helper Functions Created**:
- `iam.current_user_id()` - Get authenticated user
- `iam.is_org_member(org_id)` - Check org membership
- `iam.is_org_admin(org_id)` - Check admin role

✅ **Policies Created**: 30+ RLS policies enforcing multi-tenancy

### Application Changes

**NONE REQUIRED** ✨

All database operations use the service role, which bypasses RLS. Your application continues working exactly as before.

## Security Model

```
┌─────────────────────────────────────────────────────────┐
│                     Application Layer                   │
│  (Next.js API Routes + Service Role = Bypass RLS)      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Row Level Security                      │
│         (Protects against client-side exposure)         │
├─────────────────────────────────────────────────────────┤
│  Users → Sessions (own sessions only)                   │
│  Users → Orgs → Memberships (org-based access)         │
│  Orgs → Domains → Errors/Settings (org-based access)   │
└─────────────────────────────────────────────────────────┘
```

## Why Enable RLS Now?

Even though we use service role (bypasses RLS), enabling RLS provides:

1. **Defense in Depth**: Protection if anon key is accidentally exposed
2. **Future-Proofing**: Ready for client-side database access if needed
3. **Best Practice**: Industry standard for multi-tenant SaaS
4. **Zero Risk**: Service role continues working unchanged

## Rollback Plan

If any issues occur:

```sql
-- Disable RLS on all tables
ALTER TABLE iam.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE iam.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE iam.orgs DISABLE ROW LEVEL SECURITY;
ALTER TABLE iam.org_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE iam.org_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.domains DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.errors DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_onboarding DISABLE ROW LEVEL SECURITY;
ALTER TABLE app.gateway_settings DISABLE ROW LEVEL SECURITY;

-- Drop helper functions
DROP FUNCTION IF EXISTS iam.current_user_id();
DROP FUNCTION IF EXISTS iam.is_org_member(uuid);
DROP FUNCTION IF EXISTS iam.is_org_admin(uuid);

-- Restore from backup
psql -h <host> -U postgres -d postgres < backup_before_rls_YYYYMMDD.sql
```

## FAQ

### Q: Will this break my application?

**A:** No. Service role bypasses RLS, so all existing queries work unchanged.

### Q: Do I need to change any code?

**A:** No. No application code changes required.

### Q: When do RLS policies take effect?

**A:** Only when using the anon key (currently not used). Service role bypasses RLS.

### Q: Can I test RLS without affecting production?

**A:** Yes. Use `test-rls.sql` which creates temporary test data and runs verification queries.

### Q: What if a policy is too restrictive?

**A:** Service role isn't affected. If you ever use anon key, adjust policies in `enable-rls.sql` and re-run.

### Q: How do I verify service role is being used?

**A:** Check `SUPABASE_SERVICE_ROLE_KEY` in environment variables. All `createIamClient('service')` and `createAppClient('service')` calls use it.

### Q: Will there be a performance impact?

**A:** No measurable impact when using service role (bypasses RLS). Minimal impact if using anon key with proper indexes.

## Support

For questions or issues:

1. Check `docs/security/row-level-security.md` for detailed reference
2. Run `test-rls.sql` to verify policies
3. Review Supabase logs in dashboard
4. Check application logs with `bun run see`

---

**Ready to deploy?** Follow the steps above and you'll have RLS enabled in under 5 minutes with zero downtime.
