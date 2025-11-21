import { type NextRequest, NextResponse } from "next/server"
import { requireManagerAuth } from "@/features/manager/lib/api-helpers"
import { createCorsSuccessResponse, createCorsErrorResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { createClient } from "@supabase/supabase-js"
import type { Database as AppDatabase } from "@/lib/supabase/app.types"

/**
 * Create App schema client
 */
async function getAppClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase credentials")
  }

  return createClient<AppDatabase>(url, key, {
    db: { schema: "app" },
  })
}

/**
 * POST /api/manager/domains/transfer
 * Transfer a domain to a different organization
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  const authError = await requireManagerAuth()
  if (authError) {
    return authError
  }

  try {
    const body = await req.json()
    const { domain, targetOrgId } = body

    if (!domain || !targetOrgId) {
      return createCorsErrorResponse(origin, ErrorCodes.VALIDATION_ERROR, 400, {
        details: { message: "domain and targetOrgId are required" },
      })
    }

    const app = await getAppClient()

    // Update domain's org_id
    const { error: updateError } = await app.from("domains").update({ org_id: targetOrgId }).eq("hostname", domain)

    if (updateError) {
      console.error("[Manager] Failed to transfer domain:", updateError)
      return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
        details: { message: updateError.message },
      })
    }

    return createCorsSuccessResponse(origin, {
      success: true,
      message: `Domain ${domain} transferred to organization ${targetOrgId}`,
    })
  } catch (error) {
    console.error("[Manager] Error transferring domain:", error)
    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
      details: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

/**
 * OPTIONS /api/manager/domains/transfer
 * CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 204 })
  addCorsHeaders(res, origin)
  return res
}
