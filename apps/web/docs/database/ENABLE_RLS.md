# Enable RLS with Custom JWT Tokens

**Status:** Ready to implement
**Time:** 15 minutes

## Overview

Your RLS policies in `enable-rls.sql` use `iam.current_user_id()` which calls Supabase Auth (`auth.uid()`). But Claude Bridge uses custom JWT tokens, so `auth.uid()` returns NULL and RLS never works.

**Solution:** Update `iam.current_user_id()` to use your existing `public.sub()` function.

---

## Step 1: Configure Supabase JWT Secret (5 min)

Your custom JWTs are signed with `JWT_SECRET` from `.env`. Supabase needs to use the **same secret** to verify them.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → **Settings** → **API** → **JWT Settings**
2. Copy your `JWT_SECRET` from `.env`
3. **Replace** the JWT Secret in Supabase with your `JWT_SECRET`
4. Save

⚠️ **Important:** After changing the secret, update your anon/service keys in `.env`:
```bash
SUPABASE_ANON_KEY=<new_key_from_dashboard>
SUPABASE_SERVICE_ROLE_KEY=<new_key_from_dashboard>
```

---

## Step 2: Run SQL Script (2 min)

In **Supabase SQL Editor**, run:

```sql
-- apps/web/docs/database/update-rls-for-custom-jwt.sql
```

This updates `iam.current_user_id()` to call `public.sub()::uuid` instead of `auth.uid()`.

**Verification:** After running, you should see:
```
✓ Returns NULL (not authenticated)
```

---

## Step 3: Deploy Code (2 min)

Code changes already made:
- ✅ `features/auth/lib/jwt.ts` - Added `sub` claim to JWT
- ✅ `app/api/test-rls/route.ts` - Test endpoint

```bash
git add .
git commit -m "Enable RLS with custom JWT tokens"
bun run deploy  # or bun run staging
```

---

## Step 4: Test (5 min)

Visit: `https://your-domain.com/api/test-rls`

**Expected (authenticated):**
```json
{
  "authenticated": true,
  "rls": { "domainsVisible": 2 },
  "serviceRole": { "totalDomains": 10 },
  "rlsWorking": true
}
```

**Expected (not authenticated):**
```json
{
  "authenticated": false,
  "rls": { "domainsVisible": 0 },
  "rlsWorking": true
}
```

---

## How to Use RLS in Code

**Before (manual auth):**
```typescript
const user = await getSessionUser()
if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

const app = await createAppClient("service")
const { data } = await app.from("domains").select("*").in("org_id", userOrgIds)
```

**After (RLS automatic):**
```typescript
const rls = await createRLSClient()
const { data } = await rls.from("domains").select("*")
// Automatically filtered to user's org domains
```

---

## Troubleshooting

**RLS returns empty arrays even when authenticated:**
- Verify Supabase JWT secret matches your `JWT_SECRET`
- Check JWT has `sub` claim: `console.log(verifySessionToken(token))`
- Re-run SQL script

**Service role can't access data:**
- Run `docs/database/grant-service-role-permissions.sql`

**Users need to re-login:**
- Expected after changing JWT secret
- Old tokens can't be verified with new secret

---

## Files Modified

- `features/auth/lib/jwt.ts` - Added `sub` claim
- `app/api/test-rls/route.ts` - Test endpoint
- Database: `iam.current_user_id()` function

## Related Files

- `docs/database/enable-rls.sql` - RLS policy definitions (no changes needed)
- `docs/database/update-rls-for-custom-jwt.sql` - SQL script to run
- `docs/database/test-rls.sql` - Additional test queries
- `lib/supabase/server-rls.ts` - RLS client (already correct)
