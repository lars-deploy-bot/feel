import type { BrowserContext, Page } from "playwright-core"

// ============================================================
// Role Refs (adapted from OpenClaw's pw-role-snapshot)
// ============================================================

export interface RoleRef {
  role: string
  name?: string
  /** Index used only when role+name duplicates exist. */
  nth?: number
}

export type RoleRefMap = Record<string, RoleRef>

export interface RoleSnapshotStats {
  lines: number
  chars: number
  refs: number
  interactive: number
  truncated?: boolean
}

export interface RoleSnapshotOptions {
  /** Only include interactive elements (buttons, links, inputs, etc.). */
  interactive?: boolean
  /** Maximum depth to include (0 = root only). */
  maxDepth?: number
  /** Remove unnamed structural elements and empty branches. */
  compact?: boolean
}

// ============================================================
// Session & Result Types
// ============================================================

export interface WorkspaceSession {
  context: BrowserContext
  page: Page
  domain: string
  /** Caller-provided session identifier. Isolates browser state between parallel chats on the same domain. */
  sessionId: string
  lastUsed: number
  consoleMessages: ConsoleEntry[]
  pageErrors: PageError[]
  /** Role-based refs from the last snapshot. Used to resolve e1/e2 refs for click/fill/type. */
  roleRefs?: RoleRefMap
}

export interface ConsoleEntry {
  type: string
  text: string
  timestamp: string
  location?: { url?: string; lineNumber?: number; columnNumber?: number }
}

export interface PageError {
  message: string
  name?: string
  stack?: string
  timestamp: string
}

export interface SnapshotResult {
  tree: string
  refs: RoleRefMap
  stats: RoleSnapshotStats
  url: string
  title: string
}

export interface ScreenshotResult {
  image: string // base64 PNG
  url: string
  title: string
}

export interface BrowserActionResult {
  ok: boolean
  message?: string
  url?: string
}
