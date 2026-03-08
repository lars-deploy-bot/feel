/**
 * Output limiting utilities for tool responses.
 *
 * Prevents overwhelming the system with large outputs from tools.
 * Use these utilities in all tools that produce variable-length output.
 *
 * Shared tool limits are defined here so both `@webalive/tools` (sandboxed-fs)
 * and `@webalive/sandbox` (E2B MCP) use identical values.
 */

/** Default max characters for tool output */
export const DEFAULT_MAX_CHARS = 8000

/** Default max lines for tool output */
export const DEFAULT_MAX_LINES = 50

// =============================================================================
// TOOL LIMITS — shared across sandboxed-fs and E2B MCP implementations
// =============================================================================

export const TOOL_LIMITS = {
  /** Default max lines returned by Read (matches SDK built-in) */
  READ_DEFAULT_LINES: 2000,
  /** Default bash command timeout in ms */
  BASH_TIMEOUT_MS: 120_000,
  /** Maximum bash command timeout in ms */
  BASH_MAX_TIMEOUT_MS: 600_000,
  /** Default grep max result count */
  GREP_DEFAULT_MAX_RESULTS: 50,
  /** Hard cap on grep max results */
  GREP_MAX_RESULTS: 200,
  /** Grep/glob search command timeout in ms */
  SEARCH_TIMEOUT_MS: 30_000,
  /** Truncation limits for search output (glob/grep) */
  SEARCH_OUTPUT: { maxLines: 400, maxChars: 20_000 } as const,
  /** Truncation limits for bash output */
  BASH_OUTPUT: { maxLines: 200, maxChars: 20_000 } as const,
} as const

export interface TruncateOptions {
  /** Max characters (default: 8000) */
  maxChars?: number
  /** Max lines (default: 50) */
  maxLines?: number
  /** Custom suffix when truncated (default: auto-generated) */
  suffix?: string
}

/**
 * Normalize whitespace: collapse multiple newlines, trim lines.
 */
function normalizeWhitespace(text: string): string {
  return (
    text
      // Collapse 3+ newlines to 2 (preserve paragraph breaks)
      .replace(/\n{3,}/g, "\n\n")
      // Collapse multiple spaces to single
      .replace(/ {2,}/g, " ")
      // Trim trailing whitespace per line
      .replace(/[ \t]+$/gm, "")
  )
}

/**
 * Truncate output to prevent overwhelming responses.
 *
 * Applies whitespace normalization, then both character and line limits.
 *
 * @example
 * ```typescript
 * import { truncateOutput } from "@webalive/shared"
 *
 * // Use defaults (8000 chars, 50 lines)
 * return successResult(truncateOutput(largeOutput))
 *
 * // Custom limits
 * return successResult(truncateOutput(output, { maxLines: 20, maxChars: 4000 }))
 * ```
 */
export function truncateOutput(output: string, options: TruncateOptions = {}): string {
  const { maxChars = DEFAULT_MAX_CHARS, maxLines = DEFAULT_MAX_LINES } = options

  // Normalize whitespace first
  let result = normalizeWhitespace(output)
  let truncated = false
  let truncationType = ""

  // Check line limit first
  const lines = result.split("\n")
  if (lines.length > maxLines) {
    result = lines.slice(0, maxLines).join("\n")
    truncated = true
    truncationType = `${lines.length - maxLines} lines`
  }

  // Then check character limit
  if (result.length > maxChars) {
    result = result.slice(0, maxChars)
    truncated = true
    truncationType = truncationType
      ? `${truncationType}, ${output.length - maxChars} chars`
      : `${output.length - maxChars} chars`
  }

  if (truncated) {
    const suffix =
      options.suffix ?? `\n\n... truncated (${truncationType} omitted, limit: ${maxLines} lines / ${maxChars} chars)`
    result += suffix
  }

  return result
}
