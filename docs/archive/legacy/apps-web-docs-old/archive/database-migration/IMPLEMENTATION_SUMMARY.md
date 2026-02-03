# Organization Duplication Fix - Implementation Summary

**Date:** 2025-01-17
**Status:** ✅ Implemented - Ready for Testing

---

## What Was Fixed

**Problem:** Every domain deployment created a new organization, resulting in users having 8+ organizations instead of all domains grouped under one organization.

**Solution:** Require users to explicitly select an organization before deploying. No automatic organization creation during deployment.

---

## Implementation Changes

### 1. New Organization Resolver Module

**File:** `apps/web/lib/deployment/org-resolver.ts`

**Key Functions:**

- `getUserOrganizations(userId)` - Get all orgs for a user
- `getUserDefaultOrgId(userId, email, credits)` - Get or create default org (CLI use only)
- `validateUserOrgAccess(userId, orgId)` - Validate user has access to org
- `getOrganizationById(orgId)` - Get org details

**Purpose:** Centralized, reusable organization resolution logic.

---

### 2. Updated Domain Registry

**File:** `apps/web/lib/deployment/domain-registry.ts`

**Changes:**

```typescript
// BEFORE
export interface DomainRegistration {
  hostname: string
  email: string
  passwordHash?: string
  port: number
  credits?: number
}

// AFTER
export interface DomainRegistration {
  hostname: string
  email: string
  passwordHash?: string
  port: number
  orgId: string // REQUIRED
  credits?: number // Deprecated
}
```

**Behavior:**

- `registerDomain()` now **requires** `orgId` parameter
- **Removed** automatic org creation logic
- **Added** org existence validation
- Users/callers must resolve orgId **before** calling this function

---

### 3. Updated Flow 1: UI Deploy (`/api/deploy`)

**File:** `apps/web/app/api/deploy/route.ts`

**Changes:**

1. **Authentication Required:**

   ```typescript
   // BEFORE: Optional authentication
   const user = await getSessionUser() // Could be null

   // AFTER: Required authentication
   const user = await requireSessionUser() // Throws if not logged in
   ```

2. **Explicit Org Selection:**

   ```typescript
   // Request body now requires orgId
   interface DeployRequest {
     domain: string
     orgId: string // REQUIRED
   }
   ```

3. **Org Validation:**
   ```typescript
   // Validate user has access to specified org
   const hasAccess = await validateUserOrgAccess(user.id, body.orgId)
   if (!hasAccess) {
     return 403 // Forbidden
   }
   ```

**Breaking Change:** Frontend must now:

- Require user login before showing deploy UI
- Fetch user's organizations
- Show organization selector
- Pass `orgId` in request body

---

### 4. Updated Flow 2: Subdomain Deploy (`/api/deploy-subdomain`)

**File:** `apps/web/app/api/deploy-subdomain/route.ts`

**Changes:**

1. **Authentication Required:**

   ```typescript
   const user = await requireSessionUser()
   ```

2. **Updated Schema:**

   ```typescript
   // BEFORE
   export const DeploySubdomainSchema = z.object({
     slug: z.string(),
     email: z.string().email(), // Removed
     password: z.string().min(6), // Removed
     siteIdeas: z.string().optional(),
     selectedTemplate: z.enum(["landing", "recipe"]).optional(),
   })

   // AFTER
   export const DeploySubdomainSchema = z.object({
     slug: z.string(),
     orgId: z.string(), // Added - REQUIRED
     siteIdeas: z.string().optional(),
     selectedTemplate: z.enum(["landing", "recipe"]).optional(),
   })
   ```

3. **Email from Session:**
   ```typescript
   // Use authenticated user's email (not from request body)
   email: user.email
   ```

**Breaking Change:** Frontend must now:

- Require user to sign up/login FIRST
- Show organization selector
- Pass `orgId` in request (not email/password)

---

### 5. Updated CLI Script

**File:** `apps/web/scripts/add-domain-to-supabase.ts`

**Changes:**

1. **User Creation Moved to Script:**

   ```typescript
   // Script now handles user creation if needed
   if (!existingUser && passwordHash) {
     // Create user first
     const newUser = await iam.from("users").insert({ email, password_hash })
     userId = newUser.user_id
   }
   ```

2. **Org Resolution:**

   ```typescript
   // Get or create default org for user
   const orgId = await getUserDefaultOrgId(userId, email, 200)
   ```

