/**
 * Verify Tenant Readiness for E2E Tests
 *
 * Checks if tenant has been fully created and is ready for testing.
 * Used by global-setup.ts to poll for database consistency.
 * Only accessible in test environments.
 */

import { TEST_CONFIG } from "@webalive/shared"
import { createErrorResponse } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(req: Request) {
  // Environment guard - accessible in test/local environments OR with valid test secret
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.BRIDGE_ENV === "local"

  // Check for test secret header (for staging/production E2E tests)
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = process.env.E2E_TEST_SECRET
  const hasValidSecret = expectedSecret && testSecret === expectedSecret

  if (!isTestEnv && !hasValidSecret) {
    return createErrorResponse(ErrorCodes.UNAUTHORIZED, 404)
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  if (!email) {
    return createErrorResponse(ErrorCodes.VALIDATION_ERROR, 400)
  }

  const iam = await createIamClient("service")
  const app = await createAppClient("service")

  try {
    // 1. Check if user exists
    const { data: user } = await iam.from("users").select("user_id").eq("email", email).single()

    if (!user) {
      return Response.json({ ready: false, missing: "user" })
    }

    // 2. Check if user has org membership
    const { data: membership } = await iam.from("org_memberships").select("org_id").eq("user_id", user.user_id).single()

    if (!membership) {
      return Response.json({ ready: false, missing: "membership" })
    }

    // 3. Check if org has credits
    const { data: org } = await iam.from("orgs").select("credits").eq("org_id", membership.org_id).single()

    if (!org || org.credits < 0) {
      return Response.json({ ready: false, missing: "org" })
    }

    // 4. Check if domain exists (extract workspace from email pattern)
    const workerIndex = email.match(/worker(\d+)@/)?.[1]
    if (workerIndex !== undefined) {
      const workspace = `${TEST_CONFIG.WORKSPACE_PREFIX}${workerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`
      const { data: domain } = await app
        .from("domains")
        .select("hostname")
        .eq("hostname", workspace)
        .eq("org_id", membership.org_id)
        .single()

      if (!domain) {
        return Response.json({ ready: false, missing: "domain" })
      }
    }

    // All checks passed
    return Response.json({ ready: true })
  } catch (error) {
    console.error("[Verify Tenant] Error:", error)
    return createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500)
  }
}
