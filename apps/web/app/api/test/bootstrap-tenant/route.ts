/**
 * Bootstrap Tenant for E2E Test Worker
 *
 * Creates isolated user/org/domain for each Playwright worker.
 * Only accessible in test environments.
 */

import { randomUUID } from "node:crypto"
import * as Sentry from "@sentry/nextjs"
import { AppConstants, type ExecutionMode } from "@webalive/database"
import { env } from "@webalive/env/server"
import { TEST_CONFIG } from "@webalive/shared"
import { hash } from "bcrypt"
import { ensureWorkspaceFilesystem } from "@/app/api/test/bootstrap-tenant/workspace-filesystem"
import {
  BootstrapTenantRequestSchema,
  BootstrapTenantResponseSchema,
  type TestTenant,
} from "@/app/api/test/test-route-schemas"
import { invalidateUserAuthzCache, invalidateWorkspaceAuthzCache } from "@/features/auth/lib/auth"
import { invalidateSessionDomainCache } from "@/features/auth/lib/sessionStore"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"
import { invalidateDomainOrgCache } from "@/lib/tokens"

function requireExecutionMode(mode: ExecutionMode): ExecutionMode {
  const matchedMode = AppConstants.app.Enums.execution_mode.find(value => value === mode)
  if (!matchedMode) {
    throw new Error(`Missing execution mode constant: ${mode}`)
  }
  return matchedMode
}

const DEFAULT_TEST_DOMAIN_EXECUTION_MODE = requireExecutionMode("systemd")

/**
 * Guard: refuse to upsert a domain if it already exists as a production (non-test) domain.
 * Returns true if safe to proceed, false if the domain is a production domain that must not be touched.
 */
async function isDomainSafeForTestUpsert(
  app: Awaited<ReturnType<typeof createAppClient>>,
  hostname: string,
): Promise<boolean> {
  const { data, error } = await app.from("domains").select("hostname, is_test_env").eq("hostname", hostname).single()
  // Fail closed: if the lookup itself fails (not "no rows"), refuse the upsert
  if (error && error.code !== "PGRST116") {
    console.error("[isDomainSafeForTestUpsert] Lookup failed, failing closed:", { hostname, error })
    return false
  }
  // No existing domain → safe
  if (!data) return true
  // Existing test domain → safe to overwrite
  if (data.is_test_env) return true
  // Production domain → NOT safe
  return false
}

