/**
 * Text utilities for markdown, string manipulation, and formatting.
 */

/**
 * Truncate markdown text at a line boundary near `maxLen` chars.
 * Avoids cutting mid-tag or mid-word by snapping to the last newline.
 * Appends "..." if the text was truncated.
 */
export function truncateMarkdown(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text

  const chunk = text.slice(0, maxLen)
  const lastNewline = chunk.lastIndexOf("\n")
  // Snap to last newline if it's reasonably far in (>40% of maxLen)
  const cutPoint = lastNewline > maxLen * 0.4 ? lastNewline : maxLen
  return `${text.slice(0, cutPoint).trimEnd()}...`
}

/**
 * Format a byte count into a human-readable string (e.g. "1.5 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}
