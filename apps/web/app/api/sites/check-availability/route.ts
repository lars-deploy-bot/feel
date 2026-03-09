import { type NextRequest, NextResponse } from "next/server"
import { validateSlug } from "@/features/deployment/lib/slug-utils"
import { structuredErrorResponse } from "@/lib/api/responses"
import { handleQuery, isHandleBodyError } from "@/lib/api/server"
import { inspectSiteOccupancy } from "@/lib/deployment/site-occupancy"
import { ErrorCodes } from "@/lib/error-codes"

interface AvailabilityResponse {
  available: boolean
  slug?: string
  reason?: string
  error?: string
}

export async function GET(req: NextRequest) {
  const query = await handleQuery("sites/check-availability", req)
  if (isHandleBodyError(query)) return query
  const { slug } = query

  const validation = validateSlug(slug)
  if (!validation.valid) {
    return structuredErrorResponse(ErrorCodes.INVALID_SLUG, { status: 400, details: { error: validation.error } })
  }

  const occupancy = inspectSiteOccupancy(slug)

  console.log(
    `[Availability] Checking slug "${slug}" -> occupied: ${occupancy.occupied} (${occupancy.reason ?? "free"})`,
  )

  return NextResponse.json(
    { available: !occupancy.occupied, slug, reason: occupancy.reason } satisfies AvailabilityResponse,
    { status: 200 },
  )
}
