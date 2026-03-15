/**
 * new-site-lifecycle unit tests
 *
 * Tests the deploy payload builder — specifically that chatUrl
 * correctly encodes workspace and org query parameters.
 */
import { describe, expect, test } from "vitest"
import { buildNewSiteSuccessPayload } from "../new-site-lifecycle"

describe("buildNewSiteSuccessPayload", () => {
  test("includes org in chatUrl when orgId provided", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "my-site.alive.best",
      orgId: "org-123",
      executionMode: "systemd",
      message: "Site created",
    })

    expect(payload.chatUrl).toContain("org=org-123")
  })

  test("omits org from chatUrl when orgId undefined", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "my-site.alive.best",
      orgId: undefined,
      executionMode: "systemd",
      message: "Site created",
    })

    expect(payload.chatUrl).not.toContain("org=")
  })

  test("URL-encodes domain in chatUrl", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "site with spaces.alive.best",
      executionMode: "systemd",
      message: "Created",
    })

    // URLSearchParams encodes spaces as '+'
    expect(payload.chatUrl).not.toContain("site with spaces")
    expect(payload.chatUrl).toContain("wk=")
  })

  test("preserves all payload fields", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "test.alive.best",
      orgId: "org-abc",
      executionMode: "e2b",
      message: "Deployed successfully",
    })

    expect(payload.domain).toBe("test.alive.best")
    expect(payload.orgId).toBe("org-abc")
    expect(payload.executionMode).toBe("e2b")
    expect(payload.message).toBe("Deployed successfully")
    expect(payload.chatUrl).toBeDefined()
  })

  test("chatUrl starts with /chat?wk=", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "example.alive.best",
      executionMode: "systemd",
      message: "Done",
    })

    expect(payload.chatUrl).toMatch(/^\/chat\?wk=/)
  })

  test("chatUrl uses QUERY_KEYS.workspace for wk parameter", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "test.alive.best",
      executionMode: "systemd",
      message: "Created",
    })

    // The URL should use 'wk' as the workspace key (from QUERY_KEYS.workspace)
    const url = new URL(payload.chatUrl, "https://example.com")
    expect(url.searchParams.get("wk")).toBe("test.alive.best")
  })

  test("chatUrl uses QUERY_KEYS.org for org parameter", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "test.alive.best",
      orgId: "org-xyz",
      executionMode: "systemd",
      message: "Created",
    })

    const url = new URL(payload.chatUrl, "https://example.com")
    expect(url.searchParams.get("org")).toBe("org-xyz")
  })

  test("chatUrl with no orgId has only wk parameter", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "simple.alive.best",
      executionMode: "systemd",
      message: "Created",
    })

    const url = new URL(payload.chatUrl, "https://example.com")
    // Should have wk but not org
    expect(url.searchParams.has("wk")).toBe(true)
    expect(url.searchParams.has("org")).toBe(false)
  })

  test("domain with special URL characters is properly encoded", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "site&name=test.alive.best",
      executionMode: "systemd",
      message: "Created",
    })

    // Parse back and verify the domain round-trips correctly
    const url = new URL(payload.chatUrl, "https://example.com")
    expect(url.searchParams.get("wk")).toBe("site&name=test.alive.best")
  })
})
