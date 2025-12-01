import { existsSync } from "node:fs"
import { DEFAULTS, DOMAINS, PATHS } from "@webalive/shared"
import { DeploymentError } from "@webalive/site-controller"
import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, requireSessionUser } from "@/features/auth/lib/auth"
import { normalizeAndValidateDomain } from "@/features/manager/lib/domain-utils"
import { deploySite } from "@/lib/deployment/deploy-site"
import { DomainRegistrationError, registerDomain } from "@/lib/deployment/domain-registry"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { validateSSLCertificate } from "@/lib/deployment/ssl-validation"
import { validateTemplateFromDb } from "@/lib/deployment/template-validation"
import { getUserQuota } from "@/lib/deployment/user-quotas"
import { ErrorCodes } from "@/lib/error-codes"

interface DeployRequest {
  domain: string
  orgId: string // REQUIRED: Organization to deploy to (user must explicitly select)
  templateId?: string // Optional: Template to use (defaults to "blank")
}

interface DeployResponse {
  ok: boolean
  message: string
  domain?: string
  orgId?: string
  errors?: string[]
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("🚀 [DEPLOY API] Request received")

  let domain = "unknown domain" // Initialize domain outside try block for error handling

  try {
    // AUTHENTICATION REQUIRED - No anonymous deployments allowed
    const user = await requireSessionUser()
    console.log(`🔐 [DEPLOY API] Authenticated user: ${user.email} (${user.id})`)

    // Parse request body
    let body: DeployRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ [DEPLOY API] Failed to parse request JSON:", parseError)
      return createErrorResponse(ErrorCodes.INVALID_JSON, 400)
    }

    // Normalize and validate domain
    const domainResult = normalizeAndValidateDomain(body.domain)
    if (!domainResult.isValid) {
      console.error(`❌ [DEPLOY API] Domain validation failed: ${domainResult.error}`)
      return createErrorResponse(ErrorCodes.INVALID_DOMAIN, 400, { error: domainResult.error })
    }

    domain = domainResult.domain // Use normalized domain

    // Validate orgId is provided
    if (!body.orgId) {
      console.error("❌ [DEPLOY API] orgId is required")
      return createErrorResponse(ErrorCodes.ORG_ID_REQUIRED, 400)
    }

    const orgId = body.orgId

    // Validate user has access to the specified organization
    console.log(`🏢 [DEPLOY API] Validating access to organization: ${orgId}`)
    const hasAccess = await validateUserOrgAccess(user.id, orgId)

