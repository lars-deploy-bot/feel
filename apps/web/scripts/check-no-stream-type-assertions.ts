#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

const CRITICAL_STREAM_FILES = [
  "app/api/claude/stream/route.ts",
  "app/api/claude/stream/reconnect/route.ts",
  "app/api/claude/stream/cancel/route.ts",
  "lib/stream/ndjson-stream-handler.ts",
  "lib/stream/stream-buffer.ts",
  "lib/stream/cancellation-registry.ts",
  "lib/stream/abort-handler.ts",
] as const

type ViolationType = "as_assertion" | "type_assertion" | "explicit_any"

interface Violation {
  file: string
  line: number
  column: number
  kind: ViolationType
  snippet: string
}

function collectViolationsInFile(absolutePath: string, relativePath: string): Violation[] {
  const sourceText = readFileSync(absolutePath, "utf8")
  const sourceFile = ts.createSourceFile(absolutePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations: Violation[] = []

  const addViolation = (node: ts.Node, kind: ViolationType) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    const snippet = node.getText(sourceFile).split("\n")[0] ?? ""
    violations.push({
      file: relativePath,
      line: position.line + 1,
      column: position.character + 1,
      kind,
      snippet,
    })
  }

  const visit = (node: ts.Node) => {
    if (ts.isAsExpression(node)) {
      addViolation(node, "as_assertion")
    } else if (ts.isTypeAssertionExpression(node)) {
      addViolation(node, "type_assertion")
    } else if (node.kind === ts.SyntaxKind.AnyKeyword) {
      addViolation(node, "explicit_any")
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

const cwd = process.cwd()
const allViolations: Violation[] = []
const missingFiles: string[] = []

for (const relativePath of CRITICAL_STREAM_FILES) {
  const absolutePath = path.join(cwd, relativePath)
  if (!existsSync(absolutePath)) {
    missingFiles.push(relativePath)
    continue
  }

  allViolations.push(...collectViolationsInFile(absolutePath, relativePath))
}

if (missingFiles.length > 0) {
  console.error("Missing critical streaming file(s):")
  for (const file of missingFiles) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

if (allViolations.length > 0) {
  console.error("Found forbidden type assertions in critical streaming files:\n")
  for (const violation of allViolations) {
    console.error(`${violation.file}:${violation.line}:${violation.column} [${violation.kind}] ${violation.snippet}`)
  }
  console.error("\nUse type guards / safe narrowing instead of assertions in this path.")
  process.exit(1)
}

console.log("OK: no type assertions or explicit any in critical streaming files")
