/**
 * Playwright Global Teardown - Cleanup Test Data
 *
 * Removes all test data for this run after tests complete.
 */

import { TEST_CONFIG } from "@webalive/shared"
import { createServiceAppClient, createServiceIamClient, createServicePublicClient } from "@/lib/supabase/service"

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const err: { message: unknown } = error
    return String(err.message)
  }
  return JSON.stringify(error)
}

export default async function globalTeardown() {
  const runId = process.env.E2E_RUN_ID

  if (!runId) {
    console.warn("\n⚠️  [Global Teardown] No E2E_RUN_ID found, skipping cleanup\n")
    return
  }

  console.log(`\n🧹 [Global Teardown] Cleaning up test run: ${runId}`)

  const iam = createServiceIamClient()
  const app = createServiceAppClient()
  const pub = createServicePublicClient()

  // 1. Get test user IDs
  const { data: users } = await iam.from("users").select("user_id, email").eq("test_run_id", runId)
  const allRunUserRows = users || []
  const managedUserIds = allRunUserRows
    .filter((u: { user_id: string; email: string | null }) => {
      const email = u.email ?? ""
      return email.startsWith(TEST_CONFIG.WORKER_EMAIL_PREFIX) && email.endsWith(`@${TEST_CONFIG.EMAIL_DOMAIN}`)
    })
    .map((u: { user_id: string }) => u.user_id)

  // 2. Get test org IDs — ONLY orgs that are both tagged with this run AND marked as test.
  // Never delete production orgs that were merely associated with a test run (e.g. isolated
  // orgs created for real users during bootstrap). The is_test_env guard prevents wiping
  // real user data if bootstrap accidentally tagged a production org with test_run_id.
  const { data: orgs } = await iam.from("orgs").select("org_id").eq("test_run_id", runId).eq("is_test_env", true)
  const orgIds = orgs?.map((o: { org_id: string }) => o.org_id) || []

  const stats = {
    sessions: 0,
    domains: 0,
    userQuotas: 0,
    memberships: 0,
    orgs: 0,
    users: 0,
    workflows: 0,
    workflowVersions: 0,
    workflowInvocations: 0,
    workflowInvocationEvals: 0,
  }

  // 3. Delete sessions (must happen before users due to FK constraint)
  if (managedUserIds.length > 0) {
    try {
      const { count, error } = await iam.from("sessions").delete({ count: "exact" }).in("user_id", managedUserIds)
      if (error) throw error
      stats.sessions = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete sessions for user_ids: ${managedUserIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.sessions = 0
    }
  }

  // 4. Delete domains — only test domains within test orgs
  if (orgIds.length > 0) {
    try {
      const { count, error } = await app
        .from("domains")
        .delete({ count: "exact" })
        .in("org_id", orgIds)
        .eq("is_test_env", true)
      if (error) throw error
      stats.domains = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete domains for org_ids: ${orgIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.domains = 0
    }
  }

  // 5. Delete user_quotas (must happen before users due to FK constraint)
  if (managedUserIds.length > 0) {
    try {
      const { count, error } = await app.from("user_quotas").delete({ count: "exact" }).in("user_id", managedUserIds)
      if (error) throw error
      stats.userQuotas = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete user_quotas for user_ids: ${managedUserIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.userQuotas = 0
    }
  }

  // 6. Delete legacy workflow rows (public schema) that reference user_id via clerk_id.
  // Must run before user deletion to avoid Workflow_clerk_id_fkey failures.
  if (managedUserIds.length > 0) {
    try {
      const { data: workflows, error: workflowSelectError } = await pub
        .from("Workflow")
        .select("wf_id")
        .in("clerk_id", managedUserIds)
      if (workflowSelectError) throw workflowSelectError

      const workflowIds = workflows?.map((w: { wf_id: string }) => w.wf_id) || []
      if (workflowIds.length > 0) {
        const { data: workflowVersions, error: versionSelectError } = await pub
          .from("WorkflowVersion")
          .select("wf_version_id")
          .in("workflow_id", workflowIds)
        if (versionSelectError) throw versionSelectError

        const workflowVersionIds = workflowVersions?.map((v: { wf_version_id: string }) => v.wf_version_id) || []
        if (workflowVersionIds.length > 0) {
          const { data: workflowInvocations, error: invocationSelectError } = await pub
            .from("WorkflowInvocation")
            .select("wf_invocation_id")
            .in("wf_version_id", workflowVersionIds)
          if (invocationSelectError) throw invocationSelectError

          const workflowInvocationIds =
            workflowInvocations?.map((i: { wf_invocation_id: string }) => i.wf_invocation_id) || []
          if (workflowInvocationIds.length > 0) {
            const { count: evalCount, error: evalDeleteError } = await pub
              .from("WorkflowInvocationEval")
              .delete({ count: "exact" })
              .in("wf_inv_id", workflowInvocationIds)
            if (evalDeleteError) throw evalDeleteError
            stats.workflowInvocationEvals = evalCount || 0
          }

          const { count: invocationCount, error: invocationDeleteError } = await pub
            .from("WorkflowInvocation")
            .delete({ count: "exact" })
            .in("wf_version_id", workflowVersionIds)
          if (invocationDeleteError) throw invocationDeleteError
          stats.workflowInvocations = invocationCount || 0
        }

        const { count: versionCount, error: versionDeleteError } = await pub
          .from("WorkflowVersion")
          .delete({ count: "exact" })
          .in("workflow_id", workflowIds)
        if (versionDeleteError) throw versionDeleteError
        stats.workflowVersions = versionCount || 0
      }

      const { count: workflowCount, error: workflowDeleteError } = await pub
        .from("Workflow")
        .delete({ count: "exact" })
        .in("clerk_id", managedUserIds)
      if (workflowDeleteError) throw workflowDeleteError
      stats.workflows = workflowCount || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete workflow rows for user_ids: ${managedUserIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.workflows = 0
      stats.workflowVersions = 0
      stats.workflowInvocations = 0
      stats.workflowInvocationEvals = 0
    }
  }

  // 7. Delete memberships — only for test orgs (orgIds already filtered to is_test_env=true)
  if (orgIds.length > 0) {
    try {
      const { count, error } = await iam.from("org_memberships").delete({ count: "exact" }).in("org_id", orgIds)
      if (error) throw error
      stats.memberships = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete org_memberships for org_ids: ${orgIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.memberships = 0
    }
  }

  // 8. Delete orgs
  if (orgIds.length > 0) {
    try {
      const { count, error } = await iam.from("orgs").delete({ count: "exact" }).in("org_id", orgIds)
      if (error) throw error
      stats.orgs = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete orgs for org_ids: ${orgIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.orgs = 0
    }
  }

  // 9. Delete users
  if (managedUserIds.length > 0) {
    try {
      const { count, error } = await iam.from("users").delete({ count: "exact" }).in("user_id", managedUserIds)
      if (error) throw error
      stats.users = count || 0
    } catch (error) {
      console.error(`⚠️  [Global Teardown] Failed to delete users for user_ids: ${managedUserIds.join(", ")}`)
      console.error(`   Error: ${formatError(error)}`)
      stats.users = 0
    }
  }

  const skippedRunUsers = allRunUserRows.length - managedUserIds.length
  if (skippedRunUsers > 0) {
    console.log(`✓ Skipped non-managed run users: ${skippedRunUsers}`)
  }

  console.log(`✓ Sessions: ${stats.sessions}`)
  console.log(`✓ Domains: ${stats.domains}`)
  console.log(`✓ User Quotas: ${stats.userQuotas}`)
  console.log(`✓ Workflows: ${stats.workflows}`)
  console.log(`✓ Workflow Versions: ${stats.workflowVersions}`)
  console.log(`✓ Workflow Invocations: ${stats.workflowInvocations}`)
  console.log(`✓ Workflow Invocation Evals: ${stats.workflowInvocationEvals}`)
  console.log(`✓ Memberships: ${stats.memberships}`)
  console.log(`✓ Orgs: ${stats.orgs}`)
  console.log(`✓ Users: ${stats.users}`)
  console.log("\n✅ [Global Teardown] Cleanup complete\n")
}