    if (!hasAccess) {
      console.error(`❌ [DEPLOY API] User ${user.email} does not have access to org ${orgId}`)
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, 403)
    }

    console.log(`✅ [DEPLOY API] User has access to organization ${orgId}`)

    // Check site creation limit
    const quota = await getUserQuota(user.id)
    if (!quota.canCreateSite) {
      console.error(
        `❌ [DEPLOY API] User ${user.email} has reached site limit (${quota.currentSites}/${quota.maxSites})`,
      )
      return createErrorResponse(ErrorCodes.SITE_LIMIT_EXCEEDED, 403, {
        limit: quota.maxSites,
        currentCount: quota.currentSites,
      })
    }

    // Validate and get selected template from database
    const templateValidation = await validateTemplateFromDb(body.templateId)
    if (!templateValidation.valid || !templateValidation.template) {
      const error = templateValidation.error!
      console.error(`❌ [DEPLOY API] Template validation failed: ${error.code}`, error)
      return createErrorResponse(
        error.code === "INVALID_TEMPLATE" ? ErrorCodes.INVALID_TEMPLATE : ErrorCodes.TEMPLATE_NOT_FOUND,
        400,
        {
          templateId: error.templateId,
          message: error.message,
        },
      )
    }
    const template = templateValidation.template
    console.log(
      `📋 [DEPLOY API] Request: domain=${body.domain} → normalized: ${domain}, template: ${template.template_id}`,
    )

    // Check if site already exists
    const sitePath = `${PATHS.SITES_ROOT}/${domain}`
    const siteExists = existsSync(sitePath)

    if (siteExists) {
      console.log(`⚠️  [DEPLOY API] Site already exists at: ${sitePath}`)
    } else {
      console.log(`📁 [DEPLOY API] Creating new site at: ${sitePath}`)
    }

    // Execute deployment script (SECURE: uses systemd isolation)
    const deployResult = await deploySite({
      domain,
      email: user.email, // User email (authenticated)
      orgId, // Organization to deploy to
      templatePath: template.source_path, // Template to copy from
    })

    // Register domain in Supabase with deployment info
    console.log("📝 [DEPLOY API] Registering domain in database...")
    try {
      await registerDomain({
        hostname: domain,
        email: user.email,
        port: deployResult.port,
        orgId,
      })
      console.log("✅ [DEPLOY API] Domain registered successfully")
    } catch (registrationError) {
      if (registrationError instanceof DomainRegistrationError) {
        console.error(`⚠️  [DEPLOY API] Domain registration warning: ${registrationError.message}`)
        // Don't fail deployment if registration fails - infrastructure is up
      } else {
        throw registrationError
      }
    }

    // Wait for SSL certificate to be provisioned and validate deployment
    console.log(`🔒 [DEPLOY API] Validating SSL certificate for ${domain}...`)

    const sslValidation = await validateSSLCertificate(domain)

    const duration = Date.now() - startTime

    if (sslValidation.success) {
      console.log(`✅ [DEPLOY API] Deployment completed successfully in ${duration}ms`)
      return NextResponse.json({
        ok: true,
        message: `Site ${domain} deployed successfully with SSL certificate`,
        domain,
        orgId,
      } as DeployResponse)
    }
    console.warn(`⚠️  [DEPLOY API] Deployment completed but SSL validation failed: ${sslValidation.error}`)
    return NextResponse.json({
      ok: true, // Deployment itself succeeded
      message: `Site ${domain} deployed but SSL certificate is still being provisioned. Try again in 30-60 seconds.`,
      domain,
      orgId,
      errors: [sslValidation.error],
    } as DeployResponse)
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    console.error(`💥 [DEPLOY API] Error after ${duration}ms:`, error)

    let errorMessage = "Deployment failed"
    let statusCode = 500

    // Handle typed DeploymentError from site-controller (no string matching!)
    if (error instanceof DeploymentError) {
      statusCode = error.statusCode
      switch (error.code) {
        case "DNS_VALIDATION_FAILED":
          errorMessage = `${error.message}. Please ensure your domain points to ${DEFAULTS.SERVER_IP}. See DNS setup guide: ${DOMAINS.BRIDGE_PROD}/docs/dns-setup`
          break
        case "INVALID_DOMAIN":
        case "PATH_TRAVERSAL":
        case "SITE_EXISTS":
          errorMessage = error.message
          break
        default:
          errorMessage = `Deployment failed: ${error.message}`
      }
    } else if (error instanceof DomainRegistrationError) {
      errorMessage = error.message
      // Map common error codes to HTTP status codes
      statusCode = error.errorCode === "DOMAIN_ALREADY_EXISTS" ? 409 : 400
    } else if (error && typeof error === "object" && "code" in error && error.code === "ETIMEDOUT") {
      errorMessage = "Deployment timed out (5 minutes)"
      statusCode = 408
    } else if (error instanceof Error) {
      errorMessage = `Deployment failed: ${error.message}`
    }

    return NextResponse.json(
      {
        ok: false,
        message: errorMessage,
        errors: process.env.NODE_ENV === "development" ? [String(error)] : undefined,
      } as DeployResponse,
      { status: statusCode },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Deploy API is running",
    usage: 'POST with { "domain": "example.com" }',
    endpoints: {
      deploy: "POST /api/deploy",
    },
    documentation: {
      manual_guide: `${PATHS.TEMPLATE_PATH}/DEPLOYMENT.md`,
      web_interface: `${DOMAINS.BRIDGE_PROD}/deploy`,
    },
  })
}
