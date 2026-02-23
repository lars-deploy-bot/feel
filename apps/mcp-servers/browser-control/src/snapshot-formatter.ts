/**
 * Snapshot Formatter
 *
 * Uses CDP's Accessibility.getFullAXTree to get the accessibility tree,
 * then annotates interactive and content elements with refs (e1, e2, ...).
 *
 * We use CDP directly instead of Playwright's ariaSnapshot() because
 * Playwright 1.58's injected code has compatibility issues with Chrome 144+.
 *
 * Adapted from OpenClaw's pw-role-snapshot approach.
 */

import type { Page } from "playwright-core"
import type { RoleRefMap, RoleSnapshotOptions, RoleSnapshotStats, SnapshotResult } from "./types.js"

// ============================================================
// Role Classification
// ============================================================

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "treeitem",
])

const CONTENT_ROLES = new Set([
  "heading",
  "cell",
  "gridcell",
  "columnheader",
  "rowheader",
  "listitem",
  "article",
  "region",
  "main",
  "navigation",
])

const STRUCTURAL_ROLES = new Set([
  "generic",
  "group",
  "list",
  "table",
  "row",
  "rowgroup",
  "grid",
  "treegrid",
  "menu",
  "menubar",
  "toolbar",
  "tablist",
  "tree",
  "directory",
  "document",
  "application",
  "presentation",
  "none",
])

// ============================================================
// Duplicate Tracking
// ============================================================

interface RoleNameTracker {
  getNextIndex(role: string, name?: string): number
  trackRef(role: string, name: string | undefined, ref: string): void
  getDuplicateKeys(): Set<string>
  getKey(role: string, name?: string): string
}

function createRoleNameTracker(): RoleNameTracker {
  const counts = new Map<string, number>()
  const refsByKey = new Map<string, string[]>()

  return {
    getKey(role: string, name?: string) {
      return `${role}:${name ?? ""}`
    },
    getNextIndex(role: string, name?: string) {
      const key = this.getKey(role, name)
      const current = counts.get(key) ?? 0
      counts.set(key, current + 1)
      return current
    },
    trackRef(role: string, name: string | undefined, ref: string) {
      const key = this.getKey(role, name)
      const list = refsByKey.get(key) ?? []
      list.push(ref)
      refsByKey.set(key, list)
    },
    getDuplicateKeys() {
      const out = new Set<string>()
      for (const [key, refs] of refsByKey) {
        if (refs.length > 1) {
          out.add(key)
        }
      }
      return out
    },
  }
}

function removeNthFromNonDuplicates(refs: RoleRefMap, tracker: RoleNameTracker): void {
  const duplicates = tracker.getDuplicateKeys()
  for (const [ref, data] of Object.entries(refs)) {
    const key = tracker.getKey(data.role, data.name)
    if (!duplicates.has(key)) {
      delete refs[ref]?.nth
    }
  }
}

// ============================================================
// Tree Utilities
// ============================================================

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/)
  return match ? Math.floor(match[1].length / 2) : 0
}

function compactTree(tree: string): string {
  const lines = tree.split("\n")
  const result: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) continue

    // Always keep lines with refs
    if (line.includes("[ref=")) {
      result.push(line)
      continue
    }
    // Keep lines with content (role + name on same line)
    if (line.includes(":") && !line.trimEnd().endsWith(":")) {
      result.push(line)
      continue
    }

    // Only keep structural lines that have ref-bearing children
    const currentIndent = getIndentLevel(line)
    let hasRelevantChildren = false
    for (let j = i + 1; j < lines.length; j += 1) {
      const childIndent = getIndentLevel(lines[j] ?? "")
      if (childIndent <= currentIndent) break
      if (lines[j]?.includes("[ref=")) {
        hasRelevantChildren = true
        break
      }
    }
    if (hasRelevantChildren) {
      result.push(line)
    }
  }

  return result.join("\n")
}

// ============================================================
// Core: Build Role Snapshot from Aria Snapshot
// ============================================================

