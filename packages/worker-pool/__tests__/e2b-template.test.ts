import { E2B_TEMPLATES } from "@webalive/sandbox"
import { describe, expect, it } from "vitest"
import { isE2eWorkspaceHostname, resolveSandboxTemplate } from "../src/e2b-template"

describe("E2B template routing", () => {
  it("routes e2e worker hostnames to the minimal template", () => {
    expect(isE2eWorkspaceHostname("e2e-w0.alive.local")).toBe(true)
    expect(isE2eWorkspaceHostname("e2e-w12.alive.local")).toBe(true)
    expect(resolveSandboxTemplate("e2e-w12.alive.local")).toBe(E2B_TEMPLATES.ALIVE_E2E_MINIMAL)
  })

  it("keeps non-e2e hostnames on the default template", () => {
    expect(isE2eWorkspaceHostname("app.alive.best")).toBe(false)
    expect(isE2eWorkspaceHostname("customer.alive.best")).toBe(false)
    expect(resolveSandboxTemplate("app.alive.best")).toBe(E2B_TEMPLATES.ALIVE)
  })
})
