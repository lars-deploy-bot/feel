import { existsSync } from "node:fs"
import { type NextRequest, NextResponse } from "next/server"
import { validateDeploySubdomainRequest } from "@/features/deployment/types/guards"
import { buildSubdomain } from "@/lib/config"
import { deploySite } from "@/lib/deployment/deploy-site"
import { validateSSLCertificate } from "@/lib/deployment/ssl-validation"
import { siteMetadataStore } from "@/lib/siteMetadataStore"

interface DeploySubdomainResponse {
  ok: boolean
  message: string
  domain?: string
  chatUrl?: string
  error?: string
  details?: unknown
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("[Deploy-Subdomain] === DEPLOY SUBDOMAIN REQUEST START ===")

  try {
    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
      console.log("[Deploy-Subdomain] Request parsed")
    } catch (parseError) {
      console.error("[Deploy-Subdomain] Failed to parse JSON:", parseError)
      const errorResponse: DeploySubdomainResponse = {
        ok: false,
        message: "Invalid JSON in request body",
        error: "INVALID_JSON",
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Validate using Zod schema
    const parseResult = validateDeploySubdomainRequest(body)
    if (!parseResult.success) {
      console.error("[Deploy-Subdomain] Schema validation failed:", parseResult.error.issues)
      const firstError = parseResult.error.issues[0]
      const errorMessage = firstError ? `${firstError.path.join(".")}: ${firstError.message}` : "Invalid request"
      const validationError: DeploySubdomainResponse = {
        ok: false,
        message: errorMessage,
        error: "VALIDATION_ERROR",
      }
      return NextResponse.json(validationError, { status: 400 })
    }

    const { slug, email, siteIdeas, password } = parseResult.data

    // Build full domain from slug
    const fullDomain = buildSubdomain(slug)
    const workspacePath = `/srv/webalive/sites/${fullDomain}/user`

    console.log(`[Deploy-Subdomain] Full domain: ${fullDomain}`)
    console.log(`[Deploy-Subdomain] Workspace: ${workspacePath}`)

    // Check if slug already exists
    const slugExists = await siteMetadataStore.exists(slug)
    if (slugExists) {
      console.error(`[Deploy-Subdomain] Slug already exists: ${slug}`)
      const slugTakenError: DeploySubdomainResponse = {
        ok: false,
        message: `Subdomain "${slug}" is already taken. Choose a different name.`,
        error: "SLUG_TAKEN",
      }
      return NextResponse.json(slugTakenError, { status: 409 })
    }

    // Also check if directory exists (extra safety)
    const siteDir = `/srv/webalive/sites/${fullDomain}`
    if (existsSync(siteDir)) {
      console.error(`[Deploy-Subdomain] Site directory already exists: ${siteDir}`)
      const directoryExistsError: DeploySubdomainResponse = {
        ok: false,
        message: "Site directory already exists. Choose a different slug.",
        error: "SLUG_TAKEN",
      }
      return NextResponse.json(directoryExistsError, { status: 409 })
    }

    // Execute deployment script
    console.log("[Deploy-Subdomain] Starting deployment...")
    await deploySite({
      domain: fullDomain,
      password,
    })
    console.log("[Deploy-Subdomain] Deploy script completed")

    // Save metadata immediately after deployment completes
    console.log("[Deploy-Subdomain] Saving metadata...")
    await siteMetadataStore.setSite(slug, {
      slug,
      domain: fullDomain,
      workspace: fullDomain,
      email,
      siteIdeas,
      createdAt: Date.now(),
    })
    console.log("[Deploy-Subdomain] Metadata saved successfully")

    // Validate SSL certificate
    console.log("[Deploy-Subdomain] Validating SSL certificate...")
    const sslValidation = await validateSSLCertificate(fullDomain)

    if (!sslValidation.success) {
      console.warn(`[Deploy-Subdomain] SSL validation failed: ${sslValidation.error}`)
      // Still continue - deployment succeeded, cert might just be slow
    }

    const duration = Date.now() - startTime
    console.log(`[Deploy-Subdomain] Deployment completed successfully in ${duration}ms`)

    const sessionId = crypto.randomUUID()

    const response: DeploySubdomainResponse = {
      ok: true,
      message: `Site ${fullDomain} deployed successfully!`,
      domain: fullDomain,
      chatUrl: `/chat?slug=${slug}`,
    }

    const res = NextResponse.json(response, { status: 200 })

    res.cookies.set("session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })

    return res
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    console.error(`[Deploy-Subdomain] Error after ${duration}ms:`, error)

    let errorMessage = "Deployment failed"
    let statusCode = 500

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