async function buildTenantResponse(
  app: Awaited<ReturnType<typeof createAppClient>>,
  tenant: Omit<TestTenant, "siteId">,
): Promise<Response> {
  invalidateUserAuthzCache(tenant.userId)
  invalidateWorkspaceAuthzCache(tenant.workspace)
  invalidateSessionDomainCache(tenant.workspace)
  invalidateDomainOrgCache(tenant.workspace)

  try {
    await ensureWorkspaceFilesystem(tenant.workspace)
  } catch (error) {
    console.error("[Bootstrap] Failed to provision workspace filesystem:", {
      workspace: tenant.workspace,
      error: error instanceof Error ? error.message : String(error),
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const { data: domain, error: domainError } = await app
    .from("domains")
    .select("domain_id")
    .eq("hostname", tenant.workspace)
    .single()

  if (domainError || !domain?.domain_id) {
    console.error("[Bootstrap] Failed to resolve site id for tenant:", {
      workspace: tenant.workspace,
      error: domainError,
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const payload = BootstrapTenantResponseSchema.parse({
    ok: true,
    tenant: {
      ...tenant,
      siteId: domain.domain_id,
    },
  })

  return Response.json(payload)
}

export async function POST(req: Request) {
  // Environment guard - accessible in test/local environments OR with valid test secret
  const isTestEnv = env.NODE_ENV === "test" || env.ALIVE_ENV === "local"

  // Check for test secret header (for staging/production E2E tests)
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = env.E2E_TEST_SECRET
  const hasValidSecret = expectedSecret && testSecret === expectedSecret

  if (!isTestEnv && !hasValidSecret) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const parsedBody = BootstrapTenantRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsedBody.success) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  const { runId, workerIndex, email, workspace, credits = TEST_CONFIG.DEFAULT_CREDITS } = parsedBody.data

  // Validate workerIndex against centralized config (single source of truth)
  if (workerIndex < 0 || workerIndex >= TEST_CONFIG.MAX_WORKERS) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  const port = TEST_CONFIG.WORKER_PORT_BASE + workerIndex

  const iam = await createIamClient("service")
  const app = await createAppClient("service")

  // Generate password hash (used for both new and existing users)
  const passwordHash = await hash(TEST_CONFIG.TEST_PASSWORD, 10)

  // Check if tenant already exists by email (idempotent across test runs)
  const { data: existingUser, error: existingUserError } = await iam
    .from("users")
    .select("user_id, email, is_test_env")
    .eq("email", email)
    .single()

  // PGRST116 = "The result contains 0 rows" - expected for new users
  if (existingUserError && existingUserError.code !== "PGRST116") {
    console.error("[Bootstrap] User lookup failed:", existingUserError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  if (existingUser) {
    const existingUserEmail = existingUser.email ?? ""
    const isManagedE2eUser =
      existingUserEmail.startsWith(TEST_CONFIG.WORKER_EMAIL_PREFIX) &&
      existingUserEmail.endsWith(`@${TEST_CONFIG.EMAIL_DOMAIN}`)

    // SAFETY: Real users must NEVER have their password_hash, is_test_env, or test_run_id mutated.
    // Only managed E2E users (e2e_w*@alive.local) may be fully managed by the bootstrap route.
    // This guard prevents accidental corruption of production user accounts.
    if (!isManagedE2eUser) {
      const isolatedOrgId = randomUUID()
      const isolatedOrgName = `E2E Isolated Worker ${workerIndex}`

      const { error: isolatedOrgError } = await iam.from("orgs").insert({
        org_id: isolatedOrgId,
        name: isolatedOrgName,
        credits,
        is_test_env: true,
        test_run_id: runId,
      })
      if (isolatedOrgError) {
        console.error("[Bootstrap] Failed to create isolated org for existing non-test user:", {
          error: isolatedOrgError,
          userId: existingUser.user_id,
          email,
          runId,
        })
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      const { error: isolatedMembershipError } = await iam.from("org_memberships").insert({
        user_id: existingUser.user_id,
        org_id: isolatedOrgId,
        role: "owner",
      })
      if (isolatedMembershipError) {
        console.error("[Bootstrap] Failed to create isolated membership for existing non-test user:", {
          error: isolatedMembershipError,
          userId: existingUser.user_id,
          orgId: isolatedOrgId,
          runId,
        })
        await iam.from("orgs").delete().eq("org_id", isolatedOrgId)
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      // Guard: never overwrite a production domain
      if (!(await isDomainSafeForTestUpsert(app, workspace))) {
        console.error("[Bootstrap] Refusing to overwrite production domain:", {
          hostname: workspace,
          userId: existingUser.user_id,
          orgId: isolatedOrgId,
          runId,
        })
        await Promise.allSettled([
          iam.from("org_memberships").delete().eq("user_id", existingUser.user_id).eq("org_id", isolatedOrgId),
          iam.from("orgs").delete().eq("org_id", isolatedOrgId),
        ])
        return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 409 })
      }

      const { error: isolatedDomainError } = await app.from("domains").upsert(
        {
          hostname: workspace,
          org_id: isolatedOrgId,
          port,
          is_test_env: true,
          test_run_id: runId,
        },
        { onConflict: "hostname" },
      )
      if (isolatedDomainError) {
        console.error("[Bootstrap] Failed to upsert isolated domain for existing non-test user:", {
          error: isolatedDomainError,
          userId: existingUser.user_id,
          orgId: isolatedOrgId,
          workspace,
          runId,
        })
        const cleanupResults = await Promise.allSettled([
          iam.from("org_memberships").delete().eq("user_id", existingUser.user_id).eq("org_id", isolatedOrgId),
          iam.from("orgs").delete().eq("org_id", isolatedOrgId),
        ])
        cleanupResults.forEach((result, index) => {
          if (result.status === "rejected") {
            const operation = index === 0 ? "membership" : "org"
            console.error(`[Bootstrap] Failed to cleanup isolated ${operation} after domain upsert failure:`, {
              error: result.reason,
              userId: existingUser.user_id,
              orgId: isolatedOrgId,
              runId,
            })
          }
        })
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      return buildTenantResponse(app, {
        userId: existingUser.user_id,
        email,
        orgId: isolatedOrgId,
        orgName: isolatedOrgName,
        workspace,
        workerIndex,
      })
    }

    // HARD GUARD: If we reach here, the user MUST be a managed E2E user.
    // This is defense-in-depth — the !isManagedE2eUser block above returns early,
    // but if the logic ever changes, this prevents corrupting real user accounts.
    if (!isManagedE2eUser) {
      console.error("[Bootstrap] BUG: non-managed user fell through to managed-user path:", {
        email,
        userId: existingUser.user_id,
        runId,
      })
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    // Get org and return existing tenant
    const { data: membership, error: membershipError } = await iam
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", existingUser.user_id)
      .single()

    // Handle orphaned user (user exists but membership was deleted by teardown)
    // PGRST116 = "The result contains 0 rows" - means no membership exists
    if (membershipError && membershipError.code === "PGRST116") {
      console.log("[Bootstrap] Orphaned user detected, recreating org and membership:", {
        userId: existingUser.user_id,
        email,
        runId,
      })

      // Create new org for orphaned user
      const newOrgId = randomUUID()
      const { error: newOrgError } = await iam.from("orgs").insert({
        org_id: newOrgId,
        name: `E2E Worker ${workerIndex}`,
        credits,
        is_test_env: true,
        test_run_id: runId,
      })

      if (newOrgError) {
        console.error("[Bootstrap] Failed to create org for orphaned user:", newOrgError)
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      // Create membership for orphaned user
      const { error: newMembershipError } = await iam.from("org_memberships").insert({
        user_id: existingUser.user_id,
        org_id: newOrgId,
        role: "owner",
      })

      if (newMembershipError) {
        console.error("[Bootstrap] Failed to create membership for orphaned user:", newMembershipError)
        // Cleanup the org we just created
        await iam.from("orgs").delete().eq("org_id", newOrgId)
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      // Guard: never overwrite a production domain
      if (!(await isDomainSafeForTestUpsert(app, workspace))) {
        console.error("[Bootstrap] Refusing to overwrite production domain for orphaned user:", {
          hostname: workspace,
          runId,
        })
        await Promise.allSettled([
          iam.from("org_memberships").delete().eq("user_id", existingUser.user_id).eq("org_id", newOrgId),
          iam.from("orgs").delete().eq("org_id", newOrgId),
        ])
        return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 409 })
      }

      // Update user's test_run_id and create domain
      const [userUpdate, domainUpsert] = await Promise.all([
        iam
          .from("users")
          .update({
            test_run_id: runId,
            password_hash: passwordHash,
            is_test_env: true,
          })
          .eq("user_id", existingUser.user_id),
        app.from("domains").upsert(
          {
            hostname: workspace,
            org_id: newOrgId,
            port,
            execution_mode: DEFAULT_TEST_DOMAIN_EXECUTION_MODE,
            is_test_env: true,
            test_run_id: runId,
          },
          { onConflict: "hostname" },
        ),
      ])

      if (userUpdate.error || domainUpsert.error) {
        console.error("[Bootstrap] Failed to update orphaned user tenant:", {
          userUpdate: userUpdate.error,
          domainUpsert: domainUpsert.error,
        })
        Sentry.captureException(
          new Error(
            `Bootstrap: Failed to update orphaned user tenant: ${JSON.stringify({ userUpdate: userUpdate.error, domainUpsert: domainUpsert.error })}`,
          ),
        )
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }

      return buildTenantResponse(app, {
        userId: existingUser.user_id,
        email,
        orgId: newOrgId,
        orgName: `E2E Worker ${workerIndex}`,
        workspace,
        workerIndex,
      })
    }

    // Non-PGRST116 membership error (unexpected error)
    if (membershipError) {
      console.error("[Bootstrap] Membership lookup failed:", {
        error: membershipError,
        userId: existingUser.user_id,
        email,
        runId,
      })

      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    if (!membership) {
      console.error("[Bootstrap] No membership found for existing user:", {
        userId: existingUser.user_id,
        email,
        runId,
      })
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    const { data: org, error: orgError } = await iam
      .from("orgs")
      .select("name")
      .eq("org_id", membership.org_id)
      .single()

    if (orgError) {
      console.error("[Bootstrap] Org lookup failed:", {
        error: orgError,
        orgId: membership.org_id,
        userId: existingUser.user_id,
        runId,
      })

      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    // Guard: never overwrite a production domain
    if (!(await isDomainSafeForTestUpsert(app, workspace))) {
      console.error("[Bootstrap] Refusing to overwrite production domain for managed user:", {
        hostname: workspace,
        runId,
      })
      return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 409 })
    }

    // Update test_run_id and password hash to ensure consistency across test runs
    // Use upsert for domain to handle case where domain was deleted but user still exists
    try {
      const [userUpdate, orgUpdate, domainUpsert] = await Promise.all([
        iam
          .from("users")
          .update({
            test_run_id: runId,
            password_hash: passwordHash,
            is_test_env: true,
          })
          .eq("user_id", existingUser.user_id),
        iam
          .from("orgs")
          .update({
            test_run_id: runId,
            is_test_env: true,
            credits,
          })
          .eq("org_id", membership.org_id),
        app.from("domains").upsert(
          {
            hostname: workspace,
            org_id: membership.org_id,
            port,
            execution_mode: DEFAULT_TEST_DOMAIN_EXECUTION_MODE,
            is_test_env: true,
            test_run_id: runId,
          },
          {
            onConflict: "hostname",
          },
        ),
      ])

      // Check for Supabase operation errors
      if (userUpdate.error || orgUpdate.error || domainUpsert.error) {
        console.error("[Bootstrap] Failed to update existing tenant:", {
          userUpdate: userUpdate.error,
          orgUpdate: orgUpdate.error,
          domainUpsert: domainUpsert.error,
          context: {
            runId,
            userId: existingUser.user_id,
            orgId: membership.org_id,
            workspace,
          },
        })

        // Note: Rollback is not performed here as these are updates to existing records
        // and we don't have the previous values stored. In a production system, consider
        // implementing a transaction log or using database transactions.
        return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
      }
    } catch (error) {
      console.error("[Bootstrap] Unexpected error during existing tenant update:", {
        error: error instanceof Error ? error.message : String(error),
        context: {
          runId,
          userId: existingUser.user_id,
          orgId: membership.org_id,
          workspace,
        },
      })
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return buildTenantResponse(app, {
      userId: existingUser.user_id,
      email,
      orgId: membership.org_id,
      orgName: org?.name || `Worker ${workerIndex}`,
      workspace,
      workerIndex,
    })
  }

  // Create new tenant
  const userId = randomUUID()
  const orgId = randomUUID()

  // 1. Create user
  const { error: userError } = await iam.from("users").insert({
    user_id: userId,
    email,
    password_hash: passwordHash,
    status: "active",
    is_test_env: true,
    test_run_id: runId,
    metadata: { workerIndex },
    email_verified: true, // Test users are always verified
  })

  if (userError) {
    console.error("[Bootstrap] User creation failed:", userError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  // 2. Create org
  const { error: orgError } = await iam.from("orgs").insert({
    org_id: orgId,
    name: `E2E Worker ${workerIndex}`,
    credits,
    is_test_env: true,
    test_run_id: runId,
  })

  if (orgError) {
    console.error("[Bootstrap] Org creation failed:", orgError)
    // Cleanup user if org creation fails
    const { error: userCleanupError } = await iam.from("users").delete().eq("user_id", userId)
    if (userCleanupError) {
      console.error("[Bootstrap] Failed to cleanup user after org creation failure:", {
        error: userCleanupError,
        userId,
        runId,
      })
    }
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  // 3. Create membership
  const { error: membershipError } = await iam.from("org_memberships").insert({
    user_id: userId,
    org_id: orgId,
    role: "owner",
  })

  if (membershipError) {
    console.error("[Bootstrap] Membership creation failed:", membershipError)
    // Cleanup user and org if membership creation fails
    const cleanupResults = await Promise.allSettled([
      iam.from("users").delete().eq("user_id", userId),
      iam.from("orgs").delete().eq("org_id", orgId),
    ])

    // Log cleanup failures
    cleanupResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.error) {
        const operation = index === 0 ? "user" : "org"
        console.error(`[Bootstrap] Failed to cleanup ${operation} after membership creation failure:`, {
          error: result.value.error,
          userId,
          orgId,
          runId,
        })
      } else if (result.status === "rejected") {
        console.error("[Bootstrap] Cleanup operation threw exception:", {
          error: result.reason,
          userId,
          orgId,
          runId,
        })
      }
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  // 4. Create/update domain entry (virtual - no actual deployment, idempotent)
  // Guard: never overwrite a production domain
  if (!(await isDomainSafeForTestUpsert(app, workspace))) {
    console.error("[Bootstrap] Refusing to overwrite production domain for new user:", { hostname: workspace, runId })
    await Promise.allSettled([
      iam.from("org_memberships").delete().eq("user_id", userId),
      iam.from("users").delete().eq("user_id", userId),
      iam.from("orgs").delete().eq("org_id", orgId),
    ])
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 409 })
  }

  const { error: domainError } = await app.from("domains").upsert(
    {
      hostname: workspace,
      org_id: orgId,
      port, // Virtual port (validated above)
      execution_mode: DEFAULT_TEST_DOMAIN_EXECUTION_MODE,
      is_test_env: true,
      test_run_id: runId,
    },
    {
      onConflict: "hostname",
    },
  )

  if (domainError) {
    console.error("[Bootstrap] Domain creation failed:", domainError)
    // Cleanup user, org, and membership if domain creation fails
    const cleanupResults = await Promise.allSettled([
      iam.from("org_memberships").delete().eq("user_id", userId),
      iam.from("users").delete().eq("user_id", userId),
      iam.from("orgs").delete().eq("org_id", orgId),
    ])

    // Log cleanup failures
    cleanupResults.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.error) {
        const operation = index === 0 ? "membership" : index === 1 ? "user" : "org"
        console.error(`[Bootstrap] Failed to cleanup ${operation} after domain creation failure:`, {
          error: result.value.error,
          userId,
          orgId,
          runId,
        })
      } else if (result.status === "rejected") {
        console.error("[Bootstrap] Cleanup operation threw exception:", {
          error: result.reason,
          userId,
          orgId,
          runId,
        })
      }
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  return buildTenantResponse(app, {
    userId,
    email,
    orgId,
    orgName: `E2E Worker ${workerIndex}`,
    workspace,
    workerIndex,
  })
}
