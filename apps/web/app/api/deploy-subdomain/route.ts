import * as Sentry from "@sentry/nextjs"
import { COOKIE_NAMES } from "@webalive/shared"
import { DeploymentError } from "@webalive/site-controller"
import type { NextRequest } from "next/server"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { createNewSite, NewSiteRequestError } from "@/lib/deployment/create-new-site"
import { DomainRegistrationError } from "@/lib/deployment/domain-registry"
import { refreshSessionJwtForOrg } from "@/lib/deployment/new-site-lifecycle"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(request: NextRequest) {
  try {
    // Authenticated deployments only
    const sessionUser = await requireSessionUser()

    // Parse and validate request body via typed schema
    const parsed = await handleBody("deploy-subdomain", request)
    if (isHandleBodyError(parsed)) return parsed

    const { slug, siteIdeas, templateId, orgId } = parsed
    const payload = await createNewSite({
      slug,
      siteIdeas,
      templateId,
      orgId,
      sessionUser,
    })

    const res = alrighty("deploy-subdomain", payload)

    await refreshSessionJwtForOrg({
      orgId,
      sessionUser,
      logPrefix: "[Deploy-Subdomain]",
      setSessionCookie: token => {
        res.cookies.set(COOKIE_NAMES.SESSION, token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
        })
      },
    })

    return res
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, {
        status: 401,
      })
    }

    if (error instanceof NewSiteRequestError) {
      return structuredErrorResponse(error.errorCode, {
        status: error.status,
        details: error.details,
      })
    }

    if (error instanceof DomainRegistrationError) {
      const status =
        error.errorCode === ErrorCodes.DOMAIN_ALREADY_EXISTS || error.errorCode === ErrorCodes.DEPLOYMENT_IN_PROGRESS
          ? 409
          : 400
      return structuredErrorResponse(error.errorCode, {
        status,
        details: error.details,
      })
    }

    if (error instanceof DeploymentError) {
      return structuredErrorResponse(ErrorCodes.DEPLOYMENT_FAILED, {
        status: error.statusCode,
        details: { message: error.message, code: error.code },
      })
    }

    console.error("[Deploy-Subdomain] Unexpected error:", error)
    Sentry.captureException(error)

    // Determine appropriate status code based on error type
    let status = 500
    if (error && typeof error === "object") {
      if ("code" in error && error.code === "ETIMEDOUT") {
        status = 408 // Request Timeout
      } else if (("code" in error && error.code === 12) || "stderr" in error) {
        status = 400 // Bad Request (DNS validation, script errors)
      }
    }

    return structuredErrorResponse(ErrorCodes.DEPLOYMENT_FAILED, {
      status,
      details:
        process.env.NODE_ENV === "development"
          ? { error: error instanceof Error ? error.toString() : String(error) }
          : undefined,
    })
  }
}
