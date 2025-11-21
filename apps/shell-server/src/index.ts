import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import cookie from "cookie"
import { randomBytes } from "node:crypto"
import * as pty from "node-pty"
import { readFileSync, writeFileSync, existsSync, writeFile, mkdirSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import AdmZip from "adm-zip"
import { PATHS } from "@webalive/site-controller"

// Load configuration
const configPath = join(__dirname, "..", "config.json")
const config = JSON.parse(readFileSync(configPath, "utf-8"))
const env = process.env.NODE_ENV || "development"
const envConfig = config[env] || config.development

// Resolve defaultCwd (relative paths use process.cwd() as base)
const resolvedDefaultCwd = envConfig.defaultCwd.startsWith("/")
  ? envConfig.defaultCwd
  : join(process.cwd(), envConfig.defaultCwd)

// In development, ensure the workspace directory exists
if (env === "development") {
  if (!existsSync(resolvedDefaultCwd)) {
    console.log(`[CONFIG] Creating development workspace: ${resolvedDefaultCwd}`)
    mkdirSync(resolvedDefaultCwd, { recursive: true })

    // Create README to explain the directory
    const readmeContent = `# Local Development Workspace

This directory is your local shell-server workspace for development.

- Auto-created by shell-server on first run
- Gitignored (won't be committed)
- Isolated from production infrastructure
- Safe to experiment with files and scripts

When you run "make shell" and access the terminal, this is your working directory.
`
    writeFileSync(join(resolvedDefaultCwd, "README.md"), readmeContent, "utf-8")
  }
}

console.log(`[CONFIG] Environment: ${env}`)
console.log(`[CONFIG] Port: ${envConfig.port}`)
console.log(`[CONFIG] Default workspace: ${resolvedDefaultCwd}`)
console.log(`[CONFIG] Workspace selection: ${envConfig.allowWorkspaceSelection ? "enabled" : "disabled"}`)

// Load HTML templates
const templatesDir = join(__dirname, "templates")
const loginTemplate = readFileSync(join(templatesDir, "login.html"), "utf-8")
const dashboardTemplate = readFileSync(join(templatesDir, "dashboard.html"), "utf-8")
const shellTemplate = readFileSync(join(templatesDir, "shell.html"), "utf-8")
const uploadTemplate = readFileSync(join(templatesDir, "upload.html"), "utf-8")

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

const port = parseInt(process.env.PORT || envConfig.port.toString(), 10)
const SHELL_PASSWORD = process.env.SHELL_PASSWORD

console.log(`[DEBUG] PORT env var: ${process.env.PORT}, parsed port: ${port}`)

if (!SHELL_PASSWORD) {
  console.error("❌ SHELL_PASSWORD environment variable is required")
  process.exit(1)
}

// Session store (in-memory for now)
const sessions = new Set<string>()

// Rate limiting: Track all failed login attempts globally (timeframe-based)
// Persisted to disk to survive restarts
const RATE_LIMIT_FILE = join(process.cwd(), ".rate-limit-state.json")

interface RateLimitState {
  failedAttempts: number[]
  lockedUntil: number | null
}

// Rate limiting configuration
const MAX_ATTEMPTS = 40 // Max failed attempts before lockout
const ATTEMPT_WINDOW = 10 * 60 * 1000 // 10 minute sliding window
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minute lockout after max attempts

// Load or initialize rate limit state
function loadRateLimitState(): RateLimitState {
  try {
    if (existsSync(RATE_LIMIT_FILE)) {
      const data = readFileSync(RATE_LIMIT_FILE, "utf-8")
      const state = JSON.parse(data) as RateLimitState
      console.log(`[SECURITY] Loaded rate limit state: ${state.failedAttempts.length} attempts, locked until: ${state.lockedUntil ? new Date(state.lockedUntil).toISOString() : "not locked"}`)
      return state
    }
  } catch (err) {
    console.error("[SECURITY] Failed to load rate limit state:", err)
  }

  console.log("[SECURITY] Initialized new rate limit state")
  return { failedAttempts: [], lockedUntil: null }
}

// Save rate limit state to disk
function saveRateLimitState(state: RateLimitState): void {
  try {
    writeFileSync(RATE_LIMIT_FILE, JSON.stringify(state, null, 2), "utf-8")
  } catch (err) {
    console.error("[SECURITY] Failed to save rate limit state:", err)
  }
}

// Initialize state from disk
const rateLimitState = loadRateLimitState()
const failedAttempts: number[] = rateLimitState.failedAttempts
let lockedUntil: number | null = rateLimitState.lockedUntil

// Cleanup old failed attempts periodically (every 2 minutes)
setInterval(() => {
  const now = Date.now()
  const cutoff = now - ATTEMPT_WINDOW
  const beforeLength = failedAttempts.length

  // Remove attempts older than the window
  while (failedAttempts.length > 0 && failedAttempts[0] < cutoff) {
    failedAttempts.shift()
  }

  // Persist to disk if cleaned up any attempts
  if (beforeLength !== failedAttempts.length) {
    saveRateLimitState({ failedAttempts, lockedUntil })
    console.log(`[SECURITY] Cleaned up ${beforeLength - failedAttempts.length} old attempts`)
  }
}, 2 * 60 * 1000)

// Check if system is rate limited
function isRateLimited(): { limited: boolean; waitTime?: number; attemptsRemaining?: number } {
  const now = Date.now()

  // Check if we're in lockout period
  if (lockedUntil && now < lockedUntil) {
    const waitTime = Math.ceil((lockedUntil - now) / 1000 / 60)
    return { limited: true, waitTime }
  } else if (lockedUntil && now >= lockedUntil) {
    // Lockout expired
    lockedUntil = null
    failedAttempts.length = 0 // Clear all attempts
    saveRateLimitState({ failedAttempts, lockedUntil })
    console.log("[SECURITY] Lockout period expired - rate limit reset")
  }

  // Count attempts in current window
  const cutoff = now - ATTEMPT_WINDOW
  const recentAttempts = failedAttempts.filter(timestamp => timestamp >= cutoff)

  // Update array to only keep recent attempts
  failedAttempts.length = 0
  failedAttempts.push(...recentAttempts)

  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts.length

  if (failedAttempts.length >= MAX_ATTEMPTS) {
    // Trigger lockout
    lockedUntil = now + LOCKOUT_DURATION
    const waitTime = Math.ceil(LOCKOUT_DURATION / 1000 / 60)
    saveRateLimitState({ failedAttempts, lockedUntil })
    console.log(`[SECURITY] LOCKOUT TRIGGERED - ${waitTime} minutes`)
    return { limited: true, waitTime }
  }

  return { limited: false, attemptsRemaining }
}

// Record failed login attempt
function recordFailedAttempt(): void {
  const now = Date.now()
  failedAttempts.push(now)

  const remaining = MAX_ATTEMPTS - failedAttempts.length
  console.log(`[SECURITY] Failed login attempt (${failedAttempts.length}/${MAX_ATTEMPTS}, ${remaining} remaining)`)

  // Persist to disk immediately
  saveRateLimitState({ failedAttempts, lockedUntil })
}

// Clear failed attempts on successful login
function clearFailedAttempts(): void {
  failedAttempts.length = 0
  lockedUntil = null
  console.log("[SECURITY] Successful login - rate limit reset")

  // Persist to disk immediately
  saveRateLimitState({ failedAttempts, lockedUntil })
}

// Generate session token
function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

// Login page
app.get("/", (c) => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  // If already authenticated, redirect to dashboard
  if (cookies.shell_session && sessions.has(cookies.shell_session)) {
    return c.redirect("/dashboard")
  }

  // Get error message
  const error = c.req.query("error")
  const wait = c.req.query("wait")
  const remaining = c.req.query("remaining")
  let errorMessage = ""

  if (error === "rate_limit") {
    errorMessage = `Too many failed attempts. Please wait ${wait || "15"} minutes.`
  } else if (error === "invalid") {
    if (remaining) {
      errorMessage = `Invalid password (${remaining} attempts remaining)`
    } else {
      errorMessage = "Invalid password"
    }
  }

  const html = loginTemplate.replace(
    "{{ERROR_MESSAGE}}",
    errorMessage ? `<p class="error">${errorMessage}</p>` : ""
  )
  return c.html(html)
})

