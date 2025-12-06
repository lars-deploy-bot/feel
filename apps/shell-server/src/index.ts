import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import cookie from "cookie"
import { randomBytes } from "node:crypto"
import * as pty from "node-pty"
import {
  readFileSync,
  writeFileSync,
  existsSync,
  writeFile,
  mkdirSync,
  readdirSync,
  chmodSync,
  type Dirent,
} from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import AdmZip from "adm-zip"

// Get proper __dirname for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load configuration
const configPath = join(__dirname, "..", "config.json")
const config = JSON.parse(readFileSync(configPath, "utf-8"))
const env = process.env.NODE_ENV || "development"
const envConfig = config[env] || config.development

// Resolve defaultCwd (relative paths use process.cwd() as base)
const resolvedDefaultCwd = envConfig.defaultCwd.startsWith("/")
  ? envConfig.defaultCwd
  : join(process.cwd(), envConfig.defaultCwd)

// Resolve uploadDefaultCwd for file uploads
const resolvedUploadCwd = envConfig.uploadDefaultCwd?.startsWith("/")
  ? envConfig.uploadDefaultCwd
  : join(process.cwd(), envConfig.uploadDefaultCwd || envConfig.defaultCwd)

// Resolve sitesPath for website uploads
const resolvedSitesPath = envConfig.sitesPath?.startsWith("/")
  ? envConfig.sitesPath
  : join(process.cwd(), envConfig.sitesPath || "/srv/webalive/sites")

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
const editTemplate = readFileSync(join(templatesDir, "edit.html"), "utf-8")

// Editable directories configuration
// Each entry has an id, label, and absolute path
interface EditableDirectory {
  id: string
  label: string
  path: string
}

// __dirname in dist is apps/shell-server/dist, so we go up to claude-bridge root
const claudeBridgeRoot = resolve(__dirname, "..", "..", "..")

const EDITABLE_DIRECTORIES: EditableDirectory[] = [
  {
    id: "workflows",
    label: "Workflows",
    path: join(claudeBridgeRoot, "packages", "tools", "workflows"),
  },
  {
    id: "uploads",
    label: "Uploads",
    path: "/root/uploads",
  },
  {
    id: "sites",
    label: "Sites",
    path: resolvedSitesPath,
  },
]

// Validate editable directories exist
for (const dir of EDITABLE_DIRECTORIES) {
  if (existsSync(dir.path)) {
    console.log(`[EDIT] Editable directory: ${dir.label} -> ${dir.path}`)
  } else {
    console.warn(`[EDIT] Warning: Directory not found: ${dir.path}`)
  }
}

// Helper to get editable directory by ID
function getEditableDirectory(id: string): EditableDirectory | undefined {
  return EDITABLE_DIRECTORIES.find(d => d.id === id)
}

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

const port = parseInt(process.env.PORT || envConfig.port.toString(), 10)
const SHELL_PASSWORD = process.env.SHELL_PASSWORD

console.log(`[DEBUG] PORT env var: ${process.env.PORT}, parsed port: ${port}`)

if (!SHELL_PASSWORD) {
  console.error("❌ SHELL_PASSWORD environment variable is required")
  process.exit(1)
}

// Session store - persisted to disk to survive restarts
const SESSIONS_FILE = join(process.cwd(), ".sessions.json")

function loadSessions(): Set<string> {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, "utf-8")
      const arr = JSON.parse(data) as string[]
      console.log(`[SESSION] Loaded ${arr.length} sessions from disk`)
      return new Set(arr)
    }
  } catch (err) {
    console.error("[SESSION] Failed to load sessions:", err)
  }
  return new Set()
}

function saveSessions(): void {
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions]), "utf-8")
  } catch (err) {
    console.error("[SESSION] Failed to save sessions:", err)
  }
}

const sessions = loadSessions()

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
      console.log(
        `[SECURITY] Loaded rate limit state: ${state.failedAttempts.length} attempts, locked until: ${state.lockedUntil ? new Date(state.lockedUntil).toISOString() : "not locked"}`,
      )
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
setInterval(
  () => {
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
  },
  2 * 60 * 1000,
)

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
app.get("/", c => {
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

  const html = loginTemplate.replace("{{ERROR_MESSAGE}}", errorMessage ? `<p class="error">${errorMessage}</p>` : "")
  return c.html(html)
})