export function buildRoleSnapshotFromAriaSnapshot(
  ariaSnapshot: string,
  options: RoleSnapshotOptions = {},
): { snapshot: string; refs: RoleRefMap } {
  const lines = ariaSnapshot.split("\n")
  const refs: RoleRefMap = {}
  const tracker = createRoleNameTracker()

  let counter = 0
  const nextRef = () => {
    counter += 1
    return `e${counter}`
  }

  // Interactive-only mode: flat list of actionable elements
  if (options.interactive) {
    const result: string[] = []
    for (const line of lines) {
      const depth = getIndentLevel(line)
      if (options.maxDepth !== undefined && depth > options.maxDepth) continue

      const match = line.match(/^(\s*-\s*)(\w+)(?:\s+"([^"]*)")?(.*)$/)
      if (!match) continue
      const [, , roleRaw, name, suffix] = match
      if (!roleRaw || roleRaw.startsWith("/")) continue

      const role = roleRaw.toLowerCase()
      if (!INTERACTIVE_ROLES.has(role)) continue

      const ref = nextRef()
      const nth = tracker.getNextIndex(role, name)
      tracker.trackRef(role, name, ref)
      refs[ref] = { role, name, nth }

      let enhanced = `- ${roleRaw}`
      if (name) enhanced += ` "${name}"`
      enhanced += ` [ref=${ref}]`
      if (nth > 0) enhanced += ` [nth=${nth}]`
      if (suffix?.includes("[")) enhanced += suffix
      result.push(enhanced)
    }

    removeNthFromNonDuplicates(refs, tracker)

    return {
      snapshot: result.join("\n") || "(no interactive elements)",
      refs,
    }
  }

  // Full mode: preserve tree structure, annotate interactive + content elements
  const result: string[] = []
  for (const line of lines) {
    const depth = getIndentLevel(line)
    if (options.maxDepth !== undefined && depth > options.maxDepth) continue

    const match = line.match(/^(\s*-\s*)(\w+)(?:\s+"([^"]*)")?(.*)$/)
    if (!match) {
      result.push(line)
      continue
    }

    const [, prefix, roleRaw, name, suffix] = match
    if (!roleRaw || !prefix) {
      result.push(line)
      continue
    }
    if (roleRaw.startsWith("/")) {
      result.push(line)
      continue
    }

    const role = roleRaw.toLowerCase()
    const isInteractive = INTERACTIVE_ROLES.has(role)
    const isContent = CONTENT_ROLES.has(role)
    const isStructural = STRUCTURAL_ROLES.has(role)

    if (options.compact && isStructural && !name) continue

    const shouldHaveRef = isInteractive || (isContent && !!name)
    if (!shouldHaveRef) {
      result.push(line)
      continue
    }

    const ref = nextRef()
    const nth = tracker.getNextIndex(role, name)
    tracker.trackRef(role, name, ref)
    refs[ref] = { role, name, nth }

    let enhanced = `${prefix}${roleRaw}`
    if (name) enhanced += ` "${name}"`
    enhanced += ` [ref=${ref}]`
    if (nth > 0) enhanced += ` [nth=${nth}]`
    if (suffix) enhanced += suffix
    result.push(enhanced)
  }

  removeNthFromNonDuplicates(refs, tracker)

  const tree = result.join("\n") || "(empty)"
  return {
    snapshot: options.compact ? compactTree(tree) : tree,
    refs,
  }
}

// ============================================================
// Stats
// ============================================================

export function getRoleSnapshotStats(snapshot: string, refs: RoleRefMap): RoleSnapshotStats {
  const interactive = Object.values(refs).filter(r => INTERACTIVE_ROLES.has(r.role)).length
  return {
    lines: snapshot.split("\n").length,
    chars: snapshot.length,
    refs: Object.keys(refs).length,
    interactive,
  }
}

// ============================================================
// Ref Parsing & Resolution
// ============================================================

export function parseRoleRef(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.startsWith("@")
    ? trimmed.slice(1)
    : trimmed.startsWith("ref=")
      ? trimmed.slice(4)
      : trimmed
  return /^e\d+$/.test(normalized) ? normalized : null
}

/** Thrown for invalid user input (should map to HTTP 400). */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserInputError"
  }
}

/**
 * Require a valid ref from user input. Throws UserInputError if missing or invalid.
 */
export function requireRef(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : ""
  const roleRef = raw ? parseRoleRef(raw) : null
  const ref = roleRef ?? (raw.startsWith("@") ? raw.slice(1) : raw)
  if (!ref) {
    throw new UserInputError("ref is required")
  }
  return ref
}

/**
 * Resolve a ref (e.g. "e3") to a Playwright locator using the stored roleRefs.
 * Adapted from OpenClaw's refLocator pattern.
 */
export function refLocator(page: Page, ref: string, roleRefs: RoleRefMap | undefined) {
  const normalized = ref.startsWith("@") ? ref.slice(1) : ref.startsWith("ref=") ? ref.slice(4) : ref

  if (!/^e\d+$/.test(normalized)) {
    throw new UserInputError(`Invalid ref format: "${ref}". Expected e1, e2, etc.`)
  }

  const info = roleRefs?.[normalized]
  if (!info) {
    throw new UserInputError(`Unknown ref "${normalized}". Run a new snapshot and use a ref from that snapshot.`)
  }

  const locator = info.name
    ? page.getByRole(info.role as Parameters<typeof page.getByRole>[0], { name: info.name, exact: true })
    : page.getByRole(info.role as Parameters<typeof page.getByRole>[0])

  return info.nth !== undefined ? locator.nth(info.nth) : locator
}

/**
 * Clamp timeout to a sane range (500ms–120s).
 */
