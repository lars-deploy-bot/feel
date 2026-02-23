/**
 * Email message construction utilities
 *
 * Shared RFC 2822 message building used by all providers that need raw email format.
 */

interface RawEmailParams {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
}

function formatFromAddress(email: string): string {
  return `<${email}>`
}

/**
 * Build an RFC 2822 email and return it as a base64url-encoded string.
 * Used by Gmail (and potentially other providers that accept raw RFC 2822).
 */
export function createRawEmail(params: RawEmailParams): string {
  const { from, to, cc, bcc, subject, body } = params

  const headers = [
    `From: ${formatFromAddress(from)}`,
    `To: ${to.join(", ")}`,
    cc?.length ? `Cc: ${cc.join(", ")}` : null,
    bcc?.length ? `Bcc: ${bcc.join(", ")}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ]
    .filter(Boolean)
    .join("\r\n")

  return base64UrlEncode(headers)
}

/** Base64url encode a string (RFC 4648 §5, no padding) */
export function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
