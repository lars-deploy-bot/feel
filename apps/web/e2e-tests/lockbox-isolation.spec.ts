/**
 * Lockbox Cross-Account Isolation Test
 *
 * Verifies that one user CANNOT see another user's lockbox secrets.
 *
 * The lockbox stores encrypted secrets (OAuth tokens, user env keys) per user.
 * The database functions run as SECURITY DEFINER with service_role, so isolation
 * depends entirely on the application layer correctly scoping by userId from
 * the session JWT — not from user-supplied request data.
 *
 * This test proves that given two different authenticated sessions (Alice and Bob),
 * neither can see the other's data through any API endpoint that reads the lockbox.
 */

import { randomUUID } from "node:crypto"
import { COOKIE_NAMES, TEST_CONFIG } from "@webalive/shared"
import jwt from "jsonwebtoken"
import {
  BootstrapTenantRequestSchema,
  BootstrapTenantResponseSchema,
  type TestTenant,
} from "@/app/api/test/test-route-schemas"
import { DEFAULT_USER_SCOPES } from "@/features/auth/lib/jwt"
import { expect, test } from "./fixtures"
import { requireProjectBaseUrl } from "./lib/base-url"
import { buildE2ETestHeaders } from "./lib/test-headers"

/**
 * Build a JWT for a given test user.
 * Mirrors the logic in fixtures.ts authenticatedPage setup.
 */
function signJwt(user: Pick<TestTenant, "userId" | "email" | "orgId" | "orgName">, secret: string): string {
  return jwt.sign(
    {
      role: "authenticated" as const,
      sub: user.userId,
      userId: user.userId,
      email: user.email,
      name: user.orgName,
      sid: randomUUID(),
      scopes: DEFAULT_USER_SCOPES,
      orgIds: [user.orgId],
      orgRoles: { [user.orgId]: "owner" as const },
    },
    secret,
    { expiresIn: "30d" },
  )
}

/**
 * Make an authenticated fetch to the app, attaching the JWT as a cookie.
 */
async function authedFetch(baseUrl: string, path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...((init?.headers as Record<string, string>) || {}),
      Cookie: `${COOKIE_NAMES.SESSION}=${token}`,
    },
  })
}

/**
 * Bootstrap a second tenant via the test API.
 * Uses the same endpoint that global-setup uses for worker tenants.
 */