// Login handler
app.post("/login", async (c) => {
  // Check global rate limiting
  const rateLimitCheck = isRateLimited()
  if (rateLimitCheck.limited) {
    console.log(`[SECURITY] Rate limit active - login blocked`)
    return c.redirect(`/?error=rate_limit&wait=${rateLimitCheck.waitTime}`)
  }

  const body = await c.req.parseBody()
  const password = body.password

  if (password !== SHELL_PASSWORD) {
    recordFailedAttempt()
    const remaining = rateLimitCheck.attemptsRemaining ? rateLimitCheck.attemptsRemaining - 1 : MAX_ATTEMPTS - 1
    return c.redirect(`/?error=invalid&remaining=${remaining}`)
  }

  // Clear failed attempts on success
  clearFailedAttempts()

  // Create session
  const sessionToken = generateSessionToken()
  sessions.add(sessionToken)

  // Set cookie and redirect
  c.header(
    "Set-Cookie",
    cookie.serialize("shell_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })
  )

  return c.redirect("/dashboard")
})

// Dashboard - choose between shell or upload
app.get("/dashboard", (c) => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  // In production (allowWorkspaceSelection=false), redirect directly to shell with root workspace
  if (!envConfig.allowWorkspaceSelection) {
    return c.redirect(`/shell?workspace=${envConfig.defaultWorkspace}`)
  }

  return c.html(dashboardTemplate)
})

