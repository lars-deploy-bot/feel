import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"

const execAsync = promisify(exec)

interface DeployRequest {
  domain: string
  port?: number
}

interface DeployResponse {
  success: boolean
  message: string
  domain?: string
  port?: number
  errors?: string[]
}

function validateDomain(domain: string): string | null {
  if (!domain) return "Domain is required"
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return "Invalid domain format (e.g., example.com)"
  }
  return null
}

function validatePort(port: number): string | null {
  if (port && (Number.isNaN(port) || port < 1024 || port > 65535)) {
    return "Port must be between 1024-65535"
  }
  return null
}

async function findAvailablePort(startPort = 3334): Promise<number> {
  let port = startPort
  while (port <= 65535) {
    try {
      const { stdout } = await execAsync(`netstat -tuln | grep :${port}`)
      if (!stdout.trim()) {
        return port // Port is available
      }
    } catch (error) {
      // netstat failed or no match found - port is likely available
      return port
    }
    port++
  }
  throw new Error("No available ports found")
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
    const { domain, port: requestedPort } = body

    console.log(`📋 [DEPLOY API] Request: domain=${domain}, port=${requestedPort}`)

    // Validation
    const domainError = validateDomain(domain)
    if (domainError) {
      console.error(`❌ [DEPLOY API] Domain validation failed: ${domainError}`)
      return NextResponse.json(
        {
          success: false,
          message: domainError,
        } as DeployResponse,
        { status: 400 },
      )
    }

    if (requestedPort) {
      const portError = validatePort(requestedPort)
      if (portError) {
        console.error(`❌ [DEPLOY API] Port validation failed: ${portError}`)
        return NextResponse.json(
          {
            success: false,
            message: portError,
          } as DeployResponse,
          { status: 400 },
        )
      }
    }

    // Check if site already exists
    const sitePath = `/root/webalive/sites/${domain}`
    const siteExists = existsSync(sitePath)

    if (siteExists) {
      console.log(`⚠️  [DEPLOY API] Site already exists at: ${sitePath}`)
    } else {
      console.log(`📁 [DEPLOY API] Creating new site at: ${sitePath}`)
    }

    // Find available port
    const port = requestedPort || (await findAvailablePort())
    console.log(`🔍 [DEPLOY API] Using port: ${port}`)

    // Execute deployment script (SECURE: uses systemd isolation)
    const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh"
    const deployCommand = `bash ${scriptPath} ${domain}`

    console.log(`⚡ [DEPLOY API] Executing: ${deployCommand}`)

    const { stdout, stderr } = await execAsync(deployCommand, {
      timeout: 300000, // 5 minutes timeout
      cwd: "/root/webalive/claude-bridge",
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
        port,
      } as DeployResponse)
    }
    console.warn(`⚠️  [DEPLOY API] Deployment completed but SSL validation failed: ${sslValidation.error}`)
    return NextResponse.json({
      success: true, // Deployment itself succeeded
      message: `Site ${domain} deployed but SSL certificate is still being provisioned. Try again in 30-60 seconds.`,
      domain,
      port,
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
      errorMessage =
        "DNS validation failed - domain must point to this server (138.201.56.93). See DNS setup guide: https://terminal.goalive.nl/docs/dns-setup"
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
    usage: 'POST with { "domain": "example.com", "port": 3334 }',
    endpoints: {
      deploy: "POST /api/deploy",
    },
    documentation: {
      manual_guide: "/root/webalive/sites/template/DEPLOYMENT.md",
      web_interface: "https://terminal.goalive.nl/deploy",
    },
  })
}
