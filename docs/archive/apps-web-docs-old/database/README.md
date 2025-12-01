# Database Permissions Setup

## Issue: Service Role Cannot Access Custom Schemas

**Error:** `permission denied for schema iam` (Error code 42501)

**Cause:** By default, Supabase's `service_role` only has access to the `public` schema. Our application uses custom schemas (`iam` and `app`), which require explicit grants.

**Impact:**
- Integration tests fail (credit-system-supabase.test.ts)
- Server-side credit operations fail
- Admin operations cannot access user/org data

## Fix

Run the SQL script in Supabase SQL Editor:

```bash
# Location
apps/web/docs/database/grant-service-role-permissions.sql
```

### Steps:

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `grant-service-role-permissions.sql`
3. Execute the script
4. Verify output shows grants for `iam` and `app` schemas

### What It Does:

- Grants `USAGE` on `iam` and `app` schemas
- Grants `ALL` privileges on existing tables, sequences, functions
- Sets default privileges for future objects
- Verifies grants were applied successfully

## Verification

After running the script, test with:

```bash
bun run test lib/__tests__/credit-system-supabase.test.ts
```

All 25 tests should pass (not skip).

## Security Note

The `service_role` key should **NEVER** be exposed to the client. It's only used server-side in:
- API routes (`app/api/**/route.ts`)
- Server components
- Test utilities (`createTestIamClient`, `createTestAppClient`)

The anon key (used in browser) is still protected by RLS policies.
