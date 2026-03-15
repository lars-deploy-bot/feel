import { describe, expect, expectTypeOf, it } from "vitest"
import {
  CLAUDE_STREAM_ENDPOINTS,
  isClaudeStreamPathname,
  isClaudeStreamPostRequest,
  isClaudeStreamPostResponse,
  isClaudeStreamUrl,
  type ResponseLike,
  type UrlMethodLike,
} from "../claude-stream-request-matchers"

function createRequest(method: string, url: string): UrlMethodLike {
  return {
    method: () => method,
    url: () => url,
  }
}

function createResponse(request: UrlMethodLike, responseUrl: string): ResponseLike {
  return {
    request: () => request,
    url: () => responseUrl,
  }
}

describe("claude-stream-request-matchers", () => {
  it("keeps stream endpoint literals type-safe", () => {
    expectTypeOf(CLAUDE_STREAM_ENDPOINTS.STREAM).toEqualTypeOf<"/api/claude/stream">()
    expectTypeOf(CLAUDE_STREAM_ENDPOINTS.RECONNECT).toEqualTypeOf<"/api/claude/stream/reconnect">()
    expectTypeOf(CLAUDE_STREAM_ENDPOINTS.CANCEL).toEqualTypeOf<"/api/claude/stream/cancel">()
  })

  it("matches exact stream pathname only", () => {
    expect(isClaudeStreamPathname("/api/claude/stream")).toBe(true)
    expect(isClaudeStreamPathname("/api/claude/stream/reconnect")).toBe(false)
    expect(isClaudeStreamPathname("/api/claude/stream/cancel")).toBe(false)
  })

  it("matches stream URL with query params by pathname", () => {
    expect(isClaudeStreamUrl("https://terminal.test.example/api/claude/stream?requestId=abc")).toBe(true)
  })

  it("rejects stream-like URLs that are not the stream endpoint", () => {
    expect(isClaudeStreamUrl("https://terminal.test.example/api/claude/stream/reconnect")).toBe(false)
    expect(isClaudeStreamUrl("https://terminal.test.example/api/claude/stream/cancel")).toBe(false)
  })

  it("rejects invalid URLs safely", () => {
    expect(isClaudeStreamUrl("/api/claude/stream")).toBe(false)
  })

  it("matches only POST requests to exact stream endpoint", () => {
    expect(
      isClaudeStreamPostRequest(createRequest("POST", "https://terminal.test.example/api/claude/stream?x=1")),
    ).toBe(true)
    expect(isClaudeStreamPostRequest(createRequest("GET", "https://terminal.test.example/api/claude/stream"))).toBe(
      false,
    )
    expect(
      isClaudeStreamPostRequest(createRequest("POST", "https://terminal.test.example/api/claude/stream/reconnect")),
    ).toBe(false)
  })

  it("matches only responses linked to POST stream requests and stream response URL", () => {
    const postStreamRequest = createRequest("POST", "https://terminal.test.example/api/claude/stream")
    const getStreamRequest = createRequest("GET", "https://terminal.test.example/api/claude/stream")
    const postReconnectRequest = createRequest("POST", "https://terminal.test.example/api/claude/stream/reconnect")

    expect(
      isClaudeStreamPostResponse(
        createResponse(postStreamRequest, "https://terminal.test.example/api/claude/stream?requestId=abc"),
      ),
    ).toBe(true)

    expect(
      isClaudeStreamPostResponse(createResponse(getStreamRequest, "https://terminal.test.example/api/claude/stream")),
    ).toBe(false)

    expect(
      isClaudeStreamPostResponse(
        createResponse(postReconnectRequest, "https://terminal.test.example/api/claude/stream/reconnect"),
      ),
    ).toBe(false)
  })
})
