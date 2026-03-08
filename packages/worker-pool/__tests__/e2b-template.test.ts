import { E2B_DEFAULT_TEMPLATE } from "@webalive/sandbox"
import { describe, expect, it } from "vitest"
import { isE2eWorkspaceHostname, resolveSandboxTemplate } from "../src/e2b-template"

describe("E2B template routing", () => {
  it("recognizes e2e worker hostnames", () => {
    expect(isE2eWorkspaceHostname("e2e-w0.alive.local")).toBe(true)
    expect(isE2eWorkspaceHostname("e2e-w12.alive.local")).toBe(true)
  })

  it("rejects non-e2e hostnames", () => {
    expect(isE2eWorkspaceHostname("app.alive.best")).toBe(false)
    expect(isE2eWorkspaceHostname("customer.alive.best")).toBe(false)
  })

  it("resolves all hostnames to the default template", () => {
    expect(resolveSandboxTemplate("e2e-w0.alive.local")).toBe(E2B_DEFAULT_TEMPLATE)
    expect(resolveSandboxTemplate("app.alive.best")).toBe(E2B_DEFAULT_TEMPLATE)
  })
})
