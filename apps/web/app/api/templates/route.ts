/**
 * Templates API
 * Returns all active site templates for deployment.
 *
 * Templates are shared across all servers — both servers host
 * template files locally (synced via git) and serve the same set.
 */

import * as Sentry from "@sentry/nextjs"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty } from "@/lib/api/server"
import { listDeploymentTemplates } from "@/lib/deployment/template-catalog"
import { ErrorCodes } from "@/lib/error-codes"

/**
 * GET - Get all active templates
 * Requires authentication — only served to logged-in users.
 */
export async function GET() {
  try {
    await requireSessionUser()

    const templates = await listDeploymentTemplates()

    if (!templates || templates.length === 0) {
      throw new Error("No active deployment templates available — database and filesystem catalog are both empty")
    }

    // Every template must have a preview_url
    const missingUrls = templates.filter(t => !t.preview_url)
    if (missingUrls.length > 0) {
      throw new Error(`Templates missing preview_url: ${missingUrls.map(t => t.template_id).join(", ")}`)
    }

    return alrighty(
      "templates",
      { templates },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }
    console.error("[Templates API]", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
