#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

const ROOT = process.cwd()
const TOOLS_ROOT_IMPORT = "@webalive/tools"

// Server-only files where value imports from @webalive/tools are expected.
const ALLOWED_VALUE_IMPORT_FILES = new Set([
  "app/api/evaluate-progress/route.ts",
  "app/api/skills/list/route.ts",
  "app/api/templates/list/route.ts",
  "lib/automation/executor.ts",
  "lib/claude/agent-constants.mjs",
  "scripts/run-agent.mjs",
])

const EXCLUDED_DIRS = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "e2e-results",
])

const INCLUDED_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"])

interface Violation {
  file: string
  line: number
  column: number
  kind: "import" | "export" | "dynamic-import"
}

function normalize(relativePath: string): string {
  return relativePath.split(path.sep).join("/")
}

function shouldScan(relativePath: string): boolean {
  const normalized = normalize(relativePath)

  if (!INCLUDED_EXTENSIONS.has(path.extname(normalized))) return false
  if (normalized.includes("/__tests__/")) return false
  if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) return false
  if (normalized.endsWith(".spec.ts") || normalized.endsWith(".spec.tsx")) return false

  return true
}

function walk(dir: string, relativeBase = ""): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue
    const absolute = path.join(dir, entry)
    const relative = relativeBase ? path.join(relativeBase, entry) : entry
    const stat = statSync(absolute)

    if (stat.isDirectory()) {
      files.push(...walk(absolute, relative))
    } else if (shouldScan(relative)) {
      files.push(relative)
    }
  }

  return files
}

function collectViolations(relativeFile: string): Violation[] {
  const normalizedFile = normalize(relativeFile)
  const absoluteFile = path.join(ROOT, relativeFile)
  const sourceText = readFileSync(absoluteFile, "utf8")
  const sourceFile = ts.createSourceFile(absoluteFile, sourceText, ts.ScriptTarget.Latest, true)
  const violations: Violation[] = []
  const allowValueImport = ALLOWED_VALUE_IMPORT_FILES.has(normalizedFile)

  const pushViolation = (node: ts.Node, kind: Violation["kind"]) => {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({
      file: normalizedFile,
      line: pos.line + 1,
      column: pos.character + 1,
      kind,
    })
  }

  // static imports and re-exports
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const module = stmt.moduleSpecifier
      if (ts.isStringLiteral(module) && module.text === TOOLS_ROOT_IMPORT) {
        const isTypeOnly = stmt.importClause?.isTypeOnly === true
        if (!isTypeOnly && !allowValueImport) {
          pushViolation(stmt, "import")
        }
      }
    } else if (ts.isExportDeclaration(stmt)) {
      const module = stmt.moduleSpecifier
      if (module && ts.isStringLiteral(module) && module.text === TOOLS_ROOT_IMPORT) {
        const isTypeOnly = stmt.isTypeOnly === true
        if (!isTypeOnly && !allowValueImport) {
          pushViolation(stmt, "export")
        }
      }
    }
  }

  // dynamic imports
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteral(arg) && arg.text === TOOLS_ROOT_IMPORT && !allowValueImport) {
        pushViolation(node, "dynamic-import")
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return violations
}

const files = walk(ROOT)
const violations = files.flatMap(collectViolations)

if (violations.length > 0) {
  console.error("Found unsafe @webalive/tools root imports outside approved server-only files:\n")
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}:${violation.column} [${violation.kind}]`)
  }
  console.error("\nUse @webalive/tools/display in client/browser-facing code.")
  process.exit(1)
}

console.log("OK: @webalive/tools root imports are server-only and safe")
