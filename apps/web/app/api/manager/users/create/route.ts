import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { hash } from "bcrypt"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { email, password, displayName, orgType, orgId, orgName } = body

    // Validate required fields
    if (!email || !password || !orgType) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "email, password, and orgType are required", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Validate orgType
    if (orgType !== "new" && orgType !== "existing") {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "orgType must be 'new' or 'existing'", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Validate org-specific requirements
    if (orgType === "new" && !orgName) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "orgName is required when creating new org", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    if (orgType === "existing" && !orgId) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "orgId is required when assigning to existing org", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    const iam = await createIamClient("service")

    // Check if user already exists
    const { data: existingUser } = await iam.from("users").select("user_id").eq("email", email).single()

    if (existingUser) {
      const res = NextResponse.json(
        { ok: false, error: "USER_EXISTS", message: "User with this email already exists", requestId },
        { status: 409 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to create user", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
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
        const res = NextResponse.json(
          { ok: false, error: "DATABASE_ERROR", message: "Failed to create organization", requestId },
          { status: 500 },
        )
        addCorsHeaders(res, origin)
        return res
      }

      finalOrgId = newOrgId
    } else {
      // Verify org exists
      const { data: org, error: orgCheckError } = await iam.from("orgs").select("org_id").eq("org_id", orgId).single()

      if (orgCheckError || !org) {
        console.error("[Manager Users] Organization not found:", orgId)
        // Cleanup user if org verification fails
        await iam.from("users").delete().eq("user_id", userId)
        const res = NextResponse.json(
          { ok: false, error: "ORG_NOT_FOUND", message: "Organization not found", requestId },
          { status: 404 },
        )
        addCorsHeaders(res, origin)
        return res
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
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to add user to organization", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    console.log(`[Manager Users] Created user ${email} (${userId}) in org ${finalOrgId}`)

    const res = NextResponse.json({
      ok: true,
      user: {
        userId,
        email,
        displayName: displayName || null,
      },
      orgId: finalOrgId,
      requestId,
    })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager Users] Unexpected error:", error)
    const res = NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