// Logout handler
app.get("/logout", (c) => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (cookies.shell_session) {
    sessions.delete(cookies.shell_session)
  }

  c.header(
    "Set-Cookie",
    cookie.serialize("shell_session", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    })
  )

  return c.redirect("/")
})

// Shell page (protected)
app.get("/shell", (c) => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  return c.html(shellTemplate)
})

// Upload page (protected)
app.get("/upload", (c) => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  const workspace = c.req.query("workspace") || "root"
  const html = uploadTemplate.replace(/\${workspace}/g, workspace)
  return c.html(html)
})

// Check directory API endpoint
app.post("/api/check-directory", async (c) => {
  // Check authentication
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"
    const targetDir = body.targetDir?.toString() || "./"

    // Validate workspace path using config
    const baseCwd =
      workspace !== "root"
        ? `${envConfig.workspaceBase.replace(PATHS.WEBALIVE_ROOT, PATHS.SITES_ROOT)}/${workspace}`
        : resolvedDefaultCwd

    // Resolve target directory
    const resolvedTarget = resolve(baseCwd, targetDir)
    if (!resolvedTarget.startsWith(baseCwd)) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    // Check if directory exists
    const exists = existsSync(resolvedTarget)

    return c.json({
      exists,
      path: resolvedTarget,
      message: exists
        ? `Directory exists: ${targetDir}`
        : `Directory does not exist: ${targetDir}`
    })
  } catch (err) {
    console.error("[CHECK] Directory check failed:", err)
    return c.json({ error: `Check failed: ${err}` }, 500)
  }
})

