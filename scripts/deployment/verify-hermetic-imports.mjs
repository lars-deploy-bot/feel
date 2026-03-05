#!/usr/bin/env bun

/**
 * Verify standalone build does not resolve internal workspace packages outside
 * the standalone artifact.
 *
 * Why: if a package import falls back to repo-level node_modules, we can end up
 * with mixed old/new artifacts (split-brain) and runtime crashes.
 */

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const rawStandaloneRoot = process.argv[2]

if (!rawStandaloneRoot) {
  console.error("Usage: verify-hermetic-imports.mjs <standalone-root>")
  process.exit(1)
}

const standaloneRoot = realpathSync(path.resolve(rawStandaloneRoot))
const standalonePackagesRoot = path.join(standaloneRoot, "packages")
const standaloneServerEntry = path.join(standaloneRoot, "apps", "web", "server.js")
const TARGET_SCOPES = ["@webalive/", "@alive-brug/"]

if (!existsSync(standalonePackagesRoot)) {
  console.error(`Standalone packages directory not found: ${standalonePackagesRoot}`)
  process.exit(1)
}

function isInside(rootPath, targetPath) {
  const rel = path.relative(rootPath, targetPath)
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

function walkJsFiles(dirPath, acc) {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name)

    // Avoid symlink loops and huge/dead dependency trees.
    if (lstatSync(abs).isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue
      walkJsFiles(abs, acc)
      continue
    }

    if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      acc.push(abs)
    }
  }
}

function extractScopedSpecifiers(filePath) {
  const raw = readFileSync(filePath, "utf8")
  const content = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const patterns = [
    /\bimport\s+[^'"]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]

  const out = new Set()
  for (const pattern of patterns) {
    let match = pattern.exec(content)
    while (match) {
      const specifier = match[1]
      if (TARGET_SCOPES.some(prefix => specifier.startsWith(prefix))) {
        out.add(specifier)
      }
      match = pattern.exec(content)
    }
  }
  return [...out]
}

const files = []
walkJsFiles(standalonePackagesRoot, files)
if (existsSync(standaloneServerEntry)) files.push(standaloneServerEntry)

const checks = []
for (const filePath of files) {
  const specifiers = extractScopedSpecifiers(filePath)
  for (const specifier of specifiers) {
    checks.push({ filePath, specifier })
  }
}

if (checks.length === 0) {
  console.error("No internal workspace imports found to verify. Refusing to continue.")
  process.exit(1)
}

const errors = []
for (const { filePath, specifier } of checks) {
  const parentUrl = pathToFileURL(filePath).href
  try {
    const resolvedUrl = await import.meta.resolve(specifier, parentUrl)
    if (!resolvedUrl.startsWith("file:")) {
      errors.push({
        filePath,
        specifier,
        reason: `resolved to non-file URL: ${resolvedUrl}`,
      })
      continue
    }

    const resolvedPath = realpathSync(fileURLToPath(resolvedUrl))
    if (!isInside(standaloneRoot, resolvedPath)) {
      errors.push({
        filePath,
        specifier,
        reason: `resolved outside standalone root: ${resolvedPath}`,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errors.push({
      filePath,
      specifier,
      reason: `failed to resolve (${message})`,
    })
  }
}

if (errors.length > 0) {
  console.error(`Hermetic import verification failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`)
  for (const err of errors) {
    console.error(`- ${err.filePath}`)
    console.error(`  import: ${err.specifier}`)
    console.error(`  error:  ${err.reason}`)
  }
  process.exit(1)
}

console.log(`Hermetic import verification passed (${checks.length} import checks across ${files.length} files).`)
