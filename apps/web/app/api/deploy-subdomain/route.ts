import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"
import { validateDeploySubdomainRequest } from "@/features/deployment/types/guards"
import { buildSubdomain } from "@/lib/config"
import { siteMetadataStore } from "@/lib/siteMetadataStore"

const execAsync = promisify(exec)

interface DeploySubdomainResponse {
  ok: boolean
  message: string
  domain?: string
  chatUrl?: string
  error?: string
  details?: unknown
}

async function validateSSLCertificate(domain: string): Promise<{ success: boolean; error?: string }> {
  const maxAttempts = 6
  const delayMs = 10000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Deploy-Subdomain] SSL Check attempt ${attempt}/${maxAttempts} for ${domain}`)

      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
      })

      if (response.ok || response.status === 404) {
        console.log(`[Deploy-Subdomain] SSL certificate valid for ${domain}`)
        return { success: true }
      }

      console.log(`[Deploy-Subdomain] Unexpected status ${response.status}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`[Deploy-Subdomain] SSL check attempt ${attempt} failed: ${errorMessage}`)

      const isNodeError = error instanceof Error && "code" in error
      const errorCode = isNodeError ? (error as Error & { code?: string }).code : undefined
      const isExpectedError =
        (error instanceof Error && error.name === "TimeoutError") ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ENOTFOUND" ||
        errorMessage.includes("certificate") ||
        errorMessage.includes("SSL") ||
        errorMessage.includes("TLS")

      if (!isExpectedError) {
        console.error(`[Deploy-Subdomain] Unexpected error: ${error}`)
      }
    }

    if (attempt < maxAttempts) {
      console.log(`[Deploy-Subdomain] Waiting ${delayMs / 1000}s before next attempt...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: false,
    error: `SSL certificate not ready after ${(maxAttempts * delayMs) / 1000} seconds`,
  }
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
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid JSON in request body",
          error: "INVALID_JSON",
        } as DeploySubdomainResponse,
        { status: 400 },
      )
    }

    // Validate using Zod schema
    const parseResult = validateDeploySubdomainRequest(body)
    if (!parseResult.success) {
      console.error("[Deploy-Subdomain] Schema validation failed:", parseResult.error.issues)
      const firstError = parseResult.error.issues[0]
      const errorMessage = firstError ? `${firstError.path.join(".")}: ${firstError.message}` : "Invalid request"
      return NextResponse.json(
        {
          ok: false,
          message: errorMessage,
          error: "VALIDATION_ERROR",
        } as DeploySubdomainResponse,
        { status: 400 },
      )
    }

    const { slug, siteIdeas, password } = parseResult.data

    // Build full domain from slug
    const fullDomain = buildSubdomain(slug)
    const workspacePath = `/srv/webalive/sites/${fullDomain}/user`

    console.log(`[Deploy-Subdomain] Full domain: ${fullDomain}`)
    console.log(`[Deploy-Subdomain] Workspace: ${workspacePath}`)

    // Check if slug already exists
    const slugExists = await siteMetadataStore.exists(slug)
    if (slugExists) {
      console.error(`[Deploy-Subdomain] Slug already exists: ${slug}`)
      return NextResponse.json(
        {
          ok: false,
          message: `Subdomain "${slug}" is already taken. Choose a different name.`,
          error: "SLUG_TAKEN",
        } as DeploySubdomainResponse,
        { status: 409 },
      )
    }

    // Also check if directory exists (extra safety)
    const siteDir = `/srv/webalive/sites/${fullDomain}`
    if (existsSync(siteDir)) {
      console.error(`[Deploy-Subdomain] Site directory already exists: ${siteDir}`)
      return NextResponse.json(
        {
          ok: false,
          message: "Site directory already exists. Choose a different slug.",
          error: "SLUG_TAKEN",
        } as DeploySubdomainResponse,
        { status: 409 },
      )
    }

    // Execute deployment script
    const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh"
    const deployCommand = `bash ${scriptPath} ${fullDomain}`

    console.log(`[Deploy-Subdomain] Executing: ${deployCommand}`)

    const { stdout, stderr } = await execAsync(deployCommand, {
      timeout: 300000, // 5 minutes
      cwd: "/root/webalive/claude-bridge",
      env: {
        ...process.env,
        DEPLOY_PASSWORD: password,
      },
    })

    console.log("[Deploy-Subdomain] Deploy script completed")
    if (stdout) {
      console.log(`[Deploy-Subdomain] STDOUT:\n${stdout.substring(0, 500)}`)
    }
    if (stderr) {
      console.warn(`[Deploy-Subdomain] STDERR:\n${stderr.substring(0, 500)}`)
    }

    // Validate SSL certificate
    console.log("[Deploy-Subdomain] Validating SSL certificate...")
    const sslValidation = await validateSSLCertificate(fullDomain)

    if (!sslValidation.success) {
      console.warn(`[Deploy-Subdomain] SSL validation failed: ${sslValidation.error}`)
      // Still continue - deployment succeeded, cert might just be slow
    }

    // Save metadata
    console.log("[Deploy-Subdomain] Saving metadata...")
    await siteMetadataStore.setSite(slug, {
      slug,
      domain: fullDomain,
      workspace: fullDomain, // Display-friendly workspace name (just the domain)
      siteIdeas,
      createdAt: Date.now(),
    })

    const duration = Date.now() - startTime
    console.log(`[Deploy-Subdomain] Deployment completed successfully in ${duration}ms`)

    const res = NextResponse.json(
      {
        ok: true,
        message: `Site ${fullDomain} deployed successfully!`,
        domain: fullDomain,
        chatUrl: `/chat?slug=${slug}`,
      } as DeploySubdomainResponse,
      { status: 200 },
    )

    // Set session cookie so user is authenticated when redirected to chat
    res.cookies.set("session", "1", {
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

    return NextResponse.json(
      {
        ok: false,
        message: errorMessage,
        error: "DEPLOYMENT_FAILED",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.toString()
              : String(error)
            : undefined,
      } as DeploySubdomainResponse,
      { status: statusCode },
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Deploy Subdomain API is running",
      usage: 'POST with { "slug": "mysite", "siteIdeas": "...", "password": "..." }',
      endpoints: {
        deploy: "POST /api/deploy-subdomain",
        getMetadata: "GET /api/sites/metadata?slug=mysite",
      },
    },
    { status: 200 },
  )
}