// Upload API endpoint
app.post("/api/upload", async (c) => {
  // Check authentication
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"
    const targetDir = body.targetDir?.toString() || "./"
    const file = body.file as File

    if (!file) {
      return c.json({ error: "No file provided" }, 400)
    }

    // File size limit (100MB)
    const MAX_UPLOAD_SIZE = 100 * 1024 * 1024
    if (file.size > MAX_UPLOAD_SIZE) {
      return c.json({ error: "File too large (max 100MB)" }, 400)
    }

    // Validate workspace path using config
    const baseCwd =
      workspace !== "root"
        ? `${envConfig.workspaceBase.replace(PATHS.WEBALIVE_ROOT, PATHS.SITES_ROOT)}/${workspace}`
        : resolvedDefaultCwd

    // Resolve and validate target directory
    const resolvedTarget = resolve(baseCwd, targetDir)
    if (!resolvedTarget.startsWith(baseCwd)) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    console.log(`[UPLOAD] Uploading to workspace: ${workspace}, target: ${resolvedTarget}`)

    // Save uploaded file temporarily
    const tempFile = `/tmp/upload-${Date.now()}-${randomBytes(8).toString("hex")}.zip`
    const buffer = await file.arrayBuffer()
    await new Promise<void>((resolve, reject) => {
      writeFile(tempFile, Buffer.from(buffer), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    try {
      // Extract ZIP
      const zip = new AdmZip(tempFile)
      const zipEntries = zip.getEntries()

      // Validate ZIP contents (prevent malicious filenames)
      for (const entry of zipEntries) {
        const entryPath = resolve(resolvedTarget, entry.entryName)
        if (!entryPath.startsWith(resolvedTarget)) {
          await rm(tempFile, { force: true })
          return c.json({ error: "Malicious ZIP detected (path traversal in archive)" }, 400)
        }
      }

      // Create target directory if it doesn't exist
      await mkdir(resolvedTarget, { recursive: true })

      // Extract all files
      zip.extractAllTo(resolvedTarget, true)

      console.log(`[UPLOAD] Successfully extracted ${zipEntries.length} files to ${resolvedTarget}`)

      // Clean up temp file
      await rm(tempFile, { force: true })

      return c.json({
        success: true,
        message: `Extracted ${zipEntries.length} files to ${targetDir}`,
        extractedTo: resolvedTarget,
        fileCount: zipEntries.length,
      })
    } catch (err) {
      await rm(tempFile, { force: true })
      console.error("[UPLOAD] Extraction failed:", err)
      return c.json({ error: `Extraction failed: ${err}` }, 500)
    }
  } catch (err) {
    console.error("[UPLOAD] Upload failed:", err)
    return c.json({ error: `Upload failed: ${err}` }, 500)
  }
})

// Health check
app.get("/health", (c) => c.json({ status: "ok" }))

// WebSocket endpoint for shell
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    // Check authentication
    const cookies = cookie.parse(c.req.header("cookie") || "")

    if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
      return {
        onOpen() {
          // Close immediately if not authenticated
        },
      }
    }

    const url = new URL(c.req.url)
    const workspace = url.searchParams.get("workspace") || "root"

    // Determine shell and working directory using config
    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash"
    const cwd =
      workspace !== "root"
        ? `${envConfig.workspaceBase.replace(PATHS.WEBALIVE_ROOT, PATHS.SITES_ROOT)}/${workspace}`
        : resolvedDefaultCwd

    let ptyProcess: pty.IPty | null = null

    return {
      async onOpen(_event, ws) {
        console.log("[WS] Connection opened, workspace:", workspace, "cwd:", cwd)
        try {
          console.log("[WS] Spawning PTY shell:", shell)

          // Spawn shell using node-pty for proper interactive shell
          ptyProcess = pty.spawn(shell, [], {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd,
            env: process.env as { [key: string]: string },
          })

          console.log("[WS] PTY spawned, PID:", ptyProcess.pid)
          ws.send(JSON.stringify({ type: "connected" }))
          console.log("[WS] Sent connected message")

          // Handle data from PTY
          ptyProcess.onData((data) => {
            ws.send(JSON.stringify({ type: "data", data }))
          })

          // Handle process exit
          ptyProcess.onExit(({ exitCode }) => {
            console.log("[WS] PTY exited with code:", exitCode)
            ws.send(JSON.stringify({ type: "exit", exitCode }))
            ws.close()
          })
        } catch (err) {
          console.error("Failed to spawn PTY:", err)
          ws.send(JSON.stringify({ type: "error", message: "Failed to start shell" }))
          ws.close()
        }
      },
      async onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString())

          if (message.type === "resize" && ptyProcess) {
            // Resize the PTY
            ptyProcess.resize(message.cols, message.rows)
          } else if (message.type === "input" && ptyProcess) {
            // Write input to PTY
            ptyProcess.write(message.data)
          }
        } catch (err) {
          console.error("Shell message error:", err)
        }
      },
      onClose() {
        if (ptyProcess) {
          ptyProcess.kill()
          ptyProcess = null
        }
      },
    }
  })
)

// Start server with WebSocket support
const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🖥️  Shell server running on http://localhost:${info.port}`)
  }
)

injectWebSocket(server)
