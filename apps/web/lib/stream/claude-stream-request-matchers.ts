/**
 * Canonical stream endpoint paths and robust matchers for Playwright request/response filtering.
 *
 * Keeping this in one shared module prevents matcher drift across critical and live E2E suites.
 */
export const CLAUDE_STREAM_ENDPOINTS = {
  STREAM: "/api/claude/stream",
  RECONNECT: "/api/claude/stream/reconnect",
  CANCEL: "/api/claude/stream/cancel",
} as const

export type ClaudeStreamPathname = (typeof CLAUDE_STREAM_ENDPOINTS)["STREAM"]

export interface UrlMethodLike {
  method(): string
  url(): string
}

export interface ResponseLike {
  request(): UrlMethodLike
  url(): string
}

function parsePathname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).pathname
  } catch {
    return null
  }
}

export function isClaudeStreamPathname(pathname: string): pathname is ClaudeStreamPathname {
  return pathname === CLAUDE_STREAM_ENDPOINTS.STREAM
}

export function isClaudeStreamUrl(rawUrl: string): boolean {
  const pathname = parsePathname(rawUrl)
  return pathname !== null && isClaudeStreamPathname(pathname)
}

export function isClaudeStreamPostRequest(request: UrlMethodLike): boolean {
  return request.method() === "POST" && isClaudeStreamUrl(request.url())
}

export function isClaudeStreamPostResponse(response: ResponseLike): boolean {
  return isClaudeStreamPostRequest(response.request()) && isClaudeStreamUrl(response.url())
}
