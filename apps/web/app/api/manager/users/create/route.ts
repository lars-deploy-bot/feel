import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { hash } from "bcrypt"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"

/**
 * POST /api/manager/users/create - Create a new user account
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      401,
    )
  }

  try {
    const body = await req.json()
    const { email, password, displayName, orgType, orgId, orgName } = body

    // Validate required fields
    if (!email || !password || !orgType) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "email, password, and orgType are required", requestId },
        400,
      )
    }

    // Validate orgType
    if (orgType !== "new" && orgType !== "existing") {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "orgType must be 'new' or 'existing'", requestId },
        400,
      )
    }

    // Validate org-specific requirements
    if (orgType === "new" && !orgName) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "orgName is required when creating new org", requestId },
        400,
      )
    }

    if (orgType === "existing" && !orgId) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "orgId is required when assigning to existing org", requestId },
        400,
      )
    }

    const iam = await createIamClient("service")

    // Check if user already exists
    const { data: existingUser } = await iam.from("users").select("user_id").eq("email", email).single()

    if (existingUser) {
      return createCorsResponse(
        origin,
        { ok: false, error: "USER_EXISTS", message: "User with this email already exists", requestId },
        409,
      )
    }

    // Hash password
    const passwordHash = await hash(password, 10)

    // Create user
    const userId = randomUUID()
    const { error: userError } = await iam
      .from("users")
      .insert({
        user_id: userId,
        email,
        password_hash: passwordHash,
        display_name: displayName || null,
        status: "active",
        is_test_env: false,
        metadata: {},
      })
      .select("user_id")
      .single()

    if (userError) {
      console.error("[Manager Users] Failed to create user:", userError)
      return createCorsResponse(
        origin,
        { ok: false, error: "DATABASE_ERROR", message: "Failed to create user", requestId },
        500,
      )
    }

    let finalOrgId: string

    if (orgType === "new") {
      // Create new organization
      const newOrgId = randomUUID()
      const { error: orgError } = await iam
        .from("orgs")
        .insert({
          org_id: newOrgId,
          name: orgName,
          credits: 0,
          metadata: {},
        })
        .select("org_id")
        .single()

      if (orgError) {
        console.error("[Manager Users] Failed to create org:", orgError)
        // Cleanup user if org creation fails
        await iam.from("users").delete().eq("user_id", userId)
        return createCorsResponse(
          origin,
          { ok: false, error: "DATABASE_ERROR", message: "Failed to create organization", requestId },
          500,
        )
      }

      finalOrgId = newOrgId
    } else {
      // Verify org exists
      const { data: org, error: orgCheckError } = await iam.from("orgs").select("org_id").eq("org_id", orgId).single()

      if (orgCheckError || !org) {
        console.error("[Manager Users] Organization not found:", orgId)
        // Cleanup user if org verification fails
        await iam.from("users").delete().eq("user_id", userId)
        return createCorsResponse(
          origin,
          { ok: false, error: "ORG_NOT_FOUND", message: "Organization not found", requestId },
          404,
        )
      }

      finalOrgId = orgId
    }

    // Add user to organization as owner
    const { error: membershipError } = await iam.from("org_memberships").insert({
      org_id: finalOrgId,
      user_id: userId,
      role: "owner",
    })

    if (membershipError) {
      console.error("[Manager Users] Failed to create org membership:", membershipError)
      // Cleanup user and org if membership creation fails
      await iam.from("users").delete().eq("user_id", userId)
      if (orgType === "new") {
        await iam.from("orgs").delete().eq("org_id", finalOrgId)
      }
      return createCorsResponse(
        origin,
        { ok: false, error: "DATABASE_ERROR", message: "Failed to add user to organization", requestId },
        500,
      )
    }

    console.log(`[Manager Users] Created user ${email} (${userId}) in org ${finalOrgId}`)

    return createCorsSuccessResponse(origin, {
      user: {
        userId,
        email,
        displayName: displayName || null,
      },
      orgId: finalOrgId,
      requestId,
    })
  } catch (error) {
    console.error("[Manager Users] Unexpected error:", error)
    return createCorsResponse(
      origin,
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      500,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
