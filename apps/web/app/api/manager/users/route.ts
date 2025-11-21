import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsErrorResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"

/**
 * GET /api/manager/users - Fetch all users
 */
export async function GET(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsErrorResponse(origin, ErrorCodes.UNAUTHORIZED, 401, { requestId })
  }

  try {
    const iam = await createIamClient("service")

    // Fetch all users (excluding test users)
    const { data: users, error: usersError } = await iam
      .from("users")
      .select("user_id, email, display_name, created_at, status")
      .eq("is_test_env", false)
      .order("created_at", { ascending: false })

    console.log(`[Manager Users] Fetched ${users?.length || 0} users (excluding test users)`)

    if (usersError) {
      console.error("[Manager Users] Failed to fetch users:", usersError)
      return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
    }

    return createCorsSuccessResponse(origin, {
      users: users || [],
      requestId,
    })
  } catch (error) {
    console.error("[Manager Users] Unexpected error:", error)
    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