// Login handler
app.post("/login", async c => {
  // Check global rate limiting
  const rateLimitCheck = isRateLimited()
  if (rateLimitCheck.limited) {
    console.log("[SECURITY] Rate limit active - login blocked")
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
  saveSessions()

  // Set cookie and redirect
  c.header(
    "Set-Cookie",
    cookie.serialize("shell_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    }),
  )

  return c.redirect("/dashboard")
})

// Dashboard - choose between shell or upload
app.get("/dashboard", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  // In production (allowWorkspaceSelection=false), redirect directly to shell with root workspace
  if (!envConfig.allowWorkspaceSelection) {
    return c.redirect(`/shell?workspace=${envConfig.defaultWorkspace}`)
  }

  // Inject the default paths from config
  const html = dashboardTemplate
    .replace("{{SHELL_DEFAULT_PATH}}", resolvedDefaultCwd)
    .replace("{{UPLOAD_DEFAULT_PATH}}", resolvedUploadCwd)

  return c.html(html)
})

// Logout handler
app.get("/logout", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (cookies.shell_session) {
    sessions.delete(cookies.shell_session)
    saveSessions()
  }

  c.header(
    "Set-Cookie",
    cookie.serialize("shell_session", "", {
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    }),
  )

  return c.redirect("/")
})

// Shell page (protected)
app.get("/shell", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  // In production (no workspace selection), back button goes to logout
  // In development, back button goes to dashboard to select workspace
  const backUrl = envConfig.allowWorkspaceSelection ? "/dashboard" : "/logout"
  const backLabel = envConfig.allowWorkspaceSelection ? "Back" : "Exit"

  const html = shellTemplate.replace("{{BACK_URL}}", backUrl).replace("{{BACK_LABEL}}", backLabel)

  return c.html(html)
})

// Upload page (protected)
app.get("/upload", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  const workspace = c.req.query("workspace") || "root"
  // Resolve upload path based on workspace type
  let uploadPath: string
  if (workspace.startsWith("site:")) {
    const siteName = workspace.slice(5) // Remove "site:" prefix
    uploadPath = `${resolvedSitesPath}/${siteName}/user`
  } else if (workspace === "root") {
    uploadPath = resolvedUploadCwd
  } else {
    uploadPath = `${envConfig.workspaceBase}/${workspace}`
  }
  const html = uploadTemplate.replace(/\${workspace}/g, workspace).replace("{{UPLOAD_PATH}}", uploadPath)
  return c.html(html)
})

// Edit page (protected)
app.get("/edit", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")

  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.redirect("/")
  }

  // Generate directory list as JSON for the Preact app
  const directories = EDITABLE_DIRECTORIES.filter(dir => existsSync(dir.path)).map(dir => ({
    id: dir.id,
    label: dir.label,
  }))

  const html = editTemplate.replace("{{EDITABLE_DIRECTORIES}}", JSON.stringify(directories))
  return c.html(html)
})

// Check directory API endpoint
app.post("/api/check-directory", async c => {
  // Check authentication
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"
    const targetDir = body.targetDir?.toString() || "./"

    // Resolve base path based on workspace type
    let baseCwd: string
    if (workspace.startsWith("site:")) {
      const siteName = workspace.slice(5)
      baseCwd = `${resolvedSitesPath}/${siteName}/user`
    } else if (workspace === "root") {
      baseCwd = resolvedUploadCwd
    } else {
      baseCwd = `${resolvedSitesPath}/${workspace}`
    }

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
      message: exists ? `Directory exists: ${targetDir}` : `Directory does not exist: ${targetDir}`,
    })
  } catch (err) {
    console.error("[CHECK] Directory check failed:", err)
    return c.json({ error: `Check failed: ${err}` }, 500)
  }
})

