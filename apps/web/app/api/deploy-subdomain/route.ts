import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"
import { siteMetadataStore } from "@/lib/siteMetadataStore"
import { validateDeploySubdomainRequest } from "@/types/guards/deploy-subdomain"

const execAsync = promisify(exec)

interface DeploySubdomainRequest {
  slug: string
  siteIdeas: string
  password: string
}

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
    } catch (error: any) {
      console.log(`[Deploy-Subdomain] SSL check attempt ${attempt} failed: ${error.message}`)

      if (
        error.name === "TimeoutError" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND"
      ) {
        // Expected during certificate provisioning
      } else if (
        error.message?.includes("certificate") ||
        error.message?.includes("SSL") ||
        error.message?.includes("TLS")
      ) {
        // SSL-related error
      } else {
        console.error(`[Deploy-Subdomain] Unexpected error: ${error}`)
      }
    }

    if (attempt < maxAttempts) {
      console.log(`[Deploy-Subdomain] Waiting ${delayMs / 1000}s before next attempt...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
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
    let body: any
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
    const WILDCARD_TLD = process.env.WILDCARD_TLD || "alive.best"
    const fullDomain = `${slug}.${WILDCARD_TLD}`
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
          message: `Site directory already exists. Choose a different slug.`,
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
        DEPLOY_PASSWORD: body.password,
      },
    })

    console.log(`[Deploy-Subdomain] Deploy script completed`)
    if (stdout) {
      console.log(`[Deploy-Subdomain] STDOUT:\n${stdout.substring(0, 500)}`)
    }
    if (stderr) {
      console.warn(`[Deploy-Subdomain] STDERR:\n${stderr.substring(0, 500)}`)
    }

    // Validate SSL certificate
    console.log(`[Deploy-Subdomain] Validating SSL certificate...`)
    const sslValidation = await validateSSLCertificate(fullDomain)

    if (!sslValidation.success) {
      console.warn(`[Deploy-Subdomain] SSL validation failed: ${sslValidation.error}`)
      // Still continue - deployment succeeded, cert might just be slow
    }

    // Save metadata
    console.log(`[Deploy-Subdomain] Saving metadata...`)
    await siteMetadataStore.setSite(slug, {
      slug,
      domain: fullDomain,
      workspace: workspacePath,
      siteIdeas,
      createdAt: Date.now(),
    })

    const duration = Date.now() - startTime
    console.log(`[Deploy-Subdomain] Deployment completed successfully in ${duration}ms`)

    const res = NextResponse.json(
      {
        ok: true,
        message: `Site ${fullDomain} deployed successfully! Initializing Claude assistant...`,
        domain: fullDomain,
        chatUrl: `/chat?slug=${slug}&autoStart=true`,
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
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Deploy-Subdomain] Error after ${duration}ms:`, error)

    let errorMessage = "Deployment failed"
    let statusCode = 500

    if (error.code === "ETIMEDOUT") {
      errorMessage = "Deployment timed out (5 minutes). Please try again."
      statusCode = 408
    } else if (error.code === 12) {
      errorMessage = "DNS validation failed. Please check your wildcard DNS setup."
      statusCode = 400
    } else if (error.stderr) {
      // Try to extract meaningful error from stderr
      if (error.stderr.includes("User.*already exists")) {
        errorMessage = "System user conflict. Slug might be partially deployed. Please try a different slug."
      } else if (error.stderr.includes("exists in Caddyfile")) {
        errorMessage = "Domain already exists in configuration. Please try a different slug."
      } else {
        errorMessage = `Deployment error: ${error.stderr.substring(0, 200)}`
      }
      statusCode = 400
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        ok: false,
        message: errorMessage,
        error: "DEPLOYMENT_FAILED",
        details: process.env.NODE_ENV === "development" ? error.toString() : undefined,
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
