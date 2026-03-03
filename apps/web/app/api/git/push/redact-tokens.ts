/**
 * Redact tokens from error output to prevent credential leakage in logs.
 */
export function redactTokens(text: string): string {
  return (
    text
      // GitHub tokens: gho_*, ghp_*, ghs_*, ghu_*, github_pat_*
      .replace(/\b(gho_|ghp_|ghs_|ghu_|github_pat_)[A-Za-z0-9_]+/g, "[REDACTED]")
      // URL-embedded tokens: https://x-access-token:TOKEN@github.com/...
      .replace(/x-access-token:[^@\s]+@/gi, "x-access-token:[REDACTED]@")
  )
}
