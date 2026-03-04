/**
 * Bootstrap Tenant for E2E Test Worker
 *
 * Creates isolated user/org/domain for each Playwright worker.
 * Only accessible in test environments.
 */

import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { PATHS, TEST_CONFIG } from "@webalive/shared"
import { hash } from "bcrypt"
import { invalidateUserAuthzCache, invalidateWorkspaceAuthzCache } from "@/features/auth/lib/auth"
import { invalidateSessionDomainCache } from "@/features/auth/lib/sessionStore"
import { domainToSlug } from "@/features/manager/lib/domain-utils"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

const execFileAsync = promisify(execFile)
const MAX_LINUX_USERNAME_LENGTH = 32

interface BootstrapRequest {
  runId: string
  workerIndex: number
  email: string
  workspace: string
  credits?: number
}

interface BootstrapTenant {
  userId: string
  email: string
  orgId: string
  orgName: string
  workspace: string
  workerIndex: number
}

interface PosixIds {
  uid: number
  gid: number
}

function parseNumericId(value: string, source: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric ID from ${source}: "${value}"`)
  }
  return parsed
}

async function readPosixIds(username: string): Promise<PosixIds | null> {
  try {
    const [{ stdout: uidStdout }, { stdout: gidStdout }] = await Promise.all([
      execFileAsync("id", ["-u", username]),
      execFileAsync("id", ["-g", username]),
    ])

    return {
      uid: parseNumericId(uidStdout, `id -u ${username}`),
      gid: parseNumericId(gidStdout, `id -g ${username}`),
    }
  } catch (_error) {
    // User does not exist yet (or id command unavailable).
    return null
  }
}

async function ensureSystemUser(username: string): Promise<PosixIds> {
  const existing = await readPosixIds(username)
  if (existing) {
    return existing
  }

  await execFileAsync("useradd", [
    "--system",
    "--user-group",
    "--no-create-home",
    "--shell",
    "/usr/sbin/nologin",
    username,
  ])

  const created = await readPosixIds(username)
  if (!created) {
    throw new Error(`Failed to resolve uid/gid for created user: ${username}`)
  }

  return created
}

async function ensureWorkspaceFilesystem(workspace: string): Promise<void> {
  const slug = domainToSlug(workspace)
  const linuxUser = `site-${slug}`

  if (linuxUser.length > MAX_LINUX_USERNAME_LENGTH) {
    throw new Error(`Workspace slug too long for linux user: ${linuxUser}`)
  }

  const resolvedSitesRoot = path.resolve(PATHS.SITES_ROOT)
  const resolvedWorkspaceRoot = path.resolve(path.join(PATHS.SITES_ROOT, workspace))
  const relativeWorkspacePath = path.relative(resolvedSitesRoot, resolvedWorkspaceRoot)

  if (
    relativeWorkspacePath.length === 0 ||
    relativeWorkspacePath.startsWith("..") ||
    path.isAbsolute(relativeWorkspacePath)
  ) {
    throw new Error(`Workspace path escapes SITES_ROOT: ${workspace}`)
  }

  const workspaceUserDir = path.join(resolvedWorkspaceRoot, "user")

  // Keep every run deterministic: clear stale files from previous E2E runs.
  await rm(workspaceUserDir, { recursive: true, force: true })
  await mkdir(workspaceUserDir, { recursive: true, mode: 0o750 })
  await writeFile(
    path.join(workspaceUserDir, "README.md"),
    "# E2E Workspace\n\nThis workspace is provisioned for live staging E2E tests.\n",
    "utf8",
  )

  const currentUid = typeof process.getuid === "function" ? process.getuid() : null
  const currentGid = typeof process.getgid === "function" ? process.getgid() : null

  if (currentUid === null || currentGid === null) {
    throw new Error("Current process uid/gid is unavailable")
  }

  if (currentUid === 0) {
    const { uid, gid } = await ensureSystemUser(linuxUser)
    await execFileAsync("chown", ["-R", `${uid}:${gid}`, resolvedWorkspaceRoot])
    return
  }

  // Non-root deployment: align ownership to the app process user.
  await execFileAsync("chown", ["-R", `${currentUid}:${currentGid}`, resolvedWorkspaceRoot]).catch(() => {
    // If chown is not permitted, the directory is already process-owned in non-root mode.
  })
}

async function buildTenantResponse(tenant: BootstrapTenant): Promise<Response> {
  invalidateUserAuthzCache(tenant.userId)
  invalidateWorkspaceAuthzCache(tenant.workspace)
  invalidateSessionDomainCache(tenant.workspace)

  try {
    await ensureWorkspaceFilesystem(tenant.workspace)
  } catch (error) {
    console.error("[Bootstrap] Failed to provision workspace filesystem:", {
      workspace: tenant.workspace,
      error: error instanceof Error ? error.message : String(error),
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  return Response.json({ ok: true, tenant })
}

export async function POST(req: Request) {
  // Environment guard - accessible in test/local environments OR with valid test secret
  const isTestEnv = env.NODE_ENV === "test" || env.STREAM_ENV === "local"

  // Check for test secret header (for staging/production E2E tests)
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = env.E2E_TEST_SECRET
  const hasValidSecret = expectedSecret && testSecret === expectedSecret

  if (!isTestEnv && !hasValidSecret) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const body = (await req.json()) as BootstrapRequest
  const { runId, workerIndex, email, workspace, credits = TEST_CONFIG.DEFAULT_CREDITS } = body

  if (!runId || workerIndex === undefined || !email || !workspace) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

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
    .select("user_id, email")
    .eq("email", email)
    .single()

  // PGRST116 = "The result contains 0 rows" - expected for new users
  if (existingUserError && existingUserError.code !== "PGRST116") {
    console.error("[Bootstrap] User lookup failed:", existingUserError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  if (existingUser) {
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
            execution_mode: "e2b",
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

      return buildTenantResponse({
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

    // Update test_run_id and password hash to ensure consistency across test runs
    // Use upsert for domain to handle case where domain was deleted but user still exists
    let userUpdate: any, orgUpdate: any, domainUpsert: any
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
            execution_mode: "e2b",
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
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
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
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return buildTenantResponse({
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
  const { error: domainError } = await app.from("domains").upsert(
    {
      hostname: workspace,
      org_id: orgId,
      port, // Virtual port (validated above)
      execution_mode: "e2b",
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

  return buildTenantResponse({
    userId,
    email,
    orgId,
    orgName: `E2E Worker ${workerIndex}`,
    workspace,
    workerIndex,
  })
}
