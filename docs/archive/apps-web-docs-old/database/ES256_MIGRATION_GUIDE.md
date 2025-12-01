# ES256 JWT Migration Guide

**Date:** 2025-11-17
**Status:** Ready to implement

## Overview

This guide explains how to migrate from Supabase's legacy HS256 (shared secret) JWT system to the new ES256 (asymmetric) signing keys system for RLS integration.

## Why Migrate?

**Current problem:**
- Your `JWT_SECRET` is different from Supabase's legacy JWT secret
- Custom auth users' JWTs can't be verified by RLS
- Using outdated HS256 shared secret system

**Benefits of ES256:**
- ✅ Better security (public-key cryptography)
- ✅ Zero-downtime key rotation
- ✅ No secret extraction from Supabase
- ✅ Aligns with Supabase's best practices
- ✅ Works with RLS policies immediately

## Prerequisites

- [x] RLS policies enabled and working
- [x] Helper functions fixed (`is_org_member`, `is_org_admin`)
- [x] `public.sub()` updated to support testing
- [x] JWT code updated with ES256 support
- [x] ES256 private key generated

## Migration Steps

### Step 1: Store Your ES256 Private Key Securely

**⚠️ CRITICAL: Never commit private keys to git!**

1. **Add to `.env` file (already gitignored):**

   ```bash
   # Add to /root/webalive/claude-bridge/apps/web/.env
   JWT_ALGORITHM=ES256
   JWT_ES256_PRIVATE_KEY='{"kty":"EC","kid":"f1e49401-0fd7-447e-a163-140ef40645e3","use":"sig","key_ops":["sign","verify"],"alg":"ES256","ext":true,"d":"xwrnE82_dlfYEqD3-flIfbYnVej99_rZ0nrS0Des6-E","crv":"P-256","x":"6u3NKj3F6COU3tEPBygm6kXg5srd35yG5Dxvh7w5JjY","y":"T9kOWeYbosPV-25tCg-ANS4Z_JSXnh9wk19C_-kg4tw"}'
   ```

2. **Verify `.gitignore` protects it:**
   ```bash
   git status | grep es256  # Should return nothing
   ```

### Step 2: Import Private Key to Supabase

1. **Open Supabase Dashboard:**
   - Go to: https://qnvprftdorualkdyogka.supabase.co
   - Navigate to: Settings → API → JWT Settings → JWT Signing Keys

2. **Delete Old Standby Key (Optional):**
   - You have a standby key `90b73466-51ab-49e5-88cc-d1c3023d8ea5`
   - Move it to "Revoked" and delete it
   - (We can't use it because we don't have the private key)

3. **Import Your New Private Key:**
   - Click "Create a new key" → "Import a key"
   - Paste the JSON from `JWT_ES256_PRIVATE_KEY` env var (the same JSON value)
   - This creates a new standby key with ID `f1e49401-0fd7-447e-a163-140ef40645e3`

4. **Verify Import:**
   - Your new key should appear as "Standby key"
   - Algorithm: ES256 (ECC P-256)

### Step 3: Test ES256 JWT Locally

Before rotating keys in production, test locally:

1. **ES256 mode is already enabled** (you added `JWT_ALGORITHM=ES256` in Step 1)

2. **Restart the server:**
   ```bash
   cd /root/webalive/claude-bridge
   make staging     # Deploy to staging for testing
   # Or make dev   # For local testing
   ```

3. **Check logs:**
   ```bash
   make logs-staging
   # Should show: [JWT] ES256 signing enabled with key ID: f1e49401-0fd7-447e-a163-140ef40645e3
   ```

4. **Test login:**
   - Try logging in as a custom auth user
   - Check that JWT is created successfully

### Step 4: Rotate to ES256 in Supabase

**⚠️ IMPORTANT:** Do this during low-traffic period (but no downtime required)

1. **Click "Rotate keys" in Supabase Dashboard**
   - Your imported ES256 key becomes "Current key"
   - Legacy HS256 becomes "Previously used"

2. **Wait 20-25 minutes**
   - Allows all caches to clear
   - New JWTs will be signed with ES256
   - Old HS256 JWTs still work (verified via "Previously used" key)

3. **Verify RLS works:**
   ```bash
   # Login as custom auth user
   # Check that domains are visible
   # Verify cross-org isolation
   ```

### Step 5: Test RLS Integration

Run the RLS integration tests:

