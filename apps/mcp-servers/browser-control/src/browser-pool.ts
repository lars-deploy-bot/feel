/**
 * Browser Pool
 *
 * Manages a single headless Chromium instance with isolated BrowserContexts
 * per workspace domain. Each workspace gets its own context (cookie/storage
 * isolation) and a single page.
 *
 * - Max MAX_SESSIONS concurrent workspace sessions
 * - LRU eviction when limit reached
 * - Auto-cleanup after IDLE_TIMEOUT_MS of inactivity
 * - Reconnects on Chromium crash
 */

import { type Browser, chromium } from "playwright-core"
import type { ConsoleEntry, PageError, WorkspaceSession } from "./types.js"

const MAX_SESSIONS = 5
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const CLEANUP_INTERVAL_MS = 30 * 1000 // check every 30s
const MAX_CONSOLE_MESSAGES = 200
const MAX_PAGE_ERRORS = 100

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-extensions",
  "--disable-sync",
  "--disable-translate",
  "--mute-audio",
  "--hide-scrollbars",
]

class BrowserPool {
  private browser: Browser | null = null
  private sessions = new Map<string, WorkspaceSession>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private connecting: Promise<Browser> | null = null

  async ensureBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser
    }

    // Prevent concurrent launch attempts
    if (this.connecting) {
      return this.connecting
    }

    this.connecting = this.launchBrowser()
    try {
      this.browser = await this.connecting
      return this.browser
    } finally {
      this.connecting = null
    }
  }

  private async launchBrowser(): Promise<Browser> {
    console.log("[browser-pool] Launching headless Chromium...")

    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
      args: LAUNCH_ARGS,
    })

    browser.on("disconnected", () => {
      console.log("[browser-pool] Chromium disconnected, clearing sessions")
      this.browser = null
      this.sessions.clear()
    })

    // Start cleanup timer
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.cleanupIdleSessions(), CLEANUP_INTERVAL_MS)
    }

    console.log("[browser-pool] Chromium launched")
    return browser
  }

  async getSession(domain: string): Promise<WorkspaceSession> {
    const existing = this.sessions.get(domain)
    if (existing) {
      existing.lastUsed = Date.now()

      // Check if page is still usable
      try {
        await existing.page.title()
        return existing
      } catch {
        // Page crashed or was closed, recreate
        console.log(`[browser-pool] Session for ${domain} is stale, recreating`)
        await this.destroySession(domain)
      }
    }

    // Evict LRU session if at capacity
    if (this.sessions.size >= MAX_SESSIONS) {
      await this.evictLRU()
    }

    const browser = await this.ensureBrowser()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    })

    const page = await context.newPage()

    const session: WorkspaceSession = {
      context,
      page,
      domain,
      lastUsed: Date.now(),
      consoleMessages: [],
      pageErrors: [],
    }

    // Collect console messages
    page.on("console", msg => {
      const entry: ConsoleEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: msg.location(),
      }
      session.consoleMessages.push(entry)
      if (session.consoleMessages.length > MAX_CONSOLE_MESSAGES) {
        session.consoleMessages.shift()
      }
    })

    // Collect page errors
    page.on("pageerror", err => {
      const entry: PageError = {
        message: String(err.message),
        name: err.name,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }
      session.pageErrors.push(entry)
      if (session.pageErrors.length > MAX_PAGE_ERRORS) {
        session.pageErrors.shift()
      }
    })

    this.sessions.set(domain, session)
    console.log(`[browser-pool] Created session for ${domain} (${this.sessions.size}/${MAX_SESSIONS})`)
    return session
  }

  private async destroySession(domain: string): Promise<void> {
    const session = this.sessions.get(domain)
    if (!session) return

    try {
      await session.context.close()
    } catch {
      // ignore
    }
    this.sessions.delete(domain)
    console.log(`[browser-pool] Destroyed session for ${domain}`)
  }

  private async evictLRU(): Promise<void> {
    let oldest: { domain: string; lastUsed: number } | null = null

    for (const [domain, session] of this.sessions) {
      if (!oldest || session.lastUsed < oldest.lastUsed) {
        oldest = { domain, lastUsed: session.lastUsed }
      }
    }

    if (oldest) {
      console.log(`[browser-pool] Evicting LRU session: ${oldest.domain}`)
      await this.destroySession(oldest.domain)
    }
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [domain, session] of this.sessions) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        toRemove.push(domain)
      }
    }

    for (const domain of toRemove) {
      await this.destroySession(domain)
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    for (const domain of [...this.sessions.keys()]) {
      await this.destroySession(domain)
    }

    if (this.browser) {
      try {
        await this.browser.close()
      } catch {
        // ignore
      }
      this.browser = null
    }

    console.log("[browser-pool] Shut down")
  }

  get stats() {
    return {
      browserConnected: this.browser?.isConnected() ?? false,
      activeSessions: this.sessions.size,
      maxSessions: MAX_SESSIONS,
      domains: [...this.sessions.keys()],
    }
  }
}

export const browserPool = new BrowserPool()