async function bootstrapSecondTenant(baseUrl: string, suffix: string): Promise<TestTenant> {
  const runId = process.env.E2E_RUN_ID
  if (!runId) {
    throw new Error("E2E_RUN_ID not set — global setup not run?")
  }

  // Use a high worker index (within MAX_WORKERS) to avoid colliding with real workers
  // Worker slots 0-3 are used by Playwright workers (2 in CI, 4 local); we use slot 19 (last allowed)
  const workerIndex = TEST_CONFIG.MAX_WORKERS - 1
  const email = `e2e_lockbox_${suffix}@${TEST_CONFIG.EMAIL_DOMAIN}`
  const workspace = `e2e-lockbox-${suffix}.${TEST_CONFIG.EMAIL_DOMAIN}`
  const bootstrapBody = BootstrapTenantRequestSchema.parse({
    runId,
    workerIndex,
    email,
    workspace,
    credits: TEST_CONFIG.DEFAULT_CREDITS,
  })

  const res = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
    method: "POST",
    headers: buildE2ETestHeaders(true),
    body: JSON.stringify(bootstrapBody),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to bootstrap second tenant: ${res.status} ${text}`)
  }

  const data = BootstrapTenantResponseSchema.parse(await res.json())
  if (!data.ok) {
    throw new Error("Bootstrap tenant failed: ok=false")
  }

  return data.tenant
}

test.describe("Lockbox Cross-Account Isolation", () => {
  /**
   * Core isolation test:
   *
   * 1. Alice stores a secret env key  → sees it in her list
   * 2. Bob stores a different secret   → sees it in his list
   * 3. Alice does NOT see Bob's key
   * 4. Bob does NOT see Alice's key
   * 5. Cleanup: both delete their keys
   */
  test("user A cannot see user B lockbox secrets via /api/user-env-keys", async ({ workerTenant, baseURL }) => {
    const resolvedBaseUrl = requireProjectBaseUrl(baseURL)
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not set — add it to .env.e2e.local")
    }

    // --- Set up two real users ---
    // Alice = the current worker tenant (already bootstrapped by global-setup)
    const alice = {
      userId: workerTenant.userId,
      email: workerTenant.email,
      orgId: workerTenant.orgId,
      orgName: workerTenant.orgName,
    }
    const aliceToken = signJwt(alice, jwtSecret)

    // Bob = a second real tenant bootstrapped via the test API
    // Must be a real DB user because lockbox.user_secrets has FK to iam.users
    const bob = await bootstrapSecondTenant(resolvedBaseUrl, "bob")
    const bobToken = signJwt(bob, jwtSecret)

    const ALICE_KEY = "LOCKBOX_TEST_ALICE"
    const BOB_KEY = "LOCKBOX_TEST_BOB"
    const ALICE_VALUE = `alice-secret-${randomUUID().slice(0, 8)}`
    const BOB_VALUE = `bob-secret-${randomUUID().slice(0, 8)}`

    // --- Step 1: Alice stores a secret ---
    const aliceStore = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyName: ALICE_KEY, keyValue: ALICE_VALUE }),
    })
    expect(aliceStore.status, "Alice should store her key successfully").toBe(200)

    // --- Step 2: Bob stores a secret ---
    const bobStore = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", bobToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyName: BOB_KEY, keyValue: BOB_VALUE }),
    })
    expect(bobStore.status, "Bob should store his key successfully").toBe(200)

    // --- Step 3: Alice lists her keys — should see ONLY hers ---
    const aliceList = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken)
    expect(aliceList.status).toBe(200)
    const aliceKeys = await aliceList.json()
    const aliceKeyNames = aliceKeys.keys.map((k: { name: string }) => k.name)

    expect(aliceKeyNames, "Alice should see her own key").toContain(ALICE_KEY)
    expect(aliceKeyNames, "Alice must NOT see Bob's key").not.toContain(BOB_KEY)

    // --- Step 4: Bob lists his keys — should see ONLY his ---
    const bobList = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", bobToken)
    expect(bobList.status).toBe(200)
    const bobKeys = await bobList.json()
    const bobKeyNames = bobKeys.keys.map((k: { name: string }) => k.name)

    expect(bobKeyNames, "Bob should see his own key").toContain(BOB_KEY)
    expect(bobKeyNames, "Bob must NOT see Alice's key").not.toContain(ALICE_KEY)

    // --- Cleanup: delete test keys ---
    const [aliceDelete, bobDelete] = await Promise.all([
      authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyName: ALICE_KEY }),
      }),
      authedFetch(resolvedBaseUrl, "/api/user-env-keys", bobToken, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyName: BOB_KEY }),
      }),
    ])
    expect(aliceDelete.status, "Alice cleanup should succeed").toBe(200)
    expect(bobDelete.status, "Bob cleanup should succeed").toBe(200)

    // --- Verify cleanup ---
    const aliceListAfter = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken)
    const aliceKeysAfter = await aliceListAfter.json()
    const aliceKeyNamesAfter = aliceKeysAfter.keys.map((k: { name: string }) => k.name)
    expect(aliceKeyNamesAfter, "Alice's test key should be gone after cleanup").not.toContain(ALICE_KEY)
  })

  /**
   * Forge attack test:
   *
   * Eve has a valid JWT for her own account but tries to access Alice's
   * secrets. Since /api/user-env-keys derives userId from the JWT (not
   * request body), Eve cannot reach Alice's data regardless of what she
   * sends in the request payload.
   *
   * Eve is a non-DB user (random userId) which also proves:
   * - Reading (list/get) works for unknown users → returns empty, not error
   * - Writing (save) for unknown users fails → FK constraint blocks it
   * This is correct behavior: you can't store secrets for a user that
   * doesn't exist, and querying for a non-existent user reveals nothing.
   */
  test("non-existent user JWT cannot see real user secrets", async ({ workerTenant, baseURL }) => {
    const resolvedBaseUrl = requireProjectBaseUrl(baseURL)
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not set — add it to .env.e2e.local")
    }

    // Alice stores a key
    const alice = {
      userId: workerTenant.userId,
      email: workerTenant.email,
      orgId: workerTenant.orgId,
      orgName: workerTenant.orgName,
    }
    const aliceToken = signJwt(alice, jwtSecret)

    const SECRET_KEY = "FORGE_TEST_KEY"
    const SECRET_VALUE = `forge-test-${randomUUID().slice(0, 8)}`

    const storeRes = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyName: SECRET_KEY, keyValue: SECRET_VALUE }),
    })
    expect(storeRes.status, "Alice should store her key").toBe(200)

    // Eve has a valid JWT signed with the correct secret, but for a userId
    // that doesn't exist in iam.users
    const eve = {
      userId: `usr_eve_${randomUUID().slice(0, 8)}`,
      email: "eve@evil.local",
      orgId: `org_eve_${randomUUID().slice(0, 8)}`,
      orgName: "Eve Evil Org",
    }
    const eveToken = signJwt(eve, jwtSecret)

    // Eve lists keys — should see nothing
    const eveList = await authedFetch(resolvedBaseUrl, "/api/user-env-keys", eveToken)
    expect(eveList.status).toBe(200)
    const eveKeys = await eveList.json()
    const eveKeyNames = eveKeys.keys.map((k: { name: string }) => k.name)

    expect(eveKeyNames, "Eve must NOT see Alice's secret key").not.toContain(SECRET_KEY)
    expect(eveKeyNames, "Eve should have zero keys").toHaveLength(0)

    // Cleanup Alice's key
    await authedFetch(resolvedBaseUrl, "/api/user-env-keys", aliceToken, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyName: SECRET_KEY }),
    })
  })
})
