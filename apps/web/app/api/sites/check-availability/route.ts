import type { NextRequest } from "next/server"
import { validateSlug } from "@/features/deployment/lib/slug-utils"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleQuery, isHandleBodyError } from "@/lib/api/server"
import { inspectSiteOccupancy } from "@/lib/deployment/site-occupancy"
import { ErrorCodes } from "@/lib/error-codes"

export async function GET(req: NextRequest) {
  const query = await handleQuery("sites/check-availability", req)
  if (isHandleBodyError(query)) return query
  const { slug } = query

  const validation = validateSlug(slug)
  if (!validation.valid) {
    return structuredErrorResponse(ErrorCodes.INVALID_SLUG, { status: 400, details: { error: validation.error } })
  }

  const occupancy = inspectSiteOccupancy(slug)

  return alrighty("sites/check-availability", { available: !occupancy.occupied, slug, reason: occupancy.reason })
}
