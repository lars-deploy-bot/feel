import * as Sentry from "@sentry/nextjs"
import type { ExecutionMode } from "@webalive/database"
import { COOKIE_NAMES } from "@webalive/shared"
import { cookies } from "next/headers"
import type { SessionUser } from "@/features/auth/lib/auth"
import { refreshSessionTokenWithOrg } from "@/features/auth/lib/jwt"
import { inspectSiteOccupancy } from "@/lib/deployment/site-occupancy"
import { validateSSLCertificate } from "@/lib/deployment/ssl-validation"
import { errorLogger } from "@/lib/error-logger"
import { getSiteWorkspaceRoot, siteWorkspaceExists } from "@/lib/site-workspace-registry"
import { type SiteMetadata, siteMetadataStore } from "@/lib/siteMetadataStore"
import { QUERY_KEYS } from "@/lib/url/queryState"

export interface NewSiteSuccessPayload {
  message: string
  domain: string
  orgId?: string
  executionMode: ExecutionMode
  chatUrl: string
}

interface RefreshSessionJwtForOrgParams {
  orgId?: string
  sessionUser: SessionUser
  logPrefix: string
  setSessionCookie: (token: string) => void
}

export async function getNewSiteCollisionMessage(slug: string, domain: string): Promise<string | null> {
  const slugExists = await siteMetadataStore.exists(slug)
  if (slugExists) {
    return `Subdomain "${slug}" is already taken. Choose a different name.`
  }

  const occupancy = inspectSiteOccupancy(slug)
  if (occupancy.occupied) {
    return `Slug "${slug}" is not reusable yet: ${occupancy.reason}. Choose a different slug.`
  }

  if (siteWorkspaceExists(domain)) {
    return "Site workspace already exists. Choose a different slug."
  }

  return null
}

export async function persistNewSiteMetadata(params: {
  slug: string
  metadata: SiteMetadata
  executionMode: ExecutionMode
}): Promise<void> {
  await siteMetadataStore.setSite(params.slug, params.metadata, {
    workspaceRoot: getSiteWorkspaceRoot(params.metadata.domain, params.executionMode),
  })
}

export function scheduleSiteSslValidation(domain: string, executionMode: ExecutionMode): void {
  if (executionMode !== "systemd" || process.env.SKIP_SSL_VALIDATION === "true") {
    return
  }

  validateSSLCertificate(domain).catch(err => {
    errorLogger.capture({
      category: "deployment",
      source: "backend",
      message: `SSL check failed for ${domain} (non-blocking)`,
      details: { domain, error: err instanceof Error ? err.message : String(err) },
    })
  })
}

export function buildNewSiteSuccessPayload(params: {
  domain: string
  orgId?: string
  executionMode: ExecutionMode
  message: string
}): NewSiteSuccessPayload {
  const searchParams = new URLSearchParams()
  searchParams.set(QUERY_KEYS.workspace, params.domain)
  if (params.orgId) {
    searchParams.set(QUERY_KEYS.org, params.orgId)
  }
  return {
    message: params.message,
    domain: params.domain,
    orgId: params.orgId,
    executionMode: params.executionMode,
    chatUrl: `/chat?${searchParams.toString()}`,
  }
}

/**
 * Refresh the session JWT to include a newly associated org with authoritative IAM roles.
 *
 * NOTE: Under concurrent site creations with different orgs, the last write wins.
 * This is acceptable since concurrent deploys from the same session are rare, and
 * the next auth refresh/load will reconcile against the database anyway.
 */
export async function refreshSessionJwtForOrg(params: RefreshSessionJwtForOrgParams): Promise<void> {
  if (!params.orgId) {
    return
  }

  try {
    const jar = await cookies()
    const sessionCookie = jar.get(COOKIE_NAMES.SESSION)

    if (!sessionCookie?.value) {
      return
    }

    const newToken = await refreshSessionTokenWithOrg(sessionCookie.value, params.sessionUser, params.orgId)
    if (!newToken) {
      return
    }

    params.setSessionCookie(newToken)
  } catch (tokenError) {
    console.error(`${params.logPrefix} JWT regeneration failed (deployment succeeded):`, tokenError)
    Sentry.captureException(tokenError)
  }
}
