import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import path from "path"

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
  if (port && (isNaN(port) || port < 1024 || port > 65535)) {
    return "Port must be between 1024-65535"
  }
  return null
}

async function findAvailablePort(startPort: number = 3334): Promise<number> {
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

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log("🚀 [DEPLOY API] Request received")

  try {
    const body: DeployRequest = await request.json()
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

    // Execute deployment script
    const scriptPath = "/root/webalive/claude-bridge/scripts/deploy-site.sh"
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

    const duration = Date.now() - startTime
    console.log(`✅ [DEPLOY API] Deployment completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: `Site ${domain} deployed successfully`,
      domain,
      port,
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
    } else if (error.stderr) {
      errorMessage = `Script error: ${error.stderr.substring(0, 500)}`
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
  })
}
