# Organization Duplication Bug - Complete Analysis & Fix

**Date:** 2025-01-17
**Status:** 🔴 Critical Bug - Affects all users
**Impact:** Users get 1 organization per domain instead of domains grouped under organizations

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Current System Architecture](#current-system-architecture)
4. [All Affected Flows](#all-affected-flows)
5. [Dependencies](#dependencies)
6. [The Strongest Fix](#the-strongest-fix)
7. [Implementation Plan](#implementation-plan)
8. [Testing Strategy](#testing-strategy)
9. [Migration Strategy](#migration-strategy)

---

## Problem Statement

### Symptom
Users who deploy multiple domains end up with **one organization per domain** instead of **all domains under one organization**.

**Example:**
```
User: admin@example.com
Expected: 1 organization with 8 domains
Actual:   8 organizations with 1 domain each
```

### Impact
- **UI confusion:** Organization selector shows many duplicate orgs
- **Credit fragmentation:** Credits split across multiple orgs instead of shared
- **Data pollution:** Database filled with unnecessary org records
- **User experience:** Confusing mental model (what is an organization?)

### Affected Users
**ALL users** who have deployed more than one domain:
- Production users with multiple sites
- Test users during development
- Migrated users from JSON → Supabase

---

## Root Cause Analysis

### The Bug Location
**File:** `apps/web/lib/deployment/domain-registry.ts`
**Function:** `registerDomain()`
**Lines:** 192-238 (before fix)

### The Broken Code
```typescript
// Step 3: Create organization
const orgName = `${email.split("@")[0]}'s ${hostname}`
const { data: newOrg, error: orgError } = await iam
  .from("orgs")
  .insert({
    name: orgName,
    credits: credits,
  })
  .select("org_id")
  .single()
```

**Problem:** This code **ALWAYS** creates a new organization, even if the user already has existing organizations.

### Why This Happened
The original design treated **domains as the primary entity** and created organizations as a side effect:

```
Domain → Creates Org → User becomes owner
```

The correct model should be:

```
User → Has Orgs → Orgs contain Domains
```

---

## Current System Architecture

### Database Schema (Supabase)

```
┌─────────────┐
│ iam.users   │
├─────────────┤
│ user_id     │ (PK)
│ email       │ (unique)
│ password_hash
│ status      │
│ created_at  │
└─────────────┘
       │
       │ (has many)
       ▼
┌──────────────────┐
│ iam.org_memberships │
├──────────────────┤
│ org_id      │ (FK → iam.orgs)
│ user_id     │ (FK → iam.users)
│ role        │ (owner/member/viewer)
└──────────────────┘
       │
       │ (belongs to)
       ▼
┌─────────────┐
│ iam.orgs    │
├─────────────┤
│ org_id      │ (PK)
│ name        │
│ credits     │
│ created_at  │
└─────────────┘
       │
       │ (has many)
       ▼
┌─────────────┐
│ app.domains │
├─────────────┤
│ hostname    │ (PK)
│ port        │
│ org_id      │ (FK → iam.orgs)
│ created_at  │
└─────────────┘
```

### Key Relationships
- **One user** → **Many organizations** (via org_memberships)
- **One organization** → **Many domains**
- **Credits stored per organization** (not per domain)

### Current Behavior (Broken)
```
Deploy domain #1 → Create org_1 → User owns org_1 → domain_1 in org_1
Deploy domain #2 → Create org_2 → User owns org_2 → domain_2 in org_2  ❌
Deploy domain #3 → Create org_3 → User owns org_3 → domain_3 in org_3  ❌
```

### Expected Behavior (Fixed)
```
Deploy domain #1 → Create org_1 → User owns org_1 → domain_1 in org_1
Deploy domain #2 → Reuse org_1 → domain_2 in org_1  ✅
Deploy domain #3 → Reuse org_1 → domain_3 in org_1  ✅
```

---

## All Affected Flows

### Flow 1: Authenticated UI Deploy

**Endpoint:** `POST /api/deploy`
**File:** `apps/web/app/api/deploy/route.ts`

```
User logged in
  ↓
POST /api/deploy { domain: "example.com" }
  ↓
getSessionUser() → user.email exists
  ↓
deploySite({ domain, email: user.email })
  ↓
deploy-site-systemd.sh (env: DEPLOY_EMAIL)
  ↓
add-domain-to-supabase.ts (email, no passwordHash)
  ↓
registerDomain({ email, passwordHash: undefined })
  ↓
🐛 Creates NEW org for each domain
```

**Authentication:** ✅ User authenticated
**Bug:** ❌ Creates new org per deploy

---

### Flow 2: Subdomain Deploy (alive.best)

**Endpoint:** `POST /api/deploy-subdomain`
**File:** `apps/web/app/api/deploy-subdomain/route.ts`

```
User fills form (slug, email, password, siteIdeas)
  ↓
POST /api/deploy-subdomain { slug, email, password, ... }
  ↓
deploySite({ domain: "slug.alive.best", email, password })
  ↓
deploy-site-systemd.sh (env: DEPLOY_EMAIL, DEPLOY_PASSWORD)
  ↓
add-domain-to-supabase.ts (email, passwordHash, port)
  ↓
registerDomain({ email, passwordHash })
  ↓
🐛 Creates NEW org for each subdomain
```

**Authentication:** ❌ User NOT authenticated (creates account during deploy)
**Bug:** ❌ Creates new org per deploy

---

### Flow 3: CLI Manual Deploy

**Script:** `scripts/deploy-site-systemd.sh`

```bash
DEPLOY_EMAIL=user@example.com ./deploy-site-systemd.sh domain.com
```

```
deploy-site-systemd.sh (env: DEPLOY_EMAIL)
  ↓
add-domain-to-supabase.ts (email, port)
  ↓
registerDomain({ email })
  ↓
🐛 Creates NEW org for each domain
```

**Authentication:** ❌ User NOT authenticated
**Bug:** ❌ Creates new org per deploy

---

### Flow 4: Migration Script (Orphan Sync)

**Script:** `scripts/sync-orphaned-domains.ts`

```
Load JSON files (domain-passwords.json, workspaces.json)
  ↓
For each domain NOT in Supabase
  ↓
registerDomain({ email, passwordHash, port, credits })
  ↓
🐛 Creates NEW org for each domain
```

**Authentication:** N/A (batch operation)
**Bug:** ❌ Creates new org per domain

---

## Dependencies

### Code Dependencies

1. **Domain Registry Module**
   - `lib/deployment/domain-registry.ts` - Core registration logic
   - `scripts/add-domain-to-supabase.ts` - CLI wrapper
   - `scripts/sync-orphaned-domains.ts` - Migration wrapper

2. **Deployment System**
   - `lib/deployment/deploy-site.ts` - Deployment orchestration
   - `scripts/deploy-site-systemd.sh` - Bash deployment script
   - `app/api/deploy/route.ts` - HTTP endpoint
   - `app/api/deploy-subdomain/route.ts` - Subdomain endpoint

3. **Authentication System**
   - `features/auth/lib/auth.ts` - Session management
   - JWT session cookies
   - Supabase password hashing

4. **Credit System**
   - `lib/credits/supabase-credits.ts` - Credit management
   - Credits stored in `iam.orgs.credits`
   - Domains inherit org credits via `org_id` FK

### Database Dependencies

- **Tables:** `iam.users`, `iam.orgs`, `iam.org_memberships`, `app.domains`
- **Foreign Keys:** domains.org_id → orgs.org_id
- **Indexes:** Performance depends on org_id lookups

### External Dependencies

- **Supabase Client:** `@supabase/supabase-js`
- **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## The Strongest Fix

### Design Principles

A "strongest fix" must be:

1. **✅ Reusable** - Works across all flows (CLI, UI, migrations)
2. **✅ Testable** - Unit tests, integration tests, E2E tests
3. **✅ Backward Compatible** - Doesn't break existing deployments
4. **✅ Future-Proof** - Supports multi-org use case later
5. **✅ Secure** - Maintains authentication boundaries
6. **✅ Simple** - Easy to understand and maintain
7. **✅ Idempotent** - Safe to call multiple times
8. **✅ Well-Documented** - Clear intent and behavior

### The Solution: Three-Phase Hybrid Approach

#### Phase 1: Fix the Bug (One Org Per User)
**Goal:** Stop creating duplicate organizations immediately

**Approach:** Each user gets ONE default organization, all domains go into it

**Benefits:**
- ✅ Fixes the bug for all flows
- ✅ No UI changes required
- ✅ Backward compatible
- ✅ Simple mental model (1 user = 1 org)

**Limitation:**
- ❌ Can't separate sites into different orgs (yet)

#### Phase 2: Add Org Management (Multi-Org Support)
**Goal:** Support power users who want multiple organizations

**Approach:**
- Add UI to create/rename/manage organizations
- Add optional `orgId` parameter to deployment flows
- If `orgId` provided → use it
- If not provided → use default org

**Benefits:**
- ✅ Supports both simple and advanced use cases
- ✅ Maintains backward compatibility
- ✅ Users can organize sites (personal vs client projects)

#### Phase 3: Make It Explicit (Clean Architecture)
**Goal:** Clear user intent and understanding

**Approach:**
- Deployment UI shows organization selector
- Users understand what organizations are
- Optional: Require org selection for new deployments

**Benefits:**
- ✅ Clean architecture (org-first model)
- ✅ No ambiguity
- ✅ Better UX

---

## Implementation Plan

### Phase 1: Core Fix (Immediate)

#### Step 1: Create `getOrCreateDefaultOrg()` Helper

**File:** `apps/web/lib/deployment/domain-registry.ts`

```typescript
/**
 * Get user's default organization, creating one if needed
 *
 * BEHAVIOR:
 * - Returns first org where user is owner
 * - Creates new org if user has no organizations
 * - Reuses existing org for subsequent calls (idempotent)
 *
 * NAMING:
 * - First org: "{username}'s organization"
 * - Not per-domain (e.g., NOT "user's example.com")
 *
 * @param iam - Supabase IAM client
 * @param userId - User ID from iam.users
 * @param email - User email (for org naming)
 * @param initialCredits - Credits for new org (default: 200)
 * @returns Organization ID
 * @throws Error if database operations fail
 */
async function getOrCreateDefaultOrg(
  iam: SupabaseClient<IamDatabase>,
  userId: string,
  email: string,
  initialCredits: number = 200
): Promise<string> {
  // Step 1: Check if user already has an organization
  const { data: existingMemberships } = await iam
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner")

  if (existingMemberships && existingMemberships.length > 0) {
    // User has existing organization - reuse it
    const orgId = existingMemberships[0].org_id
    console.log(`[Domain Registry] Reusing existing organization ${orgId} for user ${email}`)
    return orgId
  }

  // Step 2: User has no organization - create new one
  const orgName = `${email.split("@")[0]}'s organization`
  const { data: newOrg, error: orgError } = await iam
    .from("orgs")
    .insert({
      name: orgName,
      credits: initialCredits,
    })
    .select("org_id")
    .single()

  if (orgError || !newOrg) {
    console.error("[Domain Registry] Failed to create org:", orgError)
    throw new Error(`Failed to create organization: ${orgError?.message}`)
  }

  // Step 3: Create owner membership
  const { error: membershipError } = await iam.from("org_memberships").insert({
    org_id: newOrg.org_id,
    user_id: userId,
    role: "owner",
  })

  if (membershipError) {
    console.error("[Domain Registry] Failed to create membership:", membershipError)
    throw new Error(`Failed to create org membership: ${membershipError.message}`)
  }

  console.log(`[Domain Registry] Created new organization ${newOrg.org_id} for user ${email}`)
  return newOrg.org_id
}
```

**Why This Design:**
- ✅ **Single Responsibility:** Only handles org creation/retrieval
- ✅ **Idempotent:** Safe to call multiple times (always returns same org)
- ✅ **Testable:** Pure logic with clear inputs/outputs
- ✅ **Reusable:** Can be called from any flow
- ✅ **Error Handling:** Throws on failure (caller can catch)

---

#### Step 2: Update `registerDomain()` to Use Helper

**File:** `apps/web/lib/deployment/domain-registry.ts`

```typescript
export interface DomainRegistration {
  hostname: string
  email: string
  passwordHash?: string // Optional: if undefined, link to existing user
  port: number
  credits?: number
  orgId?: string // NEW: Optional org ID (Phase 2 - not used in Phase 1)
}

export async function registerDomain(config: DomainRegistration): Promise<boolean> {
  const { hostname, email, passwordHash, port, credits = 200, orgId } = config

  try {
    const iam = await getIamClient()
    const app = await getAppClient()

    // Step 1: Check if domain already exists
    const { data: existingDomain } = await app.from("domains").select("hostname").eq("hostname", hostname).single()

    if (existingDomain) {
      console.log(`[Domain Registry] Domain ${hostname} already exists`)
      return true
    }

    // Step 2: Get or create user
    let userId: string
    const { data: existingUser } = await iam.from("users").select("user_id").eq("email", email).single()

    if (existingUser) {
      // User exists - link domain to their account
      userId = existingUser.user_id
      console.log(`[Domain Registry] User ${email} already exists, linking domain to their account`)
    } else {
      // User doesn't exist - need to create new account
      if (!passwordHash) {
        console.error(`[Domain Registry] Cannot create new user ${email} without password`)
        return false
      }

      const { data: newUser, error: userError } = await iam
        .from("users")
        .insert({
          email: email,
          password_hash: passwordHash,
          status: "active",
          is_test_env: false,
          metadata: {},
        })
        .select("user_id")
        .single()

      if (userError || !newUser) {
        console.error(`[Domain Registry] Failed to create user ${email}:`, userError)
        return false
      }

      userId = newUser.user_id
      console.log(`[Domain Registry] Created new user account for ${email}`)
    }

    // Step 3: Get or create organization
    let finalOrgId: string

    if (orgId) {
      // PHASE 2: Explicit org ID provided - validate user has access
      const { data: membership } = await iam
        .from("org_memberships")
        .select("org_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .single()

      if (!membership) {
        console.error(`[Domain Registry] User ${email} does not have access to org ${orgId}`)
        return false
      }

      finalOrgId = orgId
      console.log(`[Domain Registry] Using specified organization ${orgId}`)
    } else {
      // PHASE 1: No org ID provided - get or create default org
      finalOrgId = await getOrCreateDefaultOrg(iam, userId, email, credits)
    }

    // Step 4: Create domain entry
    const { error: domainError } = await app.from("domains").insert({
      hostname: hostname,
      port: port,
      org_id: finalOrgId,
    })

    if (domainError) {
      console.error("[Domain Registry] Failed to create domain:", domainError)
      return false
    }

    console.log(`[Domain Registry] Successfully registered ${hostname}`)
    return true
  } catch (error) {
    console.error(`[Domain Registry] Error registering domain ${hostname}:`, error)
    return false
  }
}
```

**Changes:**
1. Added `orgId?: string` to `DomainRegistration` interface (Phase 2 support)
2. Replaced Step 3 (create org) with `getOrCreateDefaultOrg()` call
3. Added conditional logic for explicit `orgId` (Phase 2)
4. Updated variable from `newOrg.org_id` → `finalOrgId`

**Backward Compatibility:**
- ✅ All existing calls work (orgId is optional)
- ✅ Behavior changes from "create new org" → "reuse existing org"
- ✅ Database schema unchanged
- ✅ API contracts unchanged

---

### Phase 2: Multi-Org Support (Future)

#### UI Changes

1. **Organization Management Page**
   - List all user's organizations
   - Create new organization
   - Rename organization
   - View domains per org
   - View credits per org

2. **Deploy Page Updates**
   - Organization selector dropdown
   - "Create new organization" option
   - Default: User's first organization (backward compatible)

#### API Changes

1. **New Endpoint:** `POST /api/organizations/create`
   ```typescript
   { name: "My Client Sites" } → { orgId: "org_xxx" }
   ```

2. **Update Deploy Endpoints:**
   ```typescript
   POST /api/deploy
   {
     domain: "example.com",
     orgId: "org_xxx"  // NEW: Optional
   }
   ```

3. **New Endpoint:** `PUT /api/domains/{hostname}/move`
   ```typescript
   { targetOrgId: "org_yyy" } → Moves domain between orgs
   ```

---

### Phase 3: Explicit Org Selection (Polish)

1. Make org selector **required** in deploy UI
2. Add tooltips explaining organizations
3. Show domain count per org in selector
4. Add "Recently used" org to top of list

---

## Testing Strategy

### Unit Tests

**File:** `apps/web/lib/deployment/__tests__/domain-registry.test.ts`

```typescript
describe("getOrCreateDefaultOrg", () => {
  it("creates new org for user with no orgs", async () => {
    const orgId = await getOrCreateDefaultOrg(iam, userId, email, 200)
    expect(orgId).toBeTruthy()

    // Verify org exists
    const org = await iam.from("orgs").select().eq("org_id", orgId).single()
    expect(org.data?.name).toBe("testuser's organization")
    expect(org.data?.credits).toBe(200)

    // Verify membership exists
    const membership = await iam.from("org_memberships").select().eq("org_id", orgId).single()
    expect(membership.data?.role).toBe("owner")
  })

  it("reuses existing org for user with org", async () => {
    // Create org
    const orgId1 = await getOrCreateDefaultOrg(iam, userId, email, 200)

    // Call again - should return same org
    const orgId2 = await getOrCreateDefaultOrg(iam, userId, email, 200)

    expect(orgId1).toBe(orgId2)

    // Verify only ONE org exists for user
    const orgs = await iam.from("org_memberships").select().eq("user_id", userId)
    expect(orgs.data?.length).toBe(1)
  })

  it("returns first org if user has multiple orgs", async () => {
    // Manually create 2 orgs for user
    const org1 = await createOrg("Org 1")
    const org2 = await createOrg("Org 2")
    await createMembership(org1.id, userId)
    await createMembership(org2.id, userId)

    // Should return first org
    const orgId = await getOrCreateDefaultOrg(iam, userId, email, 200)
    expect(orgId).toBe(org1.id)
  })

  it("throws error if org creation fails", async () => {
    // Mock Supabase to return error
    mockSupabaseError()

    await expect(
      getOrCreateDefaultOrg(iam, userId, email, 200)
    ).rejects.toThrow("Failed to create organization")
  })
})

describe("registerDomain", () => {
  it("creates user + org + domain for new user (first deploy)", async () => {
    const result = await registerDomain({
      hostname: "example.com",
      email: "new@example.com",
      passwordHash: "hash123",
      port: 3333,
      credits: 200,
    })

    expect(result).toBe(true)

    // Verify user created
    const user = await iam.from("users").select().eq("email", "new@example.com").single()
    expect(user.data).toBeTruthy()

    // Verify org created
    const orgs = await iam.from("org_memberships").select("org_id").eq("user_id", user.data.user_id)
    expect(orgs.data?.length).toBe(1)

    // Verify domain created
    const domain = await app.from("domains").select().eq("hostname", "example.com").single()
    expect(domain.data?.org_id).toBe(orgs.data[0].org_id)
  })

  it("reuses user + org for existing user (second deploy)", async () => {
    // First deploy
    await registerDomain({
      hostname: "site1.com",
      email: "existing@example.com",
      passwordHash: "hash123",
      port: 3333,
    })

    // Get org count after first deploy
    const user = await iam.from("users").select("user_id").eq("email", "existing@example.com").single()
    const orgsBefore = await iam.from("org_memberships").select().eq("user_id", user.data.user_id)

    // Second deploy - SAME EMAIL
    await registerDomain({
      hostname: "site2.com",
      email: "existing@example.com",  // Same user
      port: 3334,
    })

    // Verify org count unchanged (reused)
    const orgsAfter = await iam.from("org_memberships").select().eq("user_id", user.data.user_id)
    expect(orgsAfter.data?.length).toBe(orgsBefore.data?.length)  // Should be 1

    // Verify both domains in same org
    const domains = await app.from("domains").select().in("hostname", ["site1.com", "site2.com"])
    expect(domains.data?.length).toBe(2)
    expect(domains.data[0].org_id).toBe(domains.data[1].org_id)
  })

  it("creates 3 domains in same org for same user", async () => {
    const email = "multisite@example.com"

    await registerDomain({ hostname: "a.com", email, passwordHash: "h1", port: 3333 })
    await registerDomain({ hostname: "b.com", email, port: 3334 })  // No password = reuse account
    await registerDomain({ hostname: "c.com", email, port: 3335 })

    // Verify user has only 1 org
    const user = await iam.from("users").select("user_id").eq("email", email).single()
    const orgs = await iam.from("org_memberships").select().eq("user_id", user.data.user_id)
    expect(orgs.data?.length).toBe(1)

    // Verify all 3 domains in same org
    const domains = await app.from("domains").select().in("hostname", ["a.com", "b.com", "c.com"])
    expect(domains.data?.length).toBe(3)
    expect(new Set(domains.data.map(d => d.org_id)).size).toBe(1)  // All same org
  })

  it("uses explicit orgId when provided (Phase 2)", async () => {
    // Create user with 2 orgs
    const user = await createUser("user@example.com")
    const org1 = await createOrg("Org 1")
    const org2 = await createOrg("Org 2")
    await createMembership(org1.id, user.id)
    await createMembership(org2.id, user.id)

    // Deploy with explicit orgId
    await registerDomain({
      hostname: "example.com",
      email: "user@example.com",
      port: 3333,
      orgId: org2.id,  // Explicitly choose org2
    })

    // Verify domain in org2 (not org1)
    const domain = await app.from("domains").select().eq("hostname", "example.com").single()
    expect(domain.data?.org_id).toBe(org2.id)
  })

  it("rejects invalid orgId", async () => {
    const result = await registerDomain({
      hostname: "example.com",
      email: "user@example.com",
      passwordHash: "hash",
      port: 3333,
      orgId: "org_nonexistent",
    })

    expect(result).toBe(false)
  })
})
```

### Integration Tests

**File:** `apps/web/features/deployment/__tests__/deployment-flow.integration.test.ts`

```typescript
describe("Deployment Flow Integration", () => {
  it("deploys 3 sites via CLI - all in same org", async () => {
    const email = "cli@example.com"

    // Deploy 3 sites via CLI
    await execAsync(`DEPLOY_EMAIL=${email} ./deploy-site-systemd.sh site1.com`)
    await execAsync(`DEPLOY_EMAIL=${email} ./deploy-site-systemd.sh site2.com`)
    await execAsync(`DEPLOY_EMAIL=${email} ./deploy-site-systemd.sh site3.com`)

    // Verify only 1 org created
    const user = await getUser(email)
    const orgs = await getUserOrgs(user.id)
    expect(orgs.length).toBe(1)

    // Verify all 3 domains in same org
    const domains = await getOrgDomains(orgs[0].id)
    expect(domains.length).toBe(3)
  })

  it("deploys via UI (authenticated) then CLI (same email) - same org", async () => {
    const email = "mixed@example.com"

    // UI deploy (authenticated)
    const session = await login(email, "password123")
    await fetch("/api/deploy", {
      method: "POST",
      headers: { Cookie: session },
      body: JSON.stringify({ domain: "ui-site.com" }),
    })

    // CLI deploy (same email)
    await execAsync(`DEPLOY_EMAIL=${email} ./deploy-site-systemd.sh cli-site.com`)

    // Verify only 1 org
    const user = await getUser(email)
    const orgs = await getUserOrgs(user.id)
    expect(orgs.length).toBe(1)
  })
})
```

### E2E Tests

**File:** `apps/web/e2e-tests/organization-management.spec.ts`

```typescript
test("deploying multiple sites creates only one organization", async ({ page }) => {
  // Sign up
  await page.goto("/deploy")
  await page.fill("[name=email]", "e2e@example.com")
  await page.fill("[name=password]", "password123")
  await page.fill("[name=domain]", "site1.com")
  await page.click("button[type=submit]")
  await page.waitForURL("/chat?workspace=site1.com")

  // Deploy second site
  await page.goto("/deploy")
  await page.fill("[name=domain]", "site2.com")
  await page.click("button[type=submit]")

  // Deploy third site
  await page.goto("/deploy")
  await page.fill("[name=domain]", "site3.com")
  await page.click("button[type=submit]")

  // Check organization page
  await page.goto("/organizations")

  // Should see only 1 organization
  const orgCards = page.locator("[data-testid=org-card]")
  await expect(orgCards).toHaveCount(1)

  // Should show 3 sites in that org
  const siteCount = page.locator("[data-testid=org-site-count]")
  await expect(siteCount).toHaveText("3 sites")
})
```

---

## Migration Strategy

### For Existing Users with Multiple Orgs

**Question:** What do we do with users who already have multiple organizations?

#### Option A: Leave As-Is (Recommended for Phase 1)
- Existing users keep their multiple orgs
- Fix only affects **new** deployments going forward
- Users can manually consolidate later via UI (Phase 2)

**Pros:**
- ✅ No data migration needed
- ✅ No risk of breaking existing setups
- ✅ Fastest to ship

**Cons:**
- ❌ Existing users still see duplicate orgs

#### Option B: Consolidate All Domains into First Org
- Find users with multiple orgs
- Move all domains to first org
- Merge credits from all orgs
- Delete empty orgs

**Pros:**
- ✅ Clean state for all users
- ✅ Immediate UX improvement

**Cons:**
- ❌ Complex migration logic
- ❌ Risk of data loss
- ❌ Need rollback plan

#### Option C: Mark First Org as "Default"
- Add `is_default` flag to `iam.orgs`
- Mark first org as default for each user
- Future deployments use default org

**Pros:**
- ✅ Minimal schema change
- ✅ Supports both legacy and new behavior

**Cons:**
- ❌ Requires schema migration
- ❌ Users still see duplicate orgs

### Recommended Approach: Option A + Phase 2

1. **Phase 1:** Ship the fix (Option A)
   - Existing users: Keep current orgs
   - New deployments: Use first org

2. **Phase 2:** Add consolidation UI
   - "Merge Organizations" feature
   - User can manually consolidate if desired
   - Move domains between orgs
   - Merge credits

---

## Rollout Plan

### Week 1: Implementation
- [ ] Implement `getOrCreateDefaultOrg()`
- [ ] Update `registerDomain()`
- [ ] Write unit tests
- [ ] Write integration tests

### Week 2: Testing
- [ ] Manual testing on staging
- [ ] Deploy 10 test sites as same user
- [ ] Verify only 1 org created
- [ ] Test all 4 flows (UI, CLI, subdomain, migration)

### Week 3: Deployment
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Test with real user account
- [ ] Announce fix in release notes

### Week 4+: Phase 2 Planning
- [ ] Design organization management UI
- [ ] Plan API endpoints
- [ ] User research: Do people need multi-org?

---

## Success Metrics

### Immediate (Post-Fix)
- ✅ New users deploying 3+ sites → Only 1 organization created
- ✅ No increase in `iam.orgs` row count (except 1 per new user)
- ✅ All 4 deployment flows work without errors

### Long-Term (Phase 2)
- ✅ Users can create multiple organizations
- ✅ Users can move domains between orgs
- ✅ Average orgs per user: 1-2 (not 1 per domain)

---

## Open Questions

1. **Should we prevent users from having 0 orgs?**
   - Currently: Creating user doesn't auto-create org
   - Proposal: Create default org when user signs up

2. **Should we allow users to delete their last org?**
   - If org has domains → Block deletion
   - If org is empty → Allow deletion?

3. **What happens to credits when merging orgs?**
   - Add credits together?
   - Keep credits in source org (don't merge)?

4. **Should org names be unique per user?**
   - Currently: No uniqueness constraint
   - Proposal: Unique within user's orgs

---

## Related Files

### Core Implementation
- `apps/web/lib/deployment/domain-registry.ts` - Main fix
- `apps/web/scripts/add-domain-to-supabase.ts` - CLI wrapper
- `apps/web/lib/deployment/deploy-site.ts` - Deployment orchestration

### API Endpoints
- `apps/web/app/api/deploy/route.ts` - Authenticated deploy
- `apps/web/app/api/deploy-subdomain/route.ts` - Subdomain deploy

### Scripts
- `scripts/deploy-site-systemd.sh` - Bash deployment
- `apps/web/scripts/sync-orphaned-domains.ts` - Migration script

### Tests (To Be Created)
- `apps/web/lib/deployment/__tests__/domain-registry.test.ts`
- `apps/web/features/deployment/__tests__/deployment-flow.integration.test.ts`
- `apps/web/e2e-tests/organization-management.spec.ts`

---

## Conclusion

This fix addresses the **root cause** of organization duplication while maintaining **backward compatibility** and setting the foundation for **future multi-org support**.

The three-phase approach ensures:
1. ✅ **Immediate** bug fix (Phase 1)
2. ✅ **Future** flexibility (Phase 2)
3. ✅ **Long-term** clean architecture (Phase 3)

**Next Steps:**
1. Review this document
2. Get approval for Phase 1 implementation
3. Begin coding `getOrCreateDefaultOrg()`
4. Write comprehensive tests
5. Deploy and monitor

---

**Status:** 📝 Ready for Implementation
**Estimated Effort:** 2-3 days (Phase 1 only)
**Risk Level:** 🟡 Medium (touches core deployment logic)
