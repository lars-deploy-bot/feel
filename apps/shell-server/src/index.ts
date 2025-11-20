import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import cookie from "cookie"
import { randomBytes } from "node:crypto"
import * as pty from "node-pty"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

const port = parseInt(process.env.PORT || "3500", 10)
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

  // If already authenticated, redirect to shell
  if (cookies.shell_session && sessions.has(cookies.shell_session)) {
    return c.redirect("/shell")
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

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Shell Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .login-box {
      background: #2d2d2d;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      color: #fff;
      margin-bottom: 24px;
      font-size: 24px;
      text-align: center;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    input {
      padding: 14px;
      border: 1px solid #444;
      background: #1e1e1e;
      color: #fff;
      border-radius: 4px;
      font-size: 16px;
    }
    input:focus {
      outline: none;
      border-color: #0dbc79;
    }
    button {
      padding: 14px;
      background: #0dbc79;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
    }
    button:hover {
      background: #0aa868;
    }
    button:active {
      background: #098e5a;
    }
    .error {
      color: #f14c4c;
      font-size: 14px;
      text-align: center;
    }

    @media (max-width: 768px) {
      .login-box {
        padding: 30px 20px;
      }
      h1 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>🖥️ Shell Access</h1>
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Login</button>
      ${errorMessage ? `<p class="error">${errorMessage}</p>` : ""}
    </form>
  </div>
</body>
</html>`)
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

  return c.redirect("/shell")
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

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Shell</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html {
      height: 100%;
      overflow: hidden;
      position: fixed;
      width: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      overflow: hidden;
      height: 100%;
      width: 100%;
      position: fixed;
      overscroll-behavior: none;
      touch-action: manipulation;
      -webkit-overflow-scrolling: touch;
    }
    #header {
      background: #2d2d2d;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #444;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      height: 41px;
    }
    #header h1 {
      color: #fff;
      font-size: 14px;
      font-weight: 600;
    }
    #logout {
      background: #f14c4c;
      color: #fff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    #logout:hover {
      background: #d43e3e;
    }
    #shell-container {
      position: fixed;
      top: 41px;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
    }
    #shell {
      height: 100%;
      width: 100%;
      padding: 10px;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
    }
    #error {
      position: fixed;
      top: 51px;
      left: 10px;
      right: 10px;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgb(220, 38, 38);
      color: rgb(220, 38, 38);
      padding: 12px;
      border-radius: 6px;
      display: none;
      font-size: 14px;
      z-index: 99;
    }
    #loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 16px;
    }

    /* Mobile-specific optimizations */
    @media (max-width: 768px) {
      #shell-container {
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      #shell {
        padding: 5px;
      }
    }

    /* Prevent text selection on mobile to avoid interfering with terminal */
    @media (max-width: 768px) {
      body {
        -webkit-user-select: none;
        user-select: none;
      }
      #shell {
        -webkit-user-select: text;
        user-select: text;
      }
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>🖥️ Shell</h1>
    <button id="logout" onclick="window.location.href='/logout'">Logout</button>
  </div>
  <div id="error"></div>
  <div id="loading">Connecting to shell...</div>
  <div id="shell-container">
    <div id="shell"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.min.js"></script>
  <script>
    const params = new URLSearchParams(window.location.search);
    const workspace = params.get('workspace') || 'root';

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                     || window.innerWidth <= 768;

    // Use larger font on mobile for better readability
    const fontSize = isMobile ? 16 : 14;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 1000,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      }
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(document.getElementById('shell'));

    // Fit terminal to container
    function fitTerminal() {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Failed to fit terminal:', e);
      }
    }

    requestAnimationFrame(() => {
      fitTerminal();
    });

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(\`\${protocol}//\${window.location.host}/ws?workspace=\${workspace}\`);

    ws.onopen = () => {
      document.getElementById('loading').style.display = 'none';
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'data') {
        term.write(msg.data);
      } else if (msg.type === 'exit') {
        term.write(\`\\r\\n\\r\\n[Process exited with code \${msg.exitCode}]\\r\\n\`);
      }
    };

    ws.onerror = () => {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').textContent = 'Connection error. Please refresh.';
      document.getElementById('error').style.display = 'block';
    };

    term.onData((data) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle resize - throttled to prevent excessive calls
    let resizeTimeout;
    function handleResize() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        fitTerminal();
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows
          }));
        }
      }, 100);
    }

    window.addEventListener('resize', handleResize);

    // Mobile: Handle visual viewport changes (keyboard appearing/disappearing)
    if (isMobile && window.visualViewport) {
      let lastHeight = window.visualViewport.height;

      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const shellContainer = document.getElementById('shell-container');

        // Adjust container height when keyboard appears
        if (shellContainer) {
          const headerHeight = 41;
          const availableHeight = currentHeight - headerHeight;
          shellContainer.style.height = availableHeight + 'px';
        }

        // Only refit if height changed significantly (keyboard show/hide)
        if (Math.abs(currentHeight - lastHeight) > 100) {
          setTimeout(() => {
            fitTerminal();
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({
                type: 'resize',
                cols: term.cols,
                rows: term.rows
              }));
            }
          }, 150);
          lastHeight = currentHeight;
        }
      });

      // Initial adjustment
      const shellContainer = document.getElementById('shell-container');
      if (shellContainer) {
        const headerHeight = 41;
        const availableHeight = window.visualViewport.height - headerHeight;
        shellContainer.style.height = availableHeight + 'px';
      }
    }

    // Mobile: Scroll terminal into view when it receives focus
    if (isMobile) {
      const shellElement = document.getElementById('shell');
      if (shellElement) {
        shellElement.addEventListener('focus', () => {
          setTimeout(() => {
            shellElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 300);
        }, true);
      }
    }
  </script>
</body>
</html>`)
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

    // Determine shell and working directory
    const shell = process.platform === "win32" ? "powershell.exe" : "/bin/bash"
    const workspaceBase = process.env.WORKSPACE_BASE || "/root/webalive"
    const defaultCwd = "/root/webalive/claude-bridge"
    const cwd =
      workspace !== "root"
        ? `${workspaceBase.replace("/root/webalive", "/srv/webalive/sites")}/${workspace}`
        : defaultCwd

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