// Upload API endpoint
app.post("/api/upload", async c => {
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

    // Resolve base path based on workspace type
    let baseCwd: string
    if (workspace.startsWith("site:")) {
      const siteName = workspace.slice(5)
      baseCwd = `${resolvedSitesPath}/${siteName}/user`
    } else if (workspace === "root") {
      baseCwd = resolvedUploadCwd
    } else {
      baseCwd = `${resolvedSitesPath}/${workspace}`
    }

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
      writeFile(tempFile, Buffer.from(buffer), err => {
        if (err) reject(err)
        else resolve()
      })
    })

    try {
      // Extract ZIP
      const zip = new AdmZip(tempFile)
      const zipEntries = zip.getEntries()

      // Validate ZIP contents (prevent malicious filenames)
      const rootItems = new Set<string>()
      for (const entry of zipEntries) {
        const entryPath = resolve(resolvedTarget, entry.entryName)
        if (!entryPath.startsWith(resolvedTarget)) {
          await rm(tempFile, { force: true })
          return c.json({ error: "Malicious ZIP detected (path traversal in archive)" }, 400)
        }
        const rootItem = entry.entryName.split("/")[0]
        if (rootItem) rootItems.add(rootItem)
      }

      // Check if any root-level items already exist
      const existingItems = [...rootItems].filter(item => existsSync(join(resolvedTarget, item)))
      if (existingItems.length > 0) {
        await rm(tempFile, { force: true })
        const { statSync } = await import("node:fs")
        const details = existingItems.map(item => {
          const fullPath = join(resolvedTarget, item)
          try {
            const stats = statSync(fullPath)
            return `${item} (${stats.isDirectory() ? "folder" : "file"}, ${stats.size} bytes) at ${fullPath}`
          } catch {
            return `${item} at ${fullPath}`
          }
        })
        return c.json(
          {
            error: "Cannot extract - items already exist in target",
            existingItems,
            details,
            targetDir: resolvedTarget,
            zipContents: [...rootItems],
            hint: "Delete existing items first or remove them from ZIP",
          },
          409,
        )
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
app.get("/health", c => c.json({ status: "ok" }))

// Serve client chunks (for Vite code splitting) - must come before /client/:file
app.get("/client/chunks/:file", async c => {
  const file = c.req.param("file")
  if (!file || file.includes("..")) {
    return c.text("Not found", 404)
  }
  const clientDir = join(__dirname, "client", "chunks")
  const filePath = join(clientDir, file)
  if (!existsSync(filePath)) {
    return c.text("Not found", 404)
  }
  const content = readFileSync(filePath, "utf-8")
  let contentType = "text/plain"
  if (file.endsWith(".js")) contentType = "application/javascript"
  return c.text(content, 200, { "Content-Type": contentType })
})

// Serve client bundle
app.get("/client/:file", async c => {
  const file = c.req.param("file")
  if (!file || file.includes("..")) {
    return c.text("Not found", 404)
  }
  const clientDir = join(__dirname, "client")
  const filePath = join(clientDir, file)
  if (!existsSync(filePath)) {
    return c.text("Not found", 404)
  }
  const content = readFileSync(filePath, "utf-8")
  let contentType = "text/plain"
  if (file.endsWith(".js")) contentType = "application/javascript"
  else if (file.endsWith(".css")) contentType = "text/css"
  return c.text(content, 200, { "Content-Type": contentType })
})

// API to list files in a directory (tree view)
app.post("/api/list-files", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"

    let basePath: string
    if (workspace.startsWith("site:")) {
      const siteName = workspace.slice(5)
      basePath = `${resolvedSitesPath}/${siteName}/user`
    } else if (workspace === "root") {
      basePath = resolvedUploadCwd
    } else {
      basePath = `${resolvedSitesPath}/${workspace}`
    }

    if (!existsSync(basePath)) {
      return c.json({ error: "Directory not found", path: basePath }, 404)
    }

    const excludeDirs = new Set(["node_modules", "dist", ".git", ".turbo"])
    const maxDepth = 4

    interface TreeNode {
      text: string
      icon: string
      state?: { opened: boolean }
      children?: TreeNode[]
      data?: { path: string; type: "file" | "directory" }
    }

    function buildTree(dirPath: string, relativePath = "", depth = 0): TreeNode[] {
      if (depth >= maxDepth) return []

      const entries = readdirSync(dirPath, { withFileTypes: true }) as Dirent[]
      const filtered = entries
        .filter(e => !excludeDirs.has(e.name))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

      return filtered.map(entry => {
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          const subPath = join(dirPath, entry.name)
          return {
            text: entry.name,
            icon: "jstree-folder",
            state: { opened: depth < 2 },
            data: { path: entryRelativePath, type: "directory" as const },
            children: buildTree(subPath, entryRelativePath, depth + 1),
          }
        }
        return {
          text: entry.name,
          icon: "jstree-file",
          data: { path: entryRelativePath, type: "file" as const },
        }
      })
    }

    const tree = buildTree(basePath)
    return c.json({ path: basePath, tree })
  } catch (err) {
    console.error("[API] Failed to list files:", err)
    return c.json({ error: "Failed to list files" }, 500)
  }
})

