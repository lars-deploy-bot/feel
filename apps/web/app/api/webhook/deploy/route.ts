import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

// Configuration
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ""
const DEPLOY_SCRIPT = path.join(process.cwd(), "../../scripts/build-and-serve.sh")
const LOG_DIR = path.join(process.cwd(), "../../logs")
const BRANCH = process.env.DEPLOY_BRANCH || "main" // Only deploy on this branch

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

/**
 * Verify GitHub webhook signature
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] No GITHUB_WEBHOOK_SECRET set, skipping verification")
    return true // Allow in development
  }

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET)
  const digest = `sha256=${hmac.update(payload).digest("hex")}`
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
}

/**
 * GitHub webhook handler for automatic deployments
 *
 * Setup:
 * 1. Go to GitHub repo → Settings → Webhooks → Add webhook
 * 2. Payload URL: https://your-domain.com/api/webhook/deploy
 * 3. Content type: application/json
 * 4. Secret: (generate random string, set as GITHUB_WEBHOOK_SECRET env var)
 * 5. Events: Just the push event
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const payload = await req.text()
    const signature = req.headers.get("x-hub-signature-256") || ""

    // Verify webhook signature
    if (!verifySignature(payload, signature)) {
      console.error("[WEBHOOK] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parse payload
    const body = JSON.parse(payload)
    const event = req.headers.get("x-github-event")

    // Only handle push events
    if (event !== "push") {
      return NextResponse.json({
        message: `Ignoring ${event} event`,
      })
    }

    // Extract branch from ref (refs/heads/main → main)
    const branch = body.ref?.replace("refs/heads/", "")
    const pusher = body.pusher?.name || "unknown"
    const commits = body.commits?.length || 0

    console.log(`[WEBHOOK] Push received: ${commits} commit(s) to ${branch} by ${pusher}`)

    // Only deploy on specified branch
    if (branch !== BRANCH) {
      console.log(`[WEBHOOK] Ignoring push to ${branch} (not ${BRANCH})`)
      return NextResponse.json({
        message: `Deployment skipped (branch: ${branch}, expected: ${BRANCH})`,
      })
    }

    // Trigger deployment in background
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const logFile = path.join(LOG_DIR, `deploy-${timestamp}.log`)
    const logStream = fs.createWriteStream(logFile)

    console.log(`[WEBHOOK] Starting deployment, logs: ${logFile}`)

    // Run deploy script (it handles git pull internally)
    const deployProcess = spawn("bash", [DEPLOY_SCRIPT], {
      detached: true, // Run independently
      stdio: ["ignore", "pipe", "pipe"],
    })

    // Capture output to log file
    deployProcess.stdout?.pipe(logStream)
    deployProcess.stderr?.pipe(logStream)

    // Don't wait for process to finish
    deployProcess.unref()

    deployProcess.on("exit", code => {
      const status = code === 0 ? "SUCCESS" : "FAILED"
      const message = `[WEBHOOK] Deployment ${status} (exit code: ${code})`
      console.log(message)
      logStream.write(`\n${message}\n`)
      logStream.end()
    })

    // Return immediately
    return NextResponse.json({
      message: "Deployment started",
      branch,
      commits,
      pusher,
      logFile: path.basename(logFile),
    })
  } catch (error) {
    console.error("[WEBHOOK] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint to check webhook status and recent deployments
 */
export async function GET() {
  try {
    // Read recent log files
    const logs = fs
      .readdirSync(LOG_DIR)
      .filter(f => f.startsWith("deploy-"))
      .sort()
      .reverse()
      .slice(0, 5)

    return NextResponse.json({
      configured: !!WEBHOOK_SECRET,
      branch: BRANCH,
      recentDeployments: logs,
      logDir: LOG_DIR,
    })
  } catch (error) {
    return NextResponse.json({
      configured: !!WEBHOOK_SECRET,
      branch: BRANCH,
      error: "Could not read deployment logs",
    })
  }
}