3. **Pass orgId to registerDomain:**
   ```typescript
   await registerDomain({
     hostname,
     email,
     passwordHash,
     port,
     orgId, // REQUIRED
   })
   ```

**Behavior:** CLI deployments still work automatically by using `getUserDefaultOrgId()` helper.

---

### 6. Updated Deploy Script

**File:** `scripts/deploy-site-systemd.sh`

**Changes:**

- Removed `credits` parameter from `add-domain-to-supabase.ts` call (deprecated)

**Before:**

```bash
bun scripts/add-domain-to-supabase.ts "$DOMAIN" "$EMAIL" "$PASSWORD_HASH" "$PORT" 200
```

**After:**

```bash
bun scripts/add-domain-to-supabase.ts "$DOMAIN" "$EMAIL" "$PASSWORD_HASH" "$PORT"
```

---

## Architecture Changes

### Before (Broken)

```
User deploys domain #1
  → registerDomain() creates org_1
  → Domain #1 in org_1

User deploys domain #2
  → registerDomain() creates org_2 ❌
  → Domain #2 in org_2
```

**Result:** 1 org per domain

---

### After (Fixed)

#### For UI Deployments (Flow 1 & Flow 2):

```
User logs in
  → Frontend fetches user's orgs
  → User selects org_1 (or creates new org)
  → POST /api/deploy { domain, orgId: org_1 }
  → Validates user has access to org_1
  → deploySite({ email, orgId: org_1 })
  → registerDomain({ ..., orgId: org_1 })
  → Domain registered in org_1 ✅
```

#### For CLI Deployments:

```
DEPLOY_EMAIL=user@example.com ./deploy-site.sh domain.com
  → add-domain-to-supabase.ts
  → getUserDefaultOrgId(userId, email)
    → Returns existing org (if user has one)
    → Creates new org (if user has none)
  → registerDomain({ ..., orgId })
  → Domain registered in user's default org ✅
```

**Result:** All domains for same user go into same org

---

## Breaking Changes for Frontend

### Flow 1: `/api/deploy`

**Before:**

```typescript
// Anonymous or authenticated
POST /api/deploy
{
  domain: "example.com",
  password: "optional"
}
```

**After:**

```typescript
// MUST be authenticated (session cookie required)
POST /api/deploy
{
  domain: "example.com",
  orgId: "org_abc123" // REQUIRED
}

// Returns 401 if not authenticated
// Returns 400 if orgId missing
// Returns 403 if user doesn't have access to orgId
```

---

### Flow 2: `/api/deploy-subdomain`

**Before:**

```typescript
// Anonymous - creates account during deploy
POST /api/deploy-subdomain
{
  slug: "mysite",
  email: "user@example.com",
  password: "password123",
  siteIdeas: "...",
  selectedTemplate: "landing"
}
```

**After:**

```typescript
// MUST be authenticated (session cookie required)
POST /api/deploy-subdomain
{
  slug: "mysite",
  orgId: "org_abc123", // REQUIRED
  siteIdeas: "...",
  selectedTemplate: "landing"
}

// Email comes from authenticated session (not request body)
// Returns 401 if not authenticated
// Returns 400 if orgId missing
// Returns 403 if user doesn't have access to orgId
```

---

## Frontend Requirements

### 1. Pre-Deploy Authentication

Both deploy flows now require:

```typescript
// Check if user is authenticated
const user = await fetch('/api/user').then(r => r.json())

if (!user) {
  // Redirect to login/signup page
  router.push('/login')
  return
}
```

---

### 2. Organization Selection UI

Fetch user's organizations:

```typescript
// New endpoint needed: GET /api/auth/organizations
const orgs = await fetch("/api/auth/organizations").then(r => r.json())

// Show org selector
<select onChange={(e) => setSelectedOrgId(e.target.value)}>
  {orgs.map(org => (
    <option key={org.orgId} value={org.orgId}>
      {org.orgName} ({org.credits} credits)
    </option>
  ))}
</select>
```

**Note:** The `/api/auth/organizations` endpoint already exists!

---

### 3. Updated Deploy Calls

```typescript
// Flow 1: Custom domain deploy
await fetch("/api/deploy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    domain: "example.com",
    orgId: selectedOrgId, // From selector
  }),
})

// Flow 2: Subdomain deploy
await fetch("/api/deploy-subdomain", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    slug: "mysite",
    orgId: selectedOrgId, // From selector
    siteIdeas: "...",
    selectedTemplate: "landing",
  }),
})
```