// API to read file contents (for preview)
app.post("/api/read-file", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"
    const filePath = body.path?.toString()

    if (!filePath) {
      return c.json({ error: "No file path provided" }, 400)
    }

    let basePath: string
    if (workspace.startsWith("site:")) {
      const siteName = workspace.slice(5)
      basePath = `${resolvedSitesPath}/${siteName}/user`
    } else if (workspace === "root") {
      basePath = resolvedUploadCwd
    } else {
      basePath = `${resolvedSitesPath}/${workspace}`
    }

    // Resolve and validate path
    const resolvedPath = resolve(basePath, filePath)
    if (!resolvedPath.startsWith(basePath)) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    if (!existsSync(resolvedPath)) {
      return c.json({ error: "File not found" }, 404)
    }

    // Check file size (limit to 1MB for preview)
    const { statSync } = await import("node:fs")
    const stats = statSync(resolvedPath)
    if (stats.size > 1024 * 1024) {
      return c.json({ error: "File too large for preview (max 1MB)", size: stats.size }, 413)
    }

    // Check if binary (simple heuristic)
    const binaryExtensions = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".ico",
      ".webp",
      ".bmp",
      ".svg",
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
      ".7z",
      ".mp3",
      ".mp4",
      ".wav",
      ".avi",
      ".mov",
      ".mkv",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".otf",
      ".node",
      ".wasm",
    ])
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."))
    if (binaryExtensions.has(ext)) {
      return c.json({ error: "Binary file cannot be previewed", binary: true, extension: ext }, 415)
    }

    const content = readFileSync(resolvedPath, "utf-8")
    const filename = filePath.split("/").pop() || filePath

    return c.json({ content, path: resolvedPath, filename, size: stats.size })
  } catch (err) {
    console.error("[API] Failed to read file:", err)
    return c.json({ error: "Failed to read file" }, 500)
  }
})

// API to delete a folder (restricted to safe paths only)
app.post("/api/delete-folder", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.parseBody()
    const workspace = body.workspace?.toString() || "root"
    const folderPath = body.path?.toString()

    if (!folderPath) {
      return c.json({ error: "No folder path provided" }, 400)
    }

    // Prevent deleting root-level paths
    if (folderPath === "" || folderPath === "/" || folderPath === ".") {
      return c.json({ error: "Cannot delete root directory" }, 400)
    }

    // SECURITY: Validate folderPath doesn't contain suspicious patterns
    if (folderPath.includes("..") || folderPath.startsWith("/")) {
      return c.json({ error: "Invalid path" }, 400)
    }

    let basePath: string
    let isRootWorkspace = false

    if (workspace.startsWith("site:")) {
      const siteName = workspace.slice(5)
      // SECURITY: Validate site name - must be alphanumeric with dots/hyphens only (domain-like)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(siteName)) {
        return c.json({ error: "Invalid site name" }, 400)
      }
      basePath = `${resolvedSitesPath}/${siteName}/user`
    } else if (workspace === "root") {
      basePath = resolvedUploadCwd
      isRootWorkspace = true
    } else {
      // SECURITY: Reject unknown workspace types
      return c.json({ error: "Invalid workspace" }, 400)
    }

    // Resolve and validate path
    const resolvedPath = resolve(basePath, folderPath)

    // SECURITY: Normalize basePath too for accurate comparison
    const normalizedBasePath = resolve(basePath)

    // Security check 1: Must be within normalized base path
    if (!resolvedPath.startsWith(normalizedBasePath + "/")) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    // Security check 2: For site workspaces, must be within sites directory AND not the /user folder itself
    if (!isRootWorkspace) {
      const normalizedSitesPath = resolve(resolvedSitesPath)
      if (!resolvedPath.startsWith(normalizedSitesPath + "/")) {
        return c.json({ error: "Path outside sites directory" }, 400)
      }
      if (resolvedPath === normalizedBasePath) {
        return c.json({ error: "Cannot delete the user directory itself" }, 400)
      }
    }

    // Security check 3: For root workspace, must be within /root/uploads
    if (isRootWorkspace) {
      const normalizedUploadCwd = resolve(resolvedUploadCwd)
      if (!resolvedPath.startsWith(normalizedUploadCwd + "/")) {
        return c.json({ error: "Can only delete folders within uploads directory" }, 400)
      }
    }

    // Check if path exists
    if (!existsSync(resolvedPath)) {
      return c.json({ error: "Path not found" }, 404)
    }

    const { statSync } = await import("node:fs")
    const stats = statSync(resolvedPath)
    const isDirectory = stats.isDirectory()

    // Delete the file or folder
    console.log(`[DELETE] Deleting ${isDirectory ? "folder" : "file"}: ${resolvedPath}`)
    await rm(resolvedPath, { recursive: true, force: true })

    console.log(`[DELETE] Successfully deleted: ${resolvedPath}`)
    return c.json({
      success: true,
      message: `Deleted ${isDirectory ? "folder" : "file"}: ${folderPath}`,
      deletedPath: resolvedPath,
      type: isDirectory ? "directory" : "file",
    })
  } catch (err) {
    console.error("[API] Failed to delete folder:", err)
    return c.json({ error: "Failed to delete folder" }, 500)
  }
})

