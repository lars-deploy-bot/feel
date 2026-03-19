/**
 * Read enabled services from alive.toml [services.*] sections.
 *
 * Parsed once at module load time. Services are declared in alive.toml like:
 *
 *   [services.browser-control]
 *   enabled = true
 *   port = 5061
 *
 * This module extracts service names where `enabled = true`.
 * Uses basic regex parsing to avoid adding a TOML dependency to apps/web.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Parse enabled service names from alive.toml content.
 * @param {string} content - Raw alive.toml file content
 * @returns {string[]} List of enabled service names
 */
export function parseEnabledServices(content) {
  const enabled = []

  // Match [services.X] sections and check for enabled = true
  const sectionRegex = /^\[services\.([^\]]+)\]/gm
  let match

  while ((match = sectionRegex.exec(content)) !== null) {
    const serviceName = match[1]
    const sectionStart = match.index + match[0].length

    // Find the end of this section (next [section] or EOF)
    const nextSection = content.indexOf("\n[", sectionStart)
    const sectionContent = nextSection === -1 ? content.slice(sectionStart) : content.slice(sectionStart, nextSection)

    // Check if enabled = true (handles whitespace variations)
    if (/^\s*enabled\s*=\s*true\s*$/m.test(sectionContent)) {
      enabled.push(serviceName)
    }
  }

  return enabled
}

/** @type {string[]} */
let cachedServices = null

/** @type {string | null} */
let cachedTomlPath = null

function findAliveTomlPath(startDir) {
  let currentDir = startDir

  while (true) {
    const candidate = join(currentDir, "alive.toml")
    if (existsSync(candidate)) {
      return candidate
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }
    currentDir = parentDir
  }
}

function resolveAliveTomlPath() {
  if (cachedTomlPath !== null) {
    return cachedTomlPath
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url))
  cachedTomlPath = findAliveTomlPath(process.cwd()) ?? findAliveTomlPath(moduleDir)
  return cachedTomlPath
}

/**
 * Get enabled services from alive.toml (cached after first read).
 * Returns empty array if alive.toml doesn't exist or has no [services.*] sections.
 * @returns {string[]}
 */
export function getEnabledServices() {
  if (cachedServices !== null) return cachedServices

  try {
    const tomlPath = resolveAliveTomlPath()
    if (!tomlPath) {
      cachedServices = []
      return cachedServices
    }

    const content = readFileSync(tomlPath, "utf-8")
    cachedServices = parseEnabledServices(content)
  } catch {
    cachedServices = []
  }

  return cachedServices
}
