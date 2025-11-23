/**
 * Bootstrap Tenant for E2E Test Worker
 *
 * Creates isolated user/org/domain for each Playwright worker.
 * Only accessible in test environments.
 */

import { randomUUID } from "node:crypto"
import { hash } from "bcrypt"
import { TEST_CONFIG } from "@webalive/shared"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"
import { ErrorCodes } from "@/lib/error-codes"
import { createErrorResponse } from "@/features/auth/lib/auth"

interface BootstrapRequest {
  runId: string
  workerIndex: number
  email: string
  workspace: string
  credits?: number
}

export async function POST(req: Request) {
  // Environment guard - ONLY accessible in test or local environments (whitelist approach)
  if (process.env.NODE_ENV !== "test" && process.env.BRIDGE_ENV !== "local") {
    return createErrorResponse(ErrorCodes.UNAUTHORIZED, 404)
  }

  const body = (await req.json()) as BootstrapRequest
  const { runId, workerIndex, email, workspace, credits = TEST_CONFIG.DEFAULT_CREDITS } = body

  if (!runId || workerIndex === undefined || !email || !workspace) {
    return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 400)
  }

  // Validate workerIndex against centralized config (single source of truth)
  if (workerIndex < 0 || workerIndex >= TEST_CONFIG.MAX_WORKERS) {
    return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 400)
  }

  const port = TEST_CONFIG.WORKER_PORT_BASE + workerIndex

  const iam = await createIamClient("service")
  const app = await createAppClient("service")

  // Generate password hash (used for both new and existing users)
  const passwordHash = await hash(TEST_CONFIG.TEST_PASSWORD, 10)

  // Check if tenant already exists by email (idempotent across test runs)
  const { data: existingUser, error: existingUserError } = await iam.from("users").select("user_id, email").eq("email", email).single()

  if (existingUserError) {
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
  }

  if (existingUser) {
    // Get org and return existing tenant
    const { data: membership, error: membershipError } = await iam
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", existingUser.user_id)
      .single()

    if (membershipError) {
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
    }

    if (!membership) {
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
    }

    const { data: org, error: orgError } = await iam.from("orgs").select("name").eq("org_id", membership.org_id).single()

    if (orgError) {
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
    }

    // Update test_run_id and password hash to ensure consistency across test runs
    // Use upsert for domain to handle case where domain was deleted but user still exists
    let userUpdate, orgUpdate, domainUpsert
    try {
      ;[userUpdate, orgUpdate, domainUpsert] = await Promise.all([
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
            is_test_env: true,
            test_run_id: runId,
          },
          {
            onConflict: "hostname",
          },
        ),
      ])
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
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
    }

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
      return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
    }

    return Response.json({
      ok: true,
      tenant: {
        userId: existingUser.user_id,
        email: existingUser.email,
        orgId: membership.org_id,
        orgName: org?.name || `Worker ${workerIndex}`,
        workspace,
        workerIndex,
      },
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
  })

  if (userError) {
    console.error("[Bootstrap] User creation failed:", userError)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
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
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
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
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
  }

  // 4. Create/update domain entry (virtual - no actual deployment, idempotent)
  const { error: domainError } = await app.from("domains").upsert(
    {
      hostname: workspace,
      org_id: orgId,
      port, // Virtual port (validated above)
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
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
  }

  return Response.json({
    ok: true,
    tenant: {
      userId,
      email,
      orgId,
      orgName: `E2E Worker ${workerIndex}`,
      workspace,
      workerIndex,
    },
  })
}