---

## Backward Compatibility

### CLI Deployments

✅ **Still work!** The `add-domain-to-supabase.ts` script uses `getUserDefaultOrgId()` to automatically resolve the organization.

```bash
# Works as before
DEPLOY_EMAIL=user@example.com ./deploy-site-systemd.sh example.com
```

---

### Existing Domains

✅ **No migration needed!** Existing domains keep their current organizations. Only **new** deployments are affected by this change.

---

### Existing Users with Multiple Orgs

✅ **No automatic consolidation.** Users who already have multiple orgs will keep them. They can manually consolidate later when UI is added (Phase 2).

---

## Testing Checklist

### Unit Tests (Needed)

- [ ] `getUserDefaultOrgId()` - Creates org for new user
- [ ] `getUserDefaultOrgId()` - Reuses org for existing user
- [ ] `validateUserOrgAccess()` - Returns true for valid access
- [ ] `validateUserOrgAccess()` - Returns false for invalid access
- [ ] `registerDomain()` - Requires orgId parameter
- [ ] `registerDomain()` - Validates org exists

### Integration Tests (Needed)

- [ ] Deploy 3 domains via CLI (same email) → All in same org
- [ ] Deploy via API (authenticated) → Uses specified org
- [ ] Deploy via API (no orgId) → Returns 400
- [ ] Deploy via API (invalid orgId) → Returns 403

### E2E Tests (Needed)

- [ ] User logs in → Selects org → Deploys domain → Success
- [ ] User tries to deploy without login → Redirect to login
- [ ] User tries to deploy without selecting org → Error message

### Manual Testing

- [ ] Deploy site via CLI as new user → Creates user + org
- [ ] Deploy 2nd site via CLI (same email) → Reuses org
- [ ] Deploy site via API with valid orgId → Success
- [ ] Deploy site via API without auth → 401 error
- [ ] Deploy site via API without orgId → 400 error
- [ ] Deploy site via API with invalid orgId → 403 error

---

## Migration Notes

### For Existing Users

- Users with multiple organizations: Keep as-is
- Future: Add UI to consolidate/manage orgs (Phase 2)

### For New Users

- First deployment: Creates one default organization
- Subsequent deployments: Go into existing organization

---

## Files Changed

### New Files

- ✅ `apps/web/lib/deployment/org-resolver.ts` - Organization resolution helpers
- ✅ `docs/currently-working-on-this/organization-duplication-bug.md` - Full analysis
- ✅ `docs/currently-working-on-this/IMPLEMENTATION_SUMMARY.md` - This file

### Modified Files

- ✅ `apps/web/lib/deployment/domain-registry.ts` - Updated `registerDomain()` to require orgId
- ✅ `apps/web/app/api/deploy/route.ts` - Require auth + orgId
- ✅ `apps/web/app/api/deploy-subdomain/route.ts` - Require auth + orgId
- ✅ `apps/web/features/deployment/types/guards.ts` - Updated schema (removed email/password, added orgId)
- ✅ `apps/web/scripts/add-domain-to-supabase.ts` - Use `getUserDefaultOrgId()`
- ✅ `apps/web/lib/deployment/deploy-site.ts` - Updated interface
- ✅ `scripts/deploy-site-systemd.sh` - Removed credits parameter

---

## Next Steps

1. **Frontend Updates Required:**
   - Add organization selector to deploy UI
   - Require login before deploy
   - Update API calls to pass `orgId`

2. **Backend Testing:**
   - Write unit tests for org-resolver
   - Write integration tests for deploy flows
   - Test CLI deployments

3. **Phase 2 (Future):**
   - Add UI to create/manage organizations
   - Add "Move domain to different org" feature
   - Add organization consolidation tool

---

## Success Criteria

✅ **Fixed:** Users deploying multiple domains no longer create multiple organizations
✅ **Secure:** All deployments require authentication
✅ **Explicit:** Users must choose which org to deploy to (no silent defaults in UI)
✅ **Reusable:** Organization logic centralized in `org-resolver.ts`
✅ **Backward Compatible:** CLI deployments still work
✅ **Testable:** Clear interfaces for unit/integration testing

---

**Status:** Implementation complete, awaiting frontend updates and testing.
