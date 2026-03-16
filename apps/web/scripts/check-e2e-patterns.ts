#!/usr/bin/env bun
/**
 * E2E Anti-Pattern Checker
 *
 * Static check that catches Playwright API misuse patterns.
 * Runs as part of `static-check` pipeline (pre-push + CI).
 *
 * Anti-patterns detected:
 * 1. Using Playwright APIResponse `.ok` without () —
 *    Playwright's APIResponse.ok is a METHOD, not a property.
 *    Using it without () compares a function reference (always truthy).
 *
 * Safe (not flagged):
 * - Native fetch() response.ok — that IS a property
 * - page.evaluate() blocks — native fetch context
 * - api-helpers.ts — the safe wrapper itself
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join } from "node:path"

interface Violation {
  file: string
  line: number
  pattern: string
  fix: string
  context: string
}

const E2E_DIR = join(process.cwd(), "e2e-tests")

function findE2EFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory() && entry !== "node_modules") {
      findE2EFiles(fullPath, files)
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath)
    }
  }
  return files
}

/**
 * Detect Playwright APIResponse.ok used without () in E2E tests.
 *
 * Strategy: find variables assigned from Playwright's request.get/post/etc,
 * then flag any `.ok` without () on those variables. Native fetch() responses
 * are NOT flagged since `.ok` is a property there.
 */
function checkPlaywrightOkTrap(filePath: string): Violation[] {
  // Skip the api-helpers file — it correctly calls .ok()
  if (basename(filePath) === "api-helpers.ts") return []

  const content = readFileSync(filePath, "utf-8")
  const lines = content.split("\n")
  const violations: Violation[] = []

  // Only check Playwright test files
  const isPlaywrightFile =
    content.includes("@playwright/test") || content.includes("./fixtures") || content.includes("../fixtures")

  if (!isPlaywrightFile) return []

  // Find variable names assigned from Playwright request methods
  // e.g., `const response = await authenticatedPage.request.get(...)`
  //        `const res = await page.request.post(...)`
  const playwrightResponseVars = new Set<string>()

  for (const line of lines) {
    const assignMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\s+\w+\.request\.\w+\s*\(/)
    if (assignMatch) {
      playwrightResponseVars.add(assignMatch[1])
    }
  }

  if (playwrightResponseVars.size === 0) return []

  // Flag .ok without () on Playwright response variables
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    for (const varName of playwrightResponseVars) {
      const regex = new RegExp(`\\b${varName}\\.ok\\b(?!\\s*\\()`)
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: `${varName}.ok (property access on Playwright APIResponse)`,
          fix: `${varName}.ok() — Playwright .ok is a METHOD. Or use apiGet()/apiPost() from lib/api-helpers.ts`,
          context: line.trim(),
        })
      }
    }
  }

  return violations
}

const MOCK_PATTERNS = [
  { pattern: /\.route\s*\(/, label: "page.route() — route interception" },
  { pattern: /route\.fulfill\s*\(/, label: "route.fulfill() — fake response" },
  { pattern: /StreamBuilder/, label: "StreamBuilder — fake NDJSON" },
  { pattern: /vi\.(mock|fn|spyOn)\s*\(/, label: "vitest mock" },
  { pattern: /jest\.(mock|fn|spyOn)\s*\(/, label: "jest mock" },
  { pattern: /\.mockResolvedValue|\.mockReturnValue|\.mockImplementation/, label: "mock return value" },
]

/**
 * Detect mocks in live E2E specs (*-live.spec.ts).
 * Live specs must hit real services — mocks belong in non-live specs.
 */
function checkNoMocksInLiveSpecs(filePath: string): Violation[] {
  if (!filePath.endsWith("-live.spec.ts")) return []

  const content = readFileSync(filePath, "utf-8")
  const lines = content.split("\n")
  const violations: Violation[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    for (const { pattern, label } of MOCK_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          pattern: label,
          fix: "Live specs must not mock. Move to a non-live spec file.",
          context: line.trim(),
        })
      }
    }
  }

  return violations
}

// Main
const files = findE2EFiles(E2E_DIR)
const allViolations: Violation[] = []

for (const file of files) {
  allViolations.push(...checkPlaywrightOkTrap(file))
  allViolations.push(...checkNoMocksInLiveSpecs(file))
}

if (allViolations.length > 0) {
  const cwd = process.cwd()
  console.error("\n❌ E2E Anti-Pattern Violations Found")
  console.error("═".repeat(50))
  console.error()
  console.error("Playwright's APIResponse.ok is a METHOD, not a property.")
  console.error("Using .ok without () compares a function — always truthy.\n")

  for (const v of allViolations) {
    const rel = v.file.replace(`${cwd}/`, "")
    console.error(`  ${rel}:${v.line}`)
    console.error(`  ❌ Found: ${v.pattern}`)
    console.error(`  ✅ Fix:   ${v.fix}`)
    console.error(`  📝 ${v.context}\n`)
  }

  console.error("═".repeat(50))
  console.error("Use apiGet()/apiPost() from e2e-tests/lib/api-helpers.ts instead.\n")
  process.exit(1)
}

console.log("✅ E2E patterns clean")