// API to list available sites
app.get("/api/sites", c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const entries = readdirSync(resolvedSitesPath, { withFileTypes: true }) as Dirent[]

    const sites = entries
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .map(entry => entry.name)
      .filter(name => existsSync(join(resolvedSitesPath, name, "user")))
      .sort()

    return c.json({ sites, sitesPath: resolvedSitesPath })
  } catch (err) {
    console.error("[API] Failed to list sites:", err)
    return c.json({ error: "Failed to list sites" }, 500)
  }
})

// ============================================================================
// FILE EDITOR API ENDPOINTS
// ============================================================================

// API to list files in an editable directory
app.post("/api/edit/list-files", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    if (!existsSync(editableDir.path)) {
      return c.json({ error: "Directory not found", path: editableDir.path }, 404)
    }

    const excludeDirs = new Set(["node_modules", "dist", ".git", ".turbo", "__pycache__"])
    const maxDepth = 5

    interface EditTreeNode {
      name: string
      path: string
      type: "file" | "directory"
      children?: EditTreeNode[]
    }

    function buildEditTree(dirPath: string, relativePath = "", depth = 0): EditTreeNode[] {
      if (depth >= maxDepth) return []

      const entries = readdirSync(dirPath, { withFileTypes: true }) as Dirent[]
      const filtered = entries
        .filter(e => !excludeDirs.has(e.name) && !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })

      return filtered.map(entry => {
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          const subPath = join(dirPath, entry.name)
          return {
            name: entry.name,
            path: entryRelativePath,
            type: "directory" as const,
            children: buildEditTree(subPath, entryRelativePath, depth + 1),
          }
        }
        return {
          name: entry.name,
          path: entryRelativePath,
          type: "file" as const,
        }
      })
    }

    const tree = buildEditTree(editableDir.path)
    return c.json({ path: editableDir.path, label: editableDir.label, tree })
  } catch (err) {
    console.error("[EDIT API] Failed to list files:", err)
    return c.json({ error: "Failed to list files" }, 500)
  }
})

// API to read a file from an editable directory
app.post("/api/edit/read-file", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory
    const filePath = body.path

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    if (!filePath) {
      return c.json({ error: "No file path provided" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    // SECURITY: Validate path doesn't contain traversal
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return c.json({ error: "Invalid path" }, 400)
    }

    // Resolve and validate path
    const resolvedPath = resolve(editableDir.path, filePath)
    if (!resolvedPath.startsWith(editableDir.path)) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    if (!existsSync(resolvedPath)) {
      return c.json({ error: "File not found" }, 404)
    }

    // Check file size (limit to 2MB for editing)
    const { statSync } = await import("node:fs")
    const stats = statSync(resolvedPath)
    if (stats.size > 2 * 1024 * 1024) {
      return c.json({ error: "File too large for editing (max 2MB)", size: stats.size }, 413)
    }

    // Check file type
    const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".svg"])
    const binaryExtensions = new Set([
      ".pdf",
      ".zip",
      ".tar",
      ".gz",
      ".rar",
      ".7z",
      ".mp3",
      ".mp4",
      ".wav",
      ".avi",
      ".mov",
      ".mkv",
      ".exe",
      ".dll",
      ".so",
      ".dylib",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".otf",
      ".node",
      ".wasm",
    ])
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."))

    // Handle image files - return base64 encoded
    if (imageExtensions.has(ext)) {
      const imageData = readFileSync(resolvedPath)
      const base64 = imageData.toString("base64")
      const mimeType =
        ext === ".svg"
          ? "image/svg+xml"
          : ext === ".ico"
            ? "image/x-icon"
            : `image/${ext.slice(1).replace("jpg", "jpeg")}`

      console.log(`[EDIT API] Read image: ${resolvedPath} (${stats.size} bytes)`)
      return c.json({
        image: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
        path: resolvedPath,
        filename: filePath.split("/").pop() || filePath,
        size: stats.size,
        mtime: stats.mtimeMs,
      })
    }

    if (binaryExtensions.has(ext)) {
      return c.json({ error: "Binary file cannot be edited", binary: true, extension: ext }, 415)
    }

    const content = readFileSync(resolvedPath, "utf-8")
    const filename = filePath.split("/").pop() || filePath

    console.log(`[EDIT API] Read file: ${resolvedPath} (${stats.size} bytes)`)
    return c.json({ content, path: resolvedPath, filename, size: stats.size, mtime: stats.mtimeMs })
  } catch (err) {
    console.error("[EDIT API] Failed to read file:", err)
    return c.json({ error: "Failed to read file" }, 500)
  }
})

