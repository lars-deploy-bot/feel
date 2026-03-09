import * as Sentry from "@sentry/nextjs"
import type { SessionUser } from "@/features/auth/lib/auth"
import { buildSubdomain } from "@/lib/config"
import { runStrictDeployment } from "@/lib/deployment/deploy-pipeline"
import {
  buildNewSiteSuccessPayload,
  getNewSiteCollisionMessage,
  type NewSiteSuccessPayload,
  persistNewSiteMetadata,
  scheduleSiteSslValidation,
} from "@/lib/deployment/new-site-lifecycle"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { incrementTemplateDeployCount } from "@/lib/deployment/template-stats"
import { validateTemplateFromDb } from "@/lib/deployment/template-validation"
import { getUserQuota } from "@/lib/deployment/user-quotas"
import { type ErrorCode, ErrorCodes } from "@/lib/error-codes"

interface CreateNewSiteParams {
  slug: string
  sessionUser: SessionUser
  siteIdeas?: string
  templateId?: string
  orgId?: string
  domain?: string
  successMessage?: string
}

interface NewSiteRequestErrorDetails {
  message?: string
  limit?: number
  currentCount?: number
  templateId?: string
}

export class NewSiteRequestError extends Error {
  readonly errorCode: ErrorCode
  readonly status: number
  readonly details?: NewSiteRequestErrorDetails

  constructor(errorCode: ErrorCode, status: number, details?: NewSiteRequestErrorDetails) {
    super(details?.message || errorCode)
    this.name = "NewSiteRequestError"
    this.errorCode = errorCode
    this.status = status
    this.details = details
  }
}

export async function assertCanCreateSite(sessionUser: SessionUser): Promise<void> {
  if (sessionUser.isSuperadmin) {
    return
  }

  const quota = await getUserQuota(sessionUser.id)
  if (!quota.canCreateSite) {
    throw new NewSiteRequestError(ErrorCodes.SITE_LIMIT_EXCEEDED, 403, {
      limit: quota.maxSites,
      currentCount: quota.currentSites,
    })
  }
}

export async function createNewSite(params: CreateNewSiteParams): Promise<NewSiteSuccessPayload> {
  if (params.orgId) {
    const hasAccess = await validateUserOrgAccess(params.sessionUser.id, params.orgId)
    if (!hasAccess) {
      throw new NewSiteRequestError(ErrorCodes.ORG_ACCESS_DENIED, 403, {
        message: "You do not have access to this organization",
      })
    }
  }

  const fullDomain = params.domain ?? buildSubdomain(params.slug)

  const collisionMessage = await getNewSiteCollisionMessage(params.slug, fullDomain)
  if (collisionMessage) {
    throw new NewSiteRequestError(ErrorCodes.SLUG_TAKEN, 409, {
      message: collisionMessage,
    })
  }

  await assertCanCreateSite(params.sessionUser)

  const templateValidation = await validateTemplateFromDb(params.templateId)
  if (!templateValidation.valid || !templateValidation.template) {
    const error = templateValidation.error
    throw new NewSiteRequestError(
      error?.code === "INVALID_TEMPLATE" ? ErrorCodes.INVALID_TEMPLATE : ErrorCodes.TEMPLATE_NOT_FOUND,
      400,
      {
        templateId: error?.templateId,
        message: error?.message || "Template validation failed",
      },
    )
  }

  const template = templateValidation.template
  const deployment = await runStrictDeployment({
    domain: fullDomain,
    email: params.sessionUser.email,
    orgId: params.orgId,
    templatePath: template.source_path,
  })

  try {
    await persistNewSiteMetadata({
      slug: params.slug,
      metadata: {
        slug: params.slug,
        domain: fullDomain,
        workspace: fullDomain,
        email: params.sessionUser.email,
        siteIdeas: params.siteIdeas ?? "",
        templateId: template.template_id,
        createdAt: Date.now(),
      },
      executionMode: deployment.executionMode,
    })
  } catch (metadataError) {
    console.error("[Create-New-Site] Metadata persistence failed (non-fatal):", metadataError)
    Sentry.captureException(metadataError)
  }

  incrementTemplateDeployCount(template.template_id).catch(err => {
    console.error("[Create-New-Site] Failed to increment template deploy count:", err)
  })

  scheduleSiteSslValidation(fullDomain, deployment.executionMode)

  return buildNewSiteSuccessPayload({
    message: params.successMessage || `Site ${fullDomain} deployed successfully!`,
    domain: fullDomain,
    orgId: params.orgId,
    executionMode: deployment.executionMode,
  })
}
