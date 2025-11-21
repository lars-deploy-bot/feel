import { existsSync } from "node:fs"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { validateDeploySubdomainRequest } from "@/features/deployment/types/guards"
import { structuredErrorResponse } from "@/lib/api/responses"
import { buildSubdomain } from "@/lib/config"
import { deploySite } from "@/lib/deployment/deploy-site"
import { DomainRegistrationError, registerDomain } from "@/lib/deployment/domain-registry"
import { validateUserOrgAccess } from "@/lib/deployment/org-resolver"
import { validateSSLCertificate } from "@/lib/deployment/ssl-validation"
import { type ErrorCode, ErrorCodes } from "@/lib/error-codes"
import { siteMetadataStore } from "@/lib/siteMetadataStore"
import { loadDomainPasswords } from "@/types/guards/api"

/**
 * Get port for domain from domain-passwords.json registry
 * This file is updated by the TypeScript deployment package during deployment
 * Uses loadDomainPasswords() which handles fallback paths correctly
 */
function getPortFromRegistry(domain: string): number | null {
  try {
    const registry = loadDomainPasswords()
    const entry = registry[domain]
    return entry?.port ?? null
  } catch {
    return null
  }
}

interface DeploySubdomainResponse {
  ok: boolean
  message: string
  domain?: string
  chatUrl?: string
  orgId?: string
  error?: ErrorCode
  details?: unknown
}

/**
 * Helper to create standardized error responses
 */
function errorResponse(message: string, errorCode: ErrorCode, status: number): [DeploySubdomainResponse, number] {
  return [{ ok: false, message, error: errorCode }, status]
}

