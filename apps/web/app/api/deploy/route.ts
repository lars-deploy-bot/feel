import { existsSync } from "node:fs"
import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, requireSessionUser } from "@/features/auth/lib/auth"
import { normalizeAndValidateDomain } from "@/features/manager/lib/domain-utils"
import { deploySite } from "@/lib/deployment/deploy-site"
import { DomainRegistrationError, registerDomain } from "@/lib/deployment/domain-registry"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { validateSSLCertificate } from "@/lib/deployment/ssl-validation"
import { ErrorCodes } from "@/lib/error-codes"

interface DeployRequest {
  domain: string
  orgId: string // REQUIRED: Organization to deploy to (user must explicitly select)
}

interface DeployResponse {
  success: boolean
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

    console.log(`📋 [DEPLOY API] Request: domain=${body.domain} → normalized: ${domain}`)

    // Check if site already exists
    const sitePath = `/root/webalive/sites/${domain}`
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
      // Note: No password needed - user is already authenticated
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
        success: true,
        message: `Site ${domain} deployed successfully with SSL certificate`,
        domain,
        orgId,
      } as DeployResponse)
    }
    console.warn(`⚠️  [DEPLOY API] Deployment completed but SSL validation failed: ${sslValidation.error}`)
    return NextResponse.json({
      success: true, // Deployment itself succeeded
      message: `Site ${domain} deployed but SSL certificate is still being provisioned. Try again in 30-60 seconds.`,
      domain,
      orgId,
      errors: [sslValidation.error],
    } as DeployResponse)
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    console.error(`💥 [DEPLOY API] Error after ${duration}ms:`, error)

    // Parse different error types
    let errorMessage = "Deployment failed"
    let statusCode = 500

    const errorCode = error && typeof error === "object" && "code" in error ? error.code : null

    if (errorCode === "ETIMEDOUT") {
      errorMessage = "Deployment timed out (5 minutes)"
      statusCode = 408
    } else if (errorCode === 2) {
      errorMessage = "Invalid arguments provided to deployment script"
      statusCode = 400
    } else if (errorCode === 3) {
      errorMessage = "Template directory not found - server configuration issue"
      statusCode = 500
    } else if (errorCode === 4) {
      errorMessage = "Config generator not found - this site template is missing required scripts"
      statusCode = 500
    } else if (errorCode === 5) {
      errorMessage = "Ecosystem config generation failed - deployment incomplete"
      statusCode = 500
    } else if (errorCode === 6) {
      errorMessage = "Invalid ecosystem config - would cause PM2 crashes (missing bun script)"
      statusCode = 500
    } else if (errorCode === 7) {
      errorMessage = "Dangerous ecosystem config - contains bash references that would crash the system"
      statusCode = 500
    } else if (errorCode === 8) {
      errorMessage = "PM2 process failed to start"
      statusCode = 500
    } else if (errorCode === 9) {
      errorMessage = "PM2 process not online after startup"
      statusCode = 500
    } else if (errorCode === 10) {
      errorMessage = "PM2 process using wrong interpreter (bash instead of bun) - deployment blocked for safety"
      statusCode = 500
    } else if (errorCode === 11) {
      errorMessage = "Site already exists. Remove it first or use update commands."
      statusCode = 409 // Conflict
    } else if (errorCode === 12) {
      const errorStderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : ""
      // Check if the error message contains Cloudflare proxy detection
      if (errorStderr.includes("CLOUDFLARE PROXY DETECTED")) {
        errorMessage =
          "🚨 Cloudflare proxy detected! You must disable the orange cloud (proxy) in your Cloudflare DNS settings. Make the cloud icon GRAY (not orange) next to your A record, then try again. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
      } else if (errorStderr.includes("No A record found")) {
        errorMessage = `DNS Error: No A record found for ${domain}. You must create an A record with these settings: Type=A, Name/Host=@ (or ${domain}), Value/Points to=138.201.56.93, TTL=300. ALSO: Remove any AAAA records (IPv6) for ${domain}. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup`
      } else {
        errorMessage = `DNS Error: ${domain} does not point to our server (138.201.56.93). You need to update your A record with these settings: Type=A, Name/Host=@ (or ${domain}), Value/Points to=138.201.56.93, TTL=300. ALSO: Remove any AAAA records (IPv6) for ${domain}. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup`
      }
      statusCode = 400
    } else if (error && typeof error === "object" && "stderr" in error) {
      errorMessage = `Script error: ${String(error.stderr).slice(0, 500)}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        errors: [String(error)],
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
      manual_guide: "/root/webalive/claude-bridge/packages/template/DEPLOYMENT.md",
      web_interface: "https://terminal.goalive.nl/deploy",
    },
  })
}
