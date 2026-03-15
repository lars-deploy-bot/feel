/**
 * new-site-lifecycle tests
 *
 * Covers: buildNewSiteSuccessPayload includes orgId in chatUrl (I3, Bug A fix).
 */
import { describe, expect, it } from "vitest"
import { buildNewSiteSuccessPayload } from "../new-site-lifecycle"

describe("buildNewSiteSuccessPayload", () => {
  it("4.1 includes orgId in chatUrl when provided", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "new.alive.best",
      orgId: "org-B",
      executionMode: "systemd",
      message: "Site created",
    })

    expect(payload.chatUrl).toContain("wk=new.alive.best")
    expect(payload.chatUrl).toContain("org=org-B")
    expect(payload.chatUrl).toBe("/chat?wk=new.alive.best&org=org-B")
  })

  it("omits org param when orgId is undefined", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "new.alive.best",
      executionMode: "systemd",
      message: "Site created",
    })

    expect(payload.chatUrl).toContain("wk=new.alive.best")
    expect(payload.chatUrl).not.toContain("org=")
    expect(payload.chatUrl).toBe("/chat?wk=new.alive.best")
  })

  it("encodes special characters in domain and orgId", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "my site.alive.best",
      orgId: "org with spaces",
      executionMode: "e2b",
      message: "Created",
    })

    // URLSearchParams encodes spaces as '+' (application/x-www-form-urlencoded)
    expect(payload.chatUrl).toContain("wk=my+site.alive.best")
    expect(payload.chatUrl).toContain("org=org+with+spaces")
  })

  it("preserves all payload fields", () => {
    const payload = buildNewSiteSuccessPayload({
      domain: "test.alive.best",
      orgId: "org-1",
      executionMode: "e2b",
      message: "Done",
    })

    expect(payload.domain).toBe("test.alive.best")
    expect(payload.orgId).toBe("org-1")
    expect(payload.executionMode).toBe("e2b")
    expect(payload.message).toBe("Done")
  })
})