export async function POST(request: NextRequest) {
  try {
    // Get user if authenticated (optional - allows anonymous deployments)
    const sessionUser = await getSessionUser()

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch (_parseError) {
      const [response, status] = errorResponse("Invalid JSON in request body", ErrorCodes.INVALID_JSON, 400)
      return NextResponse.json(response, { status })
    }

    // For anonymous users, require authentication (email/password) before validating full schema
    if (!sessionUser) {
      const bodyObj = body as Record<string, unknown>
      if (!bodyObj?.email || !bodyObj?.password) {
        const [response, status] = errorResponse(
          "Authentication required. Please provide email and password to create an account.",
          ErrorCodes.UNAUTHORIZED,
          401,
        )
        return NextResponse.json(response, { status })
      }
    }

    // Validate using Zod schema
    const parseResult = validateDeploySubdomainRequest(body)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      const errorMessage = firstError ? `${firstError.path.join(".")}: ${firstError.message}` : "Invalid request"
      const [response, status] = errorResponse(errorMessage, ErrorCodes.VALIDATION_ERROR, 400)
      return NextResponse.json(response, { status })
    }

    const { slug, siteIdeas, selectedTemplate, orgId, email, password } = parseResult.data

    // Ensure email is always a string (authenticated users get it from session, anonymous users must provide it)
    const deploymentEmail = sessionUser?.email || email
    if (!deploymentEmail) {
      // This should be caught earlier, but TypeScript needs the check
      const [response, status] = errorResponse("Email is required for deployment", ErrorCodes.VALIDATION_ERROR, 400)
      return NextResponse.json(response, { status })
    }

    // Validate user has access to specified organization (if provided)
    // If no orgId provided, a default org will be created for the user
    if (sessionUser && orgId) {
      const hasAccess = await validateUserOrgAccess(sessionUser.id, orgId)

      if (!hasAccess) {
        const [response, status] = errorResponse(
          "You do not have access to this organization",
          ErrorCodes.ORG_ACCESS_DENIED,
          403,
        )
        return NextResponse.json(response, { status })
      }
    }

    // Build full domain from slug
    const fullDomain = buildSubdomain(slug)

    // Check if slug already exists
    const slugExists = await siteMetadataStore.exists(slug)
    if (slugExists) {
      const [response, status] = errorResponse(
        `Subdomain "${slug}" is already taken. Choose a different name.`,
        ErrorCodes.SLUG_TAKEN,
        409,
      )
      return NextResponse.json(response, { status })
    }

    // Also check if directory exists (extra safety)
    const siteDir = `/srv/webalive/sites/${fullDomain}`
    if (existsSync(siteDir)) {
      const [response, status] = errorResponse(
        "Site directory already exists. Choose a different slug.",
        ErrorCodes.SLUG_TAKEN,
        409,
      )
      return NextResponse.json(response, { status })
    }

    // Execute deployment script (systemd + Caddy setup + port assignment)
    // The bash script handles port assignment and updates domain-passwords.json
    await deploySite({
      domain: fullDomain,
      email: deploymentEmail, // Guaranteed to be non-empty string
      password: sessionUser ? undefined : password, // Only pass password for new account creation
      orgId, // Pass organization ID
    })

    // Read the port that was assigned by the bash script
    const port = getPortFromRegistry(fullDomain)

    if (!port) {
      const [response, status] = errorResponse(
        "Deployment succeeded but port assignment could not be verified. Please contact support.",
        ErrorCodes.DEPLOYMENT_FAILED,
        500,
      )
      return NextResponse.json(response, { status })
    }

    // Register domain in Supabase (in request context, safe to use createIamClient)
    try {
      const registrationPassword = sessionUser ? undefined : password

      await registerDomain({
        hostname: fullDomain,
        email: deploymentEmail, // Use guaranteed non-empty email
        password: registrationPassword,
        port,
        orgId,
      })
    } catch (registrationError) {
      // DomainRegistrationError includes errorCode and details - use helper
      if (registrationError instanceof DomainRegistrationError) {
        return structuredErrorResponse(registrationError.errorCode, {
          status: 400,
          details: registrationError.details,
        })
      }

      // Fallback for unexpected errors
      throw registrationError
    }

    // Save metadata immediately after deployment completes
    await siteMetadataStore.setSite(slug, {
      slug,
      domain: fullDomain,
      workspace: fullDomain,
      email: deploymentEmail, // Use guaranteed non-empty email
      siteIdeas,
      selectedTemplate,
      createdAt: Date.now(),
    })

    // Validate SSL certificate
    await validateSSLCertificate(fullDomain)
    // Still continue if validation fails - deployment succeeded, cert might just be slow

    const sessionId = crypto.randomUUID()

    const response: DeploySubdomainResponse = {
      ok: true,
      message: `Site ${fullDomain} deployed successfully!`,
      domain: fullDomain,
      orgId,
      chatUrl: `/chat?slug=${slug}`,
    }

    const res = NextResponse.json(response, { status: 200 })

    res.cookies.set("auth_session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })

    return res
  } catch (error: unknown) {
    let errorMessage = "Deployment failed"
    let statusCode = 500

    // Check for authentication errors first
    if (error instanceof Error && error.message === "Authentication required") {
      errorMessage = "Authentication required"
      statusCode = 401
    } else {
      const isNodeError = error instanceof Error && "code" in error
      const errorCode = isNodeError ? (error as Error & { code?: string | number }).code : undefined
      const stderr = isNodeError && "stderr" in error ? (error as Error & { stderr?: string }).stderr : undefined

      if (errorCode === "ETIMEDOUT") {
        errorMessage = "Deployment timed out (5 minutes). Please try again."
        statusCode = 408
      } else if (errorCode === 12) {
        errorMessage = "DNS validation failed. Please check your wildcard DNS setup."
        statusCode = 400
      } else if (stderr) {
        if (stderr.includes("User.*already exists")) {
          errorMessage = "System user conflict. Slug might be partially deployed. Please try a different slug."
        } else if (stderr.includes("exists in Caddyfile")) {
          errorMessage = "Domain already exists in configuration. Please try a different slug."
        } else {
          errorMessage = `Deployment error: ${stderr.substring(0, 200)}`
        }
        statusCode = 400
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message
      }
    }

    const deploymentError: DeploySubdomainResponse = {
      ok: false,
      message: errorMessage,
      error: "DEPLOYMENT_FAILED",
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.toString()
            : String(error)
          : undefined,
    }
    return NextResponse.json(deploymentError, { status: statusCode })
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Deploy Subdomain API is running",
      usage: 'POST with { "slug": "mysite", "email": "you@example.com", "siteIdeas": "...", "password": "..." }',
      endpoints: {
        deploy: "POST /api/deploy-subdomain",
        getMetadata: "GET /api/sites/metadata?slug=mysite",
      },
    },
    { status: 200 },
  )
}
