/**
 * Build Hygiene Tests (#224)
 *
 * CI guardrails for @webalive/tools package integrity:
 * 1. Dependency sync — every non-builtin import must be declared in package.json
 * 2. Browser-safe entrypoint — ./display must not pull Node builtins
 */

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const PKG_ROOT = path.resolve(import.meta.dirname, "..")
const SRC_DIR = path.join(PKG_ROOT, "src")

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T
}

/** Recursively collect all .ts source files (excluding tests) */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "__tests__") {
      files.push(...collectSourceFiles(full))
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full)
    }
  }
  return files
}

/** Extract bare-specifier imports from actual import/export statements */
function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8")
  // Match `import ... from "pkg"` and `export ... from "pkg"` — not string literals in comments/code
  const matches = content.matchAll(/^(?:import|export)\s+.*?\s+from\s+["']([^.][^"']*)["']/gm)
  return [...matches].map(m => m[1])
}

/** Resolve a bare specifier to its package name (handles scoped packages) */
function toPackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/")
    return `${parts[0]}/${parts[1]}`
  }
  return specifier.split("/")[0]
}

// ---------- Test: dependency sync ----------

describe("dependency sync", () => {
  it("every non-builtin import is declared in package.json", () => {
    const pkg = readJson<{
      name: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }>(path.join(PKG_ROOT, "package.json"))
    const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])

    const sourceFiles = collectSourceFiles(SRC_DIR)
    const undeclared: string[] = []

    for (const file of sourceFiles) {
      for (const specifier of extractImports(file)) {
        if (specifier.startsWith("node:")) continue
        const pkgName = toPackageName(specifier)
        if (pkgName === pkg.name) continue // self-reference
        if (!declared.has(pkgName)) {
          const rel = path.relative(PKG_ROOT, file)
          undeclared.push(`${rel} imports undeclared "${pkgName}"`)
        }
      }
    }

    expect(undeclared, `Undeclared dependencies:\n  ${undeclared.join("\n  ")}`).toEqual([])
  })

  it("no phantom dependencies (declared but never imported)", () => {
    const pkg = readJson<{ dependencies?: Record<string, string> }>(path.join(PKG_ROOT, "package.json"))

    const sourceFiles = collectSourceFiles(SRC_DIR)
    const importedPackages = new Set<string>()
    for (const file of sourceFiles) {
      for (const specifier of extractImports(file)) {
        if (specifier.startsWith("node:")) continue
        importedPackages.add(toPackageName(specifier))
      }
    }

    const phantoms: string[] = []
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      if (!importedPackages.has(dep)) {
        phantoms.push(dep)
      }
    }

    expect(phantoms, `Phantom dependencies (declared but never imported):\n  ${phantoms.join("\n  ")}`).toEqual([])
  })
})

// ---------- Test: browser-safe entrypoint ----------

describe("browser-safe entrypoint (./display)", () => {
  /**
   * The ./display entrypoint is imported in browser bundles.
   * It must not transitively pull in Node builtins.
   *
   * Strategy: trace the import graph starting from display.ts,
   * following only local (relative) imports. If any file in that
   * subgraph imports a node: module, it's a violation.
   */
  it("does not transitively import Node builtins", () => {
    const entrypoint = path.join(SRC_DIR, "display.ts")
    const visited = new Set<string>()
    const violations: string[] = []

    function trace(file: string): void {
      const resolved = file.endsWith(".ts") ? file : `${file}.ts`
      if (visited.has(resolved)) return
      visited.add(resolved)

      const content = readFileSync(resolved, "utf-8")
      const imports = content.matchAll(/from\s+["']([^"']+)["']/g)

      for (const [, specifier] of imports) {
        if (specifier.startsWith("node:")) {
          const rel = path.relative(PKG_ROOT, resolved)
          violations.push(`${rel} imports "${specifier}"`)
          continue
        }
        // Follow relative imports only
        if (specifier.startsWith(".")) {
          const dir = path.dirname(resolved)
          // Resolve .js extension to .ts source
          const target = specifier.replace(/\.js$/, ".ts")
          const abs = path.resolve(dir, target)
          trace(abs)
        }
      }
    }

    trace(entrypoint)

    expect(
      violations,
      `Browser-safe entrypoint pulls Node builtins:\n  ${violations.join("\n  ")}\n\n` +
        "Fix: Move Node-dependent code out of the ./display import graph.",
    ).toEqual([])
  })
})