```bash
cd /root/webalive/claude-bridge/apps/web
bun run test features/auth/lib/__tests__/rls-integration.test.ts
```

**Expected:** 10/10 tests pass

**What it verifies:**
- Custom auth users can see their org's data
- Cross-org access is blocked
- Unauthenticated users see nothing
- Invalid/tampered JWTs rejected

### Step 6: Revoke Legacy HS256 Key

**⚠️ Wait at least 1 hour after rotation** to ensure all tokens have been refreshed.

1. **Check active sessions:**
   - Verify no users are actively using old tokens
   - Consider session expiry time (30 days for your app)

2. **Revoke the legacy key:**
   - In Supabase Dashboard, move "Previously used" HS256 key to "Revoked"
   - This invalidates all HS256-signed tokens

3. **Monitor for errors:**
   - Check logs for authentication failures
   - If issues arise, you can move key back to "Previously used"

## Rollback Plan

If something goes wrong:

### Immediate Rollback (Within 20 minutes of rotation)

1. **In Supabase Dashboard:**
   - Move ES256 key to "Previously used"
   - Move HS256 key back to "Standby"
   - Click "Rotate keys" to make HS256 current again

2. **Disable ES256 locally:**
   ```bash
   # Remove JWT_ALGORITHM=ES256 from .env
   make staging  # Deploy to staging to test
   ```

### After Revocation (If already revoked HS256)

1. **Re-enable HS256:**
   - Move revoked HS256 key to "Standby"
   - Rotate to it
   - All users will need to re-login

2. **Investigate:**
   - Check logs for specific errors
   - Verify JWT payload format
   - Test with sample user

## Verification Checklist

After migration:

- [ ] ES256 enabled in `.env` (JWT_ALGORITHM=ES256)
- [ ] Server logs show ES256 key ID
- [ ] Custom auth users can login
- [ ] Custom auth users see their org data
- [ ] Cross-org access blocked
- [ ] RLS integration tests pass (10/10)
- [ ] Clerk users still work (if applicable)
- [ ] No authentication errors in logs

## Current State

**Files updated:**
- `features/auth/lib/jwt.ts` - ES256 support added
- `es256-private-key.json` - Generated private key

**Not yet updated:**
- JWT tests - Need to make async
- Auth lib - Need to await JWT functions
- API routes - Need to await JWT functions

**Supabase state:**
- Current key: Legacy HS256 `689f928d-54b6-4095-a824-b2aa7a767d7d`
- Standby key: ES256 `90b73466-51ab-49e5-88cc-d1c3023d8ea5` (Supabase-generated, no private key)
- Action needed: Import your ES256 key, delete old standby, rotate

## FAQ

**Q: Will existing users be logged out?**
A: No. During rotation, both keys are trusted. Users stay logged in.

**Q: What about Clerk users?**
A: Clerk users authenticate via Clerk, which has its own JWT system. This migration only affects custom auth users.

**Q: Can I test without affecting production?**
A: Yes. The JWT code supports both HS256 and ES256. You can test ES256 locally before rotating in Supabase.

**Q: What if RLS tests fail after migration?**
A: Check:
- JWT payload has `sub` claim
- `public.sub()` returns the user_id
- `is_org_member()` uses `user_id` not `clerk_id`
- User is actually a member of the org

**Q: How long until I can revoke the legacy key?**
A: Wait at least 1 hour after rotation. For safety, wait 30 days (your token expiry time) to ensure all tokens have been refreshed.

**Q: Do I need to update anon/service_role keys?**
A: No. Those are separate API keys managed by Supabase. They continue to work.

## Next Steps

1. Import ES256 private key to Supabase (Step 1)
2. Update all code to `await` JWT functions (see code changes needed below)
3. Enable ES256 locally and test (Step 2)
4. Rotate keys in Supabase (Step 3)
5. Run RLS integration tests (Step 4)
6. Wait 1 hour, then revoke legacy key (Step 5)

## Code Changes Needed

All files that call `createSessionToken` and `verifySessionToken` must be updated to `await` them:

**Files to update:**
1. `features/auth/lib/__tests__/jwt.test.ts` - Make tests async
2. `features/auth/lib/__tests__/rls-integration.test.ts` - Make tests async
3. `features/auth/lib/auth.ts` - Await JWT calls
4. `app/api/login/route.ts` - Await createSessionToken
5. `app/api/auth/preview-guard/route.ts` - Await verifySessionToken

Would you like me to update these files now?
