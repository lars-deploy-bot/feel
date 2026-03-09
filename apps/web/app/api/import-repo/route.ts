import * as Sentry from "@sentry/nextjs"
import { COOKIE_NAMES, getOAuthKeyForProvider } from "@webalive/shared"
import { DeploymentError } from "@webalive/site-controller"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { buildSubdomain } from "@/lib/config"
import { assertCanCreateSite, NewSiteRequestError } from "@/lib/deployment/create-new-site"
import { runStrictDeployment } from "@/lib/deployment/deploy-pipeline"
import { DomainRegistrationError } from "@/lib/deployment/domain-registry"
import { cleanupImportDir, importGithubRepo } from "@/lib/deployment/github-import"
import {
  buildNewSiteSuccessPayload,
  getNewSiteCollisionMessage,
  persistNewSiteMetadata,
  refreshSessionJwtForOrg,
  scheduleSiteSslValidation,
} from "@/lib/deployment/new-site-lifecycle"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { ErrorCodes } from "@/lib/error-codes"
import { parseGithubRepoWithUrls } from "@/lib/git/github-repo-url"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

export async function POST(request: NextRequest) {
  let cleanupDir: string | null = null
  let parsedRepo: ReturnType<typeof parseGithubRepoWithUrls> | null = null

  try {
    // Require authenticated session (no anonymous GitHub imports)
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, {
        status: 401,
        details: { message: "Authentication required. Please log in to import a GitHub repository." },
      })
    }

    // Parse and validate request body
    const parsed = await handleBody("import-repo", request)
    if (isHandleBodyError(parsed)) return parsed

    const { slug, repoUrl, branch, orgId, siteIdeas } = parsed

    // Validate org access if orgId provided
    if (orgId) {
      const hasAccess = await validateUserOrgAccess(sessionUser.id, orgId)
      if (!hasAccess) {
        return structuredErrorResponse(ErrorCodes.ORG_ACCESS_DENIED, {
          status: 403,
          details: { message: "You do not have access to this organization" },
        })
      }
    }

    // Build full domain from slug
    const fullDomain = buildSubdomain(slug)

    const collisionMessage = await getNewSiteCollisionMessage(slug, fullDomain)
    if (collisionMessage) {
      return structuredErrorResponse(ErrorCodes.SLUG_TAKEN, {
        status: 409,
        details: { message: collisionMessage },
      })
    }

    // Check site creation quota only after slug conflict checks so collisions
    // consistently report SLUG_TAKEN instead of SITE_LIMIT_EXCEEDED.
    try {
      await assertCanCreateSite(sessionUser)
    } catch (error) {
      if (error instanceof NewSiteRequestError) {
        return structuredErrorResponse(error.errorCode, {
          status: error.status,
          details: error.details,
        })
      }
      throw error
    }

    // Validate repo URL format before anything else
    try {
      parsedRepo = parseGithubRepoWithUrls(repoUrl)
    } catch (error) {
      return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: { message: error instanceof Error ? error.message : "Invalid repository URL format" },
      })
    }

    // Try to get GitHub OAuth token — needed for private repos, optional for public ones
    let githubToken: string | undefined
    try {
      const githubOAuthKey = getOAuthKeyForProvider("github")
      const githubOAuth = getOAuthInstance(githubOAuthKey)
      githubToken = (await githubOAuth.getAccessToken(sessionUser.id, githubOAuthKey)) ?? undefined
    } catch (_err) {
      // No GitHub token available — fine for public repos
    }

    // Download and prepare the repo via GitHub API
    let templatePath: string
    let resolvedBranch: string | undefined
    try {
      const result = await importGithubRepo(repoUrl, githubToken, branch)
      templatePath = result.templatePath
      cleanupDir = result.cleanupDir
      resolvedBranch = result.resolvedBranch
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown download error"
      return structuredErrorResponse(ErrorCodes.GITHUB_CLONE_FAILED, {
        status: 400,
        details: { message, repoUrl },
      })
    }

    // Deploy using the strict shared pipeline (deploy -> register -> caddy -> verify)
    // Skip build: imported repos are arbitrary — user builds via chat
    const deployment = await runStrictDeployment({
      domain: fullDomain,
      email: sessionUser.email,
      orgId,
      templatePath,
      skipBuild: true,
    })

    try {
      await persistNewSiteMetadata({
        slug,
        metadata: {
          slug,
          domain: fullDomain,
          workspace: fullDomain,
          email: sessionUser.email,
          siteIdeas,
          source: "github-import",
          sourceRepo: parsedRepo ? parsedRepo.canonicalUrl : repoUrl,
          sourceBranch: resolvedBranch ?? (branch?.trim() ? branch.trim() : undefined),
          createdAt: Date.now(),
        },
        executionMode: deployment.executionMode,
      })
    } catch (metadataError) {
      console.error("[Import-Repo] Metadata persistence failed (non-fatal):", metadataError)
      Sentry.captureException(metadataError)
    }

    scheduleSiteSslValidation(fullDomain, deployment.executionMode)

    const res = alrighty(
      "import-repo",
      buildNewSiteSuccessPayload({
        message: `Site ${fullDomain} deployed from GitHub repository!`,
        domain: fullDomain,
        orgId,
        executionMode: deployment.executionMode,
      }),
    )

    await refreshSessionJwtForOrg({
      orgId,
      sessionUser,
      logPrefix: "[Import-Repo]",
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

    console.error("[Import-Repo] Unexpected error:", error)

    Sentry.captureException(error)

    let status = 500
    if (error && typeof error === "object") {
      if ("code" in error && error.code === "ETIMEDOUT") {
        status = 408
      }
    }

    return structuredErrorResponse(ErrorCodes.DEPLOYMENT_FAILED, {
      status,
      details:
        process.env.NODE_ENV === "development"
          ? { error: error instanceof Error ? error.toString() : String(error) }
          : undefined,
    })
  } finally {
    // Always clean up the temp directory
    if (cleanupDir) {
      try {
        cleanupImportDir(cleanupDir)
      } catch (cleanupError) {
        console.error("[Import-Repo] Failed to clean up temp dir:", cleanupError)
        Sentry.captureException(cleanupError)
      }
    }
  }
}
