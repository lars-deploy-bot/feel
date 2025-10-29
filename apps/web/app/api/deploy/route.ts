import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"
import { normalizeAndValidateDomain } from "../../../lib/domain-utils"

const execAsync = promisify(exec)

interface DeployRequest {
  domain: string
  password: string
}

interface DeployResponse {
  success: boolean
  message: string
  domain?: string
  errors?: string[]
}

async function validateSSLCertificate(domain: string): Promise<{ success: boolean; error?: string }> {
  const maxAttempts = 6 // Try for up to 60 seconds
  const delayMs = 10000 // 10 seconds between attempts

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔍 [SSL CHECK] Attempt ${attempt}/${maxAttempts} for ${domain}`)

      // Test HTTPS connection
      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000), // 10 second timeout per request
      })

      if (response.ok || response.status === 404) {
        // 404 is fine - means we reached the site but it's empty/not found
        // The important thing is we got a valid SSL connection
        console.log(`✅ [SSL CHECK] Valid SSL certificate for ${domain} (status: ${response.status})`)
        return { success: true }
      }

      console.log(`⚠️  [SSL CHECK] Unexpected status ${response.status} for ${domain}`)
    } catch (error: any) {
      console.log(`❌ [SSL CHECK] Attempt ${attempt} failed: ${error.message}`)

      if (error.name === "TimeoutError" || error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        // These are expected during certificate provisioning
      } else if (
        error.message?.includes("certificate") ||
        error.message?.includes("SSL") ||
        error.message?.includes("TLS")
      ) {
        // SSL-related error - certificate likely still being provisioned
      } else {
        // Unexpected error
        console.error(`🚨 [SSL CHECK] Unexpected error: ${error}`)
      }
    }

    if (attempt < maxAttempts) {
      console.log(`⏱️  [SSL CHECK] Waiting ${delayMs / 1000}s before next attempt...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: false,
    error: `SSL certificate not ready after ${(maxAttempts * delayMs) / 1000} seconds. Certificate provisioning may still be in progress.`,
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("🚀 [DEPLOY API] Request received")

  let domain = "unknown domain" // Initialize domain outside try block for error handling

  try {
    // Parse request body
    let body: DeployRequest
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ [DEPLOY API] Failed to parse request JSON:", parseError)
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON in request body",
        } as DeployResponse,
        { status: 400 },
      )
    }
    // Normalize and validate domain
    const domainResult = normalizeAndValidateDomain(body.domain)
    if (!domainResult.isValid) {
      console.error(`❌ [DEPLOY API] Domain validation failed: ${domainResult.error}`)
      return NextResponse.json(
        {
          success: false,
          message: domainResult.error || "Invalid domain",
        } as DeployResponse,
        { status: 400 },
      )
    }

    domain = domainResult.domain // Use normalized domain

    // Validate password
    if (!body.password) {
      console.error(`❌ [DEPLOY API] Password is required`)
      return NextResponse.json(
        {
          success: false,
          message: "Password is required",
        } as DeployResponse,
        { status: 400 },
      )
    }

    if (body.password.length < 6 || body.password.length > 16) {
      console.error(`❌ [DEPLOY API] Password length validation failed`)
      return NextResponse.json(
        {
          success: false,
          message: "Password must be between 6 and 16 characters",
        } as DeployResponse,
        { status: 400 },
      )
    }

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
    const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh"
    const deployCommand = `bash ${scriptPath} ${domain}`

    console.log(`⚡ [DEPLOY API] Executing: ${deployCommand}`)

    // Pass password via environment variable (safer than command line argument)
    const { stdout, stderr } = await execAsync(deployCommand, {
      timeout: 300000, // 5 minutes timeout
      cwd: "/root/webalive/claude-bridge",
      env: {
        ...process.env,
        DEPLOY_PASSWORD: body.password,
      },
    })

    // Log output
    if (stdout) {
      console.log(`📤 [DEPLOY API] STDOUT:\n${stdout}`)
    }
    if (stderr) {
      console.warn(`⚠️  [DEPLOY API] STDERR:\n${stderr}`)
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
      } as DeployResponse)
    }
    console.warn(`⚠️  [DEPLOY API] Deployment completed but SSL validation failed: ${sslValidation.error}`)
    return NextResponse.json({
      success: true, // Deployment itself succeeded
      message: `Site ${domain} deployed but SSL certificate is still being provisioned. Try again in 30-60 seconds.`,
      domain,
      errors: [sslValidation.error],
    } as DeployResponse)
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`💥 [DEPLOY API] Error after ${duration}ms:`, error)

    // Parse different error types
    let errorMessage = "Deployment failed"
    let statusCode = 500

    if (error.code === "ETIMEDOUT") {
      errorMessage = "Deployment timed out (5 minutes)"
      statusCode = 408
    } else if (error.code === 2) {
      errorMessage = "Invalid arguments provided to deployment script"
      statusCode = 400
    } else if (error.code === 3) {
      errorMessage = "Template directory not found - server configuration issue"
      statusCode = 500
    } else if (error.code === 4) {
      errorMessage = "Config generator not found - this site template is missing required scripts"
      statusCode = 500
    } else if (error.code === 5) {
      errorMessage = "Ecosystem config generation failed - deployment incomplete"
      statusCode = 500
    } else if (error.code === 6) {
      errorMessage = "Invalid ecosystem config - would cause PM2 crashes (missing bun script)"
      statusCode = 500
    } else if (error.code === 7) {
      errorMessage = "Dangerous ecosystem config - contains bash references that would crash the system"
      statusCode = 500
    } else if (error.code === 8) {
      errorMessage = "PM2 process failed to start"
      statusCode = 500
    } else if (error.code === 9) {
      errorMessage = "PM2 process not online after startup"
      statusCode = 500
    } else if (error.code === 10) {
      errorMessage = "PM2 process using wrong interpreter (bash instead of bun) - deployment blocked for safety"
      statusCode = 500
    } else if (error.code === 11) {
      errorMessage = "Site already exists. Remove it first or use update commands."
      statusCode = 409 // Conflict
    } else if (error.code === 12) {
      // Check if the error message contains Cloudflare proxy detection
      if (error.stderr && error.stderr.includes("CLOUDFLARE PROXY DETECTED")) {
        errorMessage =
          "🚨 Cloudflare proxy detected! You must disable the orange cloud (proxy) in your Cloudflare DNS settings. Make the cloud icon GRAY (not orange) next to your A record, then try again. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
      } else if (error.stderr && error.stderr.includes("No A record found")) {
        errorMessage = `DNS Error: No A record found for ${domain}. You must create an A record with these settings: Type=A, Name/Host=@ (or ${domain}), Value/Points to=138.201.56.93, TTL=300. ALSO: Remove any AAAA records (IPv6) for ${domain}. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup`
      } else {
        errorMessage = `DNS Error: ${domain} does not point to our server (138.201.56.93). You need to update your A record with these settings: Type=A, Name/Host=@ (or ${domain}), Value/Points to=138.201.56.93, TTL=300. ALSO: Remove any AAAA records (IPv6) for ${domain}. See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup`
      }
      statusCode = 400
    } else if (error.stderr) {
      errorMessage = `Script error: ${error.stderr.slice(0, 500)}`
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        errors: [error.toString()],
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