export function normalizeTimeoutMs(timeoutMs: number | undefined, fallback: number): number {
  return Math.max(500, Math.min(120_000, timeoutMs ?? fallback))
}

/**
 * Convert Playwright errors into actionable messages for the AI agent.
 * Adapted from OpenClaw's toAIFriendlyError.
 */
export function toAIFriendlyError(error: unknown, selector: string): Error {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("strict mode violation")) {
    const countMatch = message.match(/resolved to (\d+) elements/)
    const count = countMatch ? countMatch[1] : "multiple"
    return new Error(
      `Selector "${selector}" matched ${count} elements. ` +
        "Run a new snapshot to get updated refs, or use a different ref.",
    )
  }

  if (
    (message.includes("Timeout") || message.includes("waiting for")) &&
    (message.includes("to be visible") || message.includes("not visible"))
  ) {
    return new Error(`Element "${selector}" not found or not visible. Run a new snapshot to see current page elements.`)
  }

  if (
    message.includes("intercepts pointer events") ||
    message.includes("not visible") ||
    message.includes("not receive pointer events")
  ) {
    return new Error(
      `Element "${selector}" is not interactable (hidden or covered). ` +
        "Try scrolling it into view, closing overlays, or re-snapshotting.",
    )
  }

  return error instanceof Error ? error : new Error(message)
}

// ============================================================
// CDP Accessibility Tree
// ============================================================

interface CDPAXNode {
  nodeId: string
  role: { type: string; value: string }
  name?: { type: string; value: string }
  childIds?: string[]
  properties?: Array<{ name: string; value: { type: string; value: unknown } }>
  ignored?: boolean
}

/**
 * Build an aria-snapshot-like text from CDP's Accessibility.getFullAXTree.
 * This sidesteps Playwright's ariaSnapshot() which has compatibility issues
 * with Chrome 144+.
 */
function cdpTreeToAriaFormat(nodes: CDPAXNode[]): string {
  const nodeMap = new Map<string, CDPAXNode>()
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node)
  }

  const lines: string[] = []

  function walk(nodeId: string, depth: number): void {
    const node = nodeMap.get(nodeId)
    if (!node) return

    const role = node.role?.value ?? "generic"
    // Skip ignored nodes and root-level browser nodes — but still traverse their children
    if (node.ignored || role === "none" || role === "RootWebArea" || role === "WebArea") {
      if (node.childIds) {
        for (const childId of node.childIds) {
          walk(childId, depth)
        }
      }
      return
    }

    const indent = "  ".repeat(depth)
    const name = node.name?.value ?? ""
    const nameStr = name ? ` "${name}"` : ""

    // Check properties for checked/expanded/selected states
    let suffix = ""
    if (node.properties) {
      for (const prop of node.properties) {
        if (prop.name === "checked" && prop.value.value === true) suffix += " [checked]"
        if (prop.name === "expanded" && prop.value.value === true) suffix += " [expanded]"
        if (prop.name === "selected" && prop.value.value === true) suffix += " [selected]"
        if (prop.name === "disabled" && prop.value.value === true) suffix += " [disabled]"
      }
    }

    lines.push(`${indent}- ${role}${nameStr}${suffix}`)

    if (node.childIds) {
      for (const childId of node.childIds) {
        walk(childId, depth + 1)
      }
    }
  }

  // Start from the first node (root)
  if (nodes.length > 0) {
    walk(nodes[0].nodeId, 0)
  }

  return lines.join("\n")
}

// ============================================================
// Public API: Take Snapshot
// ============================================================

const MAX_CHARS = 15_000

export async function takeSnapshot(page: Page, options?: RoleSnapshotOptions): Promise<SnapshotResult> {
  // Use CDP to get the accessibility tree directly, avoiding Playwright's
  // ariaSnapshot() which has compatibility issues with Chrome 144+
  const cdpSession = await page.context().newCDPSession(page)
  try {
    const { nodes } = (await cdpSession.send("Accessibility.getFullAXTree" as never)) as {
      nodes: CDPAXNode[]
    }
    const ariaSnapshot = cdpTreeToAriaFormat(nodes)

    const { snapshot, refs } = buildRoleSnapshotFromAriaSnapshot(ariaSnapshot, {
      interactive: options?.interactive,
      maxDepth: options?.maxDepth,
      compact: options?.compact ?? true,
    })

    let tree = snapshot
    if (tree.length > MAX_CHARS) {
      tree = `${tree.slice(0, MAX_CHARS)}\n\n... (truncated at ${MAX_CHARS} characters)`
    }

    const stats = getRoleSnapshotStats(snapshot, refs)
    const title = await page.title().catch(() => "")
    const url = page.url()

    return { tree, refs, stats, url, title }
  } finally {
    await cdpSession.detach().catch(() => {})
  }
}
