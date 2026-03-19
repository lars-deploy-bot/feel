import * as Sentry from "@sentry/nextjs"
import { DEFAULTS, DOMAINS } from "@webalive/shared"
import { DeploymentError } from "@webalive/site-controller"
import type { NextRequest } from "next/server"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { domainToSlug, normalizeAndValidateDomain } from "@/features/manager/lib/domain-utils"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { setSessionCookie } from "@/lib/auth/cookies"
import { assertCanCreateSite, NewSiteRequestError } from "@/lib/deployment/create-new-site"
import { runStrictDeployment } from "@/lib/deployment/deploy-pipeline"
import { DomainRegistrationError } from "@/lib/deployment/domain-registry"
import {
  buildNewSiteSuccessPayload,
  persistNewSiteMetadata,
  refreshSessionJwtForOrg,
  scheduleSiteSslValidation,
} from "@/lib/deployment/new-site-lifecycle"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { validateTemplateFromDb } from "@/lib/deployment/template-validation"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireSessionUser()

    const parsed = await handleBody("deploy", request)
    if (isHandleBodyError(parsed)) return parsed

    const normalized = normalizeAndValidateDomain(parsed.domain)
    if (!normalized.isValid) {
      return structuredErrorResponse(ErrorCodes.INVALID_DOMAIN, {
        status: 400,
        details: { message: normalized.error || "Invalid domain format" },
      })
    }

    if (parsed.orgId) {
      const hasAccess = await validateUserOrgAccess(sessionUser.id, parsed.orgId)
      if (!hasAccess) {
        return structuredErrorResponse(ErrorCodes.FORBIDDEN, { status: 403 })
      }
    }

    await assertCanCreateSite(sessionUser)

    const templateValidation = await validateTemplateFromDb(parsed.templateId)
    if (!templateValidation.valid || !templateValidation.template) {
      const error = templateValidation.error
      return structuredErrorResponse(
        error?.code === "INVALID_TEMPLATE" ? ErrorCodes.INVALID_TEMPLATE : ErrorCodes.TEMPLATE_NOT_FOUND,
        {
          status: 400,
          details: {
            templateId: error?.templateId,
            message: error?.message || "Template validation failed",
          },
        },
      )
    }

    const deployment = await runStrictDeployment({
      domain: normalized.domain,
      email: sessionUser.email,
      orgId: parsed.orgId,
      templatePath: templateValidation.template.source_path,
    })

    const slug = domainToSlug(normalized.domain)
    try {
      await persistNewSiteMetadata({
        slug,
        metadata: {
          slug,
          domain: normalized.domain,
          workspace: normalized.domain,
          email: sessionUser.email,
          siteIdeas: "",
          templateId: templateValidation.template.template_id,
          createdAt: Date.now(),
        },
        executionMode: deployment.executionMode,
      })
    } catch (metadataError) {
      console.error("[Deploy] Metadata persistence failed (non-fatal):", metadataError)
      Sentry.captureException(metadataError)
    }

    scheduleSiteSslValidation(normalized.domain, deployment.executionMode)

    const message =
      deployment.executionMode === "systemd"
        ? `Site ${normalized.domain} deployed successfully (SSL provisioning in progress)`
        : `Site ${normalized.domain} deployed successfully!`

    const res = alrighty(
      "deploy",
      buildNewSiteSuccessPayload({
        message,
        domain: normalized.domain,
        orgId: parsed.orgId,
        executionMode: deployment.executionMode,
      }),
    )

    await refreshSessionJwtForOrg({
      orgId: parsed.orgId,
      sessionUser,
      logPrefix: "[Deploy]",
      setSessionCookie: token => setSessionCookie(res, token, request),
    })

    return res
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
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
      let message = error.message
      switch (error.code) {
        case "DNS_VALIDATION_FAILED":
          message = `${error.message}. Please ensure your domain points to ${DEFAULTS.SERVER_IP}. See DNS setup guide: ${DOMAINS.APP_PROD}/docs/dns-setup`
          break
        case "INVALID_DOMAIN":
        case "PATH_TRAVERSAL":
        case "SITE_EXISTS":
          message = error.message
          break
      }

      return structuredErrorResponse(ErrorCodes.DEPLOYMENT_FAILED, {
        status: error.statusCode,
        details: { message, code: error.code },
      })
    }

    console.error("[Deploy] Unexpected error:", error)
    Sentry.captureException(error)

    let status = 500
    if (error && typeof error === "object" && "code" in error && error.code === "ETIMEDOUT") {
      status = 408
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
