import { spawnSync } from "node:child_process"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { errorResult, successResult, type ToolResult } from "../../lib/bridge-api-client.js"
import { sanitizeSubprocessEnv } from "../../lib/env-sanitizer.js"
import { hasPackageJson, validateWorkspacePath } from "../../lib/workspace-validator.js"

export const checkCodebaseParamsSchema = {}

export type CheckCodebaseParams = Record<string, never>

/**
 * Run TypeScript type checking and linting on the workspace.
 *
 * SECURITY MODEL (Direct Execution Pattern):
 * - This tool runs AFTER privilege drop (setuid/setgid to workspace user)
 * - Process already runs as workspace user, NOT root
 * - No HTTP roundtrip needed - direct execution for read-only operations
 * - Uses sanitized environment to prevent cache access issues
 *
 * EXECUTION:
 * - Runs `bun run tsc --noEmit` for TypeScript type checking
 * - Runs `bun run lint` for ESLint/Biome linting
 * - Both commands executed with isolated, sanitized environment
 */
export async function checkCodebase(_params: CheckCodebaseParams): Promise<ToolResult> {
  // Security: Use process.cwd() set by Bridge - never accept workspace from user
  const workspaceRoot = process.cwd()

  try {
    // Security: Validate workspace path
    validateWorkspacePath(workspaceRoot)

    // Verify this is a Node.js project
    if (!hasPackageJson(workspaceRoot)) {
      return errorResult("No package.json found in workspace", "This doesn't appear to be a Node.js project.")
    }

    // TODO: SECURITY - User can potentially override these commands via package.json scripts
    // or malicious node_modules. Since this runs as workspace user in their own workspace,
    // impact is limited to self-attack, but consider:
    // - Running from trusted tsc/eslint outside workspace
    // - Validating package.json scripts before execution
    // - Using containerized checker

    // Run TypeScript check - use bunx to run tsc directly from node_modules
    // Try tsconfig.app.json first (Vite projects), fall back to default tsconfig.json
    const tscResult = spawnSync("bunx", ["tsc", "--project", "tsconfig.app.json", "--noEmit"], {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 120000,
      shell: false,
      // Sanitize environment to prevent inherited root-owned paths from causing failures
      env: sanitizeSubprocessEnv(),
    })

    console.error(
      "[check_codebase] TSC Result:",
      JSON.stringify({
        status: tscResult.status,
        stdout: tscResult.stdout?.substring(0, 500),
        stderr: tscResult.stderr?.substring(0, 500),
        error: tscResult.error,
      }),
    )

    // Run ESLint check
    const lintResult = spawnSync("bun", ["run", "lint"], {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 120000,
      shell: false,
      // Sanitize environment to prevent inherited root-owned paths from causing failures
      env: sanitizeSubprocessEnv(),
    })

    console.error(
      "[check_codebase] Lint Result:",
      JSON.stringify({
        status: lintResult.status,
        stdout: lintResult.stdout?.substring(0, 500),
        stderr: lintResult.stderr?.substring(0, 500),
        error: lintResult.error,
      }),
    )

    const tscPassed = tscResult.status === 0
    const lintPassed = lintResult.status === 0

    // All checks passed
    if (tscPassed && lintPassed) {
      return successResult("All checks passed! Codebase is healthy. ✅")
    }

    // Build detailed error report
    const errors: string[] = []

    if (!tscPassed) {
      errors.push("❌ TypeScript Type Errors:\n")

      // Combine stdout and stderr for complete error output
      const tscOutput = [tscResult.stdout, tscResult.stderr].filter(Boolean).join("\n")

      // Extract TypeScript error lines (format: file.ts(line,col): error TS1234: message)
      const tsErrors = tscOutput.match(/^.+\(\d+,\d+\): error TS\d+:.+$/gm)

      if (tsErrors && tsErrors.length > 0) {
        // Show first 10 errors with clear formatting
        const displayErrors = tsErrors.slice(0, 10)
        errors.push(...displayErrors.map(e => `  ${e}`))

        if (tsErrors.length > 10) {
          errors.push(`\n  ... and ${tsErrors.length - 10} more TypeScript errors`)
        }

        // Add summary line
        const errorCount = tscOutput.match(/Found (\d+) errors?/)?.[1]
        if (errorCount) {
          errors.push(`\n  Total: ${errorCount} TypeScript errors found`)
        }
      } else {
        // Fallback: show raw output if regex didn't match
        errors.push(`  ${tscOutput.trim().split("\n").slice(0, 10).join("\n  ")}`)
      }
    }

    if (!lintPassed) {
      errors.push("\n\n❌ Linting Errors:\n")

      // Combine stdout and stderr for complete error output
      const lintOutput = [lintResult.stdout, lintResult.stderr].filter(Boolean).join("\n")

      // Extract lint error lines (format varies by linter)
      const lintErrors = lintOutput.split("\n").filter(line => line.includes("error") && !line.includes("errors found"))

      if (lintErrors.length > 0) {
        // Show first 10 errors
        const displayErrors = lintErrors.slice(0, 10)
        errors.push(...displayErrors.map(e => `  ${e}`))

        if (lintErrors.length > 10) {
          errors.push(`\n  ... and ${lintErrors.length - 10} more lint errors`)
        }
      } else {
        // Fallback: show relevant output lines
        const relevantLines = lintOutput.trim().split("\n").slice(0, 10)
        errors.push(`  ${relevantLines.join("\n  ")}`)
      }
    }

    // Add guidance for fixing errors
    errors.push(
      "\n\n⚠️ Before you start fixing the errors, try to find the root cause. If you're sure you know the root cause, only if you're really sure, you can go ahead and fix it.",
    )

    // Note: This is NOT a tool error - the tool executed successfully and found code issues
    // Return as success with error details in the message
    return successResult(errors.join("\n"))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return errorResult("Failed to run codebase check", errorMessage)
  }
}

export const checkCodebaseTool = tool(
  "check_codebase",
  "Runs TypeScript type checking (tsc) and ESLint to verify code quality. Use this BEFORE committing code, after making changes, or when debugging type errors. Returns detailed information about any TypeScript errors or lint warnings found. This is a comprehensive health check for the codebase.",
  checkCodebaseParamsSchema,
  async args => {
    return checkCodebase(args)
  },
)