// API to check mtimes for multiple files (for auto-refresh on focus)
app.post("/api/edit/check-mtimes", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory
    const files: Array<{ path: string; mtime: number }> = body.files

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    if (!files || !Array.isArray(files)) {
      return c.json({ error: "No files specified" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    const { statSync } = await import("node:fs")
    const results: Array<{ path: string; changed: boolean; mtime: number; deleted?: boolean }> = []

    for (const file of files) {
      // SECURITY: Validate path doesn't contain traversal
      if (file.path.includes("..") || file.path.startsWith("/")) {
        continue
      }

      const resolvedPath = resolve(editableDir.path, file.path)
      if (!resolvedPath.startsWith(editableDir.path)) {
        continue
      }

      if (!existsSync(resolvedPath)) {
        results.push({ path: file.path, changed: true, mtime: 0, deleted: true })
        continue
      }

      try {
        const stats = statSync(resolvedPath)
        const currentMtime = stats.mtimeMs
        results.push({
          path: file.path,
          changed: currentMtime !== file.mtime,
          mtime: currentMtime,
        })
      } catch {
        results.push({ path: file.path, changed: true, mtime: 0, deleted: true })
      }
    }

    return c.json({ results })
  } catch (err) {
    console.error("[EDIT API] Failed to check mtimes:", err)
    return c.json({ error: "Failed to check mtimes" }, 500)
  }
})

// API to write a file to an editable directory
app.post("/api/edit/write-file", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory
    const filePath = body.path
    const content = body.content

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    if (!filePath) {
      return c.json({ error: "No file path provided" }, 400)
    }

    if (typeof content !== "string") {
      return c.json({ error: "No content provided" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    // SECURITY: Validate path doesn't contain traversal
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return c.json({ error: "Invalid path" }, 400)
    }

    // Resolve and validate path
    const resolvedPath = resolve(editableDir.path, filePath)
    if (!resolvedPath.startsWith(editableDir.path)) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    // Check content size (limit to 2MB)
    const contentSize = Buffer.byteLength(content, "utf-8")
    if (contentSize > 2 * 1024 * 1024) {
      return c.json({ error: "Content too large (max 2MB)", size: contentSize }, 413)
    }

    // Ensure parent directory exists
    const parentDir = dirname(resolvedPath)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    // Write the file with 644 permissions (rw-r--r--)
    writeFileSync(resolvedPath, content, { encoding: "utf-8", mode: 0o644 })
    // Ensure permissions are set correctly (in case file existed)
    chmodSync(resolvedPath, 0o644)

    // Get new mtime after write
    const { statSync } = await import("node:fs")
    const stats = statSync(resolvedPath)

    console.log(`[EDIT API] Wrote file: ${resolvedPath} (${contentSize} bytes, mode 644)`)
    return c.json({
      success: true,
      message: `Saved ${filePath}`,
      path: resolvedPath,
      size: contentSize,
      mtime: stats.mtimeMs,
    })
  } catch (err) {
    console.error("[EDIT API] Failed to write file:", err)
    return c.json({ error: "Failed to write file" }, 500)
  }
})

// API to delete a file or folder from an editable directory
app.post("/api/edit/delete", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory
    const itemPath = body.path

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    if (!itemPath) {
      return c.json({ error: "No path provided" }, 400)
    }

    // Prevent deleting root
    if (itemPath === "" || itemPath === "/" || itemPath === ".") {
      return c.json({ error: "Cannot delete root directory" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    // SECURITY: Validate path doesn't contain traversal
    if (itemPath.includes("..") || itemPath.startsWith("/")) {
      return c.json({ error: "Invalid path" }, 400)
    }

    // Resolve and validate path
    const resolvedPath = resolve(editableDir.path, itemPath)
    if (!resolvedPath.startsWith(editableDir.path + "/")) {
      return c.json({ error: "Path traversal detected" }, 400)
    }

    // Cannot delete the editable directory itself
    if (resolvedPath === editableDir.path) {
      return c.json({ error: "Cannot delete the root directory" }, 400)
    }

    if (!existsSync(resolvedPath)) {
      return c.json({ error: "Path not found" }, 404)
    }

    const { statSync } = await import("node:fs")
    const stats = statSync(resolvedPath)
    const isDirectory = stats.isDirectory()

    // Delete the file or folder
    console.log(`[EDIT API] Deleting ${isDirectory ? "folder" : "file"}: ${resolvedPath}`)
    await rm(resolvedPath, { recursive: true, force: true })

    console.log(`[EDIT API] Successfully deleted: ${resolvedPath}`)
    return c.json({
      success: true,
      message: `Deleted ${isDirectory ? "folder" : "file"}: ${itemPath}`,
      deletedPath: itemPath,
      type: isDirectory ? "directory" : "file",
    })
  } catch (err) {
    console.error("[EDIT API] Failed to delete:", err)
    return c.json({ error: "Failed to delete" }, 500)
  }
})

// API to copy a file in an editable directory
app.post("/api/edit/copy", async c => {
  const cookies = cookie.parse(c.req.header("cookie") || "")
  if (!cookies.shell_session || !sessions.has(cookies.shell_session)) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const body = await c.req.json()
    const directoryId = body.directory
    const sourcePath = body.source
    const destPath = body.destination

    if (!directoryId) {
      return c.json({ error: "No directory specified" }, 400)
    }

    if (!sourcePath || !destPath) {
      return c.json({ error: "Source and destination paths required" }, 400)
    }

    const editableDir = getEditableDirectory(directoryId)
    if (!editableDir) {
      return c.json({ error: "Invalid directory" }, 400)
    }

    // SECURITY: Validate paths don't contain traversal
    if (sourcePath.includes("..") || sourcePath.startsWith("/")) {
      return c.json({ error: "Invalid source path" }, 400)
    }
    if (destPath.includes("..") || destPath.startsWith("/")) {
      return c.json({ error: "Invalid destination path" }, 400)
    }

    // Resolve and validate paths
    const resolvedSource = resolve(editableDir.path, sourcePath)
    const resolvedDest = resolve(editableDir.path, destPath)

    if (!resolvedSource.startsWith(editableDir.path + "/")) {
      return c.json({ error: "Source path traversal detected" }, 400)
    }
    if (!resolvedDest.startsWith(editableDir.path + "/")) {
      return c.json({ error: "Destination path traversal detected" }, 400)
    }

    if (!existsSync(resolvedSource)) {
      return c.json({ error: "Source file not found" }, 404)
    }

    if (existsSync(resolvedDest)) {
      return c.json({ error: "Destination already exists" }, 409)
    }

    // Ensure parent directory exists
    const parentDir = dirname(resolvedDest)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    // Copy the file
    const { copyFileSync } = await import("node:fs")
    copyFileSync(resolvedSource, resolvedDest)

    console.log(`[EDIT API] Copied file: ${resolvedSource} -> ${resolvedDest}`)
    return c.json({
      success: true,
      message: `Copied to ${destPath}`,
      sourcePath,
      destPath,
    })
  } catch (err) {
    console.error("[EDIT API] Failed to copy:", err)
    return c.json({ error: "Failed to copy file" }, 500)
  }
})

// WebSocket endpoint for shell
app.get(
  "/ws",
  upgradeWebSocket(c => {
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

    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash"
    const cwd = workspace !== "root" ? `${resolvedSitesPath}/${workspace}` : resolvedDefaultCwd

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
          ptyProcess.onData(data => {
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
  }),
)

// Start server with WebSocket support
const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  info => {
    console.log(`🖥️  Shell server running on http://localhost:${info.port}`)
  },
)

injectWebSocket(server)
